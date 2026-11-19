import { ProductUomValidationError } from './product-uom.domain';

/**
 * Canonical business item classification for the single inventory item master.
 *
 * `itemType` is deliberately separate from `ProductCategory`: a category is a
 * user-maintained hierarchy (oils / spices / flour ...) while itemType is a
 * bounded, authoritative business role used by receiving, issuing, production
 * and maintenance workflows. Historical rows may be NULL (unclassified) when no
 * authoritative relationship proves their role; new rows must always carry a
 * valid type.
 */
export const PRODUCT_ITEM_TYPES = [
  'RAW_MATERIAL',
  'FINISHED_GOOD',
  'SPARE_PART',
  'PACKAGING_MATERIAL',
  'CONSUMABLE',
  'GENERAL',
] as const;

export type ProductItemType = (typeof PRODUCT_ITEM_TYPES)[number];

const ITEM_TYPE_SET = new Set<string>(PRODUCT_ITEM_TYPES);

export function isProductItemType(value: unknown): value is ProductItemType {
  return typeof value === 'string' && ITEM_TYPE_SET.has(value);
}

/** Validates the comma-separated `itemTypes` filter used by lists and F9 lookups. */
export function parseItemTypeFilter(raw: string | undefined | null): ProductItemType[] | undefined {
  if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
  const values = String(raw)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (values.length === 0) return undefined;
  for (const value of values) {
    if (!isProductItemType(value)) {
      throw new ProductUomValidationError(
        'itemTypes',
        'products.itemTypeInvalid',
        `Unsupported item type filter: ${value}`,
      );
    }
  }
  return [...new Set(values)] as ProductItemType[];
}

/** Resolves a single `itemType` query parameter, rejecting unsupported values. */
export function parseSingleItemType(raw: string | undefined | null): ProductItemType | undefined {
  if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
  const value = String(raw).trim();
  if (!isProductItemType(value)) {
    throw new ProductUomValidationError('itemType', 'products.itemTypeInvalid', `Unsupported item type: ${value}`);
  }
  return value;
}

/** Evidence required to decide whether an existing Product may be reclassified. */
export interface ProductTypeCompatibilityEvidence {
  hasActiveSparePartLink: boolean;
  hasProductionDefinition: boolean;
  hasRawMaterialEvidence: boolean;
  hasPackagingEvidence: boolean;
}

const AUTHORITATIVE_TYPE_FOR_EVIDENCE: Array<{
  present: keyof ProductTypeCompatibilityEvidence;
  requiredType: ProductItemType;
}> = [
  { present: 'hasActiveSparePartLink', requiredType: 'SPARE_PART' },
  { present: 'hasProductionDefinition', requiredType: 'FINISHED_GOOD' },
  { present: 'hasRawMaterialEvidence', requiredType: 'RAW_MATERIAL' },
  { present: 'hasPackagingEvidence', requiredType: 'PACKAGING_MATERIAL' },
];

/**
 * Backend type-change safety. Stock movements remain valid regardless of a type
 * change, but a Product that is authoritatively used in a domain role may not be
 * reclassified out of that role — that would corrupt receiving / production /
 * maintenance selectors while leaving historical transactions intact.
 */
export function assertItemTypeChangeAllowed(
  current: string | null | undefined,
  next: ProductItemType,
  evidence: ProductTypeCompatibilityEvidence,
): void {
  for (const rule of AUTHORITATIVE_TYPE_FOR_EVIDENCE) {
    if (evidence[rule.present] && next !== rule.requiredType) {
      throw new ProductUomValidationError(
        'itemType',
        'products.itemTypeChangeBlocked',
        `A product with ${rule.present} evidence must remain ${rule.requiredType}`,
      );
    }
  }
  // A product already classified in a compatible role may only move to another
  // authoritative role when the old-role evidence is absent (checked above).
  void current;
}

/** Validates the itemType supplied when creating a brand-new Product. */
export function assertNewItemType(value: unknown): asserts value is ProductItemType {
  if (!isProductItemType(value)) {
    throw new ProductUomValidationError(
      'itemType',
      'products.itemTypeRequired',
      'A valid item type is required for a new item',
    );
  }
}
