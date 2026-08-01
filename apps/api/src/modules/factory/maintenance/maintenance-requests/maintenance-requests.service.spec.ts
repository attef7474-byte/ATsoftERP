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
      user: { findUnique: jest.fn() },
      machine: { findUnique: jest.fn() },
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
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      maintenanceChecklistExecution: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      maintenanceChecklistExecutionItem: { count: jest.fn() },
      maintenanceSchedule: { findUnique: jest.fn() },
      maintenanceTask: { findMany: jest.fn() },
      maintenanceRequestPartUsage: { findMany: jest.fn() },
      maintenanceRequestCostEntry: { findMany: jest.fn() },
      downtimeLog: { findMany: jest.fn(), aggregate: jest.fn() },
      attachment: { findMany: jest.fn() },
      auditLog: { findMany: jest.fn(), count: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('MR-0001') };
    notification = {
      notifyRequestCreated: jest.fn().mockResolvedValue(undefined),
      notifyRequestStarted: jest.fn().mockResolvedValue(undefined),
      notifyRequestCompleted: jest.fn().mockResolvedValue(undefined),
      notifyRequestClosed: jest.fn().mockResolvedValue(undefined),
      notifyRequestAssigned: jest.fn().mockResolvedValue(undefined),
    };
    sla = { createSlaState: jest.fn().mockResolvedValue(undefined), recalculateSla: jest.fn().mockResolvedValue(undefined) };
    service = new MaintenanceRequestsService(prisma, audit, numbering, notification, sla);
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
    await expect(service.close('r1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.onlyCompletedCanClose' } });
  });

  it('only OPEN or IN_PROGRESS requests can be cancelled', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'COMPLETED' }));
    await expect(service.cancel('r1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.onlyOpenInProgressCanCancel' } });
  });

  it('cannot update terminal requests', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(requestRecord({ status: 'CLOSED' }));
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
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.sparePartAlreadyAdded' } });
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
});
