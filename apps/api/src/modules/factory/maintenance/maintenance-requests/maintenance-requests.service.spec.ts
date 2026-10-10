import { MaintenanceRequestsService } from './maintenance-requests.service';

describe('MaintenanceRequestsService canonical errors and contract fixes', () => {
  let service: MaintenanceRequestsService;
  let prisma: any;
  let audit: any;
  let numbering: any;
  let notification: any;
  let sla: any;

  const ctx: any = { companyId: 'c1', branchId: 'b1' };
  const ownedMachine = { id: 'm1', companyId: 'c1', branchId: 'b1' };
  const foreignMachine = { id: 'm9', companyId: 'c2', branchId: 'b2' };

  const requestRecord = (overrides: any = {}) => ({
    id: 'r1',
    requestNumber: 'MR-0001',
    title: 'Fix pump',
    status: 'OPEN',
    machineId: 'm1',
    machine: ownedMachine,
    assignedToId: null,
    endDate: null,
    downtimeHours: null,
    deletedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: { findUnique: jest.fn() },
      machine: { findUnique: jest.fn() },
      productionLine: { findUnique: jest.fn() },
      operationType: { findUnique: jest.fn() },
      costCenter: { findUnique: jest.fn() },
      sparePart: { findUnique: jest.fn() },
      machineComponent: { findUnique: jest.fn() },
      maintenanceRequest: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      maintenanceRequestRequiredPart: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      maintenanceChecklistExecution: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      maintenanceChecklistExecutionItem: { count: jest.fn() },
      maintenanceSchedule: { findUnique: jest.fn() },
      maintenanceTask: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      maintenanceWorkOrder: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceRequestPartUsage: { findMany: jest.fn() },
      maintenanceRequestCostEntry: { findMany: jest.fn() },
      downtimeLog: { findMany: jest.fn(), aggregate: jest.fn() },
      attachment: { findMany: jest.fn() },
      auditLog: { findMany: jest.fn(), count: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn().mockResolvedValue({}) };
    prisma.maintenanceRequest.findFirst = jest.fn(args => prisma.maintenanceRequest.findUnique(args));
    prisma.downtimeLog.count = jest.fn().mockResolvedValue(0);
    prisma.$transaction = jest.fn(async cb => cb(prisma));
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('MR-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('MR-0001'),
    };
    notification = {
      notifyRequestCreated: jest.fn().mockResolvedValue(undefined),
      notifyRequestStarted: jest.fn().mockResolvedValue(undefined),
      notifyRequestCompleted: jest.fn().mockResolvedValue(undefined),
      notifyRequestClosed: jest.fn().mockResolvedValue(undefined),
      notifyRequestAssigned: jest.fn().mockResolvedValue(undefined),
    };
    sla = { createSlaState: jest.fn().mockResolvedValue(undefined), recalculateSla: jest.fn().mockResolvedValue(undefined) };
    service = new MaintenanceRequestsService(prisma, audit, numbering, notification, sla, { startOrReuseInTx: jest.fn().mockResolvedValue({ id: 'stop' }) } as any);
  });

  it('only OPEN requests can be started', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'IN_PROGRESS' }));
    await expect(service.start('r1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.onlyOpenCanStart' } });
  });

  it('only IN_PROGRESS requests can be completed', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    await expect(service.complete('r1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.onlyInProgressCanComplete' } });
  });

  it('complete is blocked while mandatory checklist items are pending', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'IN_PROGRESS' }));
    prisma.maintenanceChecklistExecution.findMany.mockResolvedValue([
      { id: 'e1', items: [{ id: 'i1', status: 'PENDING', checklistItem: { id: 'ci1', title: 'Oil check', isMandatory: true } }] },
    ]);
    const promise = service.complete('r1', 'u1', ctx);
    await expect(promise).rejects.toMatchObject({
      response: { messageKey: 'maintenance.mandatoryChecklistPending', params: { count: '1' } },
    });
  });

  it('only COMPLETED requests can be closed', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    await expect(service.close('r1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.closeRequiresCompleted', params: { status: 'OPEN' } } });
  });

  it('only OPEN or IN_PROGRESS requests can be cancelled', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'COMPLETED' }));
    await expect(service.cancel('r1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.onlyOpenInProgressCanCancel' } });
  });

  it('cannot update terminal requests', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'CLOSED' }));
    await expect(service.update('r1', { title: 'x' } as any, 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.requestClosedImmutable' },
    });
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'CANCELLED' }));
    await expect(service.update('r1', { title: 'x' } as any, 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.requestCancelledImmutable' },
    });
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'COMPLETED' }));
    await expect(service.update('r1', { title: 'x' } as any, 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.cannotUpdateTerminalRequest' },
    });
  });

  it('cannot delete an in-progress request', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'IN_PROGRESS' }));
    await expect(service.remove('r1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.cannotDeleteInProgressRequest' } });
  });

  it('rejects duplicate spare part in addRequiredPart', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord());
    prisma.sparePart.findUnique.mockResolvedValue({ id: 'sp1', status: 'ACTIVE' });
    prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue({ id: 'rp1', status: 'REQUESTED' });
    await expect(
      service.addRequiredPart('r1', { sparePartId: 'sp1', quantity: 1 } as any, 'u1', ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.sparePartAlreadyAddedToRequest' } });
  });

  it('rejects inactive spare part in addRequiredPart', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord());
    prisma.sparePart.findUnique.mockResolvedValue({ id: 'sp1', status: 'INACTIVE' });
    await expect(
      service.addRequiredPart('r1', { sparePartId: 'sp1', quantity: 1 } as any, 'u1', ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.inactiveSparePart' } });
  });

  it('getWorkflow returns superset shape with history', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'l1',
        action: 'CREATE',
        details: null,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        user: { id: 'u1', name: 'Admin' },
      },
    ]);
    const workflow: any = await service.getWorkflow('r1', ctx);
    expect(workflow.currentStatus).toBe('OPEN');
    expect(workflow.status).toBe('OPEN');
    expect(workflow.transitions).toContainEqual(
      expect.objectContaining({ action: 'start', fromStatus: 'OPEN', toStatus: 'IN_PROGRESS', permission: 'maintenance-request:start' }),
    );
    expect(workflow.transitions).toContainEqual(
      expect.objectContaining({ action: 'cancel', fromStatus: 'OPEN', toStatus: 'CANCELLED', permission: 'maintenance-request:cancel' }),
    );
    expect(workflow.history).toHaveLength(1);
    expect(workflow.history[0]).toMatchObject({ id: 'l1', action: 'CREATE', performedBy: { id: 'u1', name: 'Admin' } });
  });

  it('getPrintData returns web-friendly aliases', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord());
    prisma.maintenanceRequestPartUsage.findMany.mockResolvedValue([]);
    prisma.maintenanceRequestCostEntry.findMany.mockResolvedValue([]);
    prisma.maintenanceTask.findMany.mockResolvedValue([]);
    prisma.downtimeLog.findMany.mockResolvedValue([]);
    const print: any = await service.getPrintData('r1', ctx);
    expect(print.partsUsed).toEqual([]);
    expect(print.costEntries).toEqual([]);
    expect(print.downtimeLogs).toEqual([]);
    expect(print.tasks).toEqual([]);
  });

  it('getChecklists enriches executions with _count.items', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord());
    prisma.maintenanceChecklistExecution.findMany.mockResolvedValue([
      { id: 'e1', schedule: { id: 's1', title: 'Daily' }, completedBy: null, items: [{ id: 'i1' }, { id: 'i2' }] },
    ]);
    const list: any = await service.getChecklists('r1', ctx);
    expect(list[0]._count).toEqual({ items: 2 });
  });

  it('not found error uses canonical messageKey', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(null);
    await expect(service.findOne('r1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.requestNotFound' } });
  });

  it('cannot read a request whose machine belongs to another company (tenant isolation)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ machine: foreignMachine }));
    await expect(service.findOne('r1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.requestNotFound' } });
  });

  it('cannot start a request whose machine belongs to another company (tenant isolation)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN', machine: foreignMachine }));
    await expect(service.start('r1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.requestNotFound' } });
  });

  it('cannot add a required part to a request whose machine belongs to another company (tenant isolation)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ machine: foreignMachine }));
    await expect(
      service.addRequiredPart('r1', { sparePartId: 'sp1', quantity: 1 } as any, 'u1', ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.requestNotFound' } });
  });

  it('create runs createSlaState with the created request id on the normal path', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    prisma.$transaction = jest.fn(async (cb: any) => cb({
      maintenanceRequest: { create: jest.fn().mockResolvedValue(requestRecord({ id: 'r1' })) },
    }));
    const result: any = await service.create({ machineId: 'm1', title: 'Fix pump', priority: 'MEDIUM' } as any, { id: 'u1' } as any, ctx);
    expect(result.id).toBe('r1');
    expect(sla.createSlaState).toHaveBeenCalledWith('r1', ctx);
  });

  it('create still calls createSlaState even when notification fails', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    notification.notifyRequestCreated.mockRejectedValue(new Error('smtp down'));
    prisma.$transaction = jest.fn(async (cb: any) => cb({
      maintenanceRequest: { create: jest.fn().mockResolvedValue(requestRecord({ id: 'r1', assignedToId: 'u2' })) },
    }));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result: any = await service.create({ machineId: 'm1', title: 'Fix pump' } as any, { id: 'u1' } as any, ctx);
    expect(result.id).toBe('r1');
    expect(sla.createSlaState).toHaveBeenCalledWith('r1', ctx);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('notification failed'), 'smtp down');
    errorSpy.mockRestore();
  });

  it('create tolerates a createSlaState failure but surfaces it as a logged error, not silent', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    sla.createSlaState.mockRejectedValue(new Error('sla boom'));
    prisma.$transaction = jest.fn(async (cb: any) => cb({
      maintenanceRequest: { create: jest.fn().mockResolvedValue(requestRecord({ id: 'r1' })) },
    }));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result: any = await service.create({ machineId: 'm1', title: 'Fix pump' } as any, { id: 'u1' } as any, ctx);
    expect(result.id).toBe('r1');
    expect(sla.createSlaState).toHaveBeenCalledWith('r1', ctx);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('createSlaState failed'), 'sla boom');
    errorSpy.mockRestore();
  });

  // -- R2-B: generic update lifecycle/assignment/parts bypass is closed --

  it('generic update rejects lifecycle fields (status) with a canonical error', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    await expect(service.update('r1', { status: 'COMPLETED' } as any, 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.forbiddenRequestFieldUpdate' },
    });
  });

  it('generic update rejects assignment fields (assignedToId)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    await expect(service.update('r1', { assignedToId: 'u2' } as any, 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.forbiddenRequestFieldUpdate' },
    });
  });

  it('generic update rejects requiredParts replacement payload (R2-B F3 containment)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    await expect(service.update('r1', { requiredParts: [] } as any, 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.forbiddenRequestFieldUpdate' },
    });
  });

  it('update no longer deletes or recreates required parts on a header edit', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    prisma.maintenanceRequest.update.mockResolvedValue(requestRecord({ status: 'OPEN', title: 'Changed' }));
    const result: any = await service.update('r1', { title: 'Changed' } as any, 'u1', ctx);
    expect(result.title).toBe('Changed');
    const updateData = prisma.maintenanceRequest.update.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('requiredParts');
    expect(prisma.maintenanceRequestRequiredPart.deleteMany).toBeUndefined();
    expect(prisma.maintenanceRequestRequiredPart.findMany).not.toHaveBeenCalled();
  });

  // -- R2-B: emergency contract is server-enforced --

  it('normal create rejects EMERGENCY type (must use the dedicated emergency endpoint)', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    await expect(
      service.create({ machineId: 'm1', title: 'Fix pump', type: 'EMERGENCY' } as any, { id: 'u1' } as any, ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.emergencyTypeRequiresEmergencyEndpoint' } });
  });

  it('emergency create forces type EMERGENCY and priority HIGH regardless of DTO', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    const createSpy = jest.fn().mockResolvedValue(requestRecord({ id: 'r1', type: 'EMERGENCY', priority: 'HIGH' }));
    prisma.$transaction = jest.fn(async (cb: any) => cb({
      maintenanceRequest: { create: createSpy },
    }));
    prisma.downtimeLog.create = jest.fn().mockResolvedValue({});
    const result: any = await service.createEmergency(
      { machineId: 'm1', description: 'Fire', title: 'Fire', type: 'PREVENTIVE', priority: 'LOW' } as any,
      { id: 'u1' } as any,
      ctx,
    );
    const createData = createSpy.mock.calls[0][0].data;
    expect(createData.type).toBe('EMERGENCY');
    expect(createData.priority).toBe('HIGH');
    expect(createData.isEmergency).toBe(true);
    expect(result).toBeTruthy();
  });

  // -- R2-B: tenant-validated operational references --

  it('create rejects a production line from another company', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    prisma.productionLine.findUnique.mockResolvedValue({ id: 'pl9', companyId: 'c2', branchId: 'b1', status: 'ACTIVE', deletedAt: null });
    await expect(
      service.create({ machineId: 'm1', title: 't', productionLineId: 'pl9' } as any, { id: 'u1' } as any, ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.productionLineNotFound' } });
  });

  it('create rejects an inactive production line', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    prisma.productionLine.findUnique.mockResolvedValue({ id: 'pl1', companyId: 'c1', branchId: 'b1', status: 'INACTIVE', deletedAt: null });
    await expect(
      service.create({ machineId: 'm1', title: 't', productionLineId: 'pl1' } as any, { id: 'u1' } as any, ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.inactiveProductionLine' } });
  });

  it('create rejects a cost center from another branch', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    prisma.costCenter.findUnique.mockResolvedValue({ id: 'cc9', companyId: 'c1', branchId: 'b2', status: 'ACTIVE', deletedAt: null });
    await expect(
      service.create({ machineId: 'm1', title: 't', costCenterId: 'cc9' } as any, { id: 'u1' } as any, ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.costCenterNotFound' } });
  });

  it('create rejects an inactive operation type', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    prisma.operationType.findUnique.mockResolvedValue({ id: 'ot1', status: 'INACTIVE', deletedAt: null });
    await expect(
      service.create({ machineId: 'm1', title: 't', operationTypeId: 'ot1' } as any, { id: 'u1' } as any, ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.inactiveOperationType' } });
  });

  it('create rejects a machine component from another machine', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    prisma.machineComponent.findUnique.mockResolvedValue({ id: 'comp9', machineId: 'm9', machine: ownedMachine, status: 'ACTIVE', deletedAt: null });
    await expect(
      service.create({ machineId: 'm1', title: 't', machineComponentId: 'comp9' } as any, { id: 'u1' } as any, ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.machineComponentMachineMismatch' } });
  });

  it('assign rejects a user from another company (tenant isolation on assignment)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    prisma.user.findUnique.mockResolvedValue({ id: 'u9', companyId: 'c2', status: 'ACTIVE', deletedAt: null });
    await expect(service.assign('r1', 'u9', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.assignedUserCompanyMismatch' },
    });
  });

  it('assign rejects a user from another branch (tenant isolation on assignment)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    prisma.user.findUnique.mockResolvedValue({ id: 'u9', companyId: 'c1', branchId: 'b2', status: 'ACTIVE', deletedAt: null });
    await expect(service.assign('r1', 'u9', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.assignedUserBranchMismatch' },
    });
  });

  it('assign rejects an inactive user', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    prisma.user.findUnique.mockResolvedValue({ id: 'u9', companyId: 'c1', branchId: 'b1', status: 'INACTIVE', deletedAt: null });
    await expect(service.assign('r1', 'u9', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.assignedUserNotActive' },
    });
  });

  // -- R2-B: completion guards --

  it('complete is blocked while open tasks are pending', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'IN_PROGRESS' }));
    prisma.maintenanceTask.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    await expect(service.complete('r1', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.openTasksBlockCompletion', params: { count: '2' } },
    });
  });

  it('complete is blocked while required parts are unresolved', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'IN_PROGRESS' }));
    prisma.maintenanceRequestRequiredPart.findMany.mockResolvedValue([{ id: 'rp1' }]);
    await expect(service.complete('r1', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.unresolvedPartsBlockCompletion', params: { count: '1' } },
    });
  });

  it('complete is blocked while work orders are non-terminal', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'IN_PROGRESS' }));
    prisma.maintenanceWorkOrder.findMany.mockResolvedValue([{ id: 'w1' }]);
    await expect(service.complete('r1', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.openWorkOrdersBlockCompletion', params: { count: '1' } },
    });
  });

  it('complete passes when no blockers exist and syncs the machine', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'IN_PROGRESS' }));
    prisma.downtimeLog.aggregate.mockResolvedValue({ _sum: { durationMinutes: 30 } });
    const txUpdate = jest.fn().mockResolvedValue(requestRecord({ status: 'COMPLETED' }));
    const txMachine = jest.fn().mockResolvedValue({});
    const txCount = jest.fn().mockResolvedValue(0);
    prisma.$transaction = jest.fn(async (cb: any) => cb({
      maintenanceRequest: { findFirst: prisma.maintenanceRequest.findFirst, update: txUpdate, count: txCount },
      downtimeLog: prisma.downtimeLog,
      maintenanceTask: prisma.maintenanceTask,
      maintenanceRequestRequiredPart: prisma.maintenanceRequestRequiredPart,
      maintenanceWorkOrder: prisma.maintenanceWorkOrder,
      maintenanceChecklistExecution: prisma.maintenanceChecklistExecution,
      machine: { update: txMachine },
    }));
    const result: any = await service.complete('r1', 'u1', ctx);
    expect(result.status).toBe('COMPLETED');
    expect(txUpdate).toHaveBeenCalled();
    expect(txMachine).toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'u1', action: 'COMPLETE', entity: 'MaintenanceRequest', entityId: 'r1', details: expect.objectContaining({ newStatus: 'COMPLETED' }) }));
  });

  // -- R2-B: terminal request immutability for parts sub-resource --

  it('addRequiredPart is blocked on a CLOSED request (terminal immutability)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'CLOSED' }));
    await expect(
      service.addRequiredPart('r1', { sparePartId: 'sp1', quantity: 1 } as any, 'u1', ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.cannotUpdatePartsTerminalRequest' } });
  });

  it('cancelRequiredPart is blocked on a COMPLETED request (terminal immutability)', async () => {
    prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue({
      id: 'rp1',
      status: 'REQUESTED',
      maintenanceRequest: { status: 'COMPLETED', machine: ownedMachine },
    });
    await expect(service.cancelRequiredPart('rp1', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.cannotUpdatePartsTerminalRequest' },
    });
  });

  // -- R2-B: activity read re-verifies request ownership --

  it('getActivity rejects foreign requests before the audit log is read (tenant isolation)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ machine: foreignMachine }));
    await expect(service.getActivity('r1', {}, ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.requestNotFound' },
    });
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('getActivity reads audit logs only after proving ownership', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'CLOSED' }));
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'l1', action: 'CLOSE', createdAt: new Date(), user: { id: 'u1', name: 'A' } }]);
    prisma.auditLog.count.mockResolvedValue(1);
    const result: any = await service.getActivity('r1', {}, ctx);
    expect(result.meta.total).toBe(1);
  });

  // -- R2-B: workflow exposes reopen on CLOSED --

  it('getWorkflow exposes reopen for CLOSED requests', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'CLOSED' }));
    prisma.auditLog.findMany.mockResolvedValue([]);
    const workflow: any = await service.getWorkflow('r1', ctx);
    expect(workflow.transitions).toContainEqual(
      expect.objectContaining({ action: 'reopen', fromStatus: 'CLOSED', toStatus: 'OPEN', permission: 'maintenance-request:reopen' }),
    );
  });

  // -- R2-B: delete policy restricts removal to OPEN requests --

  it('remove rejects requests with execution history (CLOSED)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'CLOSED' }));
    await expect(service.remove('r1', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.onlyOpenRequestsCanBeDeleted' },
    });
  });

  it('remove allows OPEN requests and soft-deletes them', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    prisma.maintenanceRequest.update.mockResolvedValue(requestRecord({ status: 'OPEN', deletedAt: new Date() }));
    const result: any = await service.remove('r1', 'u1', ctx);
    expect(result.message).toContain('deleted');
    expect(prisma.maintenanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });

  // -- R2-C: request↔work-order coordination --

  it('cancel is blocked while a linked work order is PLANNED (anti-orphaning)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'IN_PROGRESS' }));
    prisma.maintenanceWorkOrder.findMany.mockResolvedValue([{ id: 'w1' }]);
    await expect(service.cancel('r1', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.activeWorkOrdersBlockCancel', params: { count: '1' } },
    });
    expect(prisma.maintenanceRequest.update).not.toHaveBeenCalled();
  });

  it('cancel is blocked while a linked work order is IN_PROGRESS', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'IN_PROGRESS' }));
    prisma.maintenanceWorkOrder.findMany.mockResolvedValue([{ id: 'w1' }, { id: 'w2' }]);
    await expect(service.cancel('r1', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.activeWorkOrdersBlockCancel', params: { count: '2' } },
    });
    expect(prisma.maintenanceRequest.update).not.toHaveBeenCalled();
  });

  it('cancel succeeds when linked work orders are only DRAFT/CANCELLED/COMPLETED (non-blocking)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    prisma.maintenanceWorkOrder.findMany.mockResolvedValue([]);
    prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
    prisma.maintenanceRequest.update.mockResolvedValue(requestRecord({ status: 'CANCELLED' }));

    const result: any = await service.cancel('r1', 'u1', ctx);
    expect(result.status).toBe('CANCELLED');
    expect(prisma.maintenanceWorkOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ requestId: 'r1', status: { in: ['PLANNED', 'IN_PROGRESS'] }, deletedAt: null }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith('u1', 'CANCEL', 'MaintenanceRequest', 'r1',
      expect.objectContaining({ newStatus: 'CANCELLED' }));
  });

  it('reopen audits linked work-order context and never mutates work orders', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'CLOSED' }));
    prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
    prisma.maintenanceRequest.update.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    prisma.maintenanceWorkOrder.findMany.mockResolvedValue([
      { id: 'w1', workOrderNumber: 'WO-0001', status: 'COMPLETED' },
    ]);

    const result: any = await service.reopen('r1', 'u1', ctx);
    expect(result.status).toBe('OPEN');
    expect(prisma.maintenanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'OPEN', endDate: null, downtimeHours: null } }),
    );
    expect(audit.log).toHaveBeenCalledWith('u1', 'REOPEN', 'MaintenanceRequest', 'r1',
      expect.objectContaining({
        oldStatus: 'CLOSED',
        newStatus: 'OPEN',
        linkedWorkOrders: [{ id: 'w1', workOrderNumber: 'WO-0001', status: 'COMPLETED' }],
      }),
    );
    expect((prisma.maintenanceWorkOrder as any).update).toBeUndefined();
  });

  it('reopen keeps linked work orders untouched (PLANNED survives a CANCELLED request reopen)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'CANCELLED' }));
    prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
    prisma.maintenanceRequest.update.mockResolvedValue(requestRecord({ status: 'OPEN' }));
    prisma.maintenanceWorkOrder.findMany.mockResolvedValue([
      { id: 'w1', workOrderNumber: 'WO-0001', status: 'PLANNED' },
    ]);

    await service.reopen('r1', 'u1', ctx);
    expect((prisma.maintenanceWorkOrder as any).update).toBeUndefined();
    expect(audit.log).toHaveBeenCalledWith('u1', 'REOPEN', 'MaintenanceRequest', 'r1',
      expect.objectContaining({
        linkedWorkOrders: [expect.objectContaining({ status: 'PLANNED' })],
      }));
  });

  // -- R2-D: required part lifecycle normalization --

  it('nested create request parts are born in DRAFT (F2/C dual-state defect closed)', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    const createSpy = jest.fn().mockResolvedValue(requestRecord({ id: 'r1' }));
    prisma.$transaction = jest.fn(async (cb: any) => cb({ maintenanceRequest: { create: createSpy } }));
    await service.create(
      { machineId: 'm1', title: 'Fix pump', requiredParts: [{ sparePartId: 'sp1', quantity: 1 }] } as any,
      { id: 'u1' } as any,
      ctx,
    );
    const data = createSpy.mock.calls[0][0].data;
    expect(data.requiredParts.create).toEqual([
      expect.objectContaining({ sparePartId: 'sp1', status: 'DRAFT' }),
    ]);
  });

  it('nested create rejects duplicate spare parts inside the payload with a canonical error', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    await expect(
      service.create(
        { machineId: 'm1', title: 'Fix pump', requiredParts: [{ sparePartId: 'sp1', quantity: 1 }, { sparePartId: 'sp1', quantity: 2 }] } as any,
        { id: 'u1' } as any,
        ctx,
      ),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.sparePartAlreadyAddedToRequest' } });
    expect(prisma.maintenanceRequest.create).not.toHaveBeenCalled();
  });

  it('addRequiredPart allows re-adding a spare part after a terminal CANCELLED line (DRAFT create)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord());
    prisma.sparePart.findUnique.mockResolvedValue({ id: 'sp1', status: 'ACTIVE' });
    prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue({ id: 'rp-cancelled', status: 'CANCELLED' });
    prisma.maintenanceRequestRequiredPart.create.mockResolvedValue({ id: 'rp-new', status: 'DRAFT' });

    const part: any = await service.addRequiredPart('r1', { sparePartId: 'sp1', quantity: 2 } as any, 'u1', ctx);
    expect(prisma.maintenanceRequestRequiredPart.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sparePartId: 'sp1', status: 'DRAFT' }) }),
    );
    expect(part.status).toBe('DRAFT');
  });

  it('updateRequiredPart rejects editing a REQUESTED line (FSM bypass closed)', async () => {
    prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue({
      id: 'rp1',
      status: 'REQUESTED',
      maintenanceRequest: { status: 'OPEN', machine: ownedMachine },
    });
    await expect(
      service.updateRequiredPart('rp1', { quantity: 9 } as any, 'u1', ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.partNotEditableInStatus', params: { status: 'REQUESTED' } } });
  });

  it('cancelRequiredPart rejects cancelling a USED part (terminal state)', async () => {
    prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue({
      id: 'rp1',
      status: 'USED',
      maintenanceRequest: { status: 'OPEN', machine: ownedMachine },
    });
    await expect(service.cancelRequiredPart('rp1', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.partTerminalCannotCancel', params: { status: 'USED' } },
    });
    expect(prisma.maintenanceRequestRequiredPart.update).not.toHaveBeenCalled();
  });

  it('cancelRequiredPart allows cancelling a DRAFT line and records the canceller', async () => {
    prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue({
      id: 'rp1',
      status: 'DRAFT',
      maintenanceRequest: { status: 'OPEN', machine: ownedMachine },
    });
    prisma.maintenanceRequestRequiredPart.update.mockResolvedValue({ id: 'rp1', status: 'CANCELLED' });
    const result: any = await service.cancelRequiredPart('rp1', 'u1', ctx);
    expect(prisma.maintenanceRequestRequiredPart.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED', cancelledByUserId: 'u1' }) }),
    );
    expect(result.status).toBe('CANCELLED');
    expect(audit.log).toHaveBeenCalledWith('u1', 'CANCEL', 'MaintenanceRequestRequiredPart', 'rp1',
      expect.objectContaining({ oldStatus: 'DRAFT' }));
  });
});
