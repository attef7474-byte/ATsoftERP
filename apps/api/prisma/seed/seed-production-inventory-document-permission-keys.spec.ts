import {
  PRODUCTION_FG_RECEIPT_PERMISSION_KEYS,
  PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS,
  PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS,
} from './seed-production-inventory-document-permission-keys';

describe('Phase 1.7 permission keys', () => {
  it('exactly matches the planned permission families', () => {
    expect([...PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS].sort()).toEqual([
      'production-material-document:cancel',
      'production-material-document:create',
      'production-material-document:delete',
      'production-material-document:post',
      'production-material-document:read',
      'production-material-document:reverse',
      'production-material-document:update',
    ].sort());
    expect([...PRODUCTION_FG_RECEIPT_PERMISSION_KEYS].sort()).toEqual([
      'production-finished-goods-receipt:cancel',
      'production-finished-goods-receipt:create',
      'production-finished-goods-receipt:delete',
      'production-finished-goods-receipt:post',
      'production-finished-goods-receipt:read',
      'production-finished-goods-receipt:reverse',
      'production-finished-goods-receipt:update',
    ].sort());
  });

  it('derives module/action pairs and has no duplicates', () => {
    expect(PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS).toEqual(
      PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS.map((p) => ({ key: p.key, module: p.key.split(':')[0], action: p.key.split(':')[1] })),
    );
    expect(new Set(PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS.map((p) => p.key)).size).toBe(PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS.length);
  });
});
