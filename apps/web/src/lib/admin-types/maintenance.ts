export interface MachineCategory {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  parent?: { id: string; name: string };
  children?: { id: string; name: string; code: string }[];
  _count?: { machines: number };
}

export interface Machine {
  id: string;
  code: string;
  name: string;
  categoryId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  productionLineId?: string | null;
  operationTypeId?: string | null;
  defaultCostCenterId?: string | null;
  technicalAdministrationId?: string | null;
  technicalDepartmentId?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  purchaseDate?: string | null;
  warrantyEnd?: string | null;
  location?: string | null;
  status: string;
  qrCode?: string | null;
  image?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; code: string };
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  department?: { id: string; name: string; classification?: string };
  productionLine?: { id: string; name: string; code: string };
  operationType?: { id: string; name: string; code: string };
  defaultCostCenter?: { id: string; name: string; code: string };
  technicalAdministration?: { id: string; name: string };
  technicalDepartment?: { id: string; name: string };
}

export interface MachinePart {
  id: string;
  machineId?: string | null;
  productId?: string | null;
  code: string;
  name: string;
  partNumber?: string | null;
  quantity: number;
  minStock: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
  machine?: { id: string; name: string; code: string };
  product?: { id: string; name: string; code: string };
}

export interface MachineDocument {
  id: string;
  machineId: string;
  title: string;
  type: string;
  fileUrl: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  machine?: { id: string; name: string; code: string };
}

export interface MaintenanceRequest {
  id: string;
  requestNumber: string;
  machineId: string;
  productionLineId?: string | null;
  machineComponentId?: string | null;
  operationTypeId?: string | null;
  costCenterId?: string | null;
  requestedById: string;
  assignedToId?: string | null;
  type: string;
  priority: string;
  status: string;
  title: string;
  description?: string | null;
  reportedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  downtimeHours?: number | null;
  isEmergency?: boolean | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  machine?: { id: string; name: string; code: string };
  productionLine?: { id: string; name: string; code: string };
  machineComponent?: { id: string; name: string; code: string };
  operationType?: { id: string; name: string; code: string };
  costCenter?: { id: string; name: string; code: string };
  requestedBy?: { id: string; name: string; email: string };
  assignedTo?: { id: string; name: string; email: string };
  _count?: { tasks: number };
  summary?: { tasksCount: number; completedTasksCount: number; openTasksCount: number; totalDowntimeHours: number };
  requiredParts?: Array<{
    id: string;
    sparePartId: string;
    quantity: number;
    unit?: string | null;
    usageNote?: string | null;
    isPrimary: boolean;
  }>;
}

export interface MaintenanceTask {
  id: string;
  requestId: string;
  assignedToId?: string | null;
  title: string;
  description?: string | null;
  status: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  laborHours?: number | null;
  laborCost?: number | null;
  materialCost?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  request?: { id: string; requestNumber: string; title: string; status: string };
  assignedTo?: { id: string; name: string; email: string };
}

export interface MaintenanceSchedule {
  id: string;
  machineId: string;
  requestId?: string | null;
  title: string;
  description?: string | null;
  type: string;
  frequency: string;
  intervalDays?: number | null;
  startDate: string;
  endDate?: string | null;
  nextDueDate?: string | null;
  lastRunAt?: string | null;
  lastGeneratedAt?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  machine?: { id: string; name: string; code: string };
  request?: { id: string; requestNumber: string; title: string };
  dueStatus?: string;
}

export interface MaintenanceChecklistItem {
  id: string;
  scheduleId: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  isMandatory: boolean;
  resultType: string;
  minValue?: number | null;
  maxValue?: number | null;
  unit?: string | null;
  createdAt: string;
  updatedAt: string;
  schedule?: { id: string; title: string };
}

export interface MaintenanceRequestPartUsage {
  id: string;
  requestId: string;
  productId: string;
  quantity: number;
  unitCost?: number | null;
  totalCost?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  request?: { id: string; requestNumber: string; title: string };
  product?: { id: string; name: string; code: string; unit: string };
}

export interface MaintenanceRequestCostEntry {
  id: string;
  requestId: string;
  type: string;
  description?: string | null;
  amount: number;
  incurredAt: string;
  createdAt: string;
  updatedAt: string;
  request?: { id: string; requestNumber: string; title: string };
}

export interface MaintenanceChecklistExecution {
  id: string;
  scheduleId: string;
  requestId?: string | null;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  completedById?: string | null;
  completedBy?: { id: string; name: string };
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  schedule?: { id: string; title: string; type?: string };
  request?: { id: string; requestNumber: string; title: string };
  items?: MaintenanceChecklistExecutionItem[];
  _count?: { items: number };
}

export interface MaintenanceChecklistExecutionItem {
  id: string;
  executionId: string;
  checklistItemId: string;
  status: string;
  passed?: boolean | null;
  notes?: string | null;
  completedAt?: string | null;
  completedById?: string | null;
  completedBy?: { id: string; name: string };
  checklistItem?: { id: string; title: string; description?: string | null; sortOrder: number };
}

export interface MachineMaintenanceLog {
  requests: MaintenanceRequest[];
  tasks: MaintenanceTask[];
  downtimeLogs: DowntimeLog[];
}

export interface DowntimeLog {
  id: string;
  machineId: string;
  requestId?: string | null;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  durationHours?: number | null;
  reason: string;
  failureCause?: string | null;
  failureCategory?: string | null;
  rootCause?: string | null;
  correctiveAction?: string | null;
  preventiveAction?: string | null;
  detectedAt?: string | null;
  responseStartedAt?: string | null;
  repairStartedAt?: string | null;
  repairCompletedAt?: string | null;
  isRepeatFailure?: boolean | null;
  repeatedFailureGroupId?: string | null;
  machineStopped?: boolean | null;
  productionImpact?: string | null;
  rcaStatus?: string | null;
  rcaCompletedBy?: { id: string; name: string } | null;
  rcaCompletedAt?: string | null;
  status?: string | null;
  cancelledAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  machine?: { id: string; name: string; code: string; productionLineId?: string };
  request?: { id: string; requestNumber: string; title: string };
}

export interface RcaData {
  id: string;
  failureCause?: string | null;
  failureCategory?: string | null;
  rootCause?: string | null;
  correctiveAction?: string | null;
  preventiveAction?: string | null;
  rcaStatus?: string | null;
  rcaCompletedBy?: { id: string; name: string } | null;
  rcaCompletedAt?: string | null;
  isRepeatFailure?: boolean | null;
  repeatedFailureGroupId?: string | null;
}

export interface ReliabilityMttr {
  mttrMinutes: number;
  mttrHours: number;
  totalEvents: number;
}

export interface ReliabilityMtbf {
  mtbfMinutes: number;
  mtbfHours: number;
  totalEvents: number;
}

export interface ReliabilityTotalDowntime {
  totalMinutes: number;
  totalHours: number;
  totalEvents: number;
}

export interface ReliabilityByMachine {
  machine: { id: string; code: string; name: string; productionLineId?: string } | null;
  totalMinutes: number;
  totalHours: number;
  eventCount: number;
}

export interface ReliabilityByCause {
  failureCause: string | null;
  totalMinutes: number;
  totalHours: number;
  eventCount: number;
}

export interface ReliabilityEmergencyResponseTime {
  avgResponseTimeMinutes: number;
  avgResponseTimeHours: number;
  totalEvents: number;
}

export interface ProductionLine {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  location?: string | null;
  companyId: string;
  branchId: string;
  administrationId?: string | null;
  departmentId: string;
  operationTypeId: string;
  costCenterId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
  administration?: { id: string; name: string; code: string };
  department?: { id: string; name: string; code: string; classification?: string };
  operationType?: { id: string; name: string; code: string };
  costCenter?: { id: string; name: string; code: string };
}

export interface OperationType {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MachineComponent {
  id: string;
  machineId: string;
  parentComponentId?: string | null;
  code: string;
  name: string;
  componentType: string;
  description?: string | null;
  locationInMachine?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  criticality: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  machine?: { id: string; name: string; code: string };
  parentComponent?: { id: string; name: string; code: string } | null;
  children?: { id: string; name: string; code: string }[];
  _count?: { children: number };
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type: string;
  parentId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isPrimary?: boolean;
  companyId?: string | null;
  branchId?: string | null;
  administrationId?: string | null;
  departmentId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  parent?: { id: string; code: string; name: string } | null;
  children?: { id: string; code: string; name: string; status: string }[];
  company?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
  administration?: { id: string; name: string; code: string };
  department?: { id: string; name: string; code: string };
}

export interface OperationalCostCenterAssignment {
  id: string;
  code: string;
  resourceType: string;
  costCenterId: string;
  machineId?: string | null;
  productionLineId?: string | null;
  productionUnitId?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  priority: number;
  source?: string | null;
  reason?: string | null;
  status: string;
  companyId?: string | null;
  branchId?: string | null;
  createdAt: string;
  updatedAt: string;
  costCenter?: { id: string; code: string; name: string; status: string; isPrimary?: boolean };
  machine?: { id: string; code: string; name: string } | null;
  productionLine?: { id: string; code: string; name: string } | null;
  productionUnit?: { id: string; code: string; name: string } | null;
  company?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
}

export interface MaintenancePersonnel {
  id: string;
  code: string;
  name: string;
  role: string;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  userId?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  operationalPersonId?: string;
  user?: { id: string; name: string; email: string };
  machineResponsibilities?: { id: string; machine?: { id: string; code: string; name: string } | null }[];
  requestAssignments?: { id: string; maintenanceRequest?: { id: string; requestNumber: string; title: string } | null }[];
}

export interface SparePart {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  specification?: string | null;
  unit?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  partNumber?: string | null;
  barcode?: string | null;
  minRecommendedStock?: number | null;
  maxRecommendedStock?: number | null;
  reorderPoint?: number | null;
  isCritical: boolean;
  status: string;
  technicalClassification?: string | null;
  usageType?: string | null;
  nature?: string | null;
  importance?: string | null;
  productId?: string | null;
  product?: { id: string; name: string; code: string };
  componentLinks?: ComponentSparePart[];
  machineLinks?: MachineSparePart[];
  createdAt: string;
  updatedAt: string;
}

export interface ComponentSparePart {
  id: string;
  componentId: string;
  component?: { id: string; name: string; code: string };
  sparePartId: string;
  sparePart?: { id: string; name: string; code: string; partNumber?: string };
  quantity: number;
  unit?: string | null;
  usageNote?: string | null;
  isPrimary: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MachineSparePart {
  id: string;
  machineId: string;
  machine?: { id: string; name: string; code: string };
  sparePartId: string;
  sparePart?: { id: string; name: string; code: string; partNumber?: string };
  quantity: number;
  unit?: string | null;
  usageNote?: string | null;
  isPrimary: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MachineInstalledPart {
  id: string;
  machineId: string;
  machineComponentId?: string | null;
  sparePartId: string;
  productId?: string | null;
  maintenanceRequestId?: string | null;
  requiredPartId?: string | null;
  inventoryMovementId?: string | null;
  conditionMovementId?: string | null;
  installedQuantity: number;
  installedCondition: string;
  installedAt: string;
  installedByUserId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  serialNumber?: string | null;
  batchNumber?: string | null;
  status: string;
  removedAt?: string | null;
  removedByUserId?: string | null;
  removedCondition?: string | null;
  removedQuantity?: number | null;
  removedReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  expectedLifeValue?: number | null;
  expectedLifeUnit?: string | null;
  lifeStartDate?: string | null;
  lifeStartReading?: number | null;
  currentReading?: number | null;
  warningThresholdPercent?: number | null;
  expectedExpiryDate?: string | null;
  expectedExpiryReading?: number | null;
  lifeStatus?: string | null;
  lastEvaluatedAt?: string | null;
  alertThresholdReached?: string | null;
  expectedLifeAlertAt?: string | null;
  life?: InstalledPartLife;
  machine?: { id: string; code: string; name: string };
  machineComponent?: { id: string; code: string; name: string };
  sparePart?: { id: string; code: string; name: string; unit?: string };
  maintenanceRequest?: { id: string; requestNumber: string; title: string };
}

export interface InstalledPartLife {
  lifeStatus: string;
  alertThresholdReached: string;
  progress: number | null;
  expectedExpiryDate: string | null;
  expectedExpiryReading: number | null;
}

export interface MachineInstalledPartReading {
  id: string;
  installedPartId: string;
  readingType: string;
  readingValue: number;
  isReset: boolean;
  recordedByUserId?: string | null;
  recordedAt: string;
  notes?: string | null;
  recordedBy?: { id: string; name: string };
}

export interface SparePartReplacementHistory {
  id: string;
  replacementNumber: string;
  machineId: string;
  machineComponentId?: string | null;
  maintenanceRequestId?: string | null;
  requiredPartId?: string | null;
  oldInstalledPartId?: string | null;
  newInstalledPartId?: string | null;
  oldSparePartId?: string | null;
  newSparePartId: string;
  issuedCondition: string;
  issuedQuantity: number;
  removedCondition?: string | null;
  removedQuantity?: number | null;
  replacementAction: string;
  noReturnReason?: string | null;
  removedReturnedToStock: boolean;
  conditionOutMovementId?: string | null;
  conditionInMovementId?: string | null;
  inventoryOutMovementId?: string | null;
  replacedAt: string;
  replacedByUserId?: string | null;
  notes?: string | null;
  createdAt: string;
  machine?: { id: string; code: string; name: string };
  machineComponent?: { id: string; code: string; name: string };
  maintenanceRequest?: { id: string; requestNumber: string; title: string };
  oldInstalledPart?: { id: string; sparePart: { id: string; code: string; name: string } };
  newInstalledPart?: { id: string; sparePart: { id: string; code: string; name: string } };
  oldSparePart?: { id: string; code: string; name: string };
  newSparePart?: { id: string; code: string; name: string };
}

export interface SparePartRequestLine {
  id: string;
  maintenanceRequestId: string;
  sparePartId: string;
  sparePart?: { id: string; name: string; code: string; partNumber?: string };
  machineComponentId?: string | null;
  machineComponent?: { id: string; name: string; code: string };
  machineId?: string | null;
  machine?: { id: string; name: string; code: string };
  quantity: number;
  unit?: string | null;
  usageNote?: string | null;
  isPrimary: boolean;
  status: string;
  reason?: string | null;
  requestedQuantity?: number | null;
  approvedQuantity?: number | null;
  reservedQuantity?: number | null;
  usedQuantity?: number | null;
  requestedBy?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
  rejectedBy?: { id: string; name: string } | null;
  reservedBy?: { id: string; name: string } | null;
  usedBy?: { id: string; name: string } | null;
  cancelledBy?: { id: string; name: string } | null;
  failureCause?: { id: string; reason: string; failureCause?: string } | null;
  // Batch O — stock issue integration
  issuedQuantity?: number | null;
  returnedQuantity?: number | null;
  stockIssueStatus?: string | null;
  warehouseId?: string | null;
  warehouse?: { id: string; code: string; name: string } | null;
  lastIssueAt?: string | null;
  lastIssueBy?: { id: string; name: string } | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  reservedAt?: string | null;
  usedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceWorkOrderPart {
  id: string;
  workOrderId: string;
  sparePartId?: string | null;
  productId?: string | null;
  quantity: number;
  unit?: string | null;
  unitCost?: number | null;
  totalCost?: number | null;
  notes?: string | null;
  issuedQuantity: number;
  stockIssueStatus: string;
  lastIssueAt?: string | null;
  lastIssueById?: string | null;
  createdAt: string;
  updatedAt: string;
  sparePart?: { id: string; code: string; name: string };
  product?: { id: string; code: string; name: string };
  lastIssueBy?: { id: string; name: string };
}

export interface MaintenanceWorkOrderCostEntry {
  id: string;
  workOrderId: string;
  type: string;
  description?: string | null;
  amount: number;
  incurredAt: string;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string };
}

export interface MaintenanceWorkOrder {
  id: string;
  companyId: string;
  branchId: string;
  workOrderNumber: string;
  title: string;
  description?: string | null;
  type: string;
  priority: string;
  status: string;
  machineId?: string | null;
  machineComponentId?: string | null;
  requestId?: string | null;
  warehouseId?: string | null;
  assignedToId?: string | null;
  supervisorId?: string | null;
  createdById?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  machine?: { id: string; code: string; name: string };
  machineComponent?: { id: string; code: string; name: string };
  request?: { id: string; requestNumber: string; title: string };
  warehouse?: { id: string; code: string; name: string };
  assignedTo?: { id: string; name: string };
  supervisor?: { id: string; name: string };
  createdBy?: { id: string; name: string };
  parts?: MaintenanceWorkOrderPart[];
  costEntries?: MaintenanceWorkOrderCostEntry[];
  _count?: { parts: number; costEntries: number };
}
