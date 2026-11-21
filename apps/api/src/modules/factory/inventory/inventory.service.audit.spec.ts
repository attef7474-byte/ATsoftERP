import { InventoryService } from './inventory.service';

/** Phase 6 audit coverage: warehouse/location master writes are actor and tenant scoped. */
describe('Phase 6 audit coverage: InventoryService', () => {
  const ctx = { companyId: 'C1', branchId: 'B1', source: 'NORMAL' } as any;
  const warehouse = {
    id: 'w-1',
    code: 'WH1',
    name: 'Main',
    warehouseType: 'GENERAL',
    status: 'ACTIVE',
    deletedAt: null,
    branchId: 'B1',
    companyId: 'C1',
    locations: [],
  };
  const location = {
    id: 'loc-1',
    code: 'L1',
    name: 'Shelf 1',
    status: 'ACTIVE',
    warehouseId: 'w-1',
    warehouse: { id: 'w-1', name: 'Main', code: 'WH1' },
  };

  function build() {
    const prisma: any = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(warehouse),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'w-new', ...data })),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ ...warehouse, ...data, id: where.id })),
      },
      warehouseLocation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(location),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'loc-new', ...data })),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ ...location, ...data, id: where.id })),
      },
    };
    const numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('AUTO-1') };
    const audit = { log: jest.fn().mockResolvedValue({}) };
    return {
      prisma,
      audit,
      service: new InventoryService(prisma, numbering as any, audit as any),
    };
  }

  afterEach(() => jest.clearAllMocks());

  it('CREATE warehouse records authoritative company/branch and actor', async () => {
    const { audit, service } = build();

    await service.createWarehouse({ code: 'WH1', name: 'Main' } as any, ctx, 'actor-1');

    expect(audit.log).toHaveBeenCalledTimes(1);
    const [userId, action, entity, entityId, details] = audit.log.mock.calls[0];
    expect(userId).toBe('actor-1');
    expect(action).toBe('CREATE');
    expect(entity).toBe('Warehouse');
    expect(entityId).toBe('w-new');
    expect(details).toMatchObject({
      schemaVersion: 1,
      companyId: 'C1',
      branchId: 'B1',
      scope: 'OPERATIONAL_INVENTORY_MASTER',
      actor: { userId: 'actor-1' },
      previous: null,
    });
    expect(details.next).toMatchObject({ code: 'WH1', name: 'Main' });
  });

  it('DELETE warehouse and DEACTIVATE location record previous/new and reason', async () => {
    const { audit, service } = build();

    await service.removeWarehouse('w-1', ctx, 'actor-1');
    await service.removeLocation('loc-1', ctx, 'actor-1');

    const events = audit.log.mock.calls.map((c: any[]) => ({ action: c[1], entity: c[2], details: c[4] }));
    expect(events.map((e) => e.action)).toEqual(['DELETE', 'DEACTIVATE']);
    expect(events[0].entity).toBe('Warehouse');
    expect(events[1].entity).toBe('WarehouseLocation');
    expect(events[0].details.reason).toBe('SOFT_DELETE');
    expect(events[1].details.reason).toBe('STATUS_TRANSITION');
    expect(events.every((e) => e.details.companyId === 'C1' && e.details.branchId === 'B1')).toBe(true);
    expect(events.every((e) => e.details.actor.userId === 'actor-1')).toBe(true);
    expect(events.every((e) => e.details.previous && e.details.next)).toBe(true);
  });

  it('emits no audit row without an actor', async () => {
    const { audit, service } = build();

    await service.createWarehouse({ code: 'WH1', name: 'Main' } as any, ctx);
    await service.updateWarehouse('w-1', { name: 'Renamed' } as any, ctx);
    await service.removeWarehouse('w-1', ctx);

    expect(audit.log).not.toHaveBeenCalled();
  });
});
