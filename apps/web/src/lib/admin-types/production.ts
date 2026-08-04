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
    product?: { id: string; productCode?: string; nameAr?: string; nameEn?: string } | null;
  } | null;
  productionOrderId?: string | null;
  productionOrder?: { id: string; orderNumber: string } | null;
  shiftId?: string | null;
  shift?: { id: string; shiftName: string } | null;
  productionLineId?: string | null;
  productionLine?: { id: string; name: string } | null;
  machineId?: string | null;
  machine?: { id: string; machineCode?: string; name: string } | null;
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
  maintenanceRequest?: { id: string; requestNumber: string; status: string } | null;
  maintenanceWorkOrderId?: string | null;
  maintenanceWorkOrder?: { id: string; workOrderNumber: string; status: string } | null;
  sourceType: string;
  status: string;
  requestId?: string | null;
  correctsSegmentId?: string | null;
  correctionReason?: string | null;
  notes?: string | null;
  recordedById: string;
  recordedBy?: { id: string; firstName: string; lastName: string } | null;
  closedBy?: { id: string; firstName: string; lastName: string } | null;
  cancelledBy?: { id: string; firstName: string; lastName: string } | null;
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
    product?: { id: string; productCode?: string; nameAr?: string; nameEn?: string } | null;
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
  machine?: { id: string; machineCode?: string; name: string } | null;
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
  recordedBy?: { id: string; firstName: string; lastName: string } | null;
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
    machine?: { id: string; machineCode?: string; name: string } | null;
  }>;
  totalDowntimeMinutes: number;
  events: ProductionLossQuantityEvent[];
  totals: Record<string, string>;
  meta: { page: number; limit: number; total: number; totalPages: number };
}