import { BATCH_B_PERMISSIONS } from './seed-batch-b-permission-keys';

describe('Batch B permission keys (shift-handover)', () => {
  it('defines exactly 4 shift-handover permissions', () => {
    const keys = BATCH_B_PERMISSIONS.map((p) => p.key).sort();
    expect(keys).toEqual([
      'shift-handover:acknowledge',
      'shift-handover:create',
      'shift-handover:read',
      'shift-handover:submit',
    ]);
  });

  it('all entries have module and action matching key pattern', () => {
    for (const perm of BATCH_B_PERMISSIONS) {
      expect(perm.key).toBe(`${perm.module}:${perm.action}`);
      expect(perm.module).toBe('shift-handover');
    }
  });
});
