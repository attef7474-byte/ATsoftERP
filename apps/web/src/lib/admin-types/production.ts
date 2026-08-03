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
