import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateMaintenanceTaskDto } from './dto/create-maintenance-task.dto';
import { UpdateMaintenanceTaskDto } from './dto/update-maintenance-task.dto';
import { ExecutionStartDto, ExecutionJoinDto, ExecutionLeaveDto, ExecutionHandoffDto, ExecutionCompleteDto, ExecutionPartInputDto, RegisterHistoricalExecutionDto } from './dto/execution-action.dto';
import { assertExecutionSource, executionError, executionMetrics, resolveExecutionScope, EXECUTABLE_REQUEST_STATUSES, EXECUTABLE_WORK_ORDER_STATUSES } from './maintenance-execution-policy';
import { MaintenanceRequestsService } from '../maintenance-requests/maintenance-requests.service';
import { MaintenanceWorkOrdersService } from '../maintenance-work-orders/maintenance-work-orders.service';
import { MaintenanceStockIssueService } from '../maintenance-stock-issue/maintenance-stock-issue.service';
import { DowntimeLogsService } from '../downtime-logs/downtime-logs.service';

const person = { id: true, name: true };
const detail = {
  request: { include: { requestedBy: { select: person } } },
  workOrder: { include: { createdBy: { select: person }, parts: true } },
  assignedTo: { select: person }, createdBy: { select: person },
  machine: true, productionLine: true, machineComponent: true,
  sessions: { orderBy: { startedAt: 'asc' }, include: { technicianUser: { select: person }, handoffToUser: { select: person } } },
  partUsages: { orderBy: { usedAt: 'asc' }, include: { product: true, sparePart: true, recordedByUser: { select: person }, inventoryMovement: { select: { id: true, movementNumber: true } } } },
  downtimeLogs: { orderBy: { startTime: 'asc' } },
} as const;

@Injectable()
export class MaintenanceTasksService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private requests: MaintenanceRequestsService,
    private workOrders: MaintenanceWorkOrdersService,
    private stockIssue: MaintenanceStockIssueService,
    private downtime: DowntimeLogsService,
  ) {}

  private scope(ctx: ActiveOperationalContext) {
    if (!ctx?.companyId || !ctx?.branchId) throw executionError('maintenance.executionContextRequired');
    return { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] };
  }

  private async transaction<T>(action: (tx: any) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException({ messageKey: 'maintenance.executionActiveSessionConflict' });
      if (error?.code === 'P2034') throw new ConflictException({ messageKey: 'maintenance.executionConcurrentChange' });
      throw error;
    }
  }

  private async owned(client: any, id: string, ctx: ActiveOperationalContext, lock = false): Promise<any> {
    const scope = this.scope(ctx);
    if (lock) await client.$queryRaw(Prisma.sql([
      'SELECT [id] FROM [dbo].[maintenance_tasks] WITH (UPDLOCK, HOLDLOCK) WHERE [id] = ',
      ' AND [companyId] = ', ' AND ([branchId] = ', ' OR [branchId] IS NULL)',
    ], id, ctx.companyId, ctx.branchId));
    const execution = await client.maintenanceTask.findFirst({ where: { id, ...scope }, include: detail });
    if (!execution) throw new NotFoundException({ messageKey: 'maintenance.taskNotFound' });
    return (await this.withMetrics(client, [execution]))[0];
  }

  private async withMetrics(client: any, executions: any[], at = new Date()) {
    const requestIds = [...new Set(executions.map(task => task.requestId).filter(Boolean))];
    const requestLogs = requestIds.length ? await client.downtimeLog.findMany({
      where: { requestId: { in: requestIds } }, orderBy: { startTime: 'asc' },
    }) : [];
    return executions.map(task => {
      const logs = [...new Map([...(task.downtimeLogs || []),
        ...requestLogs.filter((log: any) => log.requestId === task.requestId && log.machineId === task.machineId),
      ].map((log: any) => [log.id, log])).values()];
      const execution = { ...task, downtimeLogs: logs };
      return { ...execution, metrics: executionMetrics(execution, at) };
    });
  }

  private auditInTx(tx: any, userId: string, action: string, task: any, extra: any = {}) {
    return this.audit.logWithClient(tx, { userId, action, entity: 'MaintenanceTask', entityId: task.id,
      details: { companyId: task.companyId, branchId: task.branchId, sourceType: task.sourceType, requestId: task.requestId, workOrderId: task.workOrderId, ...extra } });
  }

  private participantScope(ctx: ActiveOperationalContext) {
    this.scope(ctx);
    return { status: 'ACTIVE', deletedAt: null, OR: [
      { operationalScopes: { some: { companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null,
        AND: [{ OR: [{ administrationId: null }, { administrationId: ctx.administrationId || null }] },
          { OR: [{ departmentId: null }, { departmentId: ctx.departmentId || null }] }],
      } } },
      { companyId: ctx.companyId, branchId: ctx.branchId,
        operationalScopes: { none: { status: 'ACTIVE', deletedAt: null } },
        OR: [{ departmentId: null }, { departmentId: ctx.departmentId || null }],
      },
    ] };
  }

  async participants(query: { page?: number; limit?: number; search?: string }, ctx: ActiveOperationalContext, actorId?: string) {
    const page = Math.max(1, query.page || 1), limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = this.participantScope(ctx);
    if (actorId && ctx.source === 'SUPER_ADMIN') where.OR.push({ id: actorId,
      roles: { some: { role: { code: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null } } } });
    if (query.search) where.name = { contains: query.search };
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: person, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.user.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async participant(id: string, ctx: ActiveOperationalContext, actorId?: string) {
    const where: any = { id, ...this.participantScope(ctx) };
    if (id === actorId && ctx.source === 'SUPER_ADMIN') where.OR.push({ id: actorId,
      roles: { some: { role: { code: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null } } } });
    const user = await this.prisma.user.findFirst({ where, select: person });
    if (!user) throw new NotFoundException({ messageKey: 'maintenance.assignedUserNotFound' });
    return user;
  }

  private async validateParticipant(tx: any, id: string, ctx: ActiveOperationalContext, actorId: string) {
    let user = await tx.user.findFirst({ where: { id, ...this.participantScope(ctx) }, select: person });
    // A super administrator may participate personally in the explicitly selected context.
    if (!user && id === actorId && ctx.source === 'SUPER_ADMIN') {
      user = await tx.user.findFirst({ where: { id, status: 'ACTIVE', deletedAt: null, roles: { some: { role: { code: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null } } } }, select: person });
    }
    if (!user) throw new NotFoundException({ messageKey: 'maintenance.assignedUserNotFound' });
  }

  private async requirePermission(tx: any, userId: string, permission: string) {
    const roles = await tx.userRole.findMany({ where: { userId }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
    const allowed = roles.some((link: any) => link.role.status === 'ACTIVE' && !link.role.deletedAt
      && (link.role.code === 'SUPER_ADMIN' || link.role.permissions.some((p: any) => p.permission.key === permission && p.permission.status === 'ACTIVE')));
    if (!allowed) throw new ForbiddenException({ messageKey: 'common.forbidden' });
  }

  private async source(tx: any, input: any, ctx: ActiveOperationalContext, requireExecutable = true): Promise<any> {
    assertExecutionSource(input);
    if (input.sourceType === 'DIRECT') return input;
    const request = input.sourceType === 'MAINTENANCE_REQUEST';
    const id = request ? input.requestId : input.workOrderId;
    // Lock the common source before any sibling transition or completion.
    if (request) await tx.$queryRaw(Prisma.sql([
      'SELECT r.[id] FROM [dbo].[maintenance_requests] r WITH (UPDLOCK,HOLDLOCK) JOIN [dbo].[machines] m ON m.[id]=r.[machineId] WHERE r.[id]=',
      ' AND m.[companyId]=', ' AND (m.[branchId]=', ' OR m.[branchId] IS NULL)',
    ], id, ctx.companyId, ctx.branchId));
    else await tx.$queryRaw(Prisma.sql([
      'SELECT [id] FROM [dbo].[maintenance_work_orders] WITH (UPDLOCK,HOLDLOCK) WHERE [id]=',
      ' AND [companyId]=', ' AND [branchId]=', '',
    ], id, ctx.companyId, ctx.branchId));
    const record = request
      ? await tx.maintenanceRequest.findFirst({ where: { id, deletedAt: null, machine: this.scope(ctx) }, include: { machine: true } })
      : await tx.maintenanceWorkOrder.findFirst({ where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
    if (!record) throw new NotFoundException({ messageKey: request ? 'maintenance.requestNotFound' : 'maintenance.workOrderNotFound' });
    const statuses = request ? EXECUTABLE_REQUEST_STATUSES : EXECUTABLE_WORK_ORDER_STATUSES;
    if (requireExecutable && !statuses.includes(record.status)) throw executionError('maintenance.executionSourceNotEligible');
    if (input.id) {
      const scopeType = request ? 'MACHINE' : record.scopeType;
      if (input.scopeType !== scopeType || (input.machineId || null) !== (record.machineId || null)
        || (input.machineComponentId || null) !== (record.machineComponentId || null)
        || record.productionLineId && input.productionLineId !== record.productionLineId
        || record.costCenterId && input.costCenterId !== record.costCenterId) {
        throw executionError('maintenance.executionSourceImmutable');
      }
    }
    return { ...record, sourceType: input.sourceType, requestId: request ? id : null, workOrderId: request ? null : id,
      scopeType: request ? 'MACHINE' : record.scopeType };
  }

  private async createInTx(tx: any, dto: CreateMaintenanceTaskDto, userId: string, ctx: ActiveOperationalContext) {
    const sourceType = dto.sourceType ?? (dto.requestId ? 'MAINTENANCE_REQUEST' : dto.workOrderId ? 'WORK_ORDER' : 'DIRECT');
    const source = await this.source(tx, { ...dto, sourceType }, ctx);
    if (sourceType !== 'DIRECT') {
      for (const key of ['scopeType', 'machineId', 'productionLineId', 'machineComponentId', 'costCenterId'] as const) {
        if (dto[key] && dto[key] !== source[key]) throw executionError('maintenance.executionSourceContextMismatch');
      }
    }
    const scope = await resolveExecutionScope(tx, source, ctx);
    const assignedToId = dto.assignedToId || userId;
    await this.validateParticipant(tx, assignedToId, ctx, userId);
    const description = dto.description?.trim() || source.description?.trim() || dto.title?.trim();
    if (!description) throw executionError('maintenance.executionDescriptionRequired');
    const task = await tx.maintenanceTask.create({ data: {
      ...scope, sourceType, requestId: sourceType === 'MAINTENANCE_REQUEST' ? dto.requestId : null,
      workOrderId: sourceType === 'WORK_ORDER' ? dto.workOrderId : null,
      companyId: ctx.companyId, branchId: ctx.branchId, createdById: userId, assignedToId,
      description, title: description.slice(0, 160), notes: dto.notes, status: 'PENDING',
    } });
    await this.auditInTx(tx, userId, 'CREATE', task);
    return task;
  }

  async create(dto: CreateMaintenanceTaskDto, userId: string, ctx: ActiveOperationalContext) {
    return this.transaction(tx => this.createInTx(tx, dto, userId, ctx));
  }

  async findAll(query: { page?: number; limit?: number; search?: string; requestId?: string; workOrderId?: string; sourceType?: string; assignedToId?: string; status?: string; overdue?: boolean }, ctx: ActiveOperationalContext) {
    const page = Math.max(1, query.page || 1), limit = Math.min(100, Math.max(1, query.limit || 10));
    const where: any = { ...this.scope(ctx) };
    if (query.search) where.AND = [{ OR: [{ title: { contains: query.search } }, { description: { contains: query.search } }] }];
    for (const key of ['requestId', 'workOrderId', 'sourceType', 'assignedToId', 'status'] as const) if (query[key]) where[key] = query[key];
    if (query.overdue) Object.assign(where, { status: { in: ['PENDING', 'IN_PROGRESS'] }, request: { endDate: { lt: new Date() }, deletedAt: null } });
    const [data, total] = await Promise.all([
      this.prisma.maintenanceTask.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: detail }),
      this.prisma.maintenanceTask.count({ where }),
    ]);
    return { data: await this.withMetrics(this.prisma, data), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.owned(this.prisma, id, ctx);
  }

  async update(id: string, dto: UpdateMaintenanceTaskDto, userId: string, ctx: ActiveOperationalContext) {
    return this.transaction(async tx => {
      const task = await this.owned(tx, id, ctx, true);
      await this.source(tx, task, ctx);
      if (['DONE', 'CANCELLED'].includes(task.status)) throw executionError('maintenance.cannotUpdateTerminalTask');
      for (const key of ['sourceType', 'requestId', 'workOrderId', 'scopeType', 'machineId', 'productionLineId', 'machineComponentId', 'costCenterId'] as const) {
        if (dto[key] !== undefined && dto[key] !== task[key]) throw executionError('maintenance.executionSourceImmutable');
      }
      if (dto.assignedToId) await this.validateParticipant(tx, dto.assignedToId, ctx, userId);
      const description = dto.description === undefined ? task.description : dto.description.trim();
      if (!description) throw executionError('maintenance.executionDescriptionRequired');
      const updated = await tx.maintenanceTask.update({ where: { id }, data: {
        description, title: description.slice(0, 160), notes: dto.notes,
        assignedToId: dto.assignedToId, workLocation: dto.workLocation,
      } });
      await this.auditInTx(tx, userId, 'UPDATE', updated);
      return updated;
    });
  }

  private async beginSource(tx: any, task: any, userId: string, ctx: ActiveOperationalContext, at: Date) {
    if (task.requestId) await this.requests.startWithClient(tx, task.requestId, userId, ctx, at);
    if (task.workOrderId) await this.workOrders.startExecutionWithClient(tx, task.workOrderId, userId, ctx, at);
  }

  private async addSession(tx: any, task: any, technicianUserId: string, actorId: string, ctx: ActiveOperationalContext, startedAt: Date, endedAt?: Date, workPerformed?: string) {
    await this.validateParticipant(tx, technicianUserId, ctx, actorId);
    // User-row lock serializes current and retrospective overlap validation globally.
    await tx.$queryRaw(Prisma.sql(['SELECT [id] FROM [dbo].[users] WITH (UPDLOCK,HOLDLOCK) WHERE [id]=', ''], technicianUserId));
    const overlap = await tx.maintenanceExecutionSession.findFirst({ where: {
      technicianUserId, startedAt: { lt: endedAt ?? new Date('9999-12-31T23:59:59.999Z') },
      OR: [{ endedAt: null }, { endedAt: { gt: startedAt } }],
    }, select: { id: true } });
    if (overlap) throw new ConflictException({ messageKey: 'maintenance.executionActiveSessionConflict' });
    return tx.maintenanceExecutionSession.create({ data: { executionId: task.id, technicianUserId, startedAt,
      endedAt, endReason: endedAt ? 'COMPLETE' : null, workPerformed } });
  }

  async start(id: string, userId: string, ctx: ActiveOperationalContext, dto: ExecutionStartDto = {}) {
    const result = await this.transaction(async tx => {
      const task = await this.owned(tx, id, ctx, true);
      if (task.status !== 'PENDING') throw executionError('maintenance.onlyPendingCanStart');
      await this.source(tx, task, ctx);
      const at = new Date();
      await this.beginSource(tx, task, userId, ctx, at);
      const participants = dto.participantUserIds?.length ? [...new Set(dto.participantUserIds)] : [task.assignedToId || userId];
      for (const technician of participants.sort()) await this.addSession(tx, task, technician, userId, ctx, at);
      if (dto.machineStopped) {
        if (!task.machineId) throw executionError('maintenance.executionInvalidScope');
        await this.downtime.startOrReuseInTx(tx, { machineId: task.machineId, requestId: task.requestId, executionId: id, reason: task.description || task.title, startTime: at }, userId, ctx);
      }
      const updated = await tx.maintenanceTask.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: at } });
      await this.auditInTx(tx, userId, 'START', updated, { participantUserIds: participants, startedAt: at });
      return this.owned(tx, id, ctx);
    });
    if (result.requestId) await this.requests.notifyCommittedExecutionTransition(result.requestId, 'START', result.startedAt, ctx);
    return result;
  }

  async join(id: string, dto: ExecutionJoinDto, userId: string, ctx: ActiveOperationalContext) {
    return this.transaction(async tx => {
      const task = await this.owned(tx, id, ctx, true);
      if (task.status !== 'IN_PROGRESS') throw executionError('maintenance.onlyInProgressTaskCanComplete');
      await this.source(tx, task, ctx);
      const technician = dto.technicianUserId || userId;
      if (technician !== userId && task.assignedToId !== userId && task.createdById !== userId) await this.requirePermission(tx, userId, 'maintenance-task:assign');
      const session = await this.addSession(tx, task, technician, userId, ctx, new Date());
      await this.auditInTx(tx, userId, 'JOIN', task, { sessionId: session.id, technicianUserId: technician });
      return session;
    });
  }

  private async endParticipation(id: string, dto: ExecutionLeaveDto | ExecutionHandoffDto, userId: string, ctx: ActiveOperationalContext, handoff: boolean) {
    return this.transaction(async tx => {
      const task = await this.owned(tx, id, ctx, true);
      if (task.status !== 'IN_PROGRESS') throw executionError('maintenance.onlyInProgressTaskCanComplete');
      if (handoff && (!dto.workPerformed?.trim() || !dto.remainingWork?.trim())) throw executionError('maintenance.executionHandoffDetailsRequired');
      const session = await tx.maintenanceExecutionSession.findFirst({ where: { executionId: id, technicianUserId: userId, endedAt: null } });
      if (!session) throw executionError('maintenance.executionNoActiveParticipation');
      const successor = handoff ? (dto as ExecutionHandoffDto).handoffToUserId : undefined;
      if (successor) await this.validateParticipant(tx, successor, ctx, userId);
      const updated = await tx.maintenanceExecutionSession.update({ where: { id: session.id }, data: {
        endedAt: new Date(), endReason: handoff ? 'HANDOFF' : (dto as ExecutionLeaveDto).endReason || 'LEAVE',
        workPerformed: dto.workPerformed?.trim(), remainingWork: dto.remainingWork?.trim(), notes: dto.notes, handoffToUserId: successor,
      } });
      if (successor && task.assignedToId === userId) await tx.maintenanceTask.update({ where: { id }, data: { assignedToId: successor } });
      await this.auditInTx(tx, userId, handoff ? 'HANDOFF' : 'LEAVE', task, { sessionId: session.id, handoffToUserId: successor });
      return updated;
    });
  }

  leave(id: string, dto: ExecutionLeaveDto, userId: string, ctx: ActiveOperationalContext) { return this.endParticipation(id, dto, userId, ctx, false); }
  handoff(id: string, dto: ExecutionHandoffDto, userId: string, ctx: ActiveOperationalContext) { return this.endParticipation(id, dto, userId, ctx, true); }

  private fingerprint(input: ExecutionPartInputDto) {
    return createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.keys(input).sort().filter(key => (input as any)[key] !== undefined).map(key => [key, (input as any)[key]])))).digest('hex');
  }

  private async issuePartInTx(tx: any, task: any, input: ExecutionPartInputDto, userId: string, ctx: ActiveOperationalContext, usedAt: Date) {
    const requestFingerprint = this.fingerprint(input);
    const existing = await tx.maintenanceExecutionPartUsage.findUnique({ where: { executionId_clientRequestId: { executionId: task.id, clientRequestId: input.clientRequestId } } });
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) throw new ConflictException({ messageKey: 'maintenance.executionPartIdempotencyConflict' });
      return existing;
    }
    if (input.executionSessionId) {
      const session = await tx.maintenanceExecutionSession.findFirst({ where: { id: input.executionSessionId, executionId: task.id } });
      if (!session) throw new NotFoundException({ messageKey: 'maintenance.executionSessionNotFound' });
      if (session.startedAt > usedAt || session.endedAt && session.endedAt < usedAt) throw executionError('maintenance.executionPartSessionMismatch');
    }
    const issued = await this.stockIssue.issueExecutionPartInTx(tx, { ...input, executionId: task.id, requestId: task.requestId,
      workOrderId: task.workOrderId, machineId: task.machineId, machineComponentId: task.machineComponentId, productionLineId: task.productionLineId, costCenterId: task.costCenterId, usedAt }, userId, ctx);
    const usage = await tx.maintenanceExecutionPartUsage.create({ data: {
      executionId: task.id, executionSessionId: input.executionSessionId, clientRequestId: input.clientRequestId, requestFingerprint,
      sparePartId: issued.sparePartId, productId: issued.productId, quantity: input.quantity, usageType: input.usageType,
      inventoryMovementId: issued.movement.id, recordedByUserId: userId, usedAt, requiredPartId: issued.requiredPartId,
      workOrderPartId: issued.workOrderPartId, installedPartId: issued.installedPartId, replacementHistoryId: issued.replacementHistoryId, notes: input.notes,
    } });
    await this.auditInTx(tx, userId, 'PART_ISSUE', task, { partUsageId: usage.id, movementId: issued.movement.id });
    return usage;
  }

  async issuePart(id: string, input: ExecutionPartInputDto, userId: string, ctx: ActiveOperationalContext) {
    return this.transaction(async tx => {
      const task = await this.owned(tx, id, ctx, true);
      if (task.status !== 'IN_PROGRESS') throw executionError('maintenance.onlyInProgressTaskCanComplete');
      await this.source(tx, task, ctx);
      return this.issuePartInTx(tx, task, input, userId, ctx, new Date());
    });
  }

  async returnToService(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.transaction(async tx => {
      const task = await this.owned(tx, id, ctx, true);
      if (!task.machineId || task.status === 'CANCELLED') throw executionError('maintenance.executionInvalidScope');
      const log = await this.downtime.closeInTx(tx, { machineId: task.machineId, requestId: task.requestId, executionId: id, endTime: new Date() }, userId, ctx);
      await this.auditInTx(tx, userId, 'RETURN_TO_SERVICE', task, { downtimeLogId: log?.id });
      return log;
    });
  }

  private async finishSource(tx: any, task: any, userId: string, ctx: ActiveOperationalContext, at: Date) {
    if (task.sourceType === 'DIRECT') return;
    const siblings = await tx.maintenanceTask.count({ where: { id: { not: task.id }, ...(task.requestId ? { requestId: task.requestId } : { workOrderId: task.workOrderId }), status: { in: ['PENDING', 'IN_PROGRESS'] } } });
    // Only the final open execution completes its source; earlier completed executions retain their history.
    if (siblings) return;
    if (task.requestId) await this.requests.completeWithClient(tx, task.requestId, userId, ctx, at);
    if (task.workOrderId) await this.workOrders.completeWithClient(tx, task.workOrderId, { id: userId } as any, ctx, at);
  }

  private async completeInTx(tx: any, task: any, dto: ExecutionCompleteDto, userId: string, ctx: ActiveOperationalContext, at: Date) {
    if (task.status === 'DONE') {
      if (dto.parts?.length) throw executionError('maintenance.executionAlreadyCompleted');
      return { ...task, metrics: executionMetrics(task) };
    }
    if (task.status !== 'IN_PROGRESS') throw executionError('maintenance.onlyInProgressTaskCanComplete');
    await this.source(tx, task, ctx);
    const active = await tx.maintenanceExecutionSession.findMany({ where: { executionId: task.id, endedAt: null } });
    if (active.length > 1 && !dto.confirmEndParticipants) throw executionError('maintenance.executionConfirmTeamCompletion');
    if (!dto.workPerformed?.trim() && !task.sessions?.some((session: any) => session.workPerformed?.trim())) throw executionError('maintenance.executionWorkPerformedRequired');
    if (dto.parts?.length) {
      await this.requirePermission(tx, userId, 'maintenance-task:parts.issue');
      for (const input of dto.parts) await this.issuePartInTx(tx, task, input, userId, ctx, at);
    }
    if (dto.machineReturnedToService) {
      await this.requirePermission(tx, userId, 'maintenance-task:downtime.close');
      if (!task.machineId) throw executionError('maintenance.executionInvalidScope');
      await this.downtime.closeInTx(tx, { machineId: task.machineId, requestId: task.requestId, executionId: task.id, endTime: at }, userId, ctx);
    }
    await tx.maintenanceExecutionSession.updateMany({ where: { executionId: task.id, endedAt: null }, data: {
      endedAt: at, endReason: 'COMPLETE', ...(dto.workPerformed?.trim() ? { workPerformed: dto.workPerformed.trim() } : {}),
    } });
    const updated = await tx.maintenanceTask.update({ where: { id: task.id }, data: { status: 'DONE', completedAt: at, notes: dto.notes ?? task.notes } });
    await this.finishSource(tx, updated, userId, ctx, at);
    await this.auditInTx(tx, userId, 'COMPLETE', updated, { completedAt: at, endedSessionIds: active.map((session: any) => session.id), workPerformed: dto.workPerformed });
    const result = await this.owned(tx, task.id, ctx);
    return { ...result, metrics: executionMetrics(result, at) };
  }

  async complete(id: string, userId: string, ctx: ActiveOperationalContext, dto: ExecutionCompleteDto = {}) {
    const result = await this.transaction(async tx => this.completeInTx(tx, await this.owned(tx, id, ctx, true), dto, userId, ctx, new Date()));
    if (result.requestId) await this.requests.notifyCommittedExecutionTransition(result.requestId, 'COMPLETE', result.completedAt, ctx);
    return result;
  }

  async registerHistorical(dto: RegisterHistoricalExecutionDto, userId: string, ctx: ActiveOperationalContext) {
    const startedAt = new Date(dto.startedAt), completedAt = new Date(dto.completedAt), downtimeAt = dto.downtimeStartedAt ? new Date(dto.downtimeStartedAt) : null;
    if (!Number.isFinite(+startedAt) || !Number.isFinite(+completedAt) || +startedAt >= +completedAt || +completedAt > Date.now()
      || downtimeAt && (!Number.isFinite(+downtimeAt) || +downtimeAt > +completedAt)
      || !dto.participantUserIds?.length || !dto.workPerformed?.trim()) throw executionError('maintenance.executionInvalidChronology');
    return this.transaction(async tx => {
      const task = await this.createInTx(tx, dto, userId, ctx);
      await this.beginSource(tx, task, userId, ctx, startedAt);
      for (const technician of [...new Set(dto.participantUserIds)].sort()) await this.addSession(tx, task, technician, userId, ctx, startedAt, completedAt, dto.workPerformed.trim());
      if (downtimeAt) {
        if (!task.machineId || !dto.machineReturnedToService) throw executionError('maintenance.executionInvalidChronology');
        await this.downtime.startOrReuseInTx(tx, { machineId: task.machineId, requestId: task.requestId, executionId: task.id, reason: task.description || task.title, startTime: downtimeAt }, userId, ctx);
      }
      await tx.maintenanceTask.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS', startedAt } });
      const result = await this.completeInTx(tx, await this.owned(tx, task.id, ctx), { ...dto, confirmEndParticipants: true }, userId, ctx, completedAt);
      await this.auditInTx(tx, userId, 'REGISTER_HISTORICAL', result, { startedAt, completedAt });
      return result;
    });
  }

  async cancel(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.transaction(async tx => {
      const task = await this.owned(tx, id, ctx, true);
      if (!['PENDING', 'IN_PROGRESS'].includes(task.status)) throw executionError('maintenance.onlyPendingInProgressCanCancelTask');
      const at = new Date();
      await tx.maintenanceExecutionSession.updateMany({ where: { executionId: id, endedAt: null }, data: { endedAt: at, endReason: 'PAUSE' } });
      const updated = await tx.maintenanceTask.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: at } });
      await this.auditInTx(tx, userId, 'CANCEL', updated);
      return updated;
    });
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const task = await this.findOne(id, ctx);
    if (task.status !== 'PENDING') throw executionError('maintenance.executionHistoryCannotDelete');
    return this.cancel(id, userId, ctx);
  }

  myTasks(userId: string, query: { page?: number; limit?: number; status?: string }, ctx: ActiveOperationalContext) { return this.findAll({ ...query, assignedToId: userId }, ctx); }
  async byRequest(requestId: string, query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const request = await this.prisma.maintenanceRequest.findFirst({ where: { id: requestId, deletedAt: null, machine: this.scope(ctx) }, select: { id: true } });
    if (!request) throw new NotFoundException({ messageKey: 'maintenance.requestNotFound' });
    return this.findAll({ ...query, requestId }, ctx);
  }
  overdue(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) { return this.findAll({ ...query, overdue: true }, ctx); }
  assignTask(id: string, assignedToId: string, userId: string, ctx: ActiveOperationalContext) { return this.update(id, { assignedToId }, userId, ctx); }
}
