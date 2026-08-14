import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateMaintenanceRequestCostDto } from './dto/create-maintenance-request-cost.dto';
import { UpdateMaintenanceRequestCostDto } from './dto/update-maintenance-request-cost.dto';

@Injectable()
export class MaintenanceRequestCostsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private isMachineInScope(
    machine: { companyId?: string | null; branchId?: string | null },
    ctx: ActiveOperationalContext,
  ): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private async assertRequestOwned(requestId: string, ctx: ActiveOperationalContext) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: { machine: { select: { companyId: true, branchId: true } } },
    });
    if (!request || !this.isMachineInScope(request.machine, ctx)) {
      throw new BadRequestException('Maintenance request not found or not in the active company/branch');
    }
    return request;
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const entry = await this.prisma.maintenanceRequestCostEntry.findUnique({
      where: { id },
      include: {
        request: {
          select: {
            id: true,
            requestNumber: true,
            title: true,
            machine: { select: { companyId: true, branchId: true } },
          },
        },
      },
    });
    if (!entry || !this.isMachineInScope(entry.request.machine, ctx)) {
      throw new NotFoundException('Cost entry not found');
    }
    return entry;
  }

  async create(dto: CreateMaintenanceRequestCostDto, userId: string, ctx: ActiveOperationalContext) {
    const request = await this.assertRequestOwned(dto.requestId, ctx);

    const data: any = { ...dto };
    if (dto.incurredAt) data.incurredAt = new Date(dto.incurredAt);

    const entry = await this.prisma.maintenanceRequestCostEntry.create({ data });
    await this.audit.log(userId, 'CREATE', 'MaintenanceRequestCostEntry', entry.id,
      { requestId: dto.requestId, requestNumber: request.requestNumber, type: dto.type, amount: dto.amount, companyId: ctx.companyId, branchId: ctx.branchId });
    return entry;
  }

  async findAll(query: { requestId?: string; type?: string }, ctx: ActiveOperationalContext) {
    const where: any = { request: { machine: this.machineScope(ctx) } };
    if (query.requestId) where.request = { ...where.request, id: query.requestId };
    if (query.type) where.type = query.type;

    return this.prisma.maintenanceRequestCostEntry.findMany({
      where,
      include: {
        request: { select: { id: true, requestNumber: true, title: true } },
      },
      orderBy: { incurredAt: 'desc' },
    });
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx);
  }

  async update(id: string, dto: UpdateMaintenanceRequestCostDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const data: any = { ...dto };
    if (dto.incurredAt) data.incurredAt = new Date(dto.incurredAt);

    const updated = await this.prisma.maintenanceRequestCostEntry.update({ where: { id }, data });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequestCostEntry', id, { dto, companyId: ctx.companyId, branchId: ctx.branchId });
    return updated;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    await this.prisma.maintenanceRequestCostEntry.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'MaintenanceRequestCostEntry', id, { companyId: ctx.companyId, branchId: ctx.branchId });
    return { message: 'Cost entry deleted successfully' };
  }
}
