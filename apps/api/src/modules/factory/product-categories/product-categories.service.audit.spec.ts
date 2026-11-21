import { ProductCategoriesService } from './product-categories.service';

/**
 * Phase 6 audit coverage: every sensitive ProductCategory write must carry an
 * authenticated actor and explicit global-catalog scope. No actor means no
 * audit row — never an actorless row with userId = undefined.
 */
describe('Phase 6 audit coverage: ProductCategoriesService', () => {
  const category = {
    id: 'cat-1',
    code: 'CAT-1',
    name: 'Category 1',
    description: null,
    parentId: null,
    status: 'ACTIVE',
    deletedAt: null,
  };

  function build() {
    const prisma: any = {
      productCategory: {
        findUnique: jest.fn().mockResolvedValue(category),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'cat-new', ...data })),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ ...category, ...data, id: where.id })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue({}) };
    return { prisma, audit, service: new ProductCategoriesService(prisma, audit as any) };
  }

  afterEach(() => jest.clearAllMocks());

  it('CREATE records the authenticated actor, entity, previous=null and next snapshot', async () => {
    const { prisma, audit, service } = build();
    prisma.productCategory.findUnique.mockResolvedValue(null);

    await service.create({ code: 'CAT-1', name: 'Category 1' } as any, 'actor-1');

    expect(audit.log).toHaveBeenCalledTimes(1);
    const [userId, action, entity, entityId, details] = audit.log.mock.calls[0];
    expect(userId).toBe('actor-1');
    expect(action).toBe('CREATE');
    expect(entity).toBe('ProductCategory');
    expect(entityId).toBe('cat-new');
    expect(details).toMatchObject({
      schemaVersion: 1,
      companyId: null,
      branchId: null,
      scope: 'GLOBAL_PRODUCT_CATEGORY_CATALOG',
      actor: { userId: 'actor-1' },
      previous: null,
    });
    expect(details.next).toMatchObject({ code: 'CAT-1', name: 'Category 1' });
  });

  it('UPDATE, ACTIVATE, DEACTIVATE and DELETE each emit one actor-aware event with previous/next', async () => {
    const { audit, service } = build();

    await service.update('cat-1', { name: 'Renamed' } as any, 'actor-1');
    await service.activate('cat-1', 'actor-1');
    await service.deactivate('cat-1', 'actor-1');
    await service.remove('cat-1', 'actor-1');

    const events = audit.log.mock.calls.map((c: any[]) => ({
      action: c[1],
      entityId: c[3],
      details: c[4],
    }));
    expect(events.map((e) => e.action)).toEqual(['UPDATE', 'ACTIVATE', 'DEACTIVATE', 'DELETE']);
    expect(events.every((e) => e.entityId === 'cat-1')).toBe(true);
    expect(events.every((e) => e.details.actor.userId === 'actor-1')).toBe(true);
    expect(events.every((e) => e.details.previous !== undefined && e.details.next !== undefined)).toBe(true);
    expect(events[3].details.reason).toBe('SOFT_DELETE');
  });

  it('emits no audit row when no authenticated actor is supplied', async () => {
    const { prisma, audit, service } = build();
    prisma.productCategory.findUnique.mockResolvedValueOnce(null);

    await service.create({ code: 'CAT-1', name: 'Category 1' } as any);
    await service.update('cat-1', { name: 'Renamed' } as any);
    await service.remove('cat-1');

    expect(audit.log).not.toHaveBeenCalled();
  });
});
