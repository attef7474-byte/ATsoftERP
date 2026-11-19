import { ProductUomValidationError } from './product-uom.domain';
import {
  PRODUCT_ITEM_TYPES,
  assertItemTypeChangeAllowed,
  assertNewItemType,
  isProductItemType,
  parseItemTypeFilter,
  parseSingleItemType,
} from './product-item-type.domain';

describe('product item-type vocabulary', () => {
  it('exposes exactly the six canonical business types', () => {
    expect(PRODUCT_ITEM_TYPES).toEqual([
      'RAW_MATERIAL',
      'FINISHED_GOOD',
      'SPARE_PART',
      'PACKAGING_MATERIAL',
      'CONSUMABLE',
      'GENERAL',
    ]);
  });

  it('accepts only canonical values', () => {
    for (const type of PRODUCT_ITEM_TYPES) expect(isProductItemType(type)).toBe(true);
    expect(isProductItemType('FINISHED_PRODUCT')).toBe(false);
    expect(isProductItemType('')).toBe(false);
    expect(isProductItemType(undefined)).toBe(false);
    expect(isProductItemType(null)).toBe(false);
    expect(isProductItemType(42)).toBe(false);
  });

  it('requires a valid item type for a new item', () => {
    expect(() => assertNewItemType('RAW_MATERIAL')).not.toThrow();
    expect(() => assertNewItemType(undefined)).toThrow(ProductUomValidationError);
    expect(() => assertNewItemType('BAD_TYPE')).toThrow(
      expect.objectContaining({ messageKey: 'products.itemTypeRequired' }),
    );
  });
});

describe('item-type filter parsing', () => {
  it('returns undefined for an absent or blank filter', () => {
    expect(parseSingleItemType(undefined)).toBeUndefined();
    expect(parseSingleItemType('')).toBeUndefined();
    expect(parseItemTypeFilter('  ')).toBeUndefined();
  });

  it('parses a single canonical type', () => {
    expect(parseSingleItemType(' FINISHED_GOOD ')).toBe('FINISHED_GOOD');
  });

  it('parses and de-duplicates a comma-separated list', () => {
    expect(parseItemTypeFilter('RAW_MATERIAL,PACKAGING_MATERIAL,RAW_MATERIAL')).toEqual([
      'RAW_MATERIAL',
      'PACKAGING_MATERIAL',
    ]);
  });

  it('rejects an unsupported type with the stable error key', () => {
    expect(() => parseSingleItemType('NOPE')).toThrow(
      expect.objectContaining({ messageKey: 'products.itemTypeInvalid' }),
    );
    expect(() => parseItemTypeFilter('RAW_MATERIAL,NOPE')).toThrow(ProductUomValidationError);
  });
});

describe('item-type change compatibility', () => {
  const noEvidence = {
    hasActiveSparePartLink: false,
    hasProductionDefinition: false,
    hasRawMaterialEvidence: false,
    hasPackagingEvidence: false,
  };

  it('allows reclassification when no authoritative evidence contradicts it', () => {
    expect(() => assertItemTypeChangeAllowed('GENERAL', 'CONSUMABLE', noEvidence)).not.toThrow();
  });

  it('allows keeping the type required by existing evidence', () => {
    expect(() =>
      assertItemTypeChangeAllowed('SPARE_PART', 'SPARE_PART', {
        ...noEvidence,
        hasActiveSparePartLink: true,
      }),
    ).not.toThrow();
  });

  it('blocks reclassifying a product linked to an active spare part', () => {
    expect(() =>
      assertItemTypeChangeAllowed('SPARE_PART', 'RAW_MATERIAL', {
        ...noEvidence,
        hasActiveSparePartLink: true,
      }),
    ).toThrow(expect.objectContaining({ messageKey: 'products.itemTypeChangeBlocked' }));
  });

  it('blocks reclassifying a production-defined product away from FINISHED_GOOD', () => {
    expect(() =>
      assertItemTypeChangeAllowed('FINISHED_GOOD', 'GENERAL', {
        ...noEvidence,
        hasProductionDefinition: true,
      }),
    ).toThrow(ProductUomValidationError);
  });

  it('blocks reclassifying a raw-material product away from RAW_MATERIAL', () => {
    expect(() =>
      assertItemTypeChangeAllowed('RAW_MATERIAL', 'GENERAL', {
        ...noEvidence,
        hasRawMaterialEvidence: true,
      }),
    ).toThrow(ProductUomValidationError);
  });

  it('blocks reclassifying a packaging product away from PACKAGING_MATERIAL', () => {
    expect(() =>
      assertItemTypeChangeAllowed('PACKAGING_MATERIAL', 'GENERAL', {
        ...noEvidence,
        hasPackagingEvidence: true,
      }),
    ).toThrow(ProductUomValidationError);
  });
});
