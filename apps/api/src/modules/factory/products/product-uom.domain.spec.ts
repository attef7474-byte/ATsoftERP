import { Prisma } from '@prisma/client';
import {
  ProductUomValidationError,
  buildProductUomPlan,
  computeBaseQuantity,
} from './product-uom.domain';

describe('buildProductUomPlan', () => {
  it('returns an empty plan when there are no packaging rows', () => {
    expect(buildProductUomPlan([], 'u-pcs')).toEqual([]);
  });

  it('always includes the base unit with conversionToBase 1', () => {
    const plan = buildProductUomPlan([], 'u-pcs');
    expect(plan).toHaveLength(0);

    const planWithBase = buildProductUomPlan([{ unitId: 'u-pcs', isBase: true }], 'u-pcs');
    expect(planWithBase).toHaveLength(1);
    expect(planWithBase[0]).toMatchObject({ unitId: 'u-pcs', isBase: true, parentUnitId: null });
    expect(planWithBase[0].conversionToBase.toString()).toBe('1');
  });

  it('resolves a package -> bag -> bale hierarchy multiplicatively', () => {
    const plan = buildProductUomPlan(
      [
        { unitId: 'u-bag', parentUnitId: 'u-pkg', quantityPerParent: 10 },
        { unitId: 'u-bale', parentUnitId: 'u-bag', quantityPerParent: 5 },
      ],
      'u-pkg',
    );
    const byUnit = new Map(plan.map((row) => [row.unitId, row]));
    expect(byUnit.get('u-pkg')!.conversionToBase.toString()).toBe('1');
    expect(byUnit.get('u-bag')!.conversionToBase.toString()).toBe('10');
    expect(byUnit.get('u-bale')!.conversionToBase.toString()).toBe('50');
    // parents are emitted before children
    const order = plan.map((row) => row.unitId);
    expect(order.indexOf('u-pkg')).toBeLessThan(order.indexOf('u-bag'));
    expect(order.indexOf('u-bag')).toBeLessThan(order.indexOf('u-bale'));
  });

  it('treats a row without a parent as a direct child of the base unit', () => {
    const plan = buildProductUomPlan([{ unitId: 'u-box', quantityPerParent: 12 }], 'u-pcs');
    const box = plan.find((row) => row.unitId === 'u-box')!;
    expect(box.parentUnitId).toBe('u-pcs');
    expect(box.conversionToBase.toString()).toBe('12');
  });

  it('uses Decimal arithmetic for fractional conversions', () => {
    const plan = buildProductUomPlan(
      [{ unitId: 'u-strip', parentUnitId: 'u-box', quantityPerParent: '0.1' }],
      'u-box',
    );
    const strip = plan.find((row) => row.unitId === 'u-strip')!;
    expect(strip.conversionToBase.toString()).toBe('0.1');
    expect(Prisma.Decimal.isDecimal(strip.conversionToBase)).toBe(true);
  });

  it('rejects more than one base unit', () => {
    expect(() =>
      buildProductUomPlan(
        [
          { unitId: 'u-pcs', isBase: true },
          { unitId: 'u-box', isBase: true, quantityPerParent: 12 },
        ],
        'u-pcs',
      ),
    ).toThrow(ProductUomValidationError);
  });

  it('rejects a base unit that disagrees with the product base unit', () => {
    expect(() =>
      buildProductUomPlan([{ unitId: 'u-box', isBase: true }], 'u-pcs'),
    ).toThrow(/base inventory unit/i);
  });

  it('rejects a self-parent', () => {
    expect(() =>
      buildProductUomPlan([{ unitId: 'u-box', parentUnitId: 'u-box', quantityPerParent: 2 }], 'u-pcs'),
    ).toThrow(/own parent/i);
  });

  it('rejects an unknown parent unit', () => {
    expect(() =>
      buildProductUomPlan([{ unitId: 'u-box', parentUnitId: 'u-ghost', quantityPerParent: 2 }], 'u-pcs'),
    ).toThrow(/same product/i);
  });

  it('rejects a cycle', () => {
    expect(() =>
      buildProductUomPlan(
        [
          { unitId: 'u-a', parentUnitId: 'u-b', quantityPerParent: 2 },
          { unitId: 'u-b', parentUnitId: 'u-a', quantityPerParent: 2 },
        ],
        'u-pcs',
      ),
    ).toThrow(/cycle/i);
  });

  it('rejects a non-positive quantity per parent', () => {
    expect(() =>
      buildProductUomPlan([{ unitId: 'u-box', quantityPerParent: 0 }], 'u-pcs'),
    ).toThrow(ProductUomValidationError);
    expect(() =>
      buildProductUomPlan([{ unitId: 'u-box', quantityPerParent: -3 }], 'u-pcs'),
    ).toThrow(ProductUomValidationError);
    expect(() =>
      buildProductUomPlan([{ unitId: 'u-box', quantityPerParent: null }], 'u-pcs'),
    ).toThrow(ProductUomValidationError);
  });

  it('rejects a duplicate unit within one payload', () => {
    expect(() =>
      buildProductUomPlan(
        [
          { unitId: 'u-box', quantityPerParent: 2 },
          { unitId: 'u-box', quantityPerParent: 3 },
        ],
        'u-pcs',
      ),
    ).toThrow(ProductUomValidationError);
  });
});

describe('computeBaseQuantity', () => {
  it('multiplies the entered quantity by the conversion factor', () => {
    const base = computeBaseQuantity(new Prisma.Decimal(3), new Prisma.Decimal(12));
    expect(base.toString()).toBe('36');
  });

  it('keeps fractional precision', () => {
    const base = computeBaseQuantity(new Prisma.Decimal('2.5'), new Prisma.Decimal('0.1'));
    expect(base.toString()).toBe('0.25');
  });

  it('rejects a non-positive conversion factor', () => {
    expect(() => computeBaseQuantity(new Prisma.Decimal(1), new Prisma.Decimal(0))).toThrow(ProductUomValidationError);
  });
});
