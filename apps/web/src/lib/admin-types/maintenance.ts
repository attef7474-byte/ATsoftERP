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
  department?: { id: string; name: string };
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
  description?: string | null;
  partNumber?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  quantity: number;
  unit?: string | null;
  replacementInterval?: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  machine?: { id: string; name: string; code: string };
  product?: { id: string; name: string; code: string };
}

export interface MachineDocument {
  id: string;
  machineId: string;
  title: string;
  documentType?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  machine?: { id: string; name: string; code: string };
}

export interface MaintenanceRequest {
  id: string;
  requestNumber: string;
  machineId: string;
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
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  machine?: { id: string; name: string; code: string };
  requestedBy?: { id: string; name: string; email: string };
  assignedTo?: { id: string; name: string; email: string };
  _count?: { tasks: number };
  summary?: { tasksCount: number; completedTasksCount: number; openTasksCount: number; totalDowntimeHours: number };
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
  maintenanceType: string;
  frequency: string;
  intervalValue?: number | null;
  startDate: string;
  endDate?: string | null;
  nextDueAt?: string | null;
  lastRunAt?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  machine?: { id: string; name: string; code: string };
  request?: { id: string; requestNumber: string; title: string };
  dueStatus?: string;
}

export interface MaintenanceChecklistItem {
  id: string;
  scheduleId?: string | null;
  taskId?: string | null;
  title: string;
  description?: string | null;
  sortOrder: number;
  required: boolean;
  status: string;
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
  status?: string | null;
  cancelledAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  machine?: { id: string; name: string; code: string };
  request?: { id: string; requestNumber: string; title: string };
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
  department?: { id: string; name: string; code: string };
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
  companyId?: string | null;
  branchId?: string | null;
  administrationId?: string | null;
  departmentId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
  administration?: { id: string; name: string; code: string };
  department?: { id: string; name: string; code: string };
}
