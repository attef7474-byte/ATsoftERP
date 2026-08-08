export const PRODUCTION_CAPACITY_PERMISSION_KEYS = [
  'production-capacity-standard:read',
  'production-capacity-standard:create',
  'production-capacity-standard:update',
  'production-capacity-standard:approve',
  'production-capacity-standard:suspend',
  'production-capacity-standard:reactivate',
  'production-capacity-standard:archive',
  'production-capacity-standard:resolve',
] as const;

export const PRODUCTION_CAPACITY_PERMISSIONS = PRODUCTION_CAPACITY_PERMISSION_KEYS.map((key) => ({
  key,
  module: 'production-capacity-standard',
  action: key.split(':')[1],
}));
