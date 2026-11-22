import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { MaintenanceTechnicianAuthorityService } from './maintenance-technician-authority.service';

@Injectable()
export class WorkOrderAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly technicians: MaintenanceTechnicianAuthorityService,
  ) {}

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

  activeTeamInclude(ctx: ActiveOperationalContext) {
    return {
      technicianAssignments: {
        where: { ...this.scope(ctx), cancelledAt: null },
        orderBy: { assignedAt: 'asc' as const },
        select: {
          id: true,
          maintenancePersonnelId: true,
          assignedAt: true,
          notes: true,
          maintenancePersonnel: {
            select: {
              id: true,
              role: true,
              specialty: true,
              operationalPerson: { select: { code: true, name: true, user: { select: { id: true, name: true } } } },
            },
          },
        },
      },
    };
  }

  projectTeam<T extends { technicianAssignments?: any[] }>(order: T): T & { technicianPersonnelIds: string[]; activeTechnicians: any[] } {
    const activeTechnicians = (order.technicianAssignments || []).map((assignment: any) => ({
      id: assignment.maintenancePersonnel?.id ?? assignment.maintenancePersonnelId,
      assignmentId: assignment.id,
      code: assignment.maintenancePersonnel?.operationalPerson?.code ?? null,
      name: assignment.maintenancePersonnel?.operationalPerson?.name ?? null,
      role: assignment.maintenancePersonnel?.role ?? null,
      specialty: assignment.maintenancePersonnel?.specialty ?? null,
      userId: assignment.maintenancePersonnel?.operationalPerson?.user?.id ?? null,
      assignedAt: assignment.assignedAt,
      notes: assignment.notes ?? null,
    }));
    return {
      ...order,
      technicianPersonnelIds: activeTechnicians.map((technician: any) => technician.id),
      activeTechnicians,
    };
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

  async candidates(query: { page?: number; limit?: number; search?: string }, ctx: ActiveOperationalContext) {
    return this.technicians.candidates(query, ctx);
  }

  async candidate(maintenancePersonnelId: string, ctx: ActiveOperationalContext) {
    return this.technicians.candidate(maintenancePersonnelId, ctx);
  }

  async assign(workOrderId: string, input: { maintenancePersonnelId: string; notes?: string }, actorId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async tx => {
      await this.order(tx, workOrderId, ctx, true);
      const technician = await this.technicians.byPersonnel(input.maintenancePersonnelId, ctx, tx);
      if (!technician) throw new NotFoundException({ messageKey: 'maintenance.personnelNotFound' });
      return this.addOne(tx, workOrderId, technician.maintenancePersonnelId, actorId, ctx, { notes: input.notes, reason: 'WORK_ORDER_PLANNING_ASSIGNMENT' });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async addOne(
    tx: any,
    workOrderId: string,
    maintenancePersonnelId: string,
    actorId: string,
    ctx: ActiveOperationalContext,
    options: { notes?: string | null; reason: string },
  ) {
    const where = { workOrderId, maintenancePersonnelId, ...this.scope(ctx), cancelledAt: null as null };
    const duplicate = await tx.maintenanceWorkOrderAssignment.findFirst({ where });
    if (duplicate) throw new ConflictException({ messageKey: 'validation.duplicateValue' });
    const row = await tx.maintenanceWorkOrderAssignment.create({ data: { ...where, assignedById: actorId, notes: options.notes } });
    await this.audit.logWithClientBusiness(tx, {
      userId: actorId,
      action: 'ASSIGN',
      entity: 'MaintenanceWorkOrderAssignment',
      entityId: row.id,
      ...this.scope(ctx),
      previous: null,
      next: { workOrderId, maintenancePersonnelId, assignedAt: row.assignedAt },
      reason: options.reason,
      metadata: { operation: 'ADD', notes: options.notes ?? null },
    });
    return row;
  }

  private async endOne(
    tx: any,
    row: any,
    actorId: string,
    ctx: ActiveOperationalContext,
    reason: string,
  ) {
    const endedAt = new Date();
    const updated = await tx.maintenanceWorkOrderAssignment.updateMany({
      where: { id: row.id, companyId: ctx.companyId, branchId: ctx.branchId, cancelledAt: null },
      data: { cancelledAt: endedAt, cancelledById: actorId },
    });
    if (updated.count !== 1) throw new NotFoundException({ messageKey: 'maintenance.workOrderAssignmentNotFound' });
    await this.audit.logWithClientBusiness(tx, {
      userId: actorId,
      action: 'CANCEL_ASSIGNMENT',
      entity: 'MaintenanceWorkOrderAssignment',
      entityId: row.id,
      ...this.scope(ctx),
      previous: { maintenancePersonnelId: row.maintenancePersonnelId, cancelledAt: null },
      next: { maintenancePersonnelId: row.maintenancePersonnelId, cancelledAt: endedAt },
      reason,
      metadata: { operation: 'END' },
    });
    return updated;
  }

  /**
   * Reconciles the desired active team inside the caller's transaction.
   * Existing rows are ended with an audit trail; re-adding a technician later
   * creates a new current row and leaves the earlier history intact.
   */
  async reconcileWithClient(
    tx: any,
    workOrderId: string,
    technicianPersonnelIds: string[] | undefined,
    actorId: string,
    ctx: ActiveOperationalContext,
    reason = 'WORK_ORDER_TEAM_RECONCILED',
  ) {
    await this.order(tx, workOrderId, ctx, true);
    if (technicianPersonnelIds === undefined) return null;
    const desired = [...new Set(technicianPersonnelIds)];
    if (desired.length > 50) throw new BadRequestException({ messageKey: 'common.validationFailed' });

    const resolved: any[] = [];
    for (const personnelId of desired) {
      const technician = await this.technicians.byPersonnel(personnelId, ctx, tx);
      if (!technician) throw new NotFoundException({ messageKey: 'maintenance.personnelNotFound' });
      resolved.push(technician);
    }

    const current: any[] = await tx.maintenanceWorkOrderAssignment.findMany({
      where: { workOrderId, ...this.scope(ctx), cancelledAt: null },
      orderBy: { assignedAt: 'asc' },
    });
    const counts = new Map<string, number>();
    for (const row of current) counts.set(row.maintenancePersonnelId, (counts.get(row.maintenancePersonnelId) || 0) + 1);
    if ([...counts.values()].some(count => count > 1)) {
      throw new ConflictException({ messageKey: 'validation.duplicateValue' });
    }

    const currentIds = current.map(row => row.maintenancePersonnelId);
    const desiredIds = resolved.map(technician => technician.maintenancePersonnelId);
    const toKeep = desiredIds.filter(id => currentIds.includes(id));
    const toAdd = desiredIds.filter(id => !currentIds.includes(id));
    const toEnd = current.filter(row => !desiredIds.includes(row.maintenancePersonnelId));

    const keptRows = current.filter(row => desiredIds.includes(row.maintenancePersonnelId));
    for (const row of toEnd) await this.endOne(tx, row, actorId, ctx, reason);
    const addedRows: any[] = [];
    for (const personnelId of toAdd) {
      const row = await this.addOne(tx, workOrderId, personnelId, actorId, ctx, { reason, notes: null });
      addedRows.push(row);
    }

    const activeRows = [...keptRows, ...addedRows].sort((a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime());
    const activeTechnicians = activeRows.map(row => {
      const technician = resolved.find(item => item.maintenancePersonnelId === row.maintenancePersonnelId)!;
      return {
        id: technician.maintenancePersonnelId,
        assignmentId: row.id,
        code: technician.code,
        name: technician.name,
        role: technician.role,
        specialty: technician.specialty,
        placement: technician.placement ?? null,
        userId: technician.userId,
        assignedAt: row.assignedAt,
        notes: row.notes ?? null,
      };
    });
    return { toAdd, toKeep, toEnd: toEnd.map(row => row.id), technicianPersonnelIds: desiredIds, activeTechnicians };
  }

  async reconcile(
    workOrderId: string,
    dto: { technicianPersonnelIds: string[]; reason?: string },
    actorId: string,
    ctx: ActiveOperationalContext,
    reason = 'WORK_ORDER_TEAM_RECONCILED',
  ) {
    return this.prisma.$transaction(
      tx => this.reconcileWithClient(tx, workOrderId, dto.technicianPersonnelIds, actorId, ctx, dto.reason || reason),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async cancel(workOrderId: string, assignmentId: string, actorId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async tx => {
      await this.order(tx, workOrderId, ctx, true);
      const where = { id: assignmentId, workOrderId, ...this.scope(ctx) };
      const row = await tx.maintenanceWorkOrderAssignment.findFirst({ where });
      if (!row) throw new NotFoundException({ messageKey: 'maintenance.personnelNotFound' });
      if (row.cancelledAt) return row;
      return this.endOne(tx, row, actorId, ctx, 'WORK_ORDER_PLANNING_ASSIGNMENT_CANCELLED');
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
