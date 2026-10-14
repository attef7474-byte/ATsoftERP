import { Prisma } from '@prisma/client';
import { ProductUomConversionService } from './product-uom-conversion.service';

function build(prisma: any) {
  return new ProductUomConversionService(prisma);
}

describe('ProductUomConversionService', () => {
  const product = { id: 'prd1', deletedAt: null, unitId: 'u-pcs' };

  function prismaWith(overrides: any = {}) {
    return {
      product: { findUnique: jest.fn().mockResolvedValue(product) },
      productUom: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      ...overrides,
    };
  }

  it('converts an explicit packaging UOM quantity to base', async () => {
    const prisma = prismaWith({
      productUom: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'puom-bale',
          productId: 'prd1',
          unitId: 'u-bale',
          isActive: true,
          conversionToBase: new Prisma.Decimal('50'),
        }),
      },
    });
    const service = build(prisma);
    const result = await service.convert(prisma, 'prd1', { quantity: 3, productUomId: 'puom-bale' });
    expect(result.productUomId).toBe('puom-bale');
    expect(result.enteredUnitId).toBe('u-bale');
    expect(result.conversionToBase.toString()).toBe('50');
    expect(result.baseQuantity.toString()).toBe('150');
  });

  it('resolves a unit by unitId and applies its factor', async () => {
    const prisma = prismaWith({
      productUom: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({
          id: 'puom-bag',
          productId: 'prd1',
          unitId: 'u-bag',
          isActive: true,
          conversionToBase: new Prisma.Decimal('10'),
        }),
      },
    });
    const service = build(prisma);
    const result = await service.convert(prisma, 'prd1', { quantity: 4, unitId: 'u-bag' });
    expect(result.baseQuantity.toString()).toBe('40');
  });

  it('uses the product base unit with factor 1 when the base unit is selected', async () => {
    const prisma = prismaWith();
    const service = build(prisma);
    const result = await service.convert(prisma, 'prd1', { quantity: 7, unitId: 'u-pcs' });
    expect(result.conversionToBase.toString()).toBe('1');
    expect(result.baseQuantity.toString()).toBe('7');
    expect(prisma.productUom.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to factor 1 when no unit is supplied', async () => {
    const prisma = prismaWith();
    const service = build(prisma);
    const result = await service.convert(prisma, 'prd1', { quantity: 2 });
    expect(result.baseQuantity.toString()).toBe('2');
    expect(result.productUomId).toBeNull();
    expect(result.enteredUnitId).toBe('u-pcs');
  });

  it('rejects a packaging UOM that belongs to another product', async () => {
    const prisma = prismaWith({
      productUom: {
        findUnique: jest.fn().mockResolvedValue({ id: 'x', productId: 'prd-other', unitId: 'u-x', isActive: true, conversionToBase: 10 }),
        findFirst: jest.fn(),
      },
    });
    const service = build(prisma);
    await expect(service.convert(prisma, 'prd1', { quantity: 1, productUomId: 'x' })).rejects.toMatchObject({
      response: { messageKey: 'products.uomInvalidReference' },
    });
  });

  it('rejects an inactive packaging UOM', async () => {
    const prisma = prismaWith({
      productUom: {
        findUnique: jest.fn().mockResolvedValue({ id: 'x', productId: 'prd1', unitId: 'u-x', isActive: false, conversionToBase: 10 }),
        findFirst: jest.fn(),
      },
    });
    const service = build(prisma);
    await expect(service.convert(prisma, 'prd1', { quantity: 1, productUomId: 'x' })).rejects.toMatchObject({
      response: { messageKey: 'products.uomInactive' },
    });
  });

  it('rejects a deleted product', async () => {
    const prisma = prismaWith({
      product: { findUnique: jest.fn().mockResolvedValue({ id: 'prd1', deletedAt: new Date(), unitId: 'u-pcs' }) },
    });
    const service = build(prisma);
    await expect(service.convert(prisma, 'prd1', { quantity: 1 })).rejects.toMatchObject({
      response: { messageKey: 'inventory.productNotFound' },
    });
  });
});
