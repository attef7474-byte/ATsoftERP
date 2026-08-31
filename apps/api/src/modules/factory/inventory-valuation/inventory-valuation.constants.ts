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

// VAL-R1B: RBAC permission keys for the valuation policy workflow and the
// legacy-stock initialization evidence workflow. These are single-sourced here
// and referenced both by the seeded permission list and the runtime guards.
export const INVENTORY_VALUATION_PERMISSION_KEYS = {
  read: 'inventory-valuation:read',
  costInput: 'inventory-valuation:cost-input',
  initialize: 'inventory-valuation:initialize',
} as const;

// VAL-R1B: audit event identifiers (entity names) written through AuditService.
export const INVENTORY_VALUATION_AUDIT_ENTITY_POLICY = 'InventoryValuationPolicy';
export const INVENTORY_VALUATION_AUDIT_ENTITY_INITIALIZATION = 'InventoryValuationInitialization';

export const INVENTORY_VALUATION_POLICY_ACTIONS = {
  policyCreate: 'POLICY_CREATE',
  policyUpdate: 'POLICY_UPDATE',
  policyInitializationStart: 'POLICY_INITIALIZATION_START',
  openingCostInput: 'OPENING_COST_INPUT',
  receiptCostInput: 'RECEIPT_COST_INPUT',
  legacyValuationInitialize: 'LEGACY_VALUATION_INITIALIZE',
} as const;
