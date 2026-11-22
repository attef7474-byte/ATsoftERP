import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { MaintenanceTechnicianAuthorityService } from '../maintenance-work-orders/maintenance-technician-authority.service';

export type ChecklistStartSource = 'SCHEDULE' | 'REQUEST' | 'DIRECT';

export interface StartChecklistParams {
  scheduleId: string;
  requestId?: string | null;
  notes?: string | null;
  /** Authenticated actor. Never supplied from a request body. */
  userId: string;
  ctx: ActiveOperationalContext;
  source: ChecklistStartSource;
  auditAction?: string;
}

const TERMINAL_REQUEST_STATUSES = ['COMPLETED', 'CANCELLED', 'CLOSED'];

/**
 * The single canonical authority for starting a maintenance checklist
 * execution. Every public entry point (schedule execute, checklist-execution
 * create, request checklist) delegates here so starter identity, active
 * execution uniqueness, snapshots and authorization are enforced identically.
 */
@Injectable()
export class MaintenanceChecklistStartAuthorityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private machineOwns(machine: { companyId?: string | null; branchId?: string | null } | undefined, ctx: ActiveOperationalContext): boolean {
    return !!machine
      && machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private scopeWhere(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] };
  }

  private async validateSource(tx: any, params: StartChecklistParams) {
    if (!params?.scheduleId) {
      throw new BadRequestException({ messageKey: 'maintenance.scheduleRequired', message: 'Schedule is required' });
    }
    const schedule = await tx.maintenanceSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { machine: { select: { id: true, companyId: true, branchId: true } } },
    });
    if (!this.machineOwns(schedule?.machine, params.ctx)) {
      throw new NotFoundException({ messageKey: 'maintenance.scheduleNotFound', message: 'Maintenance schedule not found' });
    }
    let request: any = null;
    if (params.requestId) {
      request = await tx.maintenanceRequest.findFirst({
        where: { id: params.requestId, deletedAt: null, machine: this.scopeWhere(params.ctx) },
        select: { id: true, machineId: true, status: true, requestedById: true, assignedToId: true },
      });
      if (!request) throw new NotFoundException({ messageKey: 'maintenance.requestNotFound', message: 'Maintenance request not found' });
      if (request.machineId !== schedule.machineId) {
        throw new BadRequestException({ messageKey: 'maintenance.requestMachineMismatch', message: 'Maintenance request does not belong to the selected schedule machine' });
      }
      if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
        throw new BadRequestException({ messageKey: 'maintenance.cannotAddChecklistTerminalRequest', message: 'Cannot add checklist executions to completed, cancelled, or closed requests' });
      }
    }
    return { schedule, request };
  }

  private async hasPermission(tx: any, userId: string, permission: string): Promise<boolean> {
    const roles = await tx.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    return roles.some((link: any) => link.role.status === 'ACTIVE' && !link.role.deletedAt
      && (link.role.code === 'SUPER_ADMIN'
        || link.role.permissions.some((p: any) => p.permission.key === permission && p.permission.status === 'ACTIVE')));
  }

  /** Reuses the Phase 5/6 canonical work-order team membership derivation. */
  private async isActiveTeamMember(tx: any, requestId: string, maintenancePersonnelId: string, ctx: ActiveOperationalContext): Promise<boolean> {
    const workOrders = await tx.maintenanceWorkOrder.findMany({
      where: { requestId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      select: { id: true },
    });
    if (!workOrders.length) return false;
    const assignment = await tx.maintenanceWorkOrderAssignment.findFirst({
      where: {
        workOrderId: { in: workOrders.map((workOrder: any) => workOrder.id) },
        maintenancePersonnelId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        cancelledAt: null,
      },
      select: { id: true },
    });
    return !!assignment;
  }

  private async assertActor(tx: any, params: StartChecklistParams, request: any): Promise<void> {
    if (!params.userId) throw new ForbiddenException({ messageKey: 'common.forbidden' });
    // Same Prisma/transaction client keeps the canonical chain inside the lock.
    const technicians = new MaintenanceTechnicianAuthorityService(tx as PrismaService);
    const technician = await technicians.byUser(params.userId, params.ctx, tx);
    if (!technician) {
      throw new ForbiddenException({
        messageKey: 'maintenance.checklistStartNotAuthorized',
        message: 'The authenticated user is not an active maintenance technician in this company and branch',
      });
    }
    // Elevated planner/supervisor capability reuses the Phase 5/6 assignment permission.
    if (await this.hasPermission(tx, params.userId, 'maintenance-task:assign')) return;
    // Preventive schedule-only starts require the canonical chain above.
    if (!request) return;
    // Request-linked checklists additionally reuse team/execution authority.
    if (request.requestedById === params.userId || request.assignedToId === params.userId) return;
    if (await this.isActiveTeamMember(tx, request.id, technician.maintenancePersonnelId, params.ctx)) return;
    throw new ForbiddenException({ messageKey: 'maintenance.checklistStartNotAuthorized', message: 'Not authorized to start this checklist' });
  }

  private async writeAudit(tx: any, params: StartChecklistParams, executionId: string): Promise<void> {
    const details = {
      scheduleId: params.scheduleId,
      requestId: params.requestId ?? null,
      source: params.source,
      startedById: params.userId,
      executionId,
    };
    const logWithClient = (this.audit as any).logWithClient;
    if (typeof logWithClient === 'function') {
      await logWithClient.call(this.audit, tx, {
        userId: params.userId,
        action: params.auditAction ?? 'START',
        entity: 'MaintenanceChecklistExecution',
        entityId: executionId,
        details,
      });
      return;
    }
    await this.audit.log(params.userId, params.auditAction ?? 'START', 'MaintenanceChecklistExecution', executionId, details);
  }

  async start(params: StartChecklistParams) {
    const execution = await this.prisma.$transaction(async (tx: any) => {
      // Serialize concurrent starts on the in-scope schedule row.
      await tx.$queryRaw(Prisma.sql([
        'SELECT s.[id] FROM [dbo].[maintenance_schedules] s WITH (UPDLOCK, HOLDLOCK) JOIN [dbo].[machines] m ON m.[id] = s.[machineId] WHERE s.[id] = ',
        ' AND m.[companyId] = ',
        ' AND (m.[branchId] = ',
        ' OR m.[branchId] IS NULL)',
      ], params.scheduleId, params.ctx.companyId, params.ctx.branchId));

      const { request } = await this.validateSource(tx, params);
      await this.assertActor(tx, params, request);

      const activeWhere: any = { status: 'IN_PROGRESS', OR: [{ scheduleId: params.scheduleId }] };
      if (params.requestId) activeWhere.OR.push({ requestId: params.requestId });
      const active = await tx.maintenanceChecklistExecution.findFirst({
        where: activeWhere,
        select: { id: true },
      });
      if (active) {
        throw new ConflictException({
          messageKey: 'maintenance.duplicateActiveChecklistExecution',
          message: 'An active checklist execution already exists for this schedule or request.',
          params: { executionId: active.id },
        });
      }

      // Snapshot only active current template items. Historical snapshots are
      // immutable: edits and retirements after this point never touch them.
      const items = await tx.maintenanceChecklistItem.findMany({
        where: { scheduleId: params.scheduleId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });

      const created = await tx.maintenanceChecklistExecution.create({
        data: {
          scheduleId: params.scheduleId,
          requestId: params.requestId || undefined,
          notes: params.notes ?? undefined,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          startedById: params.userId,
          completedById: null,
          completedAt: null,
          items: {
            create: items.map((item: any) => ({
              checklistItemId: item.id,
              status: 'PENDING',
              itemTitleSnapshot: item.title,
              itemSortOrderSnapshot: item.sortOrder,
              itemMandatorySnapshot: item.isMandatory,
              resultTypeSnapshot: item.resultType,
              minValueSnapshot: item.minValue ?? null,
              maxValueSnapshot: item.maxValue ?? null,
              unitSnapshot: item.unit ?? null,
            })),
          },
        },
        include: { items: { orderBy: { itemSortOrderSnapshot: 'asc' } } },
      });
      await this.writeAudit(tx, params, created.id);
      return created;
    }, { maxWait: 5000, timeout: 10000 });
    return execution;
  }
}
