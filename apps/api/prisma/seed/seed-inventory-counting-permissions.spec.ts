import { INVENTORY_COUNTING_EXTRA_PERMISSIONS } from './seed-inventory-counting-permissions';

describe('Inventory counting / movement permission keys', () => {
  const seededKeys = new Set(INVENTORY_COUNTING_EXTRA_PERMISSIONS.map((p) => p.key));

  it('seeds every permission key enforced by inventory-movements.controller.ts', () => {
    const controllerKeys = [
      'inventory-movement:post',
      'inventory-movement:cancel',
      'inventory-movement:reverse',
    ];
    for (const key of controllerKeys) {
      expect(seededKeys.has(key)).toBe(true);
    }
  });

  it('has no duplicate permission keys', () => {
    expect(seededKeys.size).toBe(INVENTORY_COUNTING_EXTRA_PERMISSIONS.length);
  });

  it('derives module and action from each key', () => {
    for (const p of INVENTORY_COUNTING_EXTRA_PERMISSIONS) {
      const separator = p.key.lastIndexOf(':');
      expect(p.module).toBe(p.key.slice(0, separator));
      expect(p.action).toBe(p.key.slice(separator + 1));
    }
  });
});
