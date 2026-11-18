import {
  FINISHED_GOODS_ISSUE_PERMISSION_KEYS,
  PRODUCTION_FG_RECEIPT_PERMISSION_KEYS,
  PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS,
  PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS,
  SPARE_PART_ISSUE_DOCUMENT_PERMISSION_KEYS,
} from './seed-production-inventory-document-permission-keys';

const EXPECTED_SPARE_PART_ISSUE_KEYS = [
  'spare-part-issue:create',
  'spare-part-issue:read',
  'spare-part-issue:update',
  'spare-part-issue:delete',
  'spare-part-issue:post',
  'spare-part-issue:cancel',
  'spare-part-issue:submit',
  'spare-part-issue:withdraw',
  'spare-part-issue:approve',
  'spare-part-issue:reject',
  'spare-part-issue:cancel-approval',
];

describe('Phase 1.7 permission keys', () => {
  it('exactly matches the planned permission families', () => {
    expect([...PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS].sort()).toEqual([
      'production-material-document:approve',
      'production-material-document:cancel',
      'production-material-document:cancel-approval',
      'production-material-document:create',
      'production-material-document:delete',
      'production-material-document:post',
      'production-material-document:read',
      'production-material-document:reject',
      'production-material-document:reverse',
      'production-material-document:submit',
      'production-material-document:update',
      'production-material-document:withdraw',
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
    expect([...FINISHED_GOODS_ISSUE_PERMISSION_KEYS].sort()).toEqual([
      'finished-goods-issue:approve',
      'finished-goods-issue:cancel',
      'finished-goods-issue:cancel-approval',
      'finished-goods-issue:create',
      'finished-goods-issue:delete',
      'finished-goods-issue:post',
      'finished-goods-issue:read',
      'finished-goods-issue:reject',
      'finished-goods-issue:reverse',
      'finished-goods-issue:submit',
      'finished-goods-issue:update',
      'finished-goods-issue:withdraw',
    ].sort());
  });

  it('owns the exact stable standalone spare-part issue permission family', () => {
    expect([...SPARE_PART_ISSUE_DOCUMENT_PERMISSION_KEYS].sort()).toEqual([...EXPECTED_SPARE_PART_ISSUE_KEYS].sort());
    // The aggregate consumed by seed.ts is the only path that persists these keys.
    expect(
      PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS
        .filter((p) => p.module === 'spare-part-issue')
        .map((p) => p.key)
        .sort(),
    ).toEqual([...EXPECTED_SPARE_PART_ISSUE_KEYS].sort());
    expect(
      PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS
        .filter((p) => p.module === 'spare-part-issue')
        .every((p) => p.action === p.key.split(':')[1]),
    ).toBe(true);
  });

  it('derives module/action pairs and has no duplicates', () => {
    expect(PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS).toEqual(
      PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS.map((p) => ({ key: p.key, module: p.key.split(':')[0], action: p.key.split(':')[1] })),
    );
    expect(new Set(PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS.map((p) => p.key)).size).toBe(PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS.length);
  });
});
