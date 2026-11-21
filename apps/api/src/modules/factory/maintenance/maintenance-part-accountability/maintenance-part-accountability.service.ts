import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateMaintenancePartAccountabilityDto, UpdateMaintenancePartAccountabilityDto } from './dto/create-maintenance-part-accountability.dto';

const AUDIT_ENTITY = 'MaintenancePartAccountability';
const AUDIT_SCOPE = 'MAINTENANCE_PART_ACCOUNTABILITY';

@Injectable()
export class MaintenancePartAccountabilityService {
  constructor(private prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}

  private auditWriter(): AuditService {
    return this.audit ?? new AuditService(this.prisma);
  }

  private async auditWrite(
    userId: string | undefined,
    action: string,
    entityId: string | undefined,
    ctx: ActiveOperationalContext,
    previous: Record<string, unknown> | null,
    next: Record<string, unknown> | null,
    reason: string,
  ) {
    if (!userId) return;
    await this.auditWriter().log(userId, action, AUDIT_ENTITY, entityId, {
      schemaVersion: 1,
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      scope: AUDIT_SCOPE,
      actor: { userId },
      previous,
      next,
      reason,
    });
  }

  private snapshot(record: any) {
    if (!record) return null;
    return {
      maintenanceRequestId: record.maintenanceRequestId ?? null,
      requiredPartId: record.requiredPartId ?? null,
      sparePartId: record.sparePartId ?? null,
      maintenancePersonnelId: record.maintenancePersonnelId ?? null,
      machineId: record.machineId ?? null,
      machineComponentId: record.machineComponentId ?? null,
      quantity: record.quantity ?? null,
      reportedUsedQuantity: record.reportedUsedQuantity ?? null,
      returnedQuantity: record.returnedQuantity ?? null,
      status: record.status ?? null,
      accountabilityNote: record.accountabilityNote ?? null,
      reportedAt: record.reportedAt?.toISOString?.() ?? null,
      cancelledAt: record.cancelledAt?.toISOString?.() ?? null,
    };
  }

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

  private async assertRequestOwned(maintenanceRequestId: string, ctx: ActiveOperationalContext) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: maintenanceRequestId },
      include: { machine: { select: { companyId: true, branchId: true } } },
    });
    if (!request || !this.isMachineInScope(request.machine, ctx)) {
      throw new BadRequestException('Maintenance request not found or not in the active company/branch');
    }
    return request;
  }

  private async assertSparePartExists(sparePartId: string) {
    const part = await this.prisma.sparePart.findUnique({ where: { id: sparePartId } });
    if (!part) throw new BadRequestException('Spare part not found');
    return part;
  }

  private async assertPersonnelExists(maintenancePersonnelId: string) {
    const personnel = await this.prisma.maintenancePersonnel.findUnique({
      where: { id: maintenancePersonnelId },
    });
    if (!personnel) throw new BadRequestException('Maintenance personnel not found');
    return personnel;
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const record = await this.prisma.maintenancePartAccountability.findUnique({
      where: { id },
      include: {
        maintenanceRequest: {
          select: {
            id: true,
            requestNumber: true,
            title: true,
            status: true,
            machine: { select: { companyId: true, branchId: true } },
          },
        },
        requiredPart: true,
        sparePart: { select: { id: true, code: true, name: true, partNumber: true, category: true } },
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true, componentType: true } },
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            specialty: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!record || !this.isMachineInScope(record.maintenanceRequest.machine, ctx)) {
      throw new NotFoundException('Part accountability record not found');
    }
    return record;
  }

  async create(dto: CreateMaintenancePartAccountabilityDto, ctx: ActiveOperationalContext, userId?: string) {
    const request = await this.assertRequestOwned(dto.maintenanceRequestId, ctx);
    await this.assertSparePartExists(dto.sparePartId);
    await this.assertPersonnelExists(dto.maintenancePersonnelId);

    // Required parts are bound to their request: a part from another request
    // (or another tenant) must never be attached here.
    if (dto.requiredPartId) {
      const requiredPart = await this.prisma.maintenanceRequestRequiredPart.findUnique({
        where: { id: dto.requiredPartId },
      });
      if (!requiredPart || requiredPart.maintenanceRequestId !== request.id) {
        throw new BadRequestException('Required part must belong to the same maintenance request');
      }
    }

    const result = await this.prisma.maintenancePartAccountability.create({
      data: dto,
      include: {
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
        sparePart: { select: { id: true, code: true, name: true, partNumber: true } },
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    await this.auditWrite(userId, 'CREATE', result.id, ctx, null, this.snapshot(result), 'PART_ACCOUNTABILITY_ASSIGNED');
    return this.mapRecord(result);
  }

  async findAll(query: { page?: number; limit?: number; maintenanceRequestId?: string; sparePartId?: string; maintenancePersonnelId?: string; machineId?: string; status?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = { maintenanceRequest: { machine: this.machineScope(ctx) } };
    if (query.maintenanceRequestId) where.maintenanceRequest = { ...where.maintenanceRequest, id: query.maintenanceRequestId };
    if (query.machineId) where.maintenanceRequest = { ...where.maintenanceRequest, machine: { ...where.maintenanceRequest.machine, id: query.machineId } };
    if (query.sparePartId) where.sparePartId = query.sparePartId;
    if (query.maintenancePersonnelId) where.maintenancePersonnelId = query.maintenancePersonnelId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.maintenancePartAccountability.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
          requiredPart: { select: { id: true, quantity: true } },
          sparePart: { select: { id: true, code: true, name: true, partNumber: true } },
          machine: { select: { id: true, code: true, name: true } },
          machineComponent: { select: { id: true, code: true, name: true } },
          maintenancePersonnel: {
            select: {
              id: true,
              role: true,
              operationalPerson: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.maintenancePartAccountability.count({ where }),
    ]);
    return { data: data.map(r => this.mapRecord(r)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.mapRecord(await this.findOwned(id, ctx));
  }

  async update(id: string, dto: UpdateMaintenancePartAccountabilityDto, ctx: ActiveOperationalContext, userId?: string) {
    const before = await this.findOwned(id, ctx);
    const data: any = { ...dto };
    if (dto.reportedAt) data.reportedAt = new Date(dto.reportedAt);
    if (dto.cancelledAt) data.cancelledAt = new Date(dto.cancelledAt);
    const result = await this.prisma.maintenancePartAccountability.update({
      where: { id },
      data,
      include: {
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    await this.auditWrite(userId, 'UPDATE', id, ctx, this.snapshot(before), this.snapshot(result), 'PART_ACCOUNTABILITY_UPDATE');
    return this.mapRecord(result);
  }

  async remove(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const before = await this.findOwned(id, ctx);
    const cancelledAt = new Date();
    const updated = await this.prisma.maintenancePartAccountability.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt },
    });
    await this.auditWrite(userId, 'CANCEL', id, ctx, this.snapshot(before), {
      ...this.snapshot(before),
      status: 'CANCELLED',
      cancelledAt: cancelledAt.toISOString(),
    }, 'PART_ACCOUNTABILITY_CANCELLED');
    return updated;
  }

  private mapRecord(r: any) {
    return {
      ...r,
      maintenancePersonnel: {
        id: r.maintenancePersonnel.id,
        code: r.maintenancePersonnel.operationalPerson?.code ?? null,
        name: r.maintenancePersonnel.operationalPerson?.name ?? null,
        role: r.maintenancePersonnel.role,
        specialty: r.maintenancePersonnel.specialty,
      },
    };
  }
}
