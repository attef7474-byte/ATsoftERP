export const OVERHEAD_PERIOD_PERMISSION_KEYS = [
  'production-cost-overhead-period:read',
  'production-cost-overhead-period:create',
  'production-cost-overhead-period:update',
  'production-cost-overhead-period:close',
  'production-cost-overhead-period:delete',
] as const;

export const OVERHEAD_ENTRY_PERMISSION_KEYS = [
  'production-cost-overhead:read',
  'production-cost-overhead:create',
  'production-cost-overhead:update',
  'production-cost-overhead:finalize',
  'production-cost-overhead:delete',
] as const;

export const OVERHEAD_PERMISSIONS = [
  ...OVERHEAD_PERIOD_PERMISSION_KEYS,
  ...OVERHEAD_ENTRY_PERMISSION_KEYS,
].map((key) => ({
  key,
  module: key.split(':')[0],
  action: key.split(':')[1],
}));
