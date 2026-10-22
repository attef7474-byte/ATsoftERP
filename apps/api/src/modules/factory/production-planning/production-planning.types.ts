import { PlanningReasonCode } from './production-planning.constants';

export interface PlanningWorkingInterval {
  start: string;
  end: string;
  minutes: number;
  source: 'ENTRY' | 'TEMPLATE';
  shiftId: string | null;
  shiftCode: string | null;
}

export interface PlanningResource {
  resourceType: 'LINE' | 'MACHINE';
  productionLineId: string;
  machineId: string | null;
  label: string;
  isDefault: boolean;
  priority: number;
}

export interface PlanningOrderInput {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  productionProductDefinitionId: string;
  productionVersionId: string;
  productionPackagingId: string | null;
  productionUnitId: string;
  quantityUnit: string;
  plannedQuantity: string;
  capacityTimeBasis: string;
  productionLineId: string;
  machineId: string | null;
  plannedStartAt: string;
  plannedEndAt: string;
  lockVersion: number;
}

export interface ScheduledOperation {
  orderId: string;
  orderNumber: string;
  priority: string;
  originalStartAt: string;
  originalEndAt: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  productionLineId: string;
  productionLineCode?: string | null;
  productionLineName?: string | null;
  machineId: string | null;
  capacityStandardId: string;
  capacityStandardCode: string;
  plannedDurationMinutes: string;
  sequenceOnResource: number;
  latenessMinutes: string;
  latenessState: 'ON_TIME' | 'LATE';
  materialState: 'READY' | 'SHORTAGE' | 'UNKNOWN';
  materialWarnings: string[];
  changed: boolean;
}

export interface UnscheduledOperation {
  orderId: string;
  orderNumber: string;
  priority: string;
  reasons: PlanningReasonCode[];
  reasonKeys: string[];
  details?: Record<string, unknown>;
}

export interface PlanningResourceLoad {
  productionLineId: string;
  machineId: string | null;
  label: string;
  usedMinutes: string;
  availableMinutes: string;
  utilizationPercent: string;
  operationCount: number;
}

export interface PlanningDraftResult {
  companyId: string;
  branchId: string;
  horizonFrom: string;
  horizonTo: string;
  calendarId: string;
  generatedAt: string;
  engineVersion: 'FINITE_CAPACITY_V1';
  scheduled: ScheduledOperation[];
  unscheduled: UnscheduledOperation[];
  resourceLoad: PlanningResourceLoad[];
  totals: {
    requested: number;
    scheduled: number;
    unscheduled: number;
    late: number;
    shortageRisk: number;
  };
}
