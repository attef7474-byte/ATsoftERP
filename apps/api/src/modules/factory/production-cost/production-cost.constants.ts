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
  productionVersion: { select: { id: true, code: true, name: true } },
  productionPackaging: { select: { id: true, code: true, name: true } },
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
} as const;

export const OPERATIONAL_COST_TRANSACTION_INCLUDE = {
  productionOrder: { select: { id: true, orderNumber: true, status: true } },
  productionRun: { select: { id: true, runNumber: true, status: true } },
  product: { select: { id: true, code: true, name: true } },
  productionVersion: { select: { id: true, code: true, name: true } },
  productionPackaging: { select: { id: true, code: true, name: true } },
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true } },
  shift: { select: { id: true, code: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
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
