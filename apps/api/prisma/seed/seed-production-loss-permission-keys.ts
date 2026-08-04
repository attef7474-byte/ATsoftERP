export const PRODUCTION_LOSS_REASON_PERMISSION_KEYS = [
  'production-loss-reason:create',
  'production-loss-reason:read',
  'production-loss-reason:update',
  'production-loss-reason:delete',
  'production-loss-reason:activate',
  'production-loss-reason:deactivate',
] as const;

export const PRODUCTION_DOWNTIME_PERMISSION_KEYS = [
  'production-downtime:read',
  'production-downtime:record',
  'production-downtime:correct',
  'production-downtime:close',
  'production-downtime:link-maintenance',
] as const;

export const PRODUCTION_LOSS_PERMISSION_KEYS = [
  'production-loss:read',
  'production-loss:record',
  'production-loss:correct',
] as const;

export const PRODUCTION_LOSS_PERMISSIONS = [
  ...PRODUCTION_LOSS_REASON_PERMISSION_KEYS,
  ...PRODUCTION_DOWNTIME_PERMISSION_KEYS,
  ...PRODUCTION_LOSS_PERMISSION_KEYS,
].map((key) => ({
  key,
  module: key.split(':')[0],
  action: key.split(':')[1],
}));
