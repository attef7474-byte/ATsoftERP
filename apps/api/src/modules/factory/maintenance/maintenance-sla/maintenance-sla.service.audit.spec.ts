import { MaintenanceSlaService } from './maintenance-sla.service';

/** Phase 6 audit coverage: SLA state writes are actor and tenant scoped. */
describe('Phase 6 audit coverage: MaintenanceSlaService', () => {
  const ctx = { companyId: 'C1', branchId: 'B1' } as any;
  const request = {
    id: 'req-1',
    priority: 'HIGH',
    type: 'CORRECTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    machine: { companyId: 'C1', branchId: 'B1' },
  };
  const state = {
    id: 'sla-1',
    maintenanceRequestKey: 'req-1',
    slaStatus: 'ON_TRACK',
    escalationLevel: 'NONE',
    responseDueAt: new Date('2026-01-01T02:00:00.000Z'),
    startDueAt: null,
    completeDueAt: null,
    responseActualAt: null,
    startActualAt: null,
    completeActualAt: null,
    responseOverdueMin: null,
    startOverdueMin: null,
    completeOverdueMin: null,
    lastEscalatedAt: null,
  };

  function build() {
    const prisma: any = {
      maintenanceRequest: {
        findUnique: jest.fn().mockResolvedValue(request),
        update: jest.fn().mockResolvedValue(request),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      maintenanceSlaRule: {
        findFirst: jest.fn().mockResolvedValue({ responseHours: 2, startHours: 4, completeHours: 8, escalationDelayHours: 1, escalationLevels: 1 }),
      },
      maintenanceSlaState: {
        findUnique: jest.fn().mockResolvedValue(state),
        upsert: jest.fn().mockResolvedValue(state),
        update: jest.fn().mockResolvedValue(state),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue({}) };
    return { prisma, audit, service: new MaintenanceSlaService(prisma, audit as any) };
  }

  afterEach(() => jest.clearAllMocks());

  it('SLA_STATE_CREATE records actor, tenant scope, previous and generated deadlines', async () => {
    const { audit, service } = build();

    await service.createSlaState('req-1', ctx, 'actor-1');

    expect(audit.log).toHaveBeenCalledTimes(1);
    const [userId, action, entity, entityId, details] = audit.log.mock.calls[0];
    expect(userId).toBe('actor-1');
    expect(action).toBe('SLA_STATE_CREATE');
    expect(entity).toBe('MaintenanceSlaState');
    expect(entityId).toBe('req-1');
    expect(details).toMatchObject({
      schemaVersion: 1,
      companyId: 'C1',
      branchId: 'B1',
      scope: 'MAINTENANCE_SLA',
      actor: { userId: 'actor-1' },
      reason: 'SLA_DEADLINE_INITIALIZATION',
    });
    expect(details.previous).toEqual(expect.any(Object));
    expect(details.next).toMatchObject({ slaStatus: 'ON_TRACK', escalationLevel: 'NONE' });
    expect(details.next.responseDueAt).toBe('2026-01-01T02:00:00.000Z');
  });

  it('SLA_RECALCULATE records the previous status and the recalculated status', async () => {
    const { prisma, audit, service } = build();
    prisma.maintenanceSlaState.findUnique.mockResolvedValue({ ...state, responseDueAt: new Date('2020-01-01T00:00:00.000Z') });

    await service.recalculateSla('req-1', ctx, 'actor-1');

    expect(audit.log).toHaveBeenCalledTimes(1);
    const [userId, action, entity, entityId, details] = audit.log.mock.calls[0];
    expect(userId).toBe('actor-1');
    expect(action).toBe('SLA_RECALCULATE');
    expect(entity).toBe('MaintenanceSlaState');
    expect(entityId).toBe('req-1');
    expect(details.previous.slaStatus).toBe('ON_TRACK');
    expect(details.next).toMatchObject({ slaStatus: 'OVERDUE' });
    expect(details.reason).toBe('SLA_RECALCULATION');
    expect(details.companyId).toBe('C1');
    expect(details.branchId).toBe('B1');
  });

  it('emits no audit row without an actor', async () => {
    const { audit, service } = build();

    await service.createSlaState('req-1', ctx);
    await service.recalculateSla('req-1', ctx);

    expect(audit.log).not.toHaveBeenCalled();
  });
});
