import { PRODUCTION_RUN_PERMISSION_KEYS, PRODUCTION_OUTPUT_PERMISSION_KEYS, PRODUCTION_MEASUREMENT_POINT_PERMISSION_KEYS, PRODUCTION_RUN_PERMISSIONS } from './seed-production-run-permission-keys';

describe('Phase 1.5 permission keys', () => {
  it('exactly matches the run lifecycle actions', () => {
    expect([...PRODUCTION_RUN_PERMISSION_KEYS].sort()).toEqual([
      'production-run:abort', 'production-run:complete', 'production-run:pause',
      'production-run:read', 'production-run:resume', 'production-run:start',
    ].sort());
    expect([...PRODUCTION_OUTPUT_PERMISSION_KEYS].sort()).toEqual(['production-output:correct', 'production-output:record'].sort());
    expect([...PRODUCTION_MEASUREMENT_POINT_PERMISSION_KEYS].sort()).toEqual([
      'production-measurement-point:activate', 'production-measurement-point:create',
      'production-measurement-point:deactivate', 'production-measurement-point:delete',
      'production-measurement-point:read', 'production-measurement-point:update',
    ].sort());
  });

  it('derives module/action pairs from the keys', () => {
    expect(PRODUCTION_RUN_PERMISSIONS).toEqual(PRODUCTION_RUN_PERMISSIONS.map((p) => ({ key: p.key, module: p.key.split(':')[0], action: p.key.split(':')[1] })));
    expect(new Set(PRODUCTION_RUN_PERMISSIONS.map((p) => p.key)).size).toBe(PRODUCTION_RUN_PERMISSIONS.length);
  });
});