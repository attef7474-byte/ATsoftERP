export interface ProductionUnit {
  id: string;
  code: string;
  name: string;
  abbreviation?: string | null;
  description?: string | null;
  decimals: number;
  companyId: string;
  branchId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  company?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
}

export interface ProductionSpecification {
  id: string;
  productionProductId: string;
  attributeName: string;
  attributeValue: string;
  dataType: string;
  unitId?: string | null;
  unit?: { id: string; code: string; name: string };
  isRequired: boolean;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionVersion {
  id: string;
  productionProductId: string;
  versionNumber: number;
  versionLabel: string;
  description?: string | null;
  isCurrent: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionPackaging {
  id: string;
  productionProductId: string;
  packagingType: string;
  packQuantity: string;
  unitId?: string | null;
  unit?: { id: string; code: string; name: string };
  grossWeight?: string | null;
  netWeight?: string | null;
  isDefault: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionEligibility {
  id: string;
  productionProductId: string;
  resourceType: string;
  machineId?: string | null;
  machine?: { id: string; code: string; name: string };
  productionLineId?: string | null;
  productionLine?: { id: string; code: string; name: string };
  priority: number;
  isDefault: boolean;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type ProductionCapacityStatus = 'DRAFT' | 'APPROVED' | 'SUSPENDED' | 'ARCHIVED';
export type ProductionCapacityOutputUnit = 'PACK' | 'UNIT' | 'KG' | 'TON' | 'LITER' | 'BATCH';
export type ProductionCapacityTimeBasis = 'MINUTE' | 'HOUR';

export interface ProductionCapacityStandard {
  id: string;
  code: string;
  revision: number;
  productionProductId: string;
  productionProduct?: { id: string; code: string; name: string };
  productionVersionId?: string | null;
  productionVersion?: { id: string; versionNumber: number; versionLabel: string } | null;
  productionPackagingId?: string | null;
  productionPackaging?: { id: string; packagingType: string; packQuantity: string } | null;
  productionLineId: string;
  productionLine?: { id: string; code: string; name: string };
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  standardRate: string;
  outputUnit: ProductionCapacityOutputUnit;
  timeBasis: ProductionCapacityTimeBasis;
  standardCycleTimeMinutes?: string | null;
  setupMinutes: string;
  changeoverMinutes: string;
  cleaningMinutes: string;
  startupAllowanceMinutes: string;
  shutdownAllowanceMinutes: string;
  targetEfficiencyPercent: string;
  expectedYieldPercent: string;
  sourceType: 'MEASURED' | 'ENGINEERING' | 'SUPPLIER' | 'HISTORICAL' | 'OWNER_OVERRIDE';
  sourceReference?: string | null;
  notes?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: ProductionCapacityStatus;
  matchedScope?: 'MACHINE' | 'LINE';
  createdAt: string;
  updatedAt: string;
}

export interface ProductionProductDefinition {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  productId: string;
  product?: { id: string; code: string; name: string; unit: string; description?: string | null };
  defaultUnitId?: string | null;
  defaultUnit?: { id: string; code: string; name: string };
  defaultLineId?: string | null;
  defaultLine?: { id: string; code: string; name: string };
  defaultWarehouseId?: string | null;
  defaultWarehouse?: { id: string; code: string; name: string };
  defaultCostCenterId?: string | null;
  defaultCostCenter?: { id: string; code: string; name: string };
  companyId: string;
  branchId: string;
  status: string;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  company?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
  specifications?: ProductionSpecification[];
  versions?: ProductionVersion[];
  packagings?: ProductionPackaging[];
  eligibilities?: ProductionEligibility[];
}

export type ProductionOrderStatus = 'DRAFT' | 'PLANNED' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'CLOSED' | 'ARCHIVED';
export type ProductionOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ProductionOrderSourceType = 'MANUAL' | 'REPLENISHMENT' | 'FORECAST' | 'OTHER';

export interface ProductionOrder {
  id: string;
  companyId: string;
  branchId: string;
  orderNumber: string;
  clientRequestId: string;
  productionProductDefinitionId: string;
  productionProductDefinition?: { id: string; code: string; name: string };
  productionVersionId: string;
  productionVersion?: { id: string; versionNumber: number; versionLabel: string };
  productionPackagingId?: string | null;
  productionPackaging?: { id: string; packagingType: string; packQuantity: string } | null;
  productionUnitId: string;
  productionUnit?: { id: string; code: string; name: string; abbreviation?: string | null };
  productionLineId: string;
  productionLine?: { id: string; code: string; name: string };
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  plannedQuantity: string;
  quantityUnit: ProductionCapacityOutputUnit;
  capacityTimeBasis: ProductionCapacityTimeBasis;
  plannedStartAt: string;
  plannedEndAt: string;
  priority: ProductionOrderPriority;
  sourceType: ProductionOrderSourceType;
  sourceReference?: string | null;
  costCenterId: string;
  costCenter?: { id: string; code: string; name: string };
  issueWarehouseId?: string | null;
  issueWarehouse?: { id: string; code: string; name: string } | null;
  receiptWarehouseId?: string | null;
  receiptWarehouse?: { id: string; code: string; name: string } | null;
  capacityStandardId: string;
  capacityStandardCodeSnapshot: string;
  capacityStandardRevisionSnapshot: number;
  standardRateSnapshot: string;
  outputUnitSnapshot: ProductionCapacityOutputUnit;
  timeBasisSnapshot: ProductionCapacityTimeBasis;
  standardCycleTimeMinutesSnapshot?: string | null;
  setupMinutesSnapshot: string;
  changeoverMinutesSnapshot: string;
  cleaningMinutesSnapshot: string;
  startupAllowanceMinutesSnapshot: string;
  shutdownAllowanceMinutesSnapshot: string;
  targetEfficiencyPercentSnapshot: string;
  expectedYieldPercentSnapshot: string;
  capacityEffectiveFromSnapshot: string;
  capacityEffectiveToSnapshot?: string | null;
  plannedGrossQuantity: string;
  plannedRunMinutes: string;
  plannedAllowanceMinutes: string;
  plannedDurationMinutes: string;
  durationCalculationVersion: string;
  snapshotFrozenAt?: string | null;
  status: ProductionOrderStatus;
  lockVersion: number;
  plannedById?: string | null;
  plannedAt?: string | null;
  releasedById?: string | null;
  releasedAt?: string | null;
  cancelledById?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  archivedById?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  closedById?: string | null;
  closedAt?: string | null;
  closureReason?: string | null;
  notes?: string | null;
  createdById: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionOrderReadiness {
  ready: boolean;
  blockers: Array<{ code: string; field?: string }>;
  warnings: Array<{ code: string; details?: Record<string, unknown> }>;
  snapshotPreview?: Record<string, string | null> | null;
}

export interface ProductionOrderTransition {
  id: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  actorId: string;
  reason?: string | null;
  requestId: string;
  readinessEvidence?: string | null;
  createdAt: string;
}

export interface ProductionOrderAttachment {
  id: string;
  attachmentId: string;
  attachment: { id: string; originalName: string; mimeType: string; size: number; createdAt: string };
  createdAt: string;
}

export interface ProductionShift {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  breakMinutes: number;
  companyId: string;
  branchId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  company?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
  _count?: {
    templateDays: number;
    calendarEntries: number;
    shiftAssignments: number;
    operationalAssignments: number;
  };
}

export interface ProductionShiftTemplateDay {
  id: string;
  templateId: string;
  dayOfWeek: number;
  shiftId: string;
  shift?: { id: string; code: string; name: string; startTime: string; endTime: string };
  isWorkDay: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionShiftTemplate {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  companyId: string;
  branchId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  company?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
  days?: ProductionShiftTemplateDay[];
  _count?: { calendars: number };
}

export interface ProductionShiftCalendarEntry {
  id: string;
  calendarId: string;
  date: string;
  shiftId?: string | null;
  shift?: { id: string; code: string; name: string; startTime: string; endTime: string };
  isWorkDay: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionShiftCalendar {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  templateId?: string | null;
  template?: { id: string; code: string; name: string };
  companyId: string;
  branchId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  company?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
  entries?: ProductionShiftCalendarEntry[];
  _count?: { entries: number; shiftAssignments: number };
}

export interface OperationalPerson {
  id: string;
  code: string;
  name: string;
  category: string;
  isActive: boolean;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface ProductionShiftAssignment {
  id: string;
  code: string;
  shiftId: string;
  shift?: { id: string; code: string; name: string; startTime: string; endTime: string };
  calendarId?: string | null;
  calendar?: { id: string; code: string; name: string };
  operationalPersonId: string;
  operationalPerson?: { id: string; code: string; name: string; category: string };
  effectiveFrom: string;
  effectiveTo?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  companyId: string;
  branchId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  company?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
}

export interface ProductionOperationalAssignment {
  id: string;
  code: string;
  resourceType: string;
  machineId?: string | null;
  machine?: { id: string; code: string; name: string };
  productionLineId?: string | null;
  productionLine?: { id: string; code: string; name: string };
  productionUnitId?: string | null;
  productionUnit?: { id: string; code: string; name: string };
  shiftId?: string | null;
  shift?: { id: string; code: string; name: string; startTime: string; endTime: string };
  capacityPerShift?: string | number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  companyId: string;
  branchId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  company?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
}


export interface ProductionRun {
  id: string;
  companyId: string;
  branchId: string;
  runNumber: string;
  clientRequestId: string;
  productionOrderId: string;
  productionOrder?: { id: string; orderNumber: string; status: string; priority: string };
  status: string;
  lockVersion: number;
  notes?: string | null;
  shiftId?: string | null;
  shiftCodeSnapshot?: string | null;
  shiftNameSnapshot?: string | null;
  shiftStartTimeSnapshot?: string | null;
  shiftEndTimeSnapshot?: string | null;
  shiftAssignmentId?: string | null;
  shiftAssignmentCodeSnapshot?: string | null;
  operationalAssignmentId?: string | null;
  operationalAssignmentCodeSnapshot?: string | null;
  operationalPersonId?: string | null;
  operationalPersonCodeSnapshot?: string | null;
  operationalPersonNameSnapshot?: string | null;
  assignmentResolutionSource: string;
  assignmentResolutionNote?: string | null;
  productionUnitId: string;
  productionUnit?: { id: string; code: string; name: string; abbreviation?: string | null };
  productionLineId: string;
  productionLine?: { id: string; code: string; name: string };
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  productionProductDefinitionId: string;
  productionVersionId: string;
  productionPackagingId?: string | null;
  costCenterId: string;
  costCenter?: { id: string; code: string; name: string } | null;
  issueWarehouseId?: string | null;
  receiptWarehouseId?: string | null;
  orderNumberSnapshot: string;
  plannedQuantitySnapshot: string | number;
  quantityUnitSnapshot: string;
  capacityStandardCodeSnapshot: string;
  capacityStandardRevisionSnapshot: number;
  standardRateSnapshot: string | number;
  outputUnitSnapshot: string;
  timeBasisSnapshot: string;
  targetEfficiencyPercentSnapshot: string | number;
  expectedYieldPercentSnapshot: string | number;
  snapshotFrozenAtSnapshot?: string | null;
  startedById?: string | null;
  startedAt?: string | null;
  pausedById?: string | null;
  pausedAt?: string | null;
  endedById?: string | null;
  endedAt?: string | null;
  pauseReason?: string | null;
  abortReason?: string | null;
  createdById: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  sessions?: ProductionRunSession[];
  transitions?: ProductionRunTransition[];
  events?: ProductionOutputEvent[];
}

export interface ProductionRunSession {
  id: string;
  companyId: string;
  branchId: string;
  productionRunId: string;
  startedAt: string;
  startedById?: string | null;
  closedAt?: string | null;
  closedById?: string | null;
  createdAt: string;
}

export interface ProductionRunTransition {
  id: string;
  companyId: string;
  branchId: string;
  productionRunId: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  actorId: string;
  requestId?: string | null;
  reason?: string | null;
  readinessEvidence?: string | null;
  createdAt: string;
}

export interface ProductionOutputEvent {
  id: string;
  companyId: string;
  branchId: string;
  productionRunId: string;
  measurementPointId: string;
  measurementPoint?: {
    id: string; code: string; name: string; role: string; source: string; unit: string; isAuthoritativeFinal: boolean;
  };
  eventType: string;
  classification: string;
  sourceType: string;
  quantity: string | number;
  goodQuantity: string | number;
  rejectQuantity: string | number;
  unit: string;
  occurredAt: string;
  requestId: string;
  previousRawCount?: string | null;
  rawCount?: string | null;
  resetValue?: string | null;
  correctsEventId?: string | null;
  correctsEvent?: { id: string; eventType: string; quantity: string | number } | null;
  reason?: string | null;
  notes?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductionRunTotals {
  finalOutputTotal: string | number;
  wasteTotal: string | number;
  reworkTotal: string | number;
  correctionsTotal: string | number;
  netCorrectionAdjustment: string | number;
  finalOutputQty: string | number;
  finalOutputGood: string | number;
  finalOutputReject: string | number;
  finalOutputCorrection: string | number;
  sourceBreakdown: Record<string, string | number>;
  pointBreakdown: Array<{ measurementPointId: string; measurementPointCode?: string; role: string; quantity: string | number }>;
  progressPercent?: number;
}

export interface ProductionMeasurementPoint {
  id: string;
  companyId: string;
  branchId: string;
  code: string;
  name: string;
  productionLineId: string;
  productionLine?: { id: string; code: string; name: string };
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  machineComponentId?: string | null;
  machineComponent?: { id: string; code: string; name: string } | null;
  productionUnitId: string;
  productionUnit?: { id: string; code: string; name: string };
  role: string;
  source: string;
  unit: string;
  isAuthoritativeFinal: boolean;
  counterModulus?: string | number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface OperationalLossReason {
  id: string;
  companyId: string;
  branchId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description?: string | null;
  parentId?: string | null;
  parent?: { id: string; code: string; nameAr: string; nameEn: string } | null;
  lossCategory: string;
  plannedDefault: boolean;
  severityDefault?: string | null;
  maintenanceRequestPolicy: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface DowntimeSegment {
  id: string;
  companyId: string;
  branchId: string;
  downtimeLogId: string;
  downtimeLog?: {
    id: string;
    reason?: string | null;
    durationMinutes?: number | null;
    machineId?: string | null;
  };
  productionRunId?: string | null;
  productionRun?: {
    id: string;
    runNumber: string;
    status: string;
    productionProductDefinition?: {
      id: string;
      code: string;
      name: string;
      product?: { id: string; code: string; name: string } | null;
    } | null;
  } | null;
  productionOrderId?: string | null;
  productionOrder?: { id: string; orderNumber: string } | null;
  shiftId?: string | null;
  shift?: { id: string; code: string; name: string } | null;
  productionLineId?: string | null;
  productionLine?: { id: string; name: string } | null;
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  startedAt: string;
  endedAt?: string | null;
  durationMinutes: string | number;
  reasonId?: string | null;
  reason?: {
    id: string;
    code: string;
    nameAr: string;
    nameEn: string;
    lossCategory: string;
    plannedDefault: boolean;
    severityDefault?: string | null;
  } | null;
  planned: boolean;
  severity: string;
  ownerDomain: string;
  maintenanceRequestId?: string | null;
  maintenanceRequest?: { id: string; requestNumber: string; status: string; machine?: { id: string; code: string } | null } | null;
  maintenanceWorkOrderId?: string | null;
  maintenanceWorkOrder?: { id: string; workOrderNumber: string; status: string } | null;
  sourceType: string;
  status: string;
  requestId?: string | null;
  correctsSegmentId?: string | null;
  correctionReason?: string | null;
  notes?: string | null;
  recordedById: string;
  closedById?: string | null;
  cancelledById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionLossQuantityEvent {
  id: string;
  companyId: string;
  branchId: string;
  productionRunId?: string | null;
  productionRun?: {
    id: string;
    runNumber: string;
    status: string;
  } | null;
  productionOrderId?: string | null;
  productionOrder?: { id: string; orderNumber: string } | null;
  outputEventId?: string | null;
  outputEvent?: { id: string; eventType: string; classification: string; quantity: string | number } | null;
  type: string;
  stage?: string | null;
  productionLineId?: string | null;
  productionLine?: { id: string; code: string; name: string } | null;
  machineId?: string | null;
  machine?: { id: string; code?: string; name: string } | null;
  measurementPointId?: string | null;
  measurementPoint?: { id: string; code: string; name: string; role: string; unit: string } | null;
  productId?: string | null;
  productCodeSnapshot?: string | null;
  productNameSnapshot?: string | null;
  versionLabelSnapshot?: string | null;
  packagingLabelSnapshot?: string | null;
  unit: string;
  quantity: string | number;
  reason?: string | null;
  reasonId?: string | null;
  reasonRef?: {
    id: string;
    code: string;
    nameAr: string;
    nameEn: string;
    lossCategory: string;
  } | null;
  sourceType: string;
  requestId: string;
  sourceEventId?: string | null;
  sourceEvent?: { id: string; type: string; quantity: string | number; occurredAt: string } | null;
  correctsEventId?: string | null;
  correctsEvent?: { id: string; type: string; quantity: string | number } | null;
  correctionReason?: string | null;
  notes?: string | null;
  recordedById: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunLossesView {
  runId: string;
  runNumber: string;
  segments: Array<{
    id: string;
    startedAt: string;
    endedAt?: string | null;
    durationMinutes: string | number;
    planned: boolean;
    severity: string;
    ownerDomain: string;
    status: string;
    reason?: { id: string; code: string; nameAr: string; nameEn: string; lossCategory: string } | null;
    machine?: { id: string; code?: string; name: string } | null;
  }>;
  totalDowntimeMinutes: number;
  events: ProductionLossQuantityEvent[];
  totals: Record<string, string>;
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type ProductionMaterialDocumentType = 'ISSUE' | 'CONSUMPTION' | 'RETURN' | 'SUBSTITUTION';
export type ProductionDocumentStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface ProductionMaterialDocumentLine {
  id: string;
  companyId: string;
  branchId: string;
  documentId: string;
  productId: string;
  product?: { id: string; code: string; name: string } | null;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  productVersionLabelSnapshot?: string | null;
  productPackagingLabelSnapshot?: string | null;
  unit: string;
  quantity: string | number;
  substitutedProductId?: string | null;
  substitutedProduct?: { id: string; code: string; name: string } | null;
  substitutionReason?: string | null;
  warehouseLocationId?: string | null;
  warehouseLocation?: { id: string; code: string; name: string } | null;
  batchNumber?: string | null;
  serialNumber?: string | null;
  expiryDate?: string | null;
  lineNumber: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionMaterialDocument {
  id: string;
  companyId: string;
  branchId: string;
  documentNumber: string;
  productionOrderId: string;
  productionOrder?: { id: string; orderNumber: string; status: string } | null;
  productionRunId: string;
  productionRun?: {
    id: string;
    runNumber: string;
    status: string;
    startedAt?: string | null;
    endedAt?: string | null;
  } | null;
  documentType: ProductionMaterialDocumentType;
  issueWarehouseId?: string | null;
  issueWarehouse?: { id: string; code: string; name: string } | null;
  status: ProductionDocumentStatus;
  movementId?: string | null;
  movement?: { id: string; movementNumber: string; movementType: string; status: string } | null;
  movementNumber?: string | null;
  sourceType: string;
  requestId?: string | null;
  notes?: string | null;
  documentDate: string;
  postedAt?: string | null;
  cancelledAt?: string | null;
  createdById: string;
  createdBy?: { id: string; name: string } | null;
  postedById?: string | null;
  postedBy?: { id: string; name: string } | null;
  cancelledById?: string | null;
  cancelledBy?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  lines: ProductionMaterialDocumentLine[];
}

export interface ProductionFinishedGoodsReceiptLine {
  id: string;
  companyId: string;
  branchId: string;
  receiptId: string;
  productId: string;
  product?: { id: string; code: string; name: string } | null;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  productVersionLabelSnapshot?: string | null;
  productPackagingLabelSnapshot?: string | null;
  unit: string;
  quantity: string | number;
  warehouseLocationId?: string | null;
  warehouseLocation?: { id: string; code: string; name: string } | null;
  batchNumber?: string | null;
  serialNumber?: string | null;
  expiryDate?: string | null;
  lineNumber: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProductionMaterialRequirementStatus = 'DRAFT' | 'FROZEN' | 'SUPERSEDED' | 'CANCELLED';
export type ProductionMaterialComponentRole = 'RAW_MATERIAL' | 'PACKAGING' | 'SEMI_FINISHED' | 'OTHER';
export type ProductionMaterialOverIssuePolicy = 'NOT_ALLOWED' | 'WITH_REASON' | 'TOLERANCE';

export interface ProductionMaterialRequirementLine {
  id: string;
  companyId: string;
  branchId: string;
  requirementId: string;
  lineNumber: number;
  productId: string;
  product?: { id: string; code: string; name: string } | null;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  componentRole: ProductionMaterialComponentRole;
  plannedQuantityPerUnit: string | number;
  plannedQuantity: string | number;
  baseUnit: string;
  issueUnit: string;
  conversionFactor: string | number;
  warehouseId?: string | null;
  warehouse?: { id: string; code: string; name: string } | null;
  productionStage?: string | null;
  lotControlRequired: boolean;
  overIssuePolicy: ProductionMaterialOverIssuePolicy;
  tolerancePercent?: string | number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionMaterialRequirement {
  id: string;
  companyId: string;
  branchId: string;
  productionOrderId: string;
  productionOrder?: { id: string; orderNumber: string; status: string; plannedQuantity: string; quantityUnit: string } | null;
  revision: number;
  status: ProductionMaterialRequirementStatus;
  sourceType: string;
  productDefinitionCodeSnapshot?: string | null;
  productDefinitionNameSnapshot?: string | null;
  productVersionLabelSnapshot?: string | null;
  productPackagingLabelSnapshot?: string | null;
  notes?: string | null;
  preparedById: string;
  preparedAt: string;
  frozenById?: string | null;
  frozenAt?: string | null;
  requestId?: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ProductionMaterialRequirementLine[];
  materialDocuments?: Array<{
    id: string;
    documentNumber: string;
    documentType: ProductionMaterialDocumentType;
    status: string;
    documentDate: string;
  }> | null;
}

export type ProductionMaterialReadinessLineStatus = 'OK' | 'SHORT' | 'OVER_ISSUE';

export interface ProductionMaterialReadinessLine {
  lineId: string;
  lineNumber: number;
  productId: string;
  productCode?: string | null;
  productName?: string | null;
  componentRole: ProductionMaterialComponentRole;
  plannedQuantity: string | number;
  baseUnit: string;
  issueUnit: string;
  overIssuePolicy: ProductionMaterialOverIssuePolicy;
  tolerancePercent?: string | number | null;
  netIssued: string | number;
  shortage: string | number;
  status: ProductionMaterialReadinessLineStatus;
  warnings: string[];
}

export interface ProductionMaterialReadiness {
  orderId: string;
  orderNumber: string;
  status: 'READY' | 'NOT_READY';
  blockers: string[];
  warnings: string[];
  lines: ProductionMaterialReadinessLine[];
}

export interface ProductionMaterialConsumptionCorrection {
  id: string;
  companyId: string;
  branchId: string;
  consumptionId: string;
  previousQuantity: string | number;
  newQuantity: string | number;
  reason: string;
  correctedById: string;
  createdAt: string;
}

export interface ProductionMaterialConsumption {
  id: string;
  companyId: string;
  branchId: string;
  productionOrderId: string;
  productionOrder?: { id: string; orderNumber: string } | null;
  productionRunId?: string | null;
  productionRun?: { id: string; runNumber: string } | null;
  requirementId?: string | null;
  requirementLineId?: string | null;
  requirementLine?: { id: string; lineNumber: number; plannedQuantity: string; plannedQuantityPerUnit: string } | null;
  productId: string;
  product?: { id: string; code: string; name: string } | null;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  unit: string;
  quantity: string | number;
  method: 'EXPLICIT' | 'DERIVED_NET_ISSUE';
  sourceType: string;
  sourceDocumentId?: string | null;
  sourceDocumentNumber?: string | null;
  sourceDocumentType?: string | null;
  recordedById: string;
  recordedBy?: { id: string; name: string } | null;
  recordedAt: string;
  requestId: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  corrections: ProductionMaterialConsumptionCorrection[];
}

export interface ProductionConsumptionLine {
  requirementLineId?: string | null;
  productId: string;
  productCode?: string | null;
  productName?: string | null;
  unit?: string | null;
  consumedQuantity: string | number;
  plannedQuantity?: string | number | null;
  netIssued?: string | number;
}

export interface ProductionConsumptionSummary {
  orderId?: string;
  runId?: string;
  orderNumber?: string;
  runNumber?: string;
  source: 'EXPLICIT' | 'DERIVED_NET_ISSUE';
  lines: ProductionConsumptionLine[];
  records?: ProductionMaterialConsumption[] | null;
  unlistedConsumed?: ProductionConsumptionLine[] | null;
  warnings?: string[] | null;
}

export interface ProductionRunMaterialsLine {
  productId: string;
  productCode?: string | null;
  productName?: string | null;
  requirementLineId?: string | null;
  plannedQuantity?: string | number | null;
  issuedQuantity: string | number;
  returnedQuantity: string | number;
  netIssued: string | number;
}

export interface ProductionRunMaterialsSummary {
  runId: string;
  runNumber: string;
  orderId: string;
  lines: ProductionRunMaterialsLine[];
}

export interface ProductionMaterialTraceabilityDocumentLine {
  id: string;
  documentId: string;
  productId: string;
  product?: { id: string; code: string; name: string } | null;
  substitutedProductId?: string | null;
  substitutedProduct?: { id: string; code: string; name: string } | null;
  requirementLineId?: string | null;
  requirementLine?: { id: string; lineNumber: number; plannedQuantity: string } | null;
  originalIssueLineId?: string | null;
  originalIssueLine?: { id: string; productId: string; lineNumber: number } | null;
  lossQuantityEvent?: {
    id: string;
    eventNumber: string;
    lossType: string;
    lostQuantity: string;
    unit: string;
  } | null;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  unit: string;
  quantity: string | number;
  lineNumber: number;
  notes?: string | null;
}

export interface ProductionMaterialTraceabilityDocument {
  id: string;
  documentNumber: string;
  documentType: ProductionMaterialDocumentType;
  status: string;
  documentDate: string;
  productionRun?: { id: string; runNumber: string } | null;
  movement?: { id: string; movementNumber: string; movementType: string; status: string } | null;
  issueWarehouse?: { id: string; code: string; name: string } | null;
  lines: ProductionMaterialTraceabilityDocumentLine[];
}

export interface ProductionMaterialTraceability {
  orderId: string;
  orderNumber: string;
  snapshot: {
    id: string;
    revision: number;
    status: string;
    preparedAt: string;
    frozenAt?: string | null;
    productDefinitionCodeSnapshot?: string | null;
    productVersionLabelSnapshot?: string | null;
    lines: ProductionMaterialRequirementLine[];
  } | null;
  documents: ProductionMaterialTraceabilityDocument[];
  consumptionRecords: ProductionMaterialConsumption[];
}

export interface ProductionFinishedGoodsReceipt {
  id: string;
  companyId: string;
  branchId: string;
  receiptNumber: string;
  productionOrderId: string;
  productionOrder?: { id: string; orderNumber: string; status: string } | null;
  productionRunId: string;
  productionRun?: {
    id: string;
    runNumber: string;
    status: string;
    startedAt?: string | null;
    endedAt?: string | null;
  } | null;
  receiptWarehouseId?: string | null;
  receiptWarehouse?: { id: string; code: string; name: string } | null;
  status: ProductionDocumentStatus;
  movementId?: string | null;
  movement?: { id: string; movementNumber: string; movementType: string; status: string } | null;
  movementNumber?: string | null;
  sourceType: string;
  requestId?: string | null;
  notes?: string | null;
  receiptDate: string;
  postedAt?: string | null;
  cancelledAt?: string | null;
  createdById: string;
  postedById?: string | null;
  cancelledById?: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ProductionFinishedGoodsReceiptLine[];
}

// ── Phase 1.8: Production Quality ────────────────────────────────────────────

export interface QualityCharacteristic {
  id: string;
  companyId: string;
  branchId: string;
  planId: string;
  sequence: number;
  nameAr: string;
  nameEn: string;
  characteristicType: 'NUMERIC' | 'BOOLEAN' | 'TEXT' | 'CHOICE';
  unit?: string | null;
  productionUnitId?: string | null;
  productionUnit?: { id: string; code: string; name: string } | null;
  lowerLimit?: number | null;
  targetValue?: number | null;
  upperLimit?: number | null;
  criticality: 'CRITICAL' | 'MAJOR' | 'MINOR';
  samplingRule?: string | null;
  isRequired: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface QualitySamplingPoint {
  id: string;
  companyId: string;
  branchId: string;
  planId: string;
  stage: 'INCOMING' | 'IN_PROCESS' | 'FINAL_OUTPUT';
  measurementPointId?: string | null;
  measurementPoint?: { id: string; code: string; name: string } | null;
  productionLineId?: string | null;
  productionLine?: { id: string; code: string; name: string } | null;
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  appliesToMaterial: boolean;
  appliesToFinishedGoods: boolean;
  sampleFrequency?: string | null;
  sampleSize?: number | null;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProductionQualityPlan {
  id: string;
  companyId: string;
  branchId: string;
  code: string;
  revision: number;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'INACTIVE';
  productionProductDefinitionId: string;
  productionProductDefinition?: {
    id: string;
    code: string;
    productId: string;
    product: { id: string; code: string; name: string };
  } | null;
  productionVersionId?: string | null;
  productionVersion?: { id: string; versionNumber: number; versionLabel: string } | null;
  productionPackagingId?: string | null;
  productionPackaging?: { id: string; packagingType: string; packQuantity: string } | null;
  productionLineId?: string | null;
  productionLine?: { id: string; code: string; name: string } | null;
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  costCenterId?: string | null;
  costCenter?: { id: string; code: string; name: string } | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  statusLabel?: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectedById?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  deactivatedById?: string | null;
  deactivatedAt?: string | null;
  deactivationReason?: string | null;
  notes?: string | null;
  createdById: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  characteristics: QualityCharacteristic[];
  samplingPoints: QualitySamplingPoint[];
}

export interface ProductionInspectionResult {
  id: string;
  companyId: string;
  branchId: string;
  inspectionId: string;
  characteristicId: string;
  characteristic?: { id: string; nameAr: string; nameEn: string } | null;
  characteristicSequenceSnapshot: number;
  characteristicNameArSnapshot: string;
  characteristicNameEnSnapshot: string;
  characteristicTypeSnapshot: string;
  unitSnapshot?: string | null;
  lowerLimitSnapshot?: number | null;
  targetSnapshot?: number | null;
  upperLimitSnapshot?: number | null;
  valueNumeric?: number | null;
  valueBoolean?: boolean | null;
  valueText?: string | null;
  valueChoice?: string | null;
  pass: boolean;
  method?: string | null;
  sourceType: string;
  correctsResultId?: string | null;
  correctionReason?: string | null;
  recordedById: string;
  recordedAt: string;
  createdAt: string;
}

export interface ProductionQualityDisposition {
  id: string;
  companyId: string;
  branchId: string;
  inspectionId: string;
  action: 'RELEASE' | 'REJECT' | 'REWORK' | 'SCRAP';
  quantity: number;
  unit: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProductionInspection {
  id: string;
  companyId: string;
  branchId: string;
  inspectionNumber: string;
  clientRequestId: string;
  planId: string;
  plan?: { id: string; code: string; revision: number; status: string } | null;
  planCodeSnapshot: string;
  planRevisionSnapshot: number;
  status: 'OPEN' | 'COMPLETED' | 'HELD' | 'DISPOSITIONED';
  productionOrderId?: string | null;
  productionOrder?: { id: string; orderNumber: string; status: string } | null;
  productionRunId?: string | null;
  productionRun?: { id: string; runNumber: string; status: string } | null;
  outputEventId?: string | null;
  outputEvent?: { id: string; eventType: string; classification: string; quantity: number; unit: string } | null;
  finishedGoodsReceiptId?: string | null;
  finishedGoodsReceipt?: { id: string; receiptNumber: string; status: string } | null;
  finishedGoodsReceiptLineId?: string | null;
  finishedGoodsReceiptLine?: { id: string; lineNumber: number; productId: string } | null;
  samplingPointId?: string | null;
  samplingPoint?: { id: string; stage: string; sortOrder: number } | null;
  productId?: string | null;
  product?: { id: string; code: string; name: string } | null;
  productCodeSnapshot?: string | null;
  productNameSnapshot?: string | null;
  productionLineId?: string | null;
  productionLine?: { id: string; code: string; name: string } | null;
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  shiftId?: string | null;
  shift?: { id: string; code: string; name: string } | null;
  costCenterId?: string | null;
  costCenter?: { id: string; code: string; name: string } | null;
  sampledQuantity: number;
  unit: string;
  inspectedAt: string;
  inspectedById?: string | null;
  inspectedAtConfirmed?: string | null;
  notes?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  results: ProductionInspectionResult[];
  dispositions: ProductionQualityDisposition[];
  nonconformances: { id: string; ncrNumber: string; severity: string; status: string; description: string }[];
}

export interface ProductionNonconformanceTransition {
  id: string;
  companyId: string;
  branchId: string;
  nonconformanceId: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  actorId: string;
  reason?: string | null;
  requestId: string;
  createdAt: string;
}

export interface ProductionNonconformanceAttachment {
  id: string;
  companyId: string;
  branchId: string;
  nonconformanceId: string;
  attachmentId: string;
  attachment?: { id: string; originalName: string; mimeType: string; size: number; createdAt: string } | null;
  uploadedById: string;
  createdAt: string;
}

export interface ProductionNcr {
  id: string;
  companyId: string;
  branchId: string;
  ncrNumber: string;
  clientRequestId: string;
  inspectionId?: string | null;
  inspection?: {
    id: string;
    inspectionNumber: string;
    status: string;
    product: { id: string; code: string; name: string };
  } | null;
  dispositionId?: string | null;
  disposition?: { id: string; action: string; quantity: number; unit: string; status: string } | null;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'ACTION_REQUIRED' | 'VERIFIED' | 'CLOSED';
  description: string;
  rootCause?: string | null;
  correctiveAction?: string | null;
  ownerUserId?: string | null;
  detectionDate: string;
  targetDate?: string | null;
  verifiedAt?: string | null;
  closedAt?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  transitions: ProductionNonconformanceTransition[];
  attachments: ProductionNonconformanceAttachment[];
}

// ── Phase 1.8: Operational Cost ──────────────────────────────────────────────

export interface ProductionCostRate {
  id: string;
  companyId: string;
  branchId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description?: string | null;
  costType: 'MATERIAL' | 'LABOR' | 'MACHINE' | 'OVERHEAD';
  unit: string;
  rate: number;
  currencyCode: string;
  productionLineId?: string | null;
  productionLine?: { id: string; code: string; name: string } | null;
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  costCenterId?: string | null;
  costCenter?: { id: string; code: string; name: string } | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdById: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProductionCostSnapshot {
  id: string;
  companyId: string;
  branchId: string;
  code: string;
  revision: number;
  status: 'DRAFT' | 'FROZEN' | 'SUPERSEDED';
  productionProductDefinitionId: string;
  productionProductDefinition?: {
    id: string;
    code: string;
    productId: string;
    product: { id: string; code: string; name: string };
  } | null;
  productionVersionId?: string | null;
  productionVersion?: { id: string; versionNumber: number; versionLabel: string } | null;
  productionPackagingId?: string | null;
  productionPackaging?: { id: string; packagingType: string; packQuantity: string } | null;
  productionLineId?: string | null;
  productionLine?: { id: string; code: string; name: string } | null;
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  costCenterId?: string | null;
  costCenter?: { id: string; code: string; name: string } | null;
  costType: 'MATERIAL' | 'LABOR' | 'MACHINE' | 'OVERHEAD';
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  statusLabel?: string;
  frozenById?: string | null;
  frozenAt?: string | null;
  supersededById?: string | null;
  supersededAt?: string | null;
  notes?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProductionCostTransaction {
  id: string;
  companyId: string;
  branchId: string;
  eventType: 'MATERIAL' | 'LABOR' | 'MACHINE' | 'OVERHEAD';
  sourceType: string;
  sourceId: string;
  sourceNumberSnapshot?: string | null;
  clientRequestId: string;
  productionOrderId?: string | null;
  productionOrder?: { id: string; orderNumber: string; status: string } | null;
  productionRunId?: string | null;
  productionRun?: { id: string; runNumber: string; status: string } | null;
  productId?: string | null;
  product?: { id: string; code: string; name: string } | null;
  productCodeSnapshot?: string | null;
  productNameSnapshot?: string | null;
  productionVersionId?: string | null;
  productionVersion?: { id: string; versionNumber: number; versionLabel: string } | null;
  productionPackagingId?: string | null;
  productionPackaging?: { id: string; packagingType: string; packQuantity: string } | null;
  productionLineId?: string | null;
  productionLine?: { id: string; code: string; name: string } | null;
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  shiftId?: string | null;
  shift?: { id: string; code: string; name: string } | null;
  costCenterId?: string | null;
  costCenter?: { id: string; code: string; name: string } | null;
  standardCostSnapshotId?: string | null;
  standardCostSnapshot?: { id: string; code: string; revision: number; status: string } | null;
  outputEventId?: string | null;
  outputEvent?: { id: string; eventType: string; classification: string; quantity: number; unit: string } | null;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  standardAmount?: number | null;
  varianceAmount?: number | null;
  currencyCode: string;
  occurredAt: string;
  status: 'POSTED' | 'REVERSED';
  reversalOfId?: string | null;
  reversalOf?: { id: string; sourceNumberSnapshot: string | null; occurredAt: string } | null;
  reversalReason?: string | null;
  notes?: string | null;
  createdById: string;
  reversedById?: string | null;
  reversedAt?: string | null;
  createdAt: string;
}

export type ProductionPerformanceTargetStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'INACTIVE';
export type ProductionPerformanceTargetScopeType = 'COMPANY' | 'BRANCH' | 'UNIT' | 'LINE' | 'MACHINE' | 'PRODUCT';

export interface ProductionPerformanceTarget {
  id: string;
  code: string;
  revision: number;
  supersedesId?: string | null;
  supersedes?: { id: string; code: string; revision: number } | null;
  scopeType: ProductionPerformanceTargetScopeType;
  productionUnitId?: string | null;
  productionUnit?: { id: string; code: string; name: string } | null;
  productionLineId?: string | null;
  productionLine?: { id: string; code: string; name: string } | null;
  machineId?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  productionProductDefinitionId?: string | null;
  productionProductDefinition?: { id: string; code: string; name: string } | null;
  availabilityTarget: string;
  performanceTarget: string;
  qualityTarget: string;
  oeeTarget: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  approvalNote?: string | null;
  notes?: string | null;
  status: ProductionPerformanceTargetStatus;
  clientRequestId: string;
  submittedById?: string | null;
  submittedAt?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  deactivatedById?: string | null;
  deactivatedAt?: string | null;
  deactivationReason?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProductionPerformanceTargetTransition {
  id: string;
  targetId: string;
  companyId: string;
  branchId: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  actorId: string;
  reason?: string | null;
  requestId: string;
  createdAt: string;
}

export interface ProductionPerformanceTargetHistory {
  code: string;
  revisions: ProductionPerformanceTarget[];
  transitions: ProductionPerformanceTargetTransition[];
  audits: Array<{
    id: string;
    userId: string;
    action: string;
    entityId: string;
    details: unknown;
    createdAt: string;
  }>;
}

export type ProductionAnalyticsFactor = {
  fraction: string | null;
  percent: string | null;
  numerator: string;
  denominator: string;
  unit: string;
  blockers: string[];
  warnings: string[];
};

export type ProductionAnalyticsOee = {
  fraction: string | null;
  percent: string | null;
  blockers: string[];
  warnings: string[];
};

export type ProductionAnalyticsTargetStatus = 'MEETING' | 'BELOW_TARGET' | 'BLOCKED' | 'NO_TARGET';

export interface ProductionAnalyticsRunSummary {
  productionRunId: string;
  runNumber: string;
  status: string;
  productionOrderId: string;
  orderNumber: string;
  productionUnitCode: string;
  productionLineCode: string;
  machineCode: string | null;
  productCode: string;
  productName: string;
  shiftCode: string | null;
  startedAt: string | null;
  endedAt: string | null;
  metrics: {
    plannedMinutes: string;
    unplannedDowntimeMinutes: string;
    operatingMinutes: string;
    idealOutput: string;
    totalOutput: string;
    goodOutput: string;
    outputEventCount: number;
    availability: ProductionAnalyticsFactor;
    performance: ProductionAnalyticsFactor;
    quality: ProductionAnalyticsFactor;
    oee: ProductionAnalyticsOee;
  };
  target: {
    id: string;
    code: string;
    revision: number;
    scopeType: string;
    availabilityTarget: string;
    performanceTarget: string;
    qualityTarget: string;
    oeeTarget: string;
  } | null;
  targetStatus: ProductionAnalyticsTargetStatus;
}

export interface ProductionAnalyticsRunDetailed extends ProductionAnalyticsRunSummary {
  plannedDowntimeMinutes: string;
  wasteTotal: string;
  reworkTotal: string;
}

export type ProductionAnalyticsAggregates = {
  runCount: number;
  plannedMinutes: string;
  operatingMinutes: string;
  totalOutput: string;
  goodOutput: string;
  rejectOutput: string;
  idealOutput: string;
  availability: ProductionAnalyticsFactor;
  performance: ProductionAnalyticsFactor;
  quality: ProductionAnalyticsFactor;
  oee: ProductionAnalyticsOee;
};

export interface ProductionAnalyticsWindow {
  from: string;
  to: string;
}

export interface ProductionAnalyticsOeeReport {
  formulaVersion: string;
  timezone: string;
  window: ProductionAnalyticsWindow;
  aggregates: ProductionAnalyticsAggregates;
  byProduct: Array<{ key: string; label: string; runCount: number; aggregates: ProductionAnalyticsAggregates }>;
  runs: ProductionAnalyticsRunSummary[];
}

export interface ProductionAnalyticsTrendReport {
  grain: 'DAY' | 'WEEK' | 'MONTH';
  formulaVersion: string;
  timezone: string;
  window: ProductionAnalyticsWindow;
  bucketCount: number;
  items: Array<{
    key: string;
    from: string;
    to: string;
    runCount: number;
    aggregates: ProductionAnalyticsAggregates;
  }>;
}

export interface ProductionAnalyticsLossParetoReport {
  timezone: string;
  window: ProductionAnalyticsWindow;
  totals: {
    unplannedMinutes: string;
    plannedMinutes: string;
    totalMinutes: string;
    segmentCount: number;
  };
  items: Array<{
    reasonId: string | null;
    reasonCode: string | null;
    reasonNameEn: string | null;
    reasonNameAr: string | null;
    lossCategory: string | null;
    plannedDefault: boolean | null;
    minutes: string;
    count: number;
    sharePercent: string;
  }>;
}

export interface ProductionAnalyticsBottlenecksReport {
  timezone: string;
  window: ProductionAnalyticsWindow;
  totalUnplannedMinutes: string;
  items: Array<{
    machineId: string | null;
    machineCode: string | null;
    machineName: string | null;
    productionLineId: string | null;
    productionLineCode: string | null;
    minutes: string;
    count: number;
    sharePercent: string;
  }>;
}

export interface ProductionAnalyticsCapacityVarianceReport {
  timezone: string;
  window: ProductionAnalyticsWindow;
  aggregates: {
    totalPlannedQuantity: string;
    totalActualOutput: string;
    totalIdealOutput: string;
    totalVariance: string;
    utilizationPercent: string;
  };
  rows: Array<{
    productionRunId: string;
    runNumber: string;
    status: string;
    productionOrderId: string;
    orderNumber: string;
    productCode: string;
    productName: string;
    productionLineCode: string;
    machineCode: string | null;
    capacityStandardCode: string;
    capacityStandardRevision: number;
    plannedQuantity: string;
    quantityUnit: string;
    actualOutput: string;
    idealOutput: string;
    variance: string;
    utilizationPercent: string;
  }>;
}

export interface ProductionAnalyticsDrilldownReport {
  timezone: string;
  window: ProductionAnalyticsWindow;
  meta: { page: number; limit: number; total: number; totalPages: number };
  runs: ProductionAnalyticsRunDetailed[];
}

export type ProductionAnalyticsOutputTotals = {
  runCount: number;
  totalOutput: string;
  goodOutput: string;
  rejectOutput: string;
  waste: string;
  rework: string;
  yieldPercent: string;
};

export interface ProductionAnalyticsOutputReport {
  timezone: string;
  window: ProductionAnalyticsWindow;
  aggregates: ProductionAnalyticsOutputTotals;
  byProduct: Array<{ key: string; label: string; runCount: number; totals: ProductionAnalyticsOutputTotals }>;
  byLine: Array<{ key: string; label: string; runCount: number; totals: ProductionAnalyticsOutputTotals }>;
  byMachine: Array<{ key: string; label: string; runCount: number; totals: ProductionAnalyticsOutputTotals }>;
}

export interface ProductionAnalyticsDowntimeReport {
  timezone: string;
  window: ProductionAnalyticsWindow;
  aggregates: {
    segmentCount: number;
    unplannedDowntimeMinutes: string;
    plannedDowntimeMinutes: string;
    totalDowntimeMinutes: string;
  };
  byReason: Array<{
    reasonId: string | null;
    reasonCode: string | null;
    reasonNameEn: string | null;
    reasonNameAr: string | null;
    lossCategory: string | null;
    minutes: string;
    count: number;
  }>;
  byShift: Array<{ shiftId: string | null; shiftCode: string | null; minutes: string; count: number }>;
}

export interface ProductionAnalyticsLossesReport {
  timezone: string;
  window: ProductionAnalyticsWindow;
  aggregates: { totalLossQuantity: string; eventCount: number };
  byType: Array<{ type: string; quantity: string; count: number }>;
  byReason: Array<{
    reasonId: string | null;
    reasonCode: string | null;
    reasonNameEn: string | null;
    reasonNameAr: string | null;
    lossCategory: string | null;
    quantity: string;
    count: number;
  }>;
}

export interface ProductionAnalyticsQualityReport {
  timezone: string;
  window: ProductionAnalyticsWindow;
  aggregates: {
    goodOutput: string;
    rejectOutput: string;
    totalOutput: string;
    qualityFactor: ProductionAnalyticsFactor;
    firstPassRatePercent: string;
    inspectionCount: number;
    passedInspections: number;
    failedInspections: number;
    dispositionCount: number;
  };
  byAction: Array<{ action: string; quantity: string; count: number }>;
}

export interface ProductionAnalyticsMaterialsReport {
  timezone: string;
  window: ProductionAnalyticsWindow;
  aggregates: { totalQuantity: string; documentCount: number };
  byProduct: Array<{
    productId: string;
    productCode: string;
    productName: string;
    unit: string;
    quantity: string;
    count: number;
  }>;
}

export interface ProductionAnalyticsCostReport {
  timezone: string;
  window: ProductionAnalyticsWindow;
  currencyCode: string;
  aggregates: { totalAmount: string; transactionCount: number };
  byEventType: Array<{ eventType: string; amount: string; count: number }>;
  byCostCenter: Array<{
    costCenterId: string | null;
    costCenterCode: string | null;
    costCenterName: string | null;
    amount: string;
    count: number;
  }>;
}

export interface ProductionAnalyticsExportResult {
  report: string;
  timezone: string;
  window: ProductionAnalyticsWindow;
  generatedAt: string;
  rowCount: number;
  csv: string;
}

export type ProductionAnalyticsReportName =
  | 'oee'
  | 'trends'
  | 'loss-pareto'
  | 'bottlenecks'
  | 'capacity-variance'
  | 'drilldown'
  | 'output'
  | 'downtime'
  | 'losses'
  | 'quality'
  | 'materials'
  | 'cost';

export interface ProductionAnalyticsQuery {
  dateFrom: string;
  dateTo: string;
  productionUnitId?: string;
  productionLineId?: string;
  machineId?: string;
  productionProductDefinitionId?: string;
  shiftId?: string;
  productionOrderId?: string;
  productionRunId?: string;
  reasonId?: string;
  grain?: 'DAY' | 'WEEK' | 'MONTH';
  lossCategory?: 'WASTE' | 'SCRAP' | 'REWORK' | 'OTHER';
  downtimeOccurrence?: 'PLANNED' | 'UNPLANNED';
}

export interface ProductionPerformanceTargetListResponse {
  data: ProductionPerformanceTarget[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}