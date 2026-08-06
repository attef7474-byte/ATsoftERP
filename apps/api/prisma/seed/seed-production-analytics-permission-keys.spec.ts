import {
  PRODUCTION_ANALYTICS_PERMISSIONS,
  PRODUCTION_PERFORMANCE_TARGET_PERMISSION_KEYS,
  PRODUCTION_ANALYTICS_PERMISSION_KEYS,
} from './seed-production-analytics-permission-keys';

describe('Phase 1.9 permission keys', () => {
  it('exactly matches the planned permission families', () => {
    expect([...PRODUCTION_PERFORMANCE_TARGET_PERMISSION_KEYS].sort()).toEqual([
      'production-performance-target:approve',
      'production-performance-target:create',
      'production-performance-target:deactivate',
      'production-performance-target:delete',
      'production-performance-target:read',
      'production-performance-target:submit',
      'production-performance-target:update',
    ].sort());
    expect([...PRODUCTION_ANALYTICS_PERMISSION_KEYS].sort()).toEqual([
      'production-analytics:export',
      'production-analytics:read',
    ].sort());
  });

  it('derives module/action pairs and has no duplicates', () => {
    expect(PRODUCTION_ANALYTICS_PERMISSIONS).toEqual(
      PRODUCTION_ANALYTICS_PERMISSIONS.map((p) => ({ key: p.key, module: p.key.split(':')[0], action: p.key.split(':')[1] })),
    );
    expect(new Set(PRODUCTION_ANALYTICS_PERMISSIONS.map((p) => p.key)).size).toBe(PRODUCTION_ANALYTICS_PERMISSIONS.length);
  });
});
