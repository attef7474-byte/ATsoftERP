export const PRODUCTION_QUALITY_AUDIT_ENTITY = 'ProductionQualityPlan';
export const PRODUCTION_INSPECTION_AUDIT_ENTITY = 'ProductionInspection';
export const PRODUCTION_NCR_AUDIT_ENTITY = 'ProductionNonconformance';

export const PRODUCTION_QUALITY_PERMISSION_KEYS = {
  planCreate: 'production-quality-plan:create',
  planRead: 'production-quality-plan:read',
  planUpdate: 'production-quality-plan:update',
  planDelete: 'production-quality-plan:delete',
  planSubmit: 'production-quality-plan:submit',
  planApprove: 'production-quality-plan:approve',
  planReject: 'production-quality-plan:reject',
  planDeactivate: 'production-quality-plan:deactivate',
  characteristicCreate: 'quality-characteristic:create',
  characteristicRead: 'quality-characteristic:read',
  characteristicUpdate: 'quality-characteristic:update',
  characteristicDelete: 'quality-characteristic:delete',
  samplingPointCreate: 'quality-sampling-point:create',
  samplingPointRead: 'quality-sampling-point:read',
  samplingPointUpdate: 'quality-sampling-point:update',
  samplingPointDelete: 'quality-sampling-point:delete',
  inspectionCreate: 'production-inspection:create',
  inspectionRead: 'production-inspection:read',
  inspectionComplete: 'production-inspection:complete',
  dispositionCreate: 'quality-disposition:create',
  dispositionRead: 'quality-disposition:read',
  dispositionApprove: 'quality-disposition:approve',
  dispositionReject: 'quality-disposition:reject',
  ncrCreate: 'production-ncr:create',
  ncrRead: 'production-ncr:read',
  ncrTransition: 'production-ncr:transition',
  ncrAttach: 'production-ncr:attach',
} as const;

export const PRODUCTION_QUALITY_PLAN_INCLUDE = {
  productionProductDefinition: { select: { id: true, code: true, productId: true, product: { select: { id: true, code: true, name: true } } } },
  productionVersion: { select: { id: true, versionNumber: true, versionLabel: true } },
  productionPackaging: { select: { id: true, packagingType: true, packQuantity: true } },
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
  characteristics: {
    where: { deletedAt: null },
    orderBy: { sequence: 'asc' as const },
    include: { productionUnit: { select: { id: true, code: true, name: true } } },
  },
  samplingPoints: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      measurementPoint: { select: { id: true, code: true, name: true } },
      productionLine: { select: { id: true, code: true, name: true } },
      machine: { select: { id: true, code: true, name: true } },
    },
  },
} as const;

export const PRODUCTION_INSPECTION_INCLUDE = {
  plan: { select: { id: true, code: true, revision: true, status: true } },
  productionOrder: { select: { id: true, orderNumber: true, status: true } },
  productionRun: { select: { id: true, runNumber: true, status: true } },
  outputEvent: { select: { id: true, eventType: true, classification: true, quantity: true, unit: true } },
  finishedGoodsReceipt: { select: { id: true, receiptNumber: true, status: true } },
  finishedGoodsReceiptLine: { select: { id: true, lineNumber: true, productId: true } },
  samplingPoint: { select: { id: true, stage: true, sortOrder: true } },
  product: { select: { id: true, code: true, name: true } },
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true } },
  shift: { select: { id: true, code: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
  results: {
    where: { correctsResultId: null },
    orderBy: { characteristicSequenceSnapshot: 'asc' as const },
    include: { characteristic: { select: { id: true, nameAr: true, nameEn: true } } },
  },
  dispositions: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
  },
  nonconformances: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
    select: { id: true, ncrNumber: true, severity: true, status: true, description: true },
  },
} as const;

export const PRODUCTION_NCR_INCLUDE = {
  inspection: {
    select: {
      id: true,
      inspectionNumber: true,
      status: true,
      product: { select: { id: true, code: true, name: true } },
    },
  },
  disposition: { select: { id: true, action: true, quantity: true, unit: true, status: true } },
  transitions: { orderBy: { createdAt: 'asc' as const } },
  attachments: {
    orderBy: { createdAt: 'asc' as const },
    include: { attachment: { select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true } } },
  },
} as const;

export const QUALITY_UNITS = ['PACK', 'UNIT', 'KG', 'TON', 'LITER', 'BATCH'] as const;
export const CHARACTERISTIC_TYPES = ['NUMERIC', 'BOOLEAN', 'TEXT', 'CHOICE'] as const;
export const CRITICALITY_LEVELS = ['CRITICAL', 'MAJOR', 'MINOR'] as const;
export const INSPECTION_STAGES = ['INCOMING', 'IN_PROCESS', 'FINAL_OUTPUT'] as const;
export const NCR_STATUSES = ['OPEN', 'INVESTIGATING', 'ACTION_REQUIRED', 'VERIFIED', 'CLOSED'] as const;
export const DISPOSITION_ACTIONS = ['RELEASE', 'REJECT', 'REWORK', 'SCRAP'] as const;

export const NCR_TRANSITION_RULES: Record<string, string[]> = {
  OPEN: ['INVESTIGATING'],
  INVESTIGATING: ['ACTION_REQUIRED', 'OPEN'],
  ACTION_REQUIRED: ['VERIFIED'],
  VERIFIED: ['CLOSED', 'ACTION_REQUIRED'],
  CLOSED: [],
};
