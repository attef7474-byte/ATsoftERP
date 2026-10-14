import { BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';

/**
 * Focused multi-UOM service tests for the Product base-row / packaging-hierarchy
 * authority. These exercise the service contract directly (no HTTP, no real DB)
 * and prove:
 *   1. the base row is preserved across packaging sync,
 *   2. rows removed by the payload are dropped but never the base row,
 *   3. the base unit is locked once inventory history exists,
 *   4. the alternate-unit hierarchy is recomputed (parents before children),
 *   5. an invalid hierarchy is rejected before any packaging row is written.
 */
describe('ProductsService multi-UOM', () => {
  const BASE = { id: 'u-pcs', code: 'PCS' };
  const BAG = { id: 'u-bag', code: 'BAG' };
  const BALE = { id: 'u-bale', code: 'BALE' };

  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: ProductsService;

  const existingProduct = (overrides: Record<string, any> = {}) => ({
    id: 'prd1',
    code: 'PRD-1',
    name: 'Test Snack',
    description: null,
    categoryId: null,
    unit: 'PCS',
    unitId: BASE.id,
    barcode: null,
    qrCode: null,
    minStock: 0,
    maxStock: 0,
    status: 'ACTIVE',
    deletedAt: null,
    category: null,
    unitRef: { ...BASE, nameAr: 'قطعة', nameEn: 'Pieces', symbol: null },
    uoms: [],
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'prd-new', ...data })),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'prd1', code: 'PRD-1', ...data })),
      },
      unit: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === BAG.id || where.code === BAG.code) return BAG;
          if (where.id === BALE.id || where.code === BALE.code) return BALE;
          if (where.id === BASE.id || where.code === BASE.code) return BASE;
          return null;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          const ids = where?.id?.in ?? [];
          return ids.map((id: string) => ({ id }));
        }),
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
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('PRD-1') };
    audit = { log: jest.fn(), logWithClient: jest.fn().mockResolvedValue(undefined) };
    service = new ProductsService(prisma, numbering, audit);
  });

  it('create persists the explicit base row before packaging rows', async () => {
    prisma.product.findUnique.mockResolvedValue(null); // no code collision

    await service.create(
      {
        name: 'Test Snack',
        unitId: BASE.id,
        uoms: [
          { unitId: BASE.id, isBase: true },
          { unitId: BAG.id, parentUnitId: BASE.id, quantityPerParent: 24 },
          { unitId: BALE.id, parentUnitId: BAG.id, quantityPerParent: 6 },
        ],
      } as any,
      'u1',
    );

    const created = prisma.productUom.create.mock.calls.map((c: any[]) => c[0].data);
    expect(created.map((d: any) => d.unitId)).toEqual([BASE.id, BAG.id, BALE.id]);
    const base = created[0];
    expect(base).toMatchObject({ isBase: true, parentProductUomId: null, unitId: BASE.id });
    expect(Number(base.conversionToBase.toString())).toBe(1);
    const bale = created[2];
    expect(Number(bale.conversionToBase.toString())).toBe(144);
    expect(bale.parentProductUomId).toBe(`puom-${BAG.id}`);
  });

  it('update preserves the existing base row and syncs packaging rows in place', async () => {
    prisma.product.findUnique.mockResolvedValue(existingProduct());
    prisma.productUom.findMany.mockResolvedValue([
      { id: 'base1', productId: 'prd1', unitId: BASE.id, isBase: true, parentProductUomId: null, quantityPerParent: 1, conversionToBase: 1, isActive: true },
      { id: 'bag1', productId: 'prd1', unitId: BAG.id, isBase: false, parentProductUomId: 'base1', quantityPerParent: 24, conversionToBase: 24, isActive: true },
    ]);

    await service.update(
      'prd1',
      {
        uoms: [
          { unitId: BAG.id, parentUnitId: BASE.id, quantityPerParent: 24 },
          { unitId: BALE.id, parentUnitId: BAG.id, quantityPerParent: 6 },
        ],
      } as any,
      'u1',
    );

    // Nothing removable: the base row and the retained bag row are never deleted.
    expect(prisma.productUom.deleteMany).not.toHaveBeenCalled();

    const updatedById = new Map<string, any>(
      prisma.productUom.update.mock.calls.map((c: any[]) => [c[0].where.id, c[0].data]),
    );
    expect(updatedById.get('base1')).toMatchObject({ isBase: true, parentProductUomId: null });
    expect(updatedById.get('bag1')).toMatchObject({ parentProductUomId: 'base1' });
    expect(Number(updatedById.get('bag1').conversionToBase.toString())).toBe(24);

    const createdBale = prisma.productUom.create.mock.calls.map((c: any[]) => c[0].data)
      .find((d: any) => d.unitId === BALE.id);
    expect(createdBale).toMatchObject({ parentProductUomId: 'bag1' });
    expect(Number(createdBale.conversionToBase.toString())).toBe(144);
  });

  it('update drops a removed packaging row but never the base', async () => {
    prisma.product.findUnique.mockResolvedValue(existingProduct());
    prisma.productUom.findMany.mockResolvedValue([
      { id: 'base1', productId: 'prd1', unitId: BASE.id, isBase: true, parentProductUomId: null, quantityPerParent: 1, conversionToBase: 1, isActive: true },
      { id: 'bag1', productId: 'prd1', unitId: BAG.id, isBase: false, parentProductUomId: 'base1', quantityPerParent: 24, conversionToBase: 24, isActive: true },
    ]);

    await service.update('prd1', { uoms: [{ unitId: BASE.id, isBase: true }] } as any, 'u1');

    expect(prisma.productUom.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['bag1'] } } });
    // Base row is retained via update, not recreated.
    expect(prisma.productUom.update.mock.calls.map((c: any[]) => c[0].where.id)).toContain('base1');
  });

  it('locks the base unit once inventory history exists', async () => {
    prisma.product.findUnique.mockResolvedValue(existingProduct());
    prisma.inventoryMovementLine.count.mockResolvedValue(3);

    await expect(
      service.update('prd1', { unitId: BAG.id } as any, 'u1'),
    ).rejects.toMatchObject({ response: { messageKey: 'products.uomBaseUnitLocked' } });

    expect(prisma.inventoryMovementLine.count).toHaveBeenCalled();
    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.productUom.deleteMany).not.toHaveBeenCalled();
  });

  it('rebuilds the hierarchy on a pre-history base-unit change', async () => {
    prisma.product.findUnique.mockResolvedValue(existingProduct());
    prisma.productUom.findMany.mockResolvedValue([
      { id: 'base1', productId: 'prd1', unitId: BASE.id, isBase: true, parentProductUomId: null, quantityPerParent: 1, conversionToBase: 1, isActive: true },
    ]);

    await service.update(
      'prd1',
      { unitId: BAG.id, uoms: [{ unitId: BAG.id, isBase: true }, { unitId: BALE.id, parentUnitId: BAG.id, quantityPerParent: 6 }] } as any,
      'u1',
    );

    expect(prisma.productUom.deleteMany).toHaveBeenCalledWith({ where: { productId: 'prd1' } });
    const created = prisma.productUom.create.mock.calls.map((c: any[]) => c[0].data);
    expect(created.map((d: any) => d.unitId)).toEqual([BAG.id, BALE.id]);
    expect(prisma.product.update.mock.calls[0][0].data).toMatchObject({ unitId: BAG.id, unit: 'BAG' });
  });

  it('rejects an invalid hierarchy before writing any packaging row', async () => {
    prisma.product.findUnique.mockResolvedValue(existingProduct());
    prisma.productUom.findMany.mockResolvedValue([
      { id: 'base1', productId: 'prd1', unitId: BASE.id, isBase: true, parentProductUomId: null, quantityPerParent: 1, conversionToBase: 1, isActive: true },
    ]);

    await expect(
      service.update(
        'prd1',
        {
          uoms: [
            { unitId: BAG.id, parentUnitId: BALE.id, quantityPerParent: 2 },
            { unitId: BALE.id, parentUnitId: BAG.id, quantityPerParent: 2 },
          ],
        } as any,
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.productUom.create).not.toHaveBeenCalled();
    expect(prisma.productUom.update).not.toHaveBeenCalled();
    expect(prisma.productUom.deleteMany).not.toHaveBeenCalled();
  });
});
