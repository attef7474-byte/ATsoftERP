export const OPERATIONAL_COST_RATE_AUDIT_ENTITY = 'OperationalCostRate';
export const OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY = 'OperationalStandardCostSnapshot';
export const OPERATIONAL_COST_TRANSACTION_AUDIT_ENTITY = 'OperationalCostTransaction';

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
} as const;

export const COST_TYPES = ['MATERIAL', 'LABOR', 'MACHINE', 'OVERHEAD'] as const;
export const COST_UNITS = ['PACK', 'UNIT', 'KG', 'TON', 'LITER', 'BATCH', 'HOUR', 'MINUTE'] as const;
export const COST_RATE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const COST_SNAPSHOT_STATUSES = ['DRAFT', 'FROZEN', 'SUPERSEDED'] as const;
export const COST_TRANSACTION_STATUSES = ['POSTED', 'REVERSED'] as const;
export const COST_TRANSACTION_SOURCE_TYPES = [
  'PRODUCTION_ORDER',
  'PRODUCTION_RUN',
  'OUTPUT_EVENT',
  'FG_RECEIPT',
  'MATERIAL_DOCUMENT',
  'QUALITY_DISPOSITION',
  'REVERSAL',
  'MANUAL',
] as const;
