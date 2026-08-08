import { COST_CENTER_PERMISSION_KEYS } from '../../src/modules/factory/maintenance/cost-centers/cost-centers.constants';
import { OPERATIONAL_COST_CENTER_PERMISSION_KEYS, OPERATIONAL_COST_CENTER_PERMISSIONS } from './seed-operational-cost-center-permission-keys';

describe('Phase 2 Batch 2A operational cost center permission keys', () => {
  it('exactly matches the 7 controller-enforced keys', () => {
    expect([...OPERATIONAL_COST_CENTER_PERMISSION_KEYS].sort()).toEqual([
      COST_CENTER_PERMISSION_KEYS.activate,
      COST_CENTER_PERMISSION_KEYS.assign,
      COST_CENTER_PERMISSION_KEYS.create,
      COST_CENTER_PERMISSION_KEYS.deactivate,
      COST_CENTER_PERMISSION_KEYS.delete,
      COST_CENTER_PERMISSION_KEYS.read,
      COST_CENTER_PERMISSION_KEYS.update,
    ].sort());
  });

  it('has exactly 7 unique keys', () => {
    expect(OPERATIONAL_COST_CENTER_PERMISSION_KEYS).toHaveLength(7);
    expect(new Set(OPERATIONAL_COST_CENTER_PERMISSION_KEYS).size).toBe(7);
  });

  it('derives module/action pairs from the keys', () => {
    expect(OPERATIONAL_COST_CENTER_PERMISSIONS).toEqual(
      OPERATIONAL_COST_CENTER_PERMISSION_KEYS.map((key) => ({
        key,
        module: key.split(':')[0],
        action: key.split(':')[1],
      })),
    );
    expect(new Set(OPERATIONAL_COST_CENTER_PERMISSIONS.map((p) => p.key)).size).toBe(OPERATIONAL_COST_CENTER_PERMISSIONS.length);
    for (const p of OPERATIONAL_COST_CENTER_PERMISSIONS) {
      expect(p.module).toBe('operational-cost-center');
    }
  });
});
