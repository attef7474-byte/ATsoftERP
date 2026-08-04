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
