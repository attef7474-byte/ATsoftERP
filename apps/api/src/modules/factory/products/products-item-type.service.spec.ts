import { ProductsService } from './products.service';

/**
 * Focused service tests for the canonical item-type rules introduced in Phase 1:
 * required-on-create, server-side list filtering, and type-change safety backed
 * by authoritative domain evidence. No HTTP and no real database are involved.
 */
describe('ProductsService itemType', () => {
  const BASE = { id: 'u-pcs', code: 'PCS' };

  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: ProductsService;

  const existingProduct = (overrides: Record<string, any> = {}) => ({
    id: 'prd1',
    code: 'PRD-1',
    name: 'Test Item',
    unit: 'PCS',
    unitId: BASE.id,
    status: 'ACTIVE',
    itemType: 'GENERAL',
    deletedAt: null,
    category: null,
    unitRef: { ...BASE, nameAr: 'قطعة', nameEn: 'Pieces', symbol: null },
    uoms: [],
    ...overrides,
  });

  const evidenceMocks = () => ({
    sparePart: { count: jest.fn().mockResolvedValue(0) },
    productionProductDefinition: { count: jest.fn().mockResolvedValue(0) },
    productionMaterialRequirementLine: { count: jest.fn().mockResolvedValue(0) },
    productionMaterialDocumentLine: { count: jest.fn().mockResolvedValue(0) },
    productionMaterialConsumption: { count: jest.fn().mockResolvedValue(0) },
  });

  beforeEach(() => {
    prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'prd-new', ...data })),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'prd1', code: 'PRD-1', ...data })),
      },
      unit: {
        findUnique: jest.fn().mockImplementation(async ({ where }) =>
          where.id === BASE.id || where.code === BASE.code ? BASE : null,
        ),
        findMany: jest.fn().mockImplementation(async ({ where }) =>
          (where?.id?.in ?? []).map((id: string) => ({ id })),
        ),
      },
      productUom: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: `puom-${data.unitId}`, ...data })),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      inventoryMovementLine: { count: jest.fn().mockResolvedValue(0) },
      inventoryBalance: { count: jest.fn().mockResolvedValue(0) },
      inventoryCountLine: { count: jest.fn().mockResolvedValue(0) },
      ...evidenceMocks(),
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('PRD-1') };
    audit = { log: jest.fn(), logWithClient: jest.fn().mockResolvedValue(undefined) };
    service = new ProductsService(prisma, numbering, audit);
  });

  it('rejects create without an item type', async () => {
    await expect(
      service.create({ name: 'No type', unitId: BASE.id } as any, 'u1'),
    ).rejects.toMatchObject({ response: { messageKey: 'products.itemTypeRequired' } });
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('rejects create with an unsupported item type', async () => {
    await expect(
      service.create({ name: 'Bad type', unitId: BASE.id, itemType: 'FINISHED_PRODUCT' } as any, 'u1'),
    ).rejects.toMatchObject({ response: { messageKey: 'products.itemTypeRequired' } });
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('persists a valid item type on create', async () => {
    await service.create(
      { name: 'Raw steel', unitId: BASE.id, itemType: 'RAW_MATERIAL' } as any,
      'u1',
    );
    expect(prisma.product.create.mock.calls[0][0].data).toMatchObject({ itemType: 'RAW_MATERIAL' });
  });

  it('filters the list by a single item type on the server', async () => {
    await service.findAll({ itemType: 'SPARE_PART' });
    expect(prisma.product.findMany.mock.calls[0][0].where).toMatchObject({ itemType: 'SPARE_PART' });
  });

  it('filters the list by multiple item types on the server', async () => {
    await service.findAll({ itemTypes: 'RAW_MATERIAL,PACKAGING_MATERIAL' });
    expect(prisma.product.findMany.mock.calls[0][0].where).toMatchObject({
      itemType: { in: ['RAW_MATERIAL', 'PACKAGING_MATERIAL'] },
    });
  });

  it('rejects an invalid itemTypes filter with a stable error key', async () => {
    await expect(service.findAll({ itemTypes: 'RAW_MATERIAL,BOGUS' })).rejects.toMatchObject({
      response: { messageKey: 'products.itemTypeInvalid' },
    });
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('does not filter by itemType when no filter is supplied', async () => {
    await service.findAll({});
    expect(prisma.product.findMany.mock.calls[0][0].where).not.toHaveProperty('itemType');
  });

  it('allows changing the type of an unconstrained general item', async () => {
    prisma.product.findUnique.mockResolvedValue(existingProduct({ itemType: 'GENERAL' }));
    await service.update('prd1', { itemType: 'CONSUMABLE' } as any, 'u1');
    expect(prisma.product.update.mock.calls[0][0].data).toMatchObject({ itemType: 'CONSUMABLE' });
    const auditDetails = audit.logWithClient.mock.calls[0][1].details;
    expect(auditDetails).toMatchObject({
      itemTypeChanged: true,
      oldItemType: 'GENERAL',
      newItemType: 'CONSUMABLE',
    });
  });

  it('blocks changing a production-defined product away from FINISHED_GOOD', async () => {
    prisma.product.findUnique.mockResolvedValue(existingProduct({ itemType: 'FINISHED_GOOD' }));
    prisma.productionProductDefinition.count.mockResolvedValue(1);
    await expect(
      service.update('prd1', { itemType: 'GENERAL' } as any, 'u1'),
    ).rejects.toMatchObject({ response: { messageKey: 'products.itemTypeChangeBlocked' } });
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('blocks changing a product linked to an active spare part away from SPARE_PART', async () => {
    prisma.product.findUnique.mockResolvedValue(existingProduct({ itemType: 'SPARE_PART' }));
    prisma.sparePart.count.mockResolvedValue(1);
    await expect(
      service.update('prd1', { itemType: 'GENERAL' } as any, 'u1'),
    ).rejects.toMatchObject({ response: { messageKey: 'products.itemTypeChangeBlocked' } });
    expect(prisma.product.update).not.toHaveBeenCalled();
  });
});
