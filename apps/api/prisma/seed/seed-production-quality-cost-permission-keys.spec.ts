import {
  PRODUCTION_QUALITY_COST_PERMISSIONS,
  PRODUCTION_QUALITY_PLAN_PERMISSION_KEYS,
  PRODUCTION_INSPECTION_PERMISSION_KEYS,
  PRODUCTION_NCR_PERMISSION_KEYS,
  PRODUCTION_COST_RATE_PERMISSION_KEYS,
  PRODUCTION_COST_SNAPSHOT_PERMISSION_KEYS,
  PRODUCTION_COST_TRANSACTION_PERMISSION_KEYS,
  PRODUCTION_COST_CALCULATION_PERMISSION_KEYS,
} from './seed-production-quality-cost-permission-keys';

describe('Phase 1.8 permission keys', () => {
  it('exactly matches the planned permission families', () => {
    expect([...PRODUCTION_QUALITY_PLAN_PERMISSION_KEYS].sort()).toEqual([
      'production-quality-plan:approve',
      'production-quality-plan:create',
      'production-quality-plan:deactivate',
      'production-quality-plan:delete',
      'production-quality-plan:read',
      'production-quality-plan:reject',
      'production-quality-plan:submit',
      'production-quality-plan:update',
    ].sort());
    expect([...PRODUCTION_INSPECTION_PERMISSION_KEYS].sort()).toEqual([
      'production-inspection:complete',
      'production-inspection:create',
      'production-inspection:read',
    ].sort());
    expect([...PRODUCTION_NCR_PERMISSION_KEYS].sort()).toEqual([
      'production-ncr:attach',
      'production-ncr:create',
      'production-ncr:read',
      'production-ncr:transition',
    ].sort());
    expect([...PRODUCTION_COST_RATE_PERMISSION_KEYS].sort()).toEqual([
      'production-cost-rate:create',
      'production-cost-rate:delete',
      'production-cost-rate:read',
      'production-cost-rate:update',
    ].sort());
    expect([...PRODUCTION_COST_SNAPSHOT_PERMISSION_KEYS].sort()).toEqual([
      'production-cost-snapshot:create',
      'production-cost-snapshot:freeze',
      'production-cost-snapshot:read',
      'production-cost-snapshot:supersede',
      'production-cost-snapshot:update',
    ].sort());
    expect([...PRODUCTION_COST_TRANSACTION_PERMISSION_KEYS].sort()).toEqual([
      'production-cost-transaction:post',
      'production-cost-transaction:read',
      'production-cost-transaction:reverse',
    ].sort());
    expect([...PRODUCTION_COST_CALCULATION_PERMISSION_KEYS].sort()).toEqual([
      'production-cost-calculation:create',
      'production-cost-calculation:finalize',
      'production-cost-calculation:link',
      'production-cost-calculation:read',
      'production-cost-calculation:reopen',
      'production-cost-calculation:review',
    ].sort());
  });

  it('derives module/action pairs and has no duplicates', () => {
    expect(PRODUCTION_QUALITY_COST_PERMISSIONS).toEqual(
      PRODUCTION_QUALITY_COST_PERMISSIONS.map((p) => ({ key: p.key, module: p.key.split(':')[0], action: p.key.split(':')[1] })),
    );
    expect(new Set(PRODUCTION_QUALITY_COST_PERMISSIONS.map((p) => p.key)).size).toBe(PRODUCTION_QUALITY_COST_PERMISSIONS.length);
  });
});
