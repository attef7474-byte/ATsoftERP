import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateMaintenanceRequestPartDto } from './dto/create-maintenance-request-part.dto';
import { UpdateMaintenanceRequestPartDto } from './dto/update-maintenance-request-part.dto';

@Injectable()
export class MaintenanceRequestPartsService {
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
    const part = await this.prisma.maintenanceRequestPartUsage.findUnique({
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
        product: { select: { id: true, name: true, code: true, unit: true } },
      },
    });
    if (!part || !this.isMachineInScope(part.request.machine, ctx)) {
      throw new NotFoundException('Part usage not found');
    }
    return part;
  }

  async create(dto: CreateMaintenanceRequestPartDto, userId: string, ctx: ActiveOperationalContext) {
    const request = await this.assertRequestOwned(dto.requestId, ctx);

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const data: any = { ...dto };
    if (dto.unitCost && dto.quantity) {
      data.totalCost = dto.unitCost * dto.quantity;
    }

    const part = await this.prisma.maintenanceRequestPartUsage.create({ data });
    await this.audit.log(userId, 'CREATE', 'MaintenanceRequestPartUsage', part.id,
      { requestId: dto.requestId, requestNumber: request.requestNumber, productId: dto.productId, quantity: dto.quantity, companyId: ctx.companyId, branchId: ctx.branchId });
    return part;
  }

  async findAll(query: { requestId?: string; productId?: string }, ctx: ActiveOperationalContext) {
    const where: any = { request: { machine: this.machineScope(ctx) } };
    if (query.requestId) where.request = { ...where.request, id: query.requestId };
    if (query.productId) where.productId = query.productId;

    return this.prisma.maintenanceRequestPartUsage.findMany({
      where,
      include: {
        request: { select: { id: true, requestNumber: true, title: true } },
        product: { select: { id: true, name: true, code: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx);
  }

  async update(id: string, dto: UpdateMaintenanceRequestPartDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const data: any = { ...dto };
    const qty = dto.quantity ?? undefined;
    const cost = dto.unitCost ?? undefined;
    if (cost !== undefined && qty !== undefined) {
      data.totalCost = cost * qty;
    } else if (cost !== undefined && qty === undefined) {
      const existing = await this.prisma.maintenanceRequestPartUsage.findUnique({ where: { id } });
      if (existing) data.totalCost = cost * existing.quantity;
    }

    const updated = await this.prisma.maintenanceRequestPartUsage.update({ where: { id }, data });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequestPartUsage', id, { dto, companyId: ctx.companyId, branchId: ctx.branchId });
    return updated;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    await this.prisma.maintenanceRequestPartUsage.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'MaintenanceRequestPartUsage', id, { companyId: ctx.companyId, branchId: ctx.branchId });
    return { message: 'Part usage deleted successfully' };
  }
}
