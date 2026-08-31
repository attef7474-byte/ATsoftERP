import { INVENTORY_VALUATION_PERMISSIONS } from './seed-inventory-valuation-permission-keys';
import { INVENTORY_VALUATION_PERMISSION_KEYS } from '../../src/modules/factory/inventory-valuation/inventory-valuation.constants';

describe('seedInventoryValuationPermissionKeys', () => {
  it('seeds exactly the three R1B valuation permission keys', () => {
    expect(INVENTORY_VALUATION_PERMISSIONS.map((p) => p.key).sort()).toEqual(
      [
        INVENTORY_VALUATION_PERMISSION_KEYS.read,
        INVENTORY_VALUATION_PERMISSION_KEYS.costInput,
        INVENTORY_VALUATION_PERMISSION_KEYS.initialize,
      ].sort(),
    );
  });

  it('has the expected length and no duplicate keys', () => {
    expect(INVENTORY_VALUATION_PERMISSIONS).toHaveLength(3);
    expect(new Set(INVENTORY_VALUATION_PERMISSIONS.map((p) => p.key)).size).toBe(3);
  });

  it('maps module/action to match the colon-split public convention', () => {
    for (const p of INVENTORY_VALUATION_PERMISSIONS) {
      expect(p.module).toBe('inventory-valuation');
      expect(p.action).toBe(p.key.split(':')[1]);
    }
  });

  it('does NOT expose an activate key (deferred to VAL-R1C)', () => {
    expect(INVENTORY_VALUATION_PERMISSIONS.map((p) => p.key)).not.toContain('inventory-valuation:activate');
  });
});
