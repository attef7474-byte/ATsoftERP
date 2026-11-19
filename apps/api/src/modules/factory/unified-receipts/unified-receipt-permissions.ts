/**
 * Phase 2 deliberately reuses the two already-seeded native read permissions.
 * There is no new umbrella "receipt:read" key: opening the unified page is an
 * OR of these keys, and every action still calls its own native authority.
 */
export const UNIFIED_RECEIPT_READ_PERMISSIONS = {
  operational: 'inventory:operational-receipt:read',
  productionFinishedGoods: 'production-finished-goods-receipt:read',
} as const;
