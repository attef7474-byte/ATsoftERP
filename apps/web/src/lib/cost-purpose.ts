export const COST_PURPOSE_VALUES = [
  'MAINTENANCE',
  'PRODUCTION',
  'QUALITY',
  'PROJECT',
  'UTILITIES',
  'ADMIN',
  'DEVELOPMENT',
  'OTHER',
] as const;

export type CostPurpose = (typeof COST_PURPOSE_VALUES)[number];

export const MAINTENANCE_COST_PURPOSE = 'MAINTENANCE' as const;
export const PRODUCTION_COST_PURPOSE = 'PRODUCTION' as const;

export const COST_PURPOSE_OVERRIDE_PERMISSION = 'cost-purpose:override';
