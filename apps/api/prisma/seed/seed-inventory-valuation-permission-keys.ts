import { INVENTORY_VALUATION_PERMISSION_KEYS } from '../../src/modules/factory/inventory-valuation/inventory-valuation.constants';

/**
 * Inventory Valuation R1B permission keys, seeded into the shared
 * extraPermissions spread (NOT the MODULES auto-CRUD list, which would generate
 * unwanted update/delete keys). Keys are single-sourced from the module
 * constants file so there is no duplication between the seeded names and the
 * runtime RBAC gate.
 */
export const INVENTORY_VALUATION_PERMISSIONS = [
  INVENTORY_VALUATION_PERMISSION_KEYS.read,
  INVENTORY_VALUATION_PERMISSION_KEYS.costInput,
  INVENTORY_VALUATION_PERMISSION_KEYS.initialize,
  INVENTORY_VALUATION_PERMISSION_KEYS.activate,
].map((key) => ({
  key,
  module: key.split(':')[0],
  action: key.split(':')[1],
}));
