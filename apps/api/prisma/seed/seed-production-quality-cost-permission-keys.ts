export const PRODUCTION_QUALITY_PLAN_PERMISSION_KEYS = [
  'production-quality-plan:create',
  'production-quality-plan:read',
  'production-quality-plan:update',
  'production-quality-plan:delete',
  'production-quality-plan:submit',
  'production-quality-plan:approve',
  'production-quality-plan:reject',
  'production-quality-plan:deactivate',
] as const;

export const QUALITY_CHARACTERISTIC_PERMISSION_KEYS = [
  'quality-characteristic:create',
  'quality-characteristic:read',
  'quality-characteristic:update',
  'quality-characteristic:delete',
] as const;

export const QUALITY_SAMPLING_POINT_PERMISSION_KEYS = [
  'quality-sampling-point:create',
  'quality-sampling-point:read',
  'quality-sampling-point:update',
  'quality-sampling-point:delete',
] as const;

export const PRODUCTION_INSPECTION_PERMISSION_KEYS = [
  'production-inspection:create',
  'production-inspection:read',
  'production-inspection:complete',
] as const;

export const QUALITY_DISPOSITION_PERMISSION_KEYS = [
  'quality-disposition:create',
  'quality-disposition:read',
  'quality-disposition:approve',
  'quality-disposition:reject',
] as const;

export const PRODUCTION_NCR_PERMISSION_KEYS = [
  'production-ncr:create',
  'production-ncr:read',
  'production-ncr:transition',
  'production-ncr:attach',
] as const;

export const PRODUCTION_COST_RATE_PERMISSION_KEYS = [
  'production-cost-rate:create',
  'production-cost-rate:read',
  'production-cost-rate:update',
  'production-cost-rate:delete',
] as const;

export const PRODUCTION_COST_SNAPSHOT_PERMISSION_KEYS = [
  'production-cost-snapshot:create',
  'production-cost-snapshot:read',
  'production-cost-snapshot:update',
  'production-cost-snapshot:freeze',
  'production-cost-snapshot:supersede',
] as const;

export const PRODUCTION_COST_TRANSACTION_PERMISSION_KEYS = [
  'production-cost-transaction:post',
  'production-cost-transaction:read',
  'production-cost-transaction:reverse',
] as const;

export const PRODUCTION_QUALITY_COST_PERMISSIONS = [
  ...PRODUCTION_QUALITY_PLAN_PERMISSION_KEYS,
  ...QUALITY_CHARACTERISTIC_PERMISSION_KEYS,
  ...QUALITY_SAMPLING_POINT_PERMISSION_KEYS,
  ...PRODUCTION_INSPECTION_PERMISSION_KEYS,
  ...QUALITY_DISPOSITION_PERMISSION_KEYS,
  ...PRODUCTION_NCR_PERMISSION_KEYS,
  ...PRODUCTION_COST_RATE_PERMISSION_KEYS,
  ...PRODUCTION_COST_SNAPSHOT_PERMISSION_KEYS,
  ...PRODUCTION_COST_TRANSACTION_PERMISSION_KEYS,
].map((key) => ({
  key,
  module: key.split(':')[0],
  action: key.split(':')[1],
}));
