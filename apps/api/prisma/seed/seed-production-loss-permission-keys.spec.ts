import {
  PRODUCTION_LOSS_PERMISSIONS,
  PRODUCTION_LOSS_REASON_PERMISSION_KEYS,
  PRODUCTION_DOWNTIME_PERMISSION_KEYS,
  PRODUCTION_LOSS_PERMISSION_KEYS,
} from './seed-production-loss-permission-keys';

describe('Phase 1.6 permission keys', () => {
  it('exactly matches the planned permission families', () => {
    expect([...PRODUCTION_LOSS_REASON_PERMISSION_KEYS].sort()).toEqual([
      'production-loss-reason:activate',
      'production-loss-reason:create',
      'production-loss-reason:deactivate',
      'production-loss-reason:delete',
      'production-loss-reason:read',
      'production-loss-reason:update',
    ].sort());
    expect([...PRODUCTION_DOWNTIME_PERMISSION_KEYS].sort()).toEqual([
      'production-downtime:close',
      'production-downtime:correct',
      'production-downtime:link-maintenance',
      'production-downtime:read',
      'production-downtime:record',
    ].sort());
    expect([...PRODUCTION_LOSS_PERMISSION_KEYS].sort()).toEqual([
      'production-loss:correct',
      'production-loss:read',
      'production-loss:record',
    ].sort());
  });

  it('derives module/action pairs and has no duplicates', () => {
    expect(PRODUCTION_LOSS_PERMISSIONS).toEqual(
      PRODUCTION_LOSS_PERMISSIONS.map((p) => ({ key: p.key, module: p.key.split(':')[0], action: p.key.split(':')[1] })),
    );
    expect(new Set(PRODUCTION_LOSS_PERMISSIONS.map((p) => p.key)).size).toBe(PRODUCTION_LOSS_PERMISSIONS.length);
  });
});
