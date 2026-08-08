import { OPERATIONAL_RELIABILITY_PERMISSION_KEYS } from '../../src/modules/factory/operational-analytics/reliability/operational-reliability.constants';
import { OPERATIONAL_RELIABILITY_PERMISSIONS } from './seed-operational-reliability-permission-keys';

describe('Phase 2 Batch 2C operational reliability permission keys', () => {
  it('exactly matches the 2 controller-enforced keys', () => {
    expect(OPERATIONAL_RELIABILITY_PERMISSIONS.map((p) => p.key).sort()).toEqual(
      [OPERATIONAL_RELIABILITY_PERMISSION_KEYS.read, OPERATIONAL_RELIABILITY_PERMISSION_KEYS.export].sort(),
    );
  });

  it('has exactly 2 unique keys', () => {
    expect(OPERATIONAL_RELIABILITY_PERMISSIONS).toHaveLength(2);
    expect(new Set(OPERATIONAL_RELIABILITY_PERMISSIONS.map((p) => p.key)).size).toBe(2);
  });

  it('does not include classify or approve keys (D-2C-4)', () => {
    const keys = OPERATIONAL_RELIABILITY_PERMISSIONS.map((p) => p.key);
    expect(keys).not.toContain('operational-reliability:classify');
    expect(keys).not.toContain('operational-reliability:approve');
  });

  it('derives module/action pairs from the keys', () => {
    for (const p of OPERATIONAL_RELIABILITY_PERMISSIONS) {
      expect(p.module).toBe('operational-reliability');
      expect(p.action).toBe(p.key.split(':')[1]);
    }
  });
});
