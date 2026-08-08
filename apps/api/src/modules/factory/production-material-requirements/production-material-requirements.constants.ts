export const PRODUCTION_MATERIAL_REQUIREMENT_AUDIT_ENTITY = 'ProductionMaterialRequirement';
export const PRODUCTION_MATERIAL_CONSUMPTION_AUDIT_ENTITY = 'ProductionMaterialConsumption';

export const PRODUCTION_MATERIAL_REQUIREMENT_STATUSES = ['DRAFT', 'FROZEN', 'SUPERSEDED', 'CANCELLED'] as const;
export const PRODUCTION_MATERIAL_COMPONENT_ROLES = ['RAW_MATERIAL', 'PACKAGING', 'SEMI_FINISHED', 'OTHER'] as const;
export const PRODUCTION_MATERIAL_OVER_ISSUE_POLICIES = ['NOT_ALLOWED', 'WITH_REASON', 'TOLERANCE'] as const;
export const PRODUCTION_MATERIAL_CONSUMPTION_METHODS = ['DERIVED_NET_ISSUE', 'EXPLICIT'] as const;

export const PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS = {
  read: 'production-material-requirement:read',
  prepare: 'production-material-requirement:prepare',
  freeze: 'production-material-requirement:freeze',
  cancel: 'production-material-requirement:cancel',
} as const;

export const PRODUCTION_MATERIAL_CONSUMPTION_PERMISSION_KEYS = {
  read: 'production-material-consumption:read',
  record: 'production-material-consumption:record',
  correct: 'production-material-consumption:correct',
  history: 'production-material-consumption:history',
} as const;

export const PRODUCTION_TRACEABILITY_PERMISSION_KEYS = {
  read: 'production-traceability:read',
} as const;

export const PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE = {
  productionOrder: { select: { id: true, orderNumber: true, status: true, plannedQuantity: true, quantityUnit: true } },
  lines: {
    include: {
      product: { select: { id: true, code: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  },
  materialDocuments: {
    where: { status: 'POSTED' },
    select: {
      id: true,
      documentNumber: true,
      documentType: true,
      status: true,
      documentDate: true,
    },
  },
} as const;

export const PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE = {
  productionOrder: { select: { id: true, orderNumber: true } },
  productionRun: { select: { id: true, runNumber: true } },
  product: { select: { id: true, code: true, name: true } },
  requirementLine: {
    select: { id: true, lineNumber: true, plannedQuantity: true, plannedQuantityPerUnit: true },
  },
  corrections: { orderBy: { createdAt: 'asc' } },
  recordedBy: { select: { id: true, name: true } },
} as const;
