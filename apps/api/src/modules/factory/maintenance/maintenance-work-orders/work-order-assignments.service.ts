import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { currentAssignmentWindow } from '../../../../common/operational-context/current-assignment-window';

@Injectable()
export class WorkOrderAssignmentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private scope(ctx: ActiveOperationalContext) {
    if (!ctx?.companyId || !ctx.branchId) throw new BadRequestException({ messageKey: 'common.validationFailed' });
    return { companyId: ctx.companyId, branchId: ctx.branchId };
  }

  private async order(tx: any, id: string, ctx: ActiveOperationalContext, write = false) {
    const scope = this.scope(ctx);
    if (write) await tx.$queryRaw(Prisma.sql`SELECT [id] FROM [dbo].[maintenance_work_orders] WITH (UPDLOCK,HOLDLOCK) WHERE [id]=${id} AND [companyId]=${scope.companyId} AND [branchId]=${scope.branchId}`);
    const order = await tx.maintenanceWorkOrder.findFirst({ where: { id, ...scope, deletedAt: null } });
    if (!order) throw new NotFoundException({ messageKey: 'maintenance.workOrderNotFound' });
    if (write && !['DRAFT', 'PLANNED', 'IN_PROGRESS'].includes(order.status)) {
      throw new BadRequestException({ messageKey: 'common.validationFailed', errors: [{ field: 'status', code: 'validation.invalidStatusTransition' }] });
    }
    return order;
  }

  async list(workOrderId: string, query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    await this.order(this.prisma, workOrderId, ctx);
    const page = Math.max(1, query.page || 1), limit = Math.min(100, Math.max(1, query.limit || 20));
    const where = { workOrderId, ...this.scope(ctx) };
    const [data, total] = await Promise.all([
      this.prisma.maintenanceWorkOrderAssignment.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
        include: { maintenancePersonnel: { select: { id: true, operationalPerson: { select: { code: true, name: true } } } } } }),
      this.prisma.maintenanceWorkOrderAssignment.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async assign(workOrderId: string, input: { maintenancePersonnelId: string; notes?: string }, actorId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async tx => {
      await this.order(tx, workOrderId, ctx, true);
      const personnel = await tx.maintenancePersonnel.findFirst({ where: { id: input.maintenancePersonnelId, isActive: true,
        operationalPerson: { isActive: true, assignments: { some: { ...this.scope(ctx), deletedAt: null, ...currentAssignmentWindow() } } } } });
      if (!personnel) throw new NotFoundException({ messageKey: 'maintenance.personnelNotFound' });
      const where = { workOrderId, maintenancePersonnelId: personnel.id, ...this.scope(ctx), cancelledAt: null };
      if (await tx.maintenanceWorkOrderAssignment.findFirst({ where })) throw new ConflictException({ messageKey: 'validation.duplicateValue' });
      const row = await tx.maintenanceWorkOrderAssignment.create({ data: { ...where, assignedById: actorId, notes: input.notes } });
      await this.audit.logWithClientBusiness(tx, { userId: actorId, action: 'ASSIGN', entity: 'MaintenanceWorkOrderAssignment', entityId: row.id,
        ...this.scope(ctx), previous: null, next: { workOrderId, maintenancePersonnelId: personnel.id }, reason: 'WORK_ORDER_PLANNING_ASSIGNMENT' });
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async cancel(workOrderId: string, assignmentId: string, actorId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async tx => {
      await this.order(tx, workOrderId, ctx, true);
      const where = { id: assignmentId, workOrderId, ...this.scope(ctx) };
      const row = await tx.maintenanceWorkOrderAssignment.findFirst({ where });
      if (!row) throw new NotFoundException({ messageKey: 'maintenance.personnelNotFound' });
      if (row.cancelledAt) return row;
      const updated = await tx.maintenanceWorkOrderAssignment.update({ where: { id: row.id }, data: { cancelledAt: new Date(), cancelledById: actorId } });
      await this.audit.logWithClientBusiness(tx, { userId: actorId, action: 'CANCEL_ASSIGNMENT', entity: 'MaintenanceWorkOrderAssignment', entityId: row.id,
        ...this.scope(ctx), previous: { maintenancePersonnelId: row.maintenancePersonnelId, cancelledAt: null }, next: { cancelledAt: updated.cancelledAt }, reason: 'WORK_ORDER_PLANNING_ASSIGNMENT_CANCELLED' });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
