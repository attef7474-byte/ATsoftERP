/**
 * Canonical client-side vocabulary for Product business classification.
 *
 * This mirrors the backend `PRODUCT_ITEM_TYPES` contract. It is intentionally a
 * small shared module (not a second Product model) so the Items grid, the single
 * Product form, domain lookups and tests all use exactly the same six values.
 * `ProductCategory` is a separate user-maintained hierarchy and is never used
 * as a substitute for this classification.
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

export const ITEM_TYPE_LABEL_KEYS: Record<ProductItemType, string> = {
  RAW_MATERIAL: 'inventory.itemTypeRawMaterial',
  FINISHED_GOOD: 'inventory.itemTypeFinishedGood',
  SPARE_PART: 'inventory.itemTypeSparePart',
  PACKAGING_MATERIAL: 'inventory.itemTypePackagingMaterial',
  CONSUMABLE: 'inventory.itemTypeConsumable',
  GENERAL: 'inventory.itemTypeGeneral',
};

export function isProductItemType(value: unknown): value is ProductItemType {
  return typeof value === 'string' && (PRODUCT_ITEM_TYPES as readonly string[]).includes(value);
}

/** Null is a real historical state: unclassified legacy rows are shown explicitly. */
export function itemTypeLabel(value: string | null | undefined, t: (key: string) => string): string {
  return isProductItemType(value) ? t(ITEM_TYPE_LABEL_KEYS[value]) : t('inventory.unclassified');
}
