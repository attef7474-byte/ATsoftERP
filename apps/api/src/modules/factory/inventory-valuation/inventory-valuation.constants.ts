// VAL-R1A: canonical valuation contract constants.
//
// These constants are the application-side source of truth for the valuation
// domain's fixed string values. They must remain in lock-step with the SQL
// Server CHECK constraint definitions created by the inventory_valuation_r1a
// migration (see the DB-contract regression spec). Keep this file minimal: no
// runtime business services, no permission keys, no posting logic.

export const INVENTORY_VALUATION_METHODS = ['WEIGHTED_AVERAGE'] as const;

export const INVENTORY_VALUATION_POLICY_STATUSES = [
  'DRAFT',
  'INITIALIZING',
  'ACTIVE',
  'RETIRED',
] as const;

export const INVENTORY_VALUATION_METHOD_DEFAULT = 'WEIGHTED_AVERAGE';

export const INVENTORY_VALUATION_POLICY_STATUS_DEFAULT = 'DRAFT';
