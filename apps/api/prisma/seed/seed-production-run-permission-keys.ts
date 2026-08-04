export const PRODUCTION_RUN_PERMISSION_KEYS = [
  'production-run:read',
  'production-run:start',
  'production-run:pause',
  'production-run:resume',
  'production-run:complete',
  'production-run:abort',
] as const;

export const PRODUCTION_OUTPUT_PERMISSION_KEYS = [
  'production-output:record',
  'production-output:correct',
] as const;

export const PRODUCTION_MEASUREMENT_POINT_PERMISSION_KEYS = [
  'production-measurement-point:create',
  'production-measurement-point:read',
  'production-measurement-point:update',
  'production-measurement-point:delete',
  'production-measurement-point:activate',
  'production-measurement-point:deactivate',
] as const;

export const PRODUCTION_RUN_PERMISSIONS = [
  ...PRODUCTION_RUN_PERMISSION_KEYS,
  ...PRODUCTION_OUTPUT_PERMISSION_KEYS,
  ...PRODUCTION_MEASUREMENT_POINT_PERMISSION_KEYS,
].map((key) => ({
  key,
  module: key.split(':')[0],
  action: key.split(':')[1],
}));