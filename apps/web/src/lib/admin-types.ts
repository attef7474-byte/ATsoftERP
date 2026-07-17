export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface Company {
  id: string;
  code: string;
  name: string;
  legalName?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { branches: number; departments: number; users: number; warehouses: number; machines: number };
}

export interface Branch {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string; code: string };
}

export interface Department {
  id: string;
  companyId: string;
  branchId?: string | null;
  parentId?: string | null;
  code: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  parent?: { id: string; name: string };
  children?: { id: string; name: string; code: string }[];
  _count?: { children: number; users: number; machines: number };
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  status: string;
  companyId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  roles?: UserRole[];
}

export interface UserRole {
  role: { id: string; code: string; name: string };
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  permissions?: RolePermission[];
  _count?: { users: number };
}

export interface RolePermission {
  permission: Permission;
}

export interface Permission {
  id: string;
  key: string;
  module: string;
  action: string;
  description?: string | null;
  status: string;
}

export interface Warehouse {
  id: string;
  companyId: string;
  branchId?: string | null;
  code: string;
  name: string;
  location?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  locations?: WarehouseLocation[];
  _count?: { locations: number; balances: number };
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  barcode?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  warehouse?: { id: string; name: string; code: string };
}

export interface ProductCategory {
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
  _count?: { children: number; products: number };
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  unit: string;
  barcode?: string | null;
  qrCode?: string | null;
  image?: string | null;
  minStock: number;
  maxStock: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; code: string };
}

export type InventoryCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type InventoryCountLineStatus = 'PENDING' | 'COUNTED' | 'VERIFIED';
export type InventoryMovementStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type InventoryMovementType = 'OPENING' | 'PURCHASE_RECEIPT' | 'SALES_ISSUE' | 'PRODUCTION_RECEIPT' | 'PRODUCTION_ISSUE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'COUNT_ADJUSTMENT';
export type InventoryMovementDirection = 'IN' | 'OUT';
export type InventoryAdjustmentStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface InventoryCount {
  id: string;
  countNumber: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  status: InventoryCountStatus;
  countDate: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  warehouse?: { id: string; name: string; code: string };
  lines?: InventoryCountLine[];
  _count?: { lines: number };
  summary?: { linesCount: number; countedLinesCount: number; verifiedLinesCount: number; totalDifferenceQty: number };
}

export interface InventoryCountLine {
  id: string;
  countId: string;
  productId: string;
  warehouseLocationId?: string | null;
  systemQty: number;
  countedQty?: number | null;
  differenceQty?: number | null;
  status: InventoryCountLineStatus;
  countedAt?: string | null;
  countedById?: string | null;
  verifiedAt?: string | null;
  verifiedById?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; name: string; code: string; unit: string };
  warehouseLocation?: { id: string; name: string; code: string };
}

export interface InventoryMovement {
  id: string;
  movementNumber: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  movementType: InventoryMovementType;
  status: InventoryMovementStatus;
  direction: InventoryMovementDirection;
  movementDate: string;
  sourceType?: string | null;
  sourceId?: string | null;
  postedAt?: string | null;
  postedById?: string | null;
  cancelledAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  warehouse?: { id: string; name: string; code: string };
  lines?: InventoryMovementLine[];
  _count?: { lines: number };
}

export interface InventoryMovementLine {
  id: string;
  movementId: string;
  productId: string;
  warehouseLocationId?: string | null;
  quantity: number;
  direction: InventoryMovementDirection;
  unit?: string | null;
  notes?: string | null;
  product?: { id: string; name: string; code: string; unit: string };
  warehouseLocation?: { id: string; name: string; code: string };
}

export interface InventoryAdjustment {
  id: string;
  adjustmentNumber: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  inventoryCountId?: string | null;
  status: InventoryAdjustmentStatus;
  adjustmentDate: string;
  reason?: string | null;
  notes?: string | null;
  postedAt?: string | null;
  postedById?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  warehouse?: { id: string; name: string; code: string };
  inventoryCount?: { id: string; countNumber: string; status: string };
  lines?: InventoryAdjustmentLine[];
  _count?: { lines: number };
}

export interface InventoryAdjustmentLine {
  id: string;
  adjustmentId: string;
  productId: string;
  warehouseLocationId?: string | null;
  systemQty: number;
  countedQty: number;
  differenceQty: number;
  notes?: string | null;
  product?: { id: string; name: string; code: string; unit: string };
  warehouseLocation?: { id: string; name: string; code: string };
}

export interface InventoryBalance {
  id: string;
  productId: string;
  warehouseId: string;
  warehouseLocationId?: string | null;
  quantity: number;
  updatedAt: string;
  product?: { id: string; name: string; code: string; unit: string };
  warehouse?: { id: string; name: string; code: string };
  warehouseLocation?: { id: string; name: string; code: string };
}

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

export interface MachineOperationalSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  category: { id: string; name: string; code: string } | null;
  activeRequests: number;
  openTasks: number;
  activeDowntime: number;
  totalDowntimeHoursThisMonth: number;
  nextMaintenanceDueDate: string | null;
  nextMaintenanceTitle: string | null;
  dueStatus: string | null;
}

export interface OperationalSummaryResponse {
  machines: MachineOperationalSummary[];
  totals: {
    totalMachines: number;
    totalActiveRequests: number;
    totalOpenTasks: number;
    totalActiveDowntime: number;
    totalDowntimeHoursThisMonth: number;
  };
}

export interface RequestSummary {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
}

export interface DowntimeSummary {
  total: number;
  active: number;
  closed: number;
  cancelled: number;
  totalDurationHours: number;
}

export interface ScheduleSummary {
  total: number;
  active: number;
  inactive: number;
  overdue: number;
  dueSoon: number;
  notDue: number;
  expired: number;
}

export interface BalanceSummary {
  totalBalances: number;
  totalProducts: number;
  totalQuantity: number;
  totalWarehouses: number;
  byWarehouse: { warehouseId: string; count: number }[];
}

export interface CountSummary {
  total: number;
  draft: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export interface MovementSummary {
  total: number;
  draft: number;
  posted: number;
  cancelled: number;
  totalInQty: number;
  totalOutQty: number;
}

export interface AdjustmentSummary {
  total: number;
  draft: number;
  posted: number;
  cancelled: number;
  totalPositiveAdjustment: number;
  totalNegativeAdjustment: number;
}

export interface BarcodeLabel {
  id: string;
  code: string;
  value: string;
  symbology: string;
  entityType: string;
  entityId: string;
  status: string;
  title?: string | null;
  description?: string | null;
  qrPayload?: string | null;
  humanReadableValue?: string | null;
  labelTemplateCode?: string | null;
  printCount: number;
  lastPrintedAt?: string | null;
  lastScannedAt?: string | null;
  scanCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BarcodeScanEvent {
  id: string;
  labelId?: string | null;
  scannedValue: string;
  symbology?: string | null;
  purpose: string;
  result: string;
  source: string;
  entityType?: string | null;
  entityId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
  message?: string | null;
  scannedAt: string;
  label?: { id: string; code: string; value: string; status: string };
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  label?: string | null;
  description?: string | null;
  group: string;
  status: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NumberSequence {
  id: string;
  code: string;
  name: string;
  prefix: string;
  suffix?: string | null;
  currentNumber: number;
  padding: number;
  scope: string;
  resetPolicy: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: { id: string; email: string; name: string } | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message?: string | null;
  link?: string | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface BarcodeScanResponse {
  result: string;
  message: string;
  event: { id: string; scannedAt: string };
  label?: { id: string; code: string; value: string; entityType?: string; symbology?: string; status: string; title?: string | null };
  entity?: Record<string, unknown>;
  suggestedActions?: string[];
}

export interface BarcodeLabelTemplate {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  symbology: string;
  entityType?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  templateData?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BarcodePrintJob {
  id: string;
  labelId?: string | null;
  templateId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  printerName?: string | null;
  copies: number;
  status: string;
  printedById?: string | null;
  jobType: string;
  note?: string | null;
  requestedAt: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
