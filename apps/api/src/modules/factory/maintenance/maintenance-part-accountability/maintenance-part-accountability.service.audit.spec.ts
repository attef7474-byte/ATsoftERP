import { MaintenancePartAccountabilityService } from './maintenance-part-accountability.service';

/** Phase 6 audit coverage: part-accountability writes are actor and tenant scoped. */
describe('Phase 6 audit coverage: MaintenancePartAccountabilityService', () => {
  const ctx = { companyId: 'C1', branchId: 'B1' } as any;
  const machine = { companyId: 'C1', branchId: 'B1' };
  const record = {
    id: 'pa-1',
    maintenanceRequestId: 'req-1',
    requiredPartId: 'rp-1',
    sparePartId: 'sp-1',
    maintenancePersonnelId: 'p-1',
    quantity: 2,
    reportedUsedQuantity: null,
    returnedQuantity: null,
    status: 'ASSIGNED',
    accountabilityNote: null,
    reportedAt: null,
    cancelledAt: null,
    maintenanceRequest: { id: 'req-1', requestNumber: 'MR-1', title: 'Fix', status: 'OPEN', machine },
    requiredPart: { id: 'rp-1', quantity: 2 },
    sparePart: { id: 'sp-1', code: 'SP1', name: 'Part', partNumber: null, category: null },
    machine: { id: 'm-1', code: 'M1', name: 'Machine' },
    machineComponent: null,
    maintenancePersonnel: { id: 'p-1', role: 'ENGINEER', specialty: null, operationalPerson: { id: 'op-1', code: 'OP1', name: 'Person' } },
  };

  function build() {
    const prisma: any = {
      maintenanceRequest: { findUnique: jest.fn().mockResolvedValue({ id: 'req-1', machine }) },
      sparePart: { findUnique: jest.fn().mockResolvedValue({ id: 'sp-1' }) },
      maintenancePersonnel: { findUnique: jest.fn().mockResolvedValue({ id: 'p-1' }) },
      maintenanceRequestRequiredPart: { findUnique: jest.fn().mockResolvedValue({ id: 'rp-1', maintenanceRequestId: 'req-1' }) },
      maintenancePartAccountability: {
        findUnique: jest.fn().mockResolvedValue(record),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...data, ...record, id: 'pa-new' })),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ ...record, ...data, id: where.id })),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue({}) };
    return { prisma, audit, service: new MaintenancePartAccountabilityService(prisma, audit as any) };
  }

  afterEach(() => jest.clearAllMocks());

  it('CREATE records actor, tenant scope and the assigned part snapshot', async () => {
    const { audit, service } = build();

    await service.create({
      maintenanceRequestId: 'req-1',
      requiredPartId: 'rp-1',
      sparePartId: 'sp-1',
      maintenancePersonnelId: 'p-1',
      quantity: 2,
    } as any, ctx, 'actor-1');

    expect(audit.log).toHaveBeenCalledTimes(1);
    const [userId, action, entity, entityId, details] = audit.log.mock.calls[0];
    expect(userId).toBe('actor-1');
    expect(action).toBe('CREATE');
    expect(entity).toBe('MaintenancePartAccountability');
    expect(entityId).toBe('pa-new');
    expect(details).toMatchObject({
      schemaVersion: 1,
      companyId: 'C1',
      branchId: 'B1',
      scope: 'MAINTENANCE_PART_ACCOUNTABILITY',
      actor: { userId: 'actor-1' },
      previous: null,
      reason: 'PART_ACCOUNTABILITY_ASSIGNED',
    });
    expect(details.next).toMatchObject({ sparePartId: 'sp-1', maintenancePersonnelId: 'p-1', status: 'ASSIGNED' });
  });

  it('UPDATE and CANCEL record previous/new values with an authenticated actor', async () => {
    const { audit, service } = build();

    await service.update('pa-1', { reportedUsedQuantity: 2 } as any, ctx, 'actor-1');
    await service.remove('pa-1', ctx, 'actor-1');

    const events = audit.log.mock.calls.map((c: any[]) => ({ action: c[1], details: c[4] }));
    expect(events.map((e) => e.action)).toEqual(['UPDATE', 'CANCEL']);
    expect(events[0].details.previous.reportedUsedQuantity).toBeNull();
    expect(events[0].details.next.reportedUsedQuantity).toBe(2);
    expect(events[1].details.previous.status).toBe('ASSIGNED');
    expect(events[1].details.next.status).toBe('CANCELLED');
    expect(events[1].details.reason).toBe('PART_ACCOUNTABILITY_CANCELLED');
    expect(events.every((e) => e.details.actor.userId === 'actor-1' && e.details.companyId === 'C1')).toBe(true);
  });

  it('emits no audit row without an actor', async () => {
    const { audit, service } = build();

    await service.update('pa-1', { reportedUsedQuantity: 2 } as any, ctx);
    await service.remove('pa-1', ctx);

    expect(audit.log).not.toHaveBeenCalled();
  });
});
