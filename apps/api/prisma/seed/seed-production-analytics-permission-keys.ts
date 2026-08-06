export const PRODUCTION_PERFORMANCE_TARGET_PERMISSION_KEYS = [
  'production-performance-target:create',
  'production-performance-target:read',
  'production-performance-target:update',
  'production-performance-target:delete',
  'production-performance-target:submit',
  'production-performance-target:approve',
  'production-performance-target:deactivate',
] as const;

export const PRODUCTION_ANALYTICS_PERMISSION_KEYS = [
  'production-analytics:read',
  'production-analytics:export',
] as const;

export const PRODUCTION_ANALYTICS_PERMISSIONS = [
  ...PRODUCTION_PERFORMANCE_TARGET_PERMISSION_KEYS,
  ...PRODUCTION_ANALYTICS_PERMISSION_KEYS,
].map((key) => ({
  key,
  module: key.split(':')[0],
  action: key.split(':')[1],
}));
