export const OPERATIONAL_COST_RATE_AUDIT_ENTITY = 'OperationalCostRate';
export const OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY = 'OperationalStandardCostSnapshot';
export const OPERATIONAL_COST_TRANSACTION_AUDIT_ENTITY = 'OperationalCostTransaction';
export const OPERATIONAL_COST_CALCULATION_AUDIT_ENTITY = 'OperationalCostCalculation';

export const PRODUCTION_COST_PERMISSION_KEYS = {
  rateCreate: 'production-cost-rate:create',
  rateRead: 'production-cost-rate:read',
  rateUpdate: 'production-cost-rate:update',
  rateDelete: 'production-cost-rate:delete',
  snapshotCreate: 'production-cost-snapshot:create',
  snapshotRead: 'production-cost-snapshot:read',
  snapshotUpdate: 'production-cost-snapshot:update',
  snapshotFreeze: 'production-cost-snapshot:freeze',
  snapshotSupersede: 'production-cost-snapshot:supersede',
  transactionPost: 'production-cost-transaction:post',
  transactionRead: 'production-cost-transaction:read',
  transactionReverse: 'production-cost-transaction:reverse',
  calculationCreate: 'production-cost-calculation:create',
  calculationRead: 'production-cost-calculation:read',
  calculationLink: 'production-cost-calculation:link',
  calculationReview: 'production-cost-calculation:review',
  calculationFinalize: 'production-cost-calculation:finalize',
  calculationReopen: 'production-cost-calculation:reopen',
} as const;

export const OPERATIONAL_COST_RATE_INCLUDE = {
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
} as const;

export const OPERATIONAL_COST_SNAPSHOT_INCLUDE = {
  productionProductDefinition: {
    select: { id: true, code: true, productId: true, product: { select: { id: true, code: true, name: true } } },
  },
  productionVersion: { select: { id: true, versionNumber: true, versionLabel: true } },
  productionPackaging: { select: { id: true, packagingType: true, packQuantity: true } },
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
} as const;

export const OPERATIONAL_COST_TRANSACTION_INCLUDE = {
  productionOrder: { select: { id: true, orderNumber: true, status: true } },
  productionRun: { select: { id: true, runNumber: true, status: true } },
  product: { select: { id: true, code: true, name: true } },
  productionVersion: { select: { id: true, versionNumber: true, versionLabel: true } },
  productionPackaging: { select: { id: true, packagingType: true, packQuantity: true } },
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true } },
  shift: { select: { id: true, code: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
  maintenanceWorkOrder: { select: { id: true, workOrderNumber: true, title: true, status: true } },
  maintenanceRequest: { select: { id: true, requestNumber: true, title: true, status: true } },
  standardCostSnapshot: { select: { id: true, code: true, revision: true, status: true } },
  outputEvent: { select: { id: true, eventType: true, classification: true, quantity: true, unit: true } },
  reversalOf: { select: { id: true, sourceNumberSnapshot: true, occurredAt: true } },
  calculation: { select: { id: true, code: true, revision: true, status: true } },
} as const;

export const OPERATIONAL_COST_CALCULATION_INCLUDE = {
  productionOrder: { select: { id: true, orderNumber: true, status: true } },
  productionRun: { select: { id: true, runNumber: true, status: true } },
  supersedes: { select: { id: true, code: true, revision: true, status: true } },
  transactions: {
    select: {
      id: true,
      eventType: true,
      sourceType: true,
      sourceId: true,
      quantity: true,
      unit: true,
      rate: true,
      amount: true,
      standardAmount: true,
      varianceAmount: true,
      occurredAt: true,
      status: true,
    },
  },
} as const;

export const COST_TYPES = ['MATERIAL', 'LABOR', 'MACHINE', 'OVERHEAD', 'DOWNTIME'] as const;
export const COST_UNITS = ['PACK', 'UNIT', 'KG', 'TON', 'LITER', 'BATCH', 'HOUR', 'MINUTE'] as const;
export const COST_RATE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const COST_SNAPSHOT_STATUSES = ['DRAFT', 'FROZEN', 'SUPERSEDED'] as const;
export const COST_TRANSACTION_STATUSES = ['POSTED', 'REVERSED'] as const;
export const COST_CALCULATION_STATUSES = ['DRAFT', 'REVIEW', 'FINALIZED'] as const;
export const COST_CALCULATION_SCOPE_TYPES = ['BRANCH', 'ORDER', 'RUN'] as const;
export const COST_TRANSACTION_SOURCE_TYPES = [
  'PRODUCTION_ORDER',
  'PRODUCTION_RUN',
  'OUTPUT_EVENT',
  'FG_RECEIPT',
  'MATERIAL_DOCUMENT',
  'QUALITY_DISPOSITION',
  'DOWNTIME',
  'REVERSAL',
  'MANUAL',
] as const;

/**
 * COST-R1B Canonical Unified Cost Ledger contract.
 *
 * costNature (HOW the amount is known):
 *   - ACTUAL                 : a real, posted, valued transaction amount (e.g. inventory material totalCost).
 *   - RATE_DERIVED           : amount computed from a served rate x quantity (downtime capacity estimate).
 *   - MANUAL_ASSERTED_ACTUAL : manually asserted value recorded by an authorized user.
 */
export const COST_NATURE_VALUES = ['ACTUAL', 'RATE_DERIVED', 'MANUAL_ASSERTED_ACTUAL'] as const;
export type CostNature = (typeof COST_NATURE_VALUES)[number];

export const PRIMARY_COST_NATURES: readonly string[] = ['ACTUAL', 'RATE_DERIVED', 'MANUAL_ASSERTED_ACTUAL'];

/**
 * entryRole (arithmetic role in the ledger):
 *   - PRIMARY_COST : a positive cost entry.
 *   - REVERSAL     : offsets (subtracts) the amount of its ORIGINAL_LEDGER_EVENT.
 */
export const ENTRY_ROLE_VALUES = ['PRIMARY_COST', 'REVERSAL'] as const;
export type EntryRole = (typeof ENTRY_ROLE_VALUES)[number];

export const ENTRY_ROLE_PRIMARY_COST = 'PRIMARY_COST' as const;
export const ENTRY_ROLE_REVERSAL = 'REVERSAL' as const;

/**
 * The controlled, canonical source types that the Unified Cost Ledger accepts
 * as authoritative source-of-truth events. Any source MUST map to one of these
 * before it can be posted through the canonical posting service:
 *   - INVENTORY_MOVEMENT_LINE : an atomic valued material movement line (production or maintenance).
 *   - DOWNTIME_EVENT          : a resolved downtime event valued by a served rate.
 *   - MANUAL                  : a manually asserted cost entry.
 * Reversal arithmetic is carried by entryRole=REVERSAL + original linkage, not by
 * an uncontrolled sourceType. The legacy sourceType='REVERSAL' convention is still
 * written for backward compatibility but is NOT part of the canonical source set.
 */
export const CANONICAL_SOURCE_TYPES = ['INVENTORY_MOVEMENT_LINE', 'DOWNTIME_EVENT', 'MANUAL'] as const;
export type CanonicalSourceType = (typeof CANONICAL_SOURCE_TYPES)[number];

export function isCanonicalSourceType(value: string | null | undefined): value is CanonicalSourceType {
  return !!value && (CANONICAL_SOURCE_TYPES as readonly string[]).includes(value);
}

export function isCostNature(value: string | null | undefined): value is CostNature {
  return !!value && (COST_NATURE_VALUES as readonly string[]).includes(value);
}

export function isEntryRole(value: string | null | undefined): value is EntryRole {
  return !!value && (ENTRY_ROLE_VALUES as readonly string[]).includes(value);
}

/**
 * COST-R1B-B2: canonical material event type. Material cost (production or
 * maintenance) is represented by the existing economic event `MATERIAL` and is
 * distinguished by `costPurpose` (PRODUCTION / MAINTENANCE). Verbose caller
 * strings (PRODUCTION_MATERIAL_ISSUE etc.) are NOT added to the DB vocabulary.
 */
export const MATERIAL_EVENT_TYPE = 'MATERIAL' as const;

/**
 * COST-R1B-B2: normalize a raw movement/product unit to the canonical ledger
 * unit vocabulary enforced by the DB `unit_ck` check (MINUTE/HOUR/BATCH/LITER/
 * TON/KG/UNIT/PACK). Any non-canonical or missing unit collapses to `UNIT`;
 * no lowercase/raw free-form unit is ever written to a canonical ledger row.
 */
export function canonicalLedgerUnit(unit: string | null | undefined): string {
  if (unit && (COST_UNITS as readonly string[]).includes(unit.toUpperCase())) return unit.toUpperCase();
  return 'UNIT';
}
