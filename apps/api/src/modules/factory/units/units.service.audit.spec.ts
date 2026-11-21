import { UnitsService } from './units.service';

/** Phase 6 audit coverage: global Unit master writes are actor-aware. */
describe('Phase 6 audit coverage: UnitsService', () => {
  const unit = {
    id: 'unit-1',
    code: 'PCS',
    nameAr: 'قطعة',
    nameEn: 'Pieces',
    symbol: 'pc',
    isActive: true,
    _count: { products: 0, spareParts: 0, machineParts: 0 },
  };

  function build() {
    const prisma: any = {
      unit: {
        findUnique: jest.fn().mockResolvedValue(unit),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'unit-new', ...data })),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ ...unit, ...data, id: where.id })),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue({}) };
    return { prisma, audit, service: new UnitsService(prisma, audit as any) };
  }

  afterEach(() => jest.clearAllMocks());

  it('CREATE records actor and global scope with a next snapshot', async () => {
    const { prisma, audit, service } = build();
    prisma.unit.findUnique.mockResolvedValue(null);

    await service.create({ code: 'pcs', nameAr: 'قطعة', nameEn: 'Pieces', symbol: 'pc' } as any, 'actor-1');

    expect(audit.log).toHaveBeenCalledTimes(1);
    const [userId, action, entity, entityId, details] = audit.log.mock.calls[0];
    expect(userId).toBe('actor-1');
    expect(action).toBe('CREATE');
    expect(entity).toBe('Unit');
    expect(entityId).toBe('unit-new');
    expect(details).toMatchObject({
      schemaVersion: 1,
      companyId: null,
      branchId: null,
      scope: 'GLOBAL_UNIT_CATALOG',
      actor: { userId: 'actor-1' },
      previous: null,
    });
    expect(details.next).toMatchObject({ code: 'PCS', nameEn: 'Pieces' });
  });

  it('ACTIVATE and DEACTIVATE record status transitions with previous and next', async () => {
    const { audit, service } = build();

    await service.deactivate('unit-1', 'actor-1');
    await service.activate('unit-1', 'actor-1');

    const events = audit.log.mock.calls.map((c: any[]) => ({ action: c[1], details: c[4] }));
    expect(events.map((e) => e.action)).toEqual(['DEACTIVATE', 'ACTIVATE']);
    expect(events[0].details.previous.isActive).toBe(true);
    expect(events[0].details.next.isActive).toBe(false);
    expect(events[1].details.reason).toBe('STATUS_TRANSITION');
    expect(events.every((e) => e.details.actor.userId === 'actor-1')).toBe(true);
  });

  it('emits no audit row without an actor', async () => {
    const { prisma, audit, service } = build();
    prisma.unit.findUnique.mockResolvedValueOnce(null);

    await service.create({ code: 'PCS', nameAr: 'x', nameEn: 'x' } as any);
    await service.update('unit-1', { nameEn: 'Updated' } as any);

    expect(audit.log).not.toHaveBeenCalled();
  });
});
