export const PRODUCTION_ORDER_PERMISSION_KEYS = [
  'production-order:read',
  'production-order:create',
  'production-order:update',
  'production-order:delete',
  'production-order:recalculate',
  'production-order:plan',
  'production-order:readiness',
  'production-order:release',
  'production-order:cancel',
  'production-order:archive',
  'production-order:close',
  'production-order:reopen',
  'production-order:attach',
] as const;

export const PRODUCTION_ORDER_PERMISSIONS = PRODUCTION_ORDER_PERMISSION_KEYS.map((key) => ({
  key,
  module: 'production-order',
  action: key.split(':')[1],
}));
