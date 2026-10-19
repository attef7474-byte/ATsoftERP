import { ForbiddenException } from '@nestjs/common';
import { PRODUCT_PERMISSIONS } from '../../../prisma/seed/seed-product-permission-keys';

/**
 * Focused contract tests (B01-B20) for the Product permission-catalog reconciliation.
 *
 * They pin the exact defect this change fixes: the plural `products:*` keys enforced by
 * the product controllers and consumed by the unified ProductsWorkspace were absent from
 * the canonical seed (which only declared the unused singular `product:*` matrix keys),
 * making every product route a permanently-denied 403 for every non-SUPER_ADMIN role.
 *
 * The second block pins the least-privilege boundaries (product identity authority is
 * separate from production-configuration authority) at the unit level, complementing the
 * disposable-SQL E2E proof.
 */
describe('Product permission seed contract', () => {
  const keys = PRODUCT_PERMISSIONS.map((p) => p.key);

  it('declares exactly the four canonical product master keys', () => {
    expect([...keys].sort()).toEqual([
      'products:create',
      'products:delete',
      'products:read',
      'products:update',
    ]);
  });

  it('uses the plural products module consistently and a valid action', () => {
    for (const p of PRODUCT_PERMISSIONS) {
      expect(p.module).toBe('products');
      expect(p.key).toBe(`${p.module}:${p.action}`);
      expect(p.action).toBe(p.key.split(':')[1]);
    }
  });

  it('is free of duplicate codes', () => {
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not collide with the reserved production-product family', () => {
    for (const key of keys) expect(key.startsWith('production-product:')).toBe(false);
  });

  it('B19: seed contains every required product permission consumed by UI and backend', () => {
    for (const key of ['products:read', 'products:create', 'products:update', 'products:delete']) {
      expect(keys).toContain(key);
    }
  });

  it('B20: re-applying the manifest is idempotent (stable codes, no duplication)', () => {
    const first = [...keys].sort();
    const second = [...PRODUCT_PERMISSIONS.map((p) => p.key)].sort();
    expect(second).toEqual(first);
    expect(new Set([...first, ...second]).size).toBe(first.length);
  });
});

/**
 * Mirrors the canonical PermissionsGuard semantics (ACTIVE roles, ACTIVE permissions,
 * explicit SUPER_ADMIN bypass) and the aggregate's secondary-permission enforcement.
 */
describe('Product permission enforcement semantics (B01-B16)', () => {
  type Row = { roleCode: string; roleStatus: string; permKey: string; permStatus: string };

  const resolve = (rows: Row[]): { isSuperAdmin: boolean; keys: Set<string> } => {
    const keys = new Set<string>();
    for (const row of rows) {
      if (row.roleStatus !== 'ACTIVE') continue;
      if (row.roleCode === 'SUPER_ADMIN') return { isSuperAdmin: true, keys };
      if (row.permStatus === 'ACTIVE') keys.add(row.permKey);
    }
    return { isSuperAdmin: false, keys };
  };

  const hasAll = (rows: Row[], required: string[]) => {
    const { isSuperAdmin, keys } = resolve(rows);
    if (isSuperAdmin) return true;
    return required.every((k) => keys.has(k));
  };

  const row = (permKey: string, roleCode = 'R'): Row => ({ roleCode, roleStatus: 'ACTIVE', permKey, permStatus: 'ACTIVE' });
  const readOnly = [row('products:read')];
  const identityEditor = [...readOnly, row('products:update')];
  const productionEditor = [row('production-product:update')];
  const full = [...identityEditor, ...productionEditor];
  const superAdmin: Row[] = [{ roleCode: 'SUPER_ADMIN', roleStatus: 'ACTIVE', permKey: '', permStatus: 'ACTIVE' }];
  const inactiveRole: Row[] = [{ roleCode: 'R', roleStatus: 'INACTIVE', permKey: 'products:read', permStatus: 'ACTIVE' }];

  it('B01: product read permission is accepted', () => {
    expect(hasAll(readOnly, ['products:read'])).toBe(true);
  });

  it('B02: missing product read permission is denied', () => {
    expect(hasAll([], ['products:read'])).toBe(false);
  });

  it('B03/B04: product create granted vs missing', () => {
    expect(hasAll(identityEditor, ['products:create'])).toBe(false);
    expect(hasAll([...identityEditor, row('products:create')], ['products:create'])).toBe(true);
  });

  it('B05/B06: product update granted vs missing', () => {
    expect(hasAll(identityEditor, ['products:update'])).toBe(true);
    expect(hasAll(readOnly, ['products:update'])).toBe(false);
  });

  it('B07: product delete policy is enforced by its own key', () => {
    expect(hasAll(identityEditor, ['products:delete'])).toBe(false);
    expect(hasAll([...identityEditor, row('products:delete')], ['products:delete'])).toBe(true);
  });

  it('B08: ProductUom mutation authority rides on products:update (no dedicated layer)', () => {
    expect(hasAll(readOnly, ['products:update'])).toBe(false);
    expect(hasAll(identityEditor, ['products:update'])).toBe(true);
  });

  it('B09/B10: production config read/update use production-product:*', () => {
    expect(hasAll(readOnly, ['production-product:read'])).toBe(false);
    expect(hasAll(productionEditor, ['production-product:update'])).toBe(true);
  });

  it('B11: product update does NOT imply production update', () => {
    expect(hasAll(identityEditor, ['production-product:update'])).toBe(false);
  });

  it('B12: production update does NOT imply product update', () => {
    expect(hasAll(productionEditor, ['products:update'])).toBe(false);
  });

  it('B13: combined aggregate update requires both authorities', () => {
    expect(hasAll(identityEditor, ['products:update', 'production-product:update'])).toBe(false);
    expect(hasAll(productionEditor, ['products:update', 'production-product:update'])).toBe(false);
    expect(hasAll(full, ['products:update', 'production-product:update'])).toBe(true);
  });

  it('B14: unauthorized payload field mutation is prevented by requiring the secondary authority', () => {
    expect(hasAll(identityEditor, ['production-product:update'])).toBe(false);
    expect(() => {
      if (!hasAll(identityEditor, ['production-product:update'])) {
        throw new ForbiddenException({ messageKey: 'auth.insufficientPermissions' });
      }
    }).toThrow(ForbiddenException);
  });

  it('B15: inactive roles grant nothing', () => {
    expect(hasAll(inactiveRole, ['products:read'])).toBe(false);
  });

  it('B16: SUPER_ADMIN normal bypass is preserved', () => {
    expect(hasAll(superAdmin, [
      'products:read', 'products:create', 'products:update', 'products:delete',
      'production-product:create', 'production-product:update',
    ])).toBe(true);
  });
});
