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
  // VAL-R1C: explicit activation of the perpetual weighted moving average
  // engine for a warehouse. Only a holder of this permission may transition a
  // fully-ready INITIALIZING policy to ACTIVE (activation is never automatic).
  activate: 'inventory-valuation:activate',
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
  // VAL-R1C: activation of the weighted moving average engine for a warehouse.
  policyActivate: 'POLICY_ACTIVATE',
} as const;

// VAL-R1C: valuation method string persisted into the InventoryMovementLine
// monetary snapshot quartet for valued postings.
export const INVENTORY_VALUATION_METHOD_WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE' as const;

// VAL-R1C/VAL-R1D: authoritative coverage registry of every source path that can
// mutate InventoryBalance.quantity / quantityBase. Each registered mutator must
// be either VALUATION_AWARE_R1C (perpetual moving-average engine applies),
// VALUATION_AWARE_R1D (the VAL-R1D appreciated transfer / stock-adjustment /
// physical-count engine applies), or BLOCKED_WHEN_ACTIVE (rejected while an
// ACTIVE valuation policy exists for the warehouse). Activation fails
// (VALUATION_UNPROTECTED_MUTATOR) if any registered mutator is neither. This
// list is the single source of truth for the coverage gate; the engine consults
// it during activation and the blocking helpers use it to keep every covered
// flow safe. Registry is intentionally additive: adding a NEW mutator later must
// also add its entry here before activation can pass.
export const INVENTORY_MUTATOR_COVERAGE = [
  // Generic movement posting: OUT lines become a VALUED_ISSUE when ACTIVE.
  { key: 'INVENTORY_MOVEMENT_POST', classification: 'VALUATION_AWARE_R1C' as const },
  // Generic movement inbound posting without a trusted receipt cost source is
  // blocked while ACTIVE (see engine classifyValuedMovement).
  { key: 'INVENTORY_MOVEMENT_IN_CREATE', classification: 'BLOCKED_WHEN_ACTIVE' as const },
  // Operational receipt posting carries the R1B trusted unitCost + currency and
  // is applied as a VALUED_RECEIPT when ACTIVE.
  { key: 'OPERATIONAL_RECEIPT_POST', classification: 'VALUATION_AWARE_R1C' as const },
  // Opening-balance posting is legacy initialization and is blocked while ACTIVE.
  { key: 'OPENING_BALANCE_POST', classification: 'BLOCKED_WHEN_ACTIVE' as const },
  // Inventory stock adjustment posting (ADJUSTMENT_IN/OUT) is valuation-aware for
  // ACTIVE warehouses in VAL-R1D: OUT revalues at the current moving average,
  // IN requires an explicit cost + policy currency + reason (cost-input RBAC).
  { key: 'STOCK_ADJUSTMENT_POST', classification: 'VALUATION_AWARE_R1D' as const },
  // Legacy inventory adjustment posting stays blocked while ACTIVE (no movement
  // record, no valuation authority; a second parallel adjustment authority is
  // forbidden — see the R1D canonical-flow decision).
  { key: 'INVENTORY_ADJUSTMENT_POST', classification: 'BLOCKED_WHEN_ACTIVE' as const },
  // Warehouse transfer posting is valuation-aware for ACTIVE warehouses in
  // VAL-R1D: requires BOTH warehouses ACTIVE under WEIGHTED_AVERAGE with the
  // same currency; a single authoritative transferTotalValue conserves combined
  // value.
  { key: 'STOCK_TRANSFER_POST', classification: 'VALUATION_AWARE_R1D' as const },
  // Physical count variance posting is valuation-aware for ACTIVE warehouses in
  // VAL-R1D: shortage revalues at the current moving average, surplus requires
  // an explicit cost + policy currency + reason.
  { key: 'PHYSICAL_COUNT_POST', classification: 'VALUATION_AWARE_R1D' as const },
  // VAL-R1E: maintenance stock issue is valuation-aware for ACTIVE warehouses:
  // valued at current weighted moving average via the inventory valuation engine.
  { key: 'MAINTENANCE_STOCK_ISSUE', classification: 'VALUATION_AWARE_R1E' as const },
  // Maintenance stock return is blocked while ACTIVE — no trusted original-issue
  // cost linkage exists to derive the return valuation (deferred to future work).
  { key: 'MAINTENANCE_STOCK_RETURN', classification: 'BLOCKED_WHEN_ACTIVE' as const },
  // VAL-R1E: maintenance work-order part issue is valuation-aware for ACTIVE
  // warehouses: valued at current weighted moving average.
  { key: 'MAINTENANCE_WORK_ORDER_ISSUE', classification: 'VALUATION_AWARE_R1E' as const },
  // VAL-R1F: production ISSUE / CONSUMPTION posts at the current moving average.
  // A RETURN is valuation-aware only when every line is immutably linked to a
  // trusted POSTED issue/consumption line carrying the original quartet.
  { key: 'PRODUCTION_MATERIAL_ISSUE_POST', classification: 'VALUATION_AWARE_R1F' as const },
  { key: 'PRODUCTION_MATERIAL_CONSUMPTION_POST', classification: 'VALUATION_AWARE_R1F' as const },
  { key: 'PRODUCTION_MATERIAL_LINKED_RETURN_POST', classification: 'VALUATION_AWARE_R1F' as const },
  { key: 'PRODUCTION_MATERIAL_UNLINKED_RETURN_POST', classification: 'BLOCKED_WHEN_ACTIVE' as const },
  // Mixed OUT/IN substitution does not yet have a trusted value-conservation
  // contract and therefore remains blocked while ACTIVE.
  { key: 'PRODUCTION_MATERIAL_SUBSTITUTION_POST', classification: 'BLOCKED_WHEN_ACTIVE' as const },
  // Finished-goods valuation remains explicitly deferred to VAL-R1G.
  { key: 'PRODUCTION_FINISHED_GOODS_POST', classification: 'BLOCKED_WHEN_ACTIVE' as const },
  // Movement reversal / true-return into an ACTIVE valuation warehouse is blocked
  // for VAL-R1C (boolean return support is deferred to a later VAL slice).
  { key: 'INVENTORY_MOVEMENT_TRUE_RETURN', classification: 'BLOCKED_WHEN_ACTIVE' as const },
  // Balance recalculation must never run against an ACTIVE warehouse because it
  // would bypass the moving-average ledger.
  { key: 'INVENTORY_BALANCE_RECALCULATE', classification: 'BLOCKED_WHEN_ACTIVE' as const },
] as const;

// VAL-R1C: movement types that carry a trusted R1B receipt cost source and are
// therefore eligible to become a VALUED_RECEIPT while ACTIVE.
export const INVENTORY_VALUATION_VALUED_RECEIPT_MOVEMENT_TYPES = ['STOCK_RECEIVING'] as const;

// VAL-R1C: source types produced by the deferred (future-slice) flows that are
// always blocked while an ACTIVE valuation policy exists for the warehouse.
export const INVENTORY_VALUATION_BLOCKED_ACTIVE_SOURCE_TYPES: readonly string[] = [
  'PRODUCTION',
  'PRODUCTION_MATERIAL',
  'PRODUCTION_MATERIAL_DOCUMENT',
  'PRODUCTION_FINISHED_GOODS',
  'PRODUCTION_FINISHED_GOODS_RECEIPT',
  'MAINTENANCE',
  'STOCK_ADJUSTMENT',
  'STM_INVENTORY_ADJUSTMENT',
  'INVENTORY_ADJUSTMENT',
  'STOCK_TRANSFER',
  'PHYSICAL_COUNT',
];
