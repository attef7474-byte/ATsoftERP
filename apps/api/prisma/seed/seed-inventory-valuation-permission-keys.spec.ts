import { INVENTORY_VALUATION_PERMISSIONS } from './seed-inventory-valuation-permission-keys';
import { INVENTORY_VALUATION_PERMISSION_KEYS } from '../../src/modules/factory/inventory-valuation/inventory-valuation.constants';

describe('seedInventoryValuationPermissionKeys', () => {
  it('seeds exactly the four R1B+R1C valuation permission keys in lock-step with the module constants', () => {
    expect(INVENTORY_VALUATION_PERMISSIONS.map((p) => p.key).sort()).toEqual(
      [
        INVENTORY_VALUATION_PERMISSION_KEYS.read,
        INVENTORY_VALUATION_PERMISSION_KEYS.costInput,
        INVENTORY_VALUATION_PERMISSION_KEYS.initialize,
        INVENTORY_VALUATION_PERMISSION_KEYS.activate,
      ].sort(),
    );
  });

  it('has the expected length and no duplicate keys', () => {
    expect(INVENTORY_VALUATION_PERMISSIONS).toHaveLength(4);
    expect(new Set(INVENTORY_VALUATION_PERMISSIONS.map((p) => p.key)).size).toBe(4);
  });

  it('maps module/action to match the colon-split public convention', () => {
    for (const p of INVENTORY_VALUATION_PERMISSIONS) {
      expect(p.module).toBe('inventory-valuation');
      expect(p.action).toBe(p.key.split(':')[1]);
    }
  });

  it('includes the R1C activate key used to gate engine activation', () => {
    expect(INVENTORY_VALUATION_PERMISSIONS.map((p) => p.key)).toContain('inventory-valuation:activate');
  });
});
