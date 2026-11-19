import { isProductItemType, ProductItemType } from '../products/product-item-type.domain';

/**
 * Phase 2 — canonical vocabulary of the single user-facing "إذن استلام".
 *
 * `ReceiptType` describes WHAT is being received. It is deliberately separate
 * from `ReceiptSource` (WHERE it came from) and from the native authority that
 * persists the document. A receipt type maps to exactly one Product.itemType
 * and exactly one native writing authority.
 */
export const RECEIPT_TYPES = [
  'RAW_MATERIAL',
  'SPARE_PART',
  'FINISHED_GOOD',
  'PACKAGING_MATERIAL',
  'CONSUMABLE',
  'GENERAL',
] as const;

export type ReceiptType = (typeof RECEIPT_TYPES)[number];

/** Only these types may be written through InventoryOperationalReceipt. */
export const OPERATIONAL_RECEIPT_TYPES = [
  'RAW_MATERIAL',
  'SPARE_PART',
  'PACKAGING_MATERIAL',
  'CONSUMABLE',
  'GENERAL',
] as const;

const OPERATIONAL_RECEIPT_TYPE_SET = new Set<string>(OPERATIONAL_RECEIPT_TYPES);

/** Distinct from receipt type. Never used to infer item type. */
export const RECEIPT_SOURCES = ['SUPPLIER', 'RETURN', 'INTERNAL', 'OTHER'] as const;
export type ReceiptSource = (typeof RECEIPT_SOURCES)[number];

export type ReceiptAuthority = 'OPERATIONAL' | 'PRODUCTION_FG';

const RECEIPT_TYPE_SET = new Set<string>(RECEIPT_TYPES);
const RECEIPT_SOURCE_SET = new Set<string>(RECEIPT_SOURCES);

/** Exact 1:1 mapping enforced by the backend for every receipt line. */
export const RECEIPT_TYPE_TO_ITEM_TYPE: Record<ReceiptType, ProductItemType> = {
  RAW_MATERIAL: 'RAW_MATERIAL',
  SPARE_PART: 'SPARE_PART',
  FINISHED_GOOD: 'FINISHED_GOOD',
  PACKAGING_MATERIAL: 'PACKAGING_MATERIAL',
  CONSUMABLE: 'CONSUMABLE',
  GENERAL: 'GENERAL',
};

/** Native authority selected by the orchestration UI — never persisted as a new table. */
export const RECEIPT_TYPE_AUTHORITY: Record<ReceiptType, ReceiptAuthority> = {
  RAW_MATERIAL: 'OPERATIONAL',
  SPARE_PART: 'OPERATIONAL',
  PACKAGING_MATERIAL: 'OPERATIONAL',
  CONSUMABLE: 'OPERATIONAL',
  GENERAL: 'OPERATIONAL',
  FINISHED_GOOD: 'PRODUCTION_FG',
};

export function isReceiptType(value: unknown): value is ReceiptType {
  return typeof value === 'string' && RECEIPT_TYPE_SET.has(value);
}

export function isOperationalReceiptType(value: unknown): boolean {
  return typeof value === 'string' && OPERATIONAL_RECEIPT_TYPE_SET.has(value);
}

export function isReceiptSource(value: unknown): value is ReceiptSource {
  return typeof value === 'string' && RECEIPT_SOURCE_SET.has(value);
}

export function itemTypeForReceiptType(value: ReceiptType): ProductItemType {
  return RECEIPT_TYPE_TO_ITEM_TYPE[value];
}

export function authorityForReceiptType(value: ReceiptType): ReceiptAuthority {
  return RECEIPT_TYPE_AUTHORITY[value];
}

/**
 * True only when a Product is eligible for the selected receipt type.
 * A null/unknown itemType is NEVER silently accepted as GENERAL: historical
 * unclassified items must be classified explicitly before daily receiving.
 */
export function productMatchesReceiptType(receiptType: ReceiptType, productItemType: unknown): boolean {
  return isProductItemType(productItemType) && productItemType === itemTypeForReceiptType(receiptType);
}
