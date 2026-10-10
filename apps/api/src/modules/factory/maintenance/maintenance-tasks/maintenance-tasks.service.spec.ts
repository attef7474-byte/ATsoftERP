import { MaintenanceTasksService } from './maintenance-tasks.service';
import { assertExecutionSource, assertExecutionScope, executionMetrics, resolveExecutionScope } from './maintenance-execution-policy';

const ctx: any = { companyId: 'c1', branchId: 'b1', source: 'EXPLICIT_SCOPE' };
const actor = 'u1';
function fixture(extra: any = {}) {
  let task: any = { id: 't1', companyId: 'c1', branchId: 'b1', sourceType: 'DIRECT', scopeType: 'GENERAL',
    requestId: null, workOrderId: null, machineId: null, description: 'Repair work', title: 'Repair work',
    assignedToId: actor, createdById: actor, status: 'PENDING', sessions: [], partUsages: [], downtimeLogs: [], ...(extra.sourceType === 'MAINTENANCE_REQUEST' ? { scopeType: 'MACHINE', machineId: 'm1', productionLineId: 'l1' } : {}), ...extra };
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: { findFirst: jest.fn().mockImplementation(async ({ where }: any) => ['u1', 'u2', 'u3'].includes(where.id) ? { id: where.id, name: where.id } : null) },
    userRole: { findMany: jest.fn().mockResolvedValue([{ role: { code: 'SUPER_ADMIN', status: 'ACTIVE', permissions: [] } }]) },
    machine: { findFirst: jest.fn().mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: 'l1' }) },
    productionLine: { findFirst: jest.fn().mockResolvedValue({ id: 'l1' }) },
    maintenanceRequest: { findFirst: jest.fn().mockResolvedValue({ id: 'r1', status: 'OPEN', machineId: 'm1', productionLineId: 'l1', description: 'Request work', machine: { companyId: 'c1', branchId: 'b1' } }) },
    maintenanceWorkOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', status: 'DRAFT', scopeType: 'GENERAL', description: 'Order work' }) },
    maintenanceTask: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => where.companyId === task.companyId && (task.branchId == null || where.OR.some((b: any) => b.branchId === task.branchId)) ? task : null),
      create: jest.fn().mockImplementation(async ({ data }: any) => { task = { ...task, ...data }; return task; }),
      update: jest.fn().mockImplementation(async ({ data }: any) => { task = { ...task, ...data }; return task; }),
      count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]),
    },
    maintenanceExecutionSession: {
      findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }: any) => { const session = { id: 's' + (task.sessions.length + 1), ...data }; task.sessions.push(session); return session; }),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 's1', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    maintenanceExecutionPartUsage: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'usage', ...data })) },
    downtimeLog: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = { ...tx, $transaction: jest.fn(async (fn: any) => fn(tx)) };
  const audit: any = { logWithClient: jest.fn().mockResolvedValue({}) };
  const requests: any = { startWithClient: jest.fn(), completeWithClient: jest.fn(), notifyCommittedExecutionTransition: jest.fn() };
  const orders: any = { startExecutionWithClient: jest.fn(), completeWithClient: jest.fn() };
  const stock: any = { issueExecutionPartInTx: jest.fn().mockResolvedValue({ movement: { id: 'movement' }, productId: 'p1' }) };
  const downtime: any = { startOrReuseInTx: jest.fn(), closeInTx: jest.fn().mockResolvedValue({ id: 'd1' }) };
  return { service: new MaintenanceTasksService(prisma as any, audit, requests, orders, stock, downtime), prisma, tx, audit, requests, orders, stock, downtime, task: () => task };
}

describe('maintenance execution source and scope contracts', () => {
  it.each([
    { sourceType: 'DIRECT' }, { sourceType: 'MAINTENANCE_REQUEST', requestId: 'r1' }, { sourceType: 'WORK_ORDER', workOrderId: 'w1' },
  ])('accepts exactly one legitimate source: %o', source => expect(() => assertExecutionSource(source)).not.toThrow());
  it.each([
    { sourceType: 'DIRECT', requestId: 'r1' }, { sourceType: 'WORK_ORDER' }, { sourceType: 'MAINTENANCE_REQUEST' },
    { sourceType: 'WORK_ORDER', requestId: 'r1', workOrderId: 'w1' }, { sourceType: 'OTHER' },
  ])('rejects invalid source: %o', source => expect(() => assertExecutionSource(source)).toThrow());
  it.each([
    { scopeType: 'GENERAL' }, { scopeType: 'PRODUCTION_LINE', productionLineId: 'l1' }, { scopeType: 'MACHINE', machineId: 'm1' },
  ])('accepts legitimate scope: %o', scope => expect(() => assertExecutionScope(scope)).not.toThrow());
  it.each([
    { scopeType: 'GENERAL', machineId: 'm1' }, { scopeType: 'PRODUCTION_LINE', productionLineId: 'l1', machineComponentId: 'comp' }, { scopeType: 'MACHINE' },
  ])('rejects invalid scope: %o', scope => expect(() => assertExecutionScope(scope)).toThrow());
  it('rejects same-context machine outside selected line, including an unassigned machine', async () => {
    const f = fixture(); f.tx.machine.findFirst.mockResolvedValue({ id: 'm1', productionLineId: null });
    await expect(resolveExecutionScope(f.tx, { scopeType: 'MACHINE', machineId: 'm1', productionLineId: 'l1' }, ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.productionLineMachineMismatch' } });
  });
});

describe('MaintenanceTasksService execution orchestration', () => {
  it('creates DIRECT GENERAL without fake parents and records authenticated creator and tenant', async () => {
    const f = fixture(); await f.service.create({ sourceType: 'DIRECT', scopeType: 'GENERAL', description: 'General repair' }, actor, ctx);
    expect(f.tx.maintenanceTask.create).toHaveBeenCalledWith({ data: expect.objectContaining({ requestId: null, workOrderId: null, machineId: null, companyId: 'c1', branchId: 'b1', createdById: actor, title: 'General repair' }) });
    expect(f.audit.logWithClient.mock.calls[0][0]).toBe(f.tx);
  });
  it.each(['COMPLETED', 'CANCELLED', 'CLOSED'])('rejects new executions on terminal request %s', async status => {
    const f = fixture(); f.tx.maintenanceRequest.findFirst.mockResolvedValue({ status });
    await expect(f.service.create({ requestId: 'r1' }, actor, ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.executionSourceNotEligible' } });
    expect(f.tx.maintenanceTask.create).not.toHaveBeenCalled();
  });
  it('cannot update or assign work against a closed request', async () => {
    const f = fixture({ sourceType: 'MAINTENANCE_REQUEST', requestId: 'r1' });
    f.tx.maintenanceRequest.findFirst.mockResolvedValue({ status: 'CLOSED' });
    await expect(f.service.assignTask('t1', 'u2', actor, ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.executionSourceNotEligible' } });
    expect(f.tx.maintenanceTask.update).not.toHaveBeenCalled();
  });
  it.each(['findOne', 'start', 'complete', 'cancel'])('foreign execution is 404 for %s', async method => {
    const f = fixture({ companyId: 'c2', branchId: 'b2' });
    const action = method === 'findOne' ? f.service.findOne('t1', ctx) : (f.service as any)[method]('t1', actor, ctx);
    await expect(action).rejects.toMatchObject({ response: { messageKey: 'maintenance.taskNotFound' } });
    expect(f.tx.maintenanceTask.update).not.toHaveBeenCalled();
    expect(f.stock.issueExecutionPartInTx).not.toHaveBeenCalled();
  });
  it('foreign source is 404 and is queried with tenant ownership', async () => {
    const f = fixture(); f.tx.maintenanceRequest.findFirst.mockResolvedValue(null);
    await expect(f.service.create({ requestId: 'foreign' }, actor, ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.requestNotFound' } });
    expect(f.tx.maintenanceRequest.findFirst.mock.calls[0][0].where.machine.companyId).toBe('c1');
  });
  it('terminal task cannot update, delete, start or cancel', async () => {
    const f = fixture({ status: 'DONE' });
    await expect(f.service.update('t1', { description: 'x' }, actor, ctx)).rejects.toThrow();
    await expect(f.service.remove('t1', actor, ctx)).rejects.toThrow();
    await expect(f.service.start('t1', actor, ctx)).rejects.toThrow();
    await expect(f.service.cancel('t1', actor, ctx)).rejects.toThrow();
    expect(f.tx.maintenanceTask.update).not.toHaveBeenCalled();
  });
  it('rejects changed source context before sessions or source transitions', async () => {
    const f = fixture({ sourceType: 'MAINTENANCE_REQUEST', requestId: 'r1' });
    f.tx.maintenanceRequest.findFirst.mockResolvedValue({ status: 'OPEN', machineId: 'm2', productionLineId: 'l1' });
    await expect(f.service.start('t1', actor, ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.executionSourceImmutable' } });
    expect(f.tx.maintenanceExecutionSession.create).not.toHaveBeenCalled();
    expect(f.requests.startWithClient).not.toHaveBeenCalled();
  });
  it('requires IN_PROGRESS before completion', async () => {
    const f = fixture(); await expect(f.service.complete('t1', actor, ctx, { workPerformed: 'Done' })).rejects.toThrow();
  });
  it('requires a scoped active engineer', async () => {
    const f = fixture(); await expect(f.service.assignTask('t1', 'foreign-user', actor, ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.assignedUserNotFound' } });
  });
  it('starts two engineers using one shared start timestamp and one transaction', async () => {
    const f = fixture(); await f.service.start('t1', actor, ctx, { participantUserIds: ['u1', 'u2'] });
    const sessions = f.tx.maintenanceExecutionSession.create.mock.calls.map((call: any) => call[0].data);
    expect(sessions).toHaveLength(2); expect(sessions[0].startedAt).toEqual(sessions[1].startedAt);
    expect(f.task().startedAt).toEqual(sessions[0].startedAt);
    expect(f.downtime.closeInTx).not.toHaveBeenCalled();
  });
  it('rejects one engineer joining overlapping work', async () => {
    const f = fixture({ status: 'IN_PROGRESS' }); f.tx.maintenanceExecutionSession.findFirst.mockResolvedValue({ id: 'other-session' });
    await expect(f.service.join('t1', {}, actor, ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.executionActiveSessionConflict' } });
    expect(f.tx.maintenanceExecutionSession.create).not.toHaveBeenCalled();
  });
  it('handoff ends only the actor session and does not start successor or finish source/downtime', async () => {
    const f = fixture({ status: 'IN_PROGRESS' }); f.tx.maintenanceExecutionSession.findFirst.mockResolvedValue({ id: 's1' });
    await f.service.handoff('t1', { workPerformed: 'Motor removed', remainingWork: 'Install motor', handoffToUserId: 'u2' }, actor, ctx);
    expect(f.tx.maintenanceExecutionSession.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: expect.objectContaining({ endReason: 'HANDOFF', handoffToUserId: 'u2' }) });
    expect(f.tx.maintenanceExecutionSession.create).not.toHaveBeenCalled();
    expect(f.requests.completeWithClient).not.toHaveBeenCalled(); expect(f.orders.completeWithClient).not.toHaveBeenCalled(); expect(f.downtime.closeInTx).not.toHaveBeenCalled();
    expect(f.task().status).toBe('IN_PROGRESS');
  });
  it('requires handoff work and remaining work', async () => {
    const f = fixture({ status: 'IN_PROGRESS' }); await expect(f.service.handoff('t1', { workPerformed: ' ', remainingWork: 'next' }, actor, ctx)).rejects.toThrow();
  });
  it('leaving does not end any other participant', async () => {
    const f = fixture({ status: 'IN_PROGRESS' }); f.tx.maintenanceExecutionSession.findFirst.mockResolvedValue({ id: 'own' });
    await f.service.leave('t1', { endReason: 'PAUSE' }, actor, ctx);
    expect(f.tx.maintenanceExecutionSession.update).toHaveBeenCalledWith({ where: { id: 'own' }, data: expect.objectContaining({ endReason: 'PAUSE' }) });
    expect(f.tx.maintenanceExecutionSession.updateMany).not.toHaveBeenCalled();
  });
  it('team completion requires explicit confirmation', async () => {
    const f = fixture({ status: 'IN_PROGRESS' }); f.tx.maintenanceExecutionSession.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
    await expect(f.service.complete('t1', actor, ctx, { workPerformed: 'done' })).rejects.toMatchObject({ response: { messageKey: 'maintenance.executionConfirmTeamCompletion' } });
    expect(f.tx.maintenanceTask.update).not.toHaveBeenCalled();
  });
  it('team completion uses exactly one timestamp for sessions, execution and canonical source', async () => {
    const f = fixture({ status: 'IN_PROGRESS', sourceType: 'WORK_ORDER', workOrderId: 'w1' });
    f.tx.maintenanceWorkOrder.findFirst.mockResolvedValue({ status: 'IN_PROGRESS', scopeType: 'GENERAL', machineId: null, machineComponentId: null });
    f.tx.maintenanceExecutionSession.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
    await f.service.complete('t1', actor, ctx, { workPerformed: 'done', confirmEndParticipants: true });
    const end = f.tx.maintenanceExecutionSession.updateMany.mock.calls[0][0].data.endedAt;
    expect(f.task().completedAt).toEqual(end);
    expect(f.orders.completeWithClient).toHaveBeenCalledWith(f.tx, 'w1', { id: actor }, ctx, end);
  });
  it('completing an earlier sibling retains open source until the final execution', async () => {
    const f = fixture({ status: 'IN_PROGRESS', sourceType: 'MAINTENANCE_REQUEST', requestId: 'r1' }); f.tx.maintenanceTask.count.mockResolvedValue(1);
    await f.service.complete('t1', actor, ctx, { workPerformed: 'done' });
    expect(f.task().status).toBe('DONE'); expect(f.requests.completeWithClient).not.toHaveBeenCalled();
  });
  it('DIRECT completion does not invent or complete a source document', async () => {
    const f = fixture({ status: 'IN_PROGRESS' }); await f.service.complete('t1', actor, ctx, { workPerformed: 'done' });
    expect(f.requests.completeWithClient).not.toHaveBeenCalled(); expect(f.orders.completeWithClient).not.toHaveBeenCalled();
  });
  it('permission cannot be bypassed by embedding parts in completion', async () => {
    const f = fixture({ status: 'IN_PROGRESS' }); f.tx.userRole.findMany.mockResolvedValue([]);
    await expect(f.service.complete('t1', actor, ctx, { workPerformed: 'done', parts: [{ clientRequestId: 'key', productId: 'p1', warehouseId: 'wh', quantity: 1, usageType: 'CONSUMED' }] })).rejects.toMatchObject({ status: 403 });
    expect(f.stock.issueExecutionPartInTx).not.toHaveBeenCalled(); expect(f.tx.maintenanceTask.update).not.toHaveBeenCalled();
  });
  it('permission cannot be bypassed by embedding return-to-service in completion', async () => {
    const f = fixture({ status: 'IN_PROGRESS', machineId: 'm1' }); f.tx.userRole.findMany.mockResolvedValue([]);
    await expect(f.service.complete('t1', actor, ctx, { workPerformed: 'done', machineReturnedToService: true })).rejects.toMatchObject({ status: 403 });
    expect(f.downtime.closeInTx).not.toHaveBeenCalled();
  });
  it('identical part retry returns original usage without another stock issue', async () => {
    const f = fixture({ status: 'IN_PROGRESS' });
    const input: any = { clientRequestId: 'key', productId: 'p1', warehouseId: 'wh', quantity: 1, usageType: 'CONSUMED' };
    const first = await f.service.issuePart('t1', input, actor, ctx);
    f.tx.maintenanceExecutionPartUsage.findUnique.mockResolvedValue(first);
    expect(await f.service.issuePart('t1', input, actor, ctx)).toBe(first);
    expect(f.stock.issueExecutionPartInTx).toHaveBeenCalledTimes(1);
    await expect(f.service.issuePart('t1', { ...input, quantity: 2 }, actor, ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.executionPartIdempotencyConflict' } });
  });
  it('source completion failure rejects the same outer transaction after usage/session mutations', async () => {
    const f = fixture({ status: 'IN_PROGRESS', sourceType: 'WORK_ORDER', workOrderId: 'w1' }); f.orders.completeWithClient.mockRejectedValue(new Error('late ledger failure'));
    await expect(f.service.complete('t1', actor, ctx, { workPerformed: 'done' })).rejects.toThrow('late ledger failure');
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(f.orders.completeWithClient.mock.calls[0][0]).toBe(f.tx);
  });
  it('rejects impossible historical chronology before any mutation', async () => {
    const f = fixture();
    await expect(f.service.registerHistorical({ sourceType: 'DIRECT', scopeType: 'GENERAL', description: 'work', startedAt: '2026-10-08T10:00Z', completedAt: '2026-10-08T08:00Z', participantUserIds: ['u1'], workPerformed: 'done' }, actor, ctx)).rejects.toThrow();
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('historical participation uses the same global overlap guard', async () => {
    const f = fixture(); f.tx.maintenanceExecutionSession.findFirst.mockResolvedValue({ id: 'overlap' });
    await expect(f.service.registerHistorical({ sourceType: 'DIRECT', scopeType: 'GENERAL', description: 'work', startedAt: '2026-10-01T08:00Z', completedAt: '2026-10-01T09:00Z', participantUserIds: ['u1'], workPerformed: 'done' }, actor, ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.executionActiveSessionConflict' } });
  });
  it('calculates summed labor independently of elapsed time and machine downtime', () => {
    const result = executionMetrics({ status: 'DONE', startedAt: '2026-10-01T08:00Z', completedAt: '2026-10-01T10:00Z',
      sessions: [{ startedAt: '2026-10-01T08:00Z', endedAt: '2026-10-01T10:00Z' }, { startedAt: '2026-10-01T09:00Z', endedAt: '2026-10-01T10:00Z' }],
      downtimeLogs: [{ machineStopped: true, startTime: '2026-10-01T07:00Z', endTime: '2026-10-01T09:00Z' }] });
    expect(result).toEqual({ elapsedMinutes: 120, totalLaborMinutes: 180, downtimeMinutes: 120, waitingForContinuation: false });
  });
});
