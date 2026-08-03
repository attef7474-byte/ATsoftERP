import { LookupAdapter } from './types';
import type { Company, Branch, Administration, Department, OrganizationalUnit, Warehouse, ProductCategory, Product, MachineCategory, Machine, User, Role, MaintenanceRequest, MaintenanceTask, MaintenanceSchedule, InventoryCount, InventoryMovement, InventoryAdjustment, WarehouseLocation, BarcodeLabel, SystemSetting, NumberSequence, Notification, AuditLog, MachinePart, DowntimeLog, OperationType, CostCenter, ProductionLine, MachineComponent, SparePart, MaintenancePersonnel, StockTransfer, OperationalReceipt, MaintenanceWorkOrder, ProductionUnit, ProductionProductDefinition, ProductionShift, ProductionShiftTemplate, ProductionShiftCalendar, ProductionShiftAssignment, ProductionOperationalAssignment, OperationalPerson } from '../../lib/admin-types';

export const companyAdapter: LookupAdapter<Company> = {
  endpoint: '/companies',
  contextField: 'companyId',
  displayLabel: (c) => `[${c.code}] ${c.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (c) => c.status },
  ],
};

export const branchAdapter: LookupAdapter<Branch> = {
  endpoint: '/branches',
  contextField: 'branchId',
  displayLabel: (b) => `[${b.code}] ${b.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'company', header: 'Company', render: (b) => b.company?.name || '-' },
    { key: 'status', header: 'Status', render: (b) => b.status },
  ],
};

export const departmentAdapter: LookupAdapter<Department> = {
  endpoint: '/departments',
  contextField: 'departmentId',
  displayLabel: (d) => `[${d.code}] ${d.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'company', header: 'Company', render: (d) => d.company?.name || '-' },
    { key: 'branch', header: 'Branch', render: (d) => d.branch?.name || '-' },
    { key: 'status', header: 'Status', render: (d) => d.status },
  ],
};

export const organizationalUnitAdapter: LookupAdapter<OrganizationalUnit> = {
  endpoint: '/organizational-units',
  displayLabel: (u) => `[${u.code}] ${u.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type', render: (u) => u.type },
    { key: 'parent', header: 'Parent', render: (u) => u.parent?.name || '-' },
    { key: 'status', header: 'Status', render: (u) => u.status },
  ],
};

export const warehouseAdapter: LookupAdapter<Warehouse> = {
  endpoint: '/inventory/warehouses',
  displayLabel: (w) => `[${w.code}] ${w.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'company', header: 'Company', render: (w) => w.company?.name || '-' },
    { key: 'branch', header: 'Branch', render: (w) => w.branch?.name || '-' },
    { key: 'status', header: 'Status', render: (w) => w.status },
  ],
};

export const productCategoryAdapter: LookupAdapter<ProductCategory> = {
  endpoint: '/product-categories',
  displayLabel: (pc) => `[${pc.code}] ${pc.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (pc) => pc.status },
  ],
};

export const productAdapter: LookupAdapter<Product> = {
  endpoint: '/products',
  displayLabel: (p) => `[${p.code}] ${p.name}`,
  searchFields: ['code', 'name', 'barcode'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category', render: (p) => p.category?.name || '-' },
    { key: 'unit', header: 'Unit' },
    { key: 'status', header: 'Status', render: (p) => p.status },
  ],
};

export const machineCategoryAdapter: LookupAdapter<MachineCategory> = {
  endpoint: '/maintenance/machine-categories',
  displayLabel: (mc) => `[${mc.code}] ${mc.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (mc) => mc.status },
  ],
};

export const machineAdapter: LookupAdapter<Machine> = {
  endpoint: '/maintenance/machines',
  displayLabel: (m) => `[${m.code}] ${m.name}`,
  searchFields: ['code', 'name', 'serialNumber'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category', render: (m) => m.category?.name || '-' },
    { key: 'model', header: 'Model', render: (m) => m.model || '-' },
    { key: 'status', header: 'Status', render: (m) => m.status },
  ],
};

export const userAdapter: LookupAdapter<User> = {
  endpoint: '/users',
  displayLabel: (u) => `${u.name} (${u.email})`,
  searchFields: ['name', 'email'],
  columns: [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'status', header: 'Status', render: (u) => u.status },
  ],
};

export const roleAdapter: LookupAdapter<Role> = {
  endpoint: '/roles',
  displayLabel: (r) => `[${r.code}] ${r.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (r) => r.status },
  ],
};

export const maintenanceRequestAdapter: LookupAdapter<MaintenanceRequest> = {
  endpoint: '/maintenance/requests',
  displayLabel: (r) => `[${r.requestNumber}] ${r.title}`,
  searchFields: ['requestNumber', 'title'],
  columns: [
    { key: 'requestNumber', header: 'Number' },
    { key: 'title', header: 'Title' },
    { key: 'status', header: 'Status', render: (r) => r.status },
    { key: 'priority', header: 'Priority', render: (r) => r.priority },
  ],
};

export const maintenanceTaskAdapter: LookupAdapter<MaintenanceTask> = {
  endpoint: '/maintenance/tasks',
  displayLabel: (t) => t.title,
  searchFields: ['title'],
  columns: [
    { key: 'title', header: 'Title' },
    { key: 'status', header: 'Status', render: (t) => t.status },
    { key: 'request', header: 'Request', render: (t) => t.request?.requestNumber || '-' },
  ],
};

export const maintenanceScheduleAdapter: LookupAdapter<MaintenanceSchedule> = {
  endpoint: '/maintenance/schedules',
  displayLabel: (s) => s.title,
  searchFields: ['title'],
  columns: [
    { key: 'title', header: 'Title' },
    { key: 'machine', header: 'Machine', render: (s) => s.machine?.name || '-' },
    { key: 'type', header: 'Type', render: (s) => s.type },
    { key: 'status', header: 'Status', render: (s) => s.status },
  ],
};

export const inventoryCountAdapter: LookupAdapter<InventoryCount> = {
  endpoint: '/inventory/counts',
  displayLabel: (c) => `[${c.countNumber}] ${c.warehouse?.name || ''} - ${c.status}`,
  searchFields: ['countNumber'],
  columns: [
    { key: 'countNumber', header: 'Number' },
    { key: 'warehouse', header: 'Warehouse', render: (c) => c.warehouse?.name || '-' },
    { key: 'status', header: 'Status', render: (c) => c.status },
    { key: 'countDate', header: 'Date', render: (c) => c.countDate ? new Date(c.countDate).toLocaleDateString() : '-' },
  ],
};

export const inventoryMovementAdapter: LookupAdapter<InventoryMovement> = {
  endpoint: '/inventory/movements',
  displayLabel: (m) => `[${m.movementNumber}] ${m.movementType} - ${m.status}`,
  searchFields: ['movementNumber'],
  columns: [
    { key: 'movementNumber', header: 'Number' },
    { key: 'movementType', header: 'Type', render: (m) => m.movementType },
    { key: 'warehouse', header: 'Warehouse', render: (m) => m.warehouse?.name || '-' },
    { key: 'status', header: 'Status', render: (m) => m.status },
  ],
};

export const inventoryAdjustmentAdapter: LookupAdapter<InventoryAdjustment> = {
  endpoint: '/inventory/adjustments',
  displayLabel: (a) => `[${a.adjustmentNumber}] ${a.warehouse?.name || ''} - ${a.status}`,
  searchFields: ['adjustmentNumber'],
  columns: [
    { key: 'adjustmentNumber', header: 'Number' },
    { key: 'warehouse', header: 'Warehouse', render: (a) => a.warehouse?.name || '-' },
    { key: 'status', header: 'Status', render: (a) => a.status },
    { key: 'adjustmentDate', header: 'Date', render: (a) => a.adjustmentDate ? new Date(a.adjustmentDate).toLocaleDateString() : '-' },
  ],
};

export const warehouseLocationAdapter: LookupAdapter<WarehouseLocation> = {
  endpoint: '/inventory/locations',
  displayLabel: (l) => `[${l.code}] ${l.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (l) => l.status },
  ],
};

export const barcodeLabelAdapter: LookupAdapter<BarcodeLabel> = {
  endpoint: '/barcodes/labels',
  displayLabel: (b) => `[${b.code}] ${b.value}`,
  searchFields: ['code', 'value'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'value', header: 'Value' },
    { key: 'entityType', header: 'Entity Type' },
    { key: 'status', header: 'Status', render: (b) => b.status },
  ],
};

export const systemSettingAdapter: LookupAdapter<SystemSetting> = {
  endpoint: '/settings',
  displayLabel: (s) => `[${s.key}] ${s.label || s.key}`,
  searchFields: ['key', 'label'],
  columns: [
    { key: 'key', header: 'Key' },
    { key: 'label', header: 'Label' },
    { key: 'group', header: 'Group' },
    { key: 'status', header: 'Status', render: (s) => s.status },
  ],
};

export const numberSequenceAdapter: LookupAdapter<NumberSequence> = {
  endpoint: '/settings/number-sequences',
  displayLabel: (n) => `[${n.code}] ${n.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'prefix', header: 'Prefix' },
    { key: 'currentNumber', header: 'Current', render: (n) => n.currentNumber },
    { key: 'status', header: 'Status', render: (n) => n.status },
  ],
};

export const notificationAdapter: LookupAdapter<Notification> = {
  endpoint: '/notifications',
  displayLabel: (n) => n.title,
  searchFields: ['title', 'type'],
  columns: [
    { key: 'type', header: 'Type' },
    { key: 'title', header: 'Title' },
    { key: 'read', header: 'Read', render: (n) => n.read ? 'Yes' : 'No' },
    { key: 'createdAt', header: 'Date', render: (n) => new Date(n.createdAt).toLocaleDateString() },
  ],
};

export const auditLogAdapter: LookupAdapter<AuditLog> = {
  endpoint: '/audit-logs',
  displayLabel: (a) => `${a.action} - ${a.entity}`,
  searchFields: ['action', 'entity', 'entityId'],
  columns: [
    { key: 'action', header: 'Action' },
    { key: 'entity', header: 'Entity' },
    { key: 'entityId', header: 'Entity ID' },
    { key: 'user', header: 'User', render: (a) => a.user?.name || '-' },
    { key: 'createdAt', header: 'Date', render: (a) => new Date(a.createdAt).toLocaleDateString() },
  ],
};

export const machinePartAdapter: LookupAdapter<MachinePart> = {
  endpoint: '/maintenance/machine-parts',
  displayLabel: (p) => `[${p.code}] ${p.name}`,
  searchFields: ['code', 'name', 'partNumber'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'partNumber', header: 'Part #' },
    { key: 'machine', header: 'Machine', render: (p) => p.machine?.name || '-' },
    { key: 'quantity', header: 'Qty' },
  ],
};

export const administrationAdapter: LookupAdapter<Administration> = {
  endpoint: '/administrations',
  contextField: 'administrationId',
  displayLabel: (a) => `[${a.code}] ${a.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'branch', header: 'Branch', render: (a) => a.branch?.name || '-' },
    { key: 'status', header: 'Status', render: (a) => a.status },
  ],
};

export const downtimeLogAdapter: LookupAdapter<DowntimeLog> = {
  endpoint: '/maintenance/downtime-logs',
  displayLabel: (d) => `${d.machine?.name || ''} - ${d.reason}`,
  searchFields: ['reason'],
  columns: [
    { key: 'machine', header: 'Machine', render: (d) => d.machine?.name || '-' },
    { key: 'reason', header: 'Reason' },
    { key: 'startTime', header: 'Start', render: (d) => new Date(d.startTime).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (d) => d.status || '-' },
  ],
};

export const operationTypeAdapter: LookupAdapter<OperationType> = {
  endpoint: '/maintenance/operation-types',
  displayLabel: (o) => `[${o.code}] ${o.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (o) => o.status },
  ],
};

export const productionLineAdapter: LookupAdapter<ProductionLine> = {
  endpoint: '/maintenance/production-lines',
  displayLabel: (p) => `[${p.code}] ${p.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'company', header: 'Company', render: (p) => p.company?.name || '-' },
    { key: 'branch', header: 'Branch', render: (p) => p.branch?.name || '-' },
    { key: 'department', header: 'Department', render: (p) => p.department?.name || '-' },
    { key: 'status', header: 'Status', render: (p) => p.status },
  ],
};

export const costCenterAdapter: LookupAdapter<CostCenter> = {
  endpoint: '/maintenance/cost-centers',
  displayLabel: (c) => `[${c.code}] ${c.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type' },
    { key: 'status', header: 'Status', render: (c) => c.status },
  ],
};

export const machineComponentAdapter: LookupAdapter<MachineComponent> = {
  endpoint: '/maintenance/machine-components',
  displayLabel: (c) => `[${c.code}] ${c.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'componentType', header: 'Type' },
    { key: 'criticality', header: 'Criticality' },
    { key: 'status', header: 'Status', render: (c) => c.status },
  ],
};

export const sparePartAdapter: LookupAdapter<SparePart> = {
  endpoint: '/maintenance/spare-parts',
  displayLabel: (s) => `[${s.code}] ${s.name}`,
  searchFields: ['code', 'name', 'partNumber'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'partNumber', header: 'Part Number' },
    { key: 'category', header: 'Category' },
    { key: 'status', header: 'Status', render: (s) => s.status },
  ],
};

export const maintenancePersonnelAdapter: LookupAdapter<MaintenancePersonnel> = {
  endpoint: '/maintenance/personnel',
  displayLabel: (p) => `[${p.code}] ${p.name}`,
  searchFields: ['code', 'name', 'role', 'specialty'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'role', header: 'Role' },
    { key: 'specialty', header: 'Specialty', render: (p) => p.specialty || '-' },
    { key: 'isActive', header: 'Active', render: (p) => p.isActive ? 'Yes' : 'No' },
  ],
};

export const operationalReceiptAdapter: LookupAdapter<OperationalReceipt> = {
  endpoint: '/inventory/operational-receipts',
  displayLabel: (r) => `[${r.code}] ${r.reason || r.id}`,
  searchFields: ['code', 'reason'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'warehouse', header: 'Warehouse', render: (r) => r.warehouse?.name || '-' },
    { key: 'status', header: 'Status', render: (r) => r.status },
  ],
};

export const stockTransferAdapter: LookupAdapter<StockTransfer> = {
  endpoint: '/inventory/transfers',
  displayLabel: (t) => `[${t.code}] ${t.reason || t.id}`,
  searchFields: ['code', 'reason'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'sourceWarehouse', header: 'From', render: (t) => t.sourceWarehouse?.name || '-' },
    { key: 'destinationWarehouse', header: 'To', render: (t) => t.destinationWarehouse?.name || '-' },
    { key: 'status', header: 'Status', render: (t) => t.status },
  ],
};

export const maintenanceWorkOrderAdapter: LookupAdapter<MaintenanceWorkOrder> = {
  endpoint: '/maintenance-work-orders',
  displayLabel: (w) => `[${w.workOrderNumber}] ${w.title}`,
  searchFields: ['workOrderNumber', 'title'],
  columns: [
    { key: 'workOrderNumber', header: 'Number' },
    { key: 'title', header: 'Title' },
    { key: 'machine', header: 'Machine', render: (w) => w.machine?.name || '-' },
    { key: 'status', header: 'Status', render: (w) => w.status },
    { key: 'priority', header: 'Priority', render: (w) => w.priority },
  ],
};

export const productionUnitAdapter: LookupAdapter<ProductionUnit> = {
  endpoint: '/production/units',
  displayLabel: (u) => `[${u.code}] ${u.name}`,
  searchFields: ['code', 'name', 'abbreviation'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'abbreviation', header: 'Abbreviation', render: (u) => u.abbreviation || '-' },
    { key: 'decimals', header: 'Decimals', render: (u) => u.decimals },
    { key: 'status', header: 'Status', render: (u) => u.status },
  ],
};

export const productionProductDefinitionAdapter: LookupAdapter<ProductionProductDefinition> = {
  endpoint: '/production/product-definitions',
  displayLabel: (p) => `[${p.code}] ${p.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'product', header: 'Product', render: (p) => p.product?.name || '-' },
    { key: 'defaultLine', header: 'Line', render: (p) => p.defaultLine?.name || '-' },
    { key: 'status', header: 'Status', render: (p) => p.status },
  ],
};

export const productionShiftAdapter: LookupAdapter<ProductionShift> = {
  endpoint: '/production/shifts',
  displayLabel: (s) => `[${s.code}] ${s.name} (${s.startTime} - ${s.endTime})`,
  searchFields: ['code', 'name', 'description'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'startTime', header: 'Start', render: (s) => s.startTime },
    { key: 'endTime', header: 'End', render: (s) => s.endTime },
    { key: 'status', header: 'Status', render: (s) => s.status },
  ],
};

export const productionShiftTemplateAdapter: LookupAdapter<ProductionShiftTemplate> = {
  endpoint: '/production/shift-templates',
  displayLabel: (t) => `[${t.code}] ${t.name}`,
  searchFields: ['code', 'name', 'description'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'days', header: 'Days', render: (t) => `${t.days?.length ?? 0}` },
    { key: 'status', header: 'Status', render: (t) => t.status },
  ],
};

export const productionShiftCalendarAdapter: LookupAdapter<ProductionShiftCalendar> = {
  endpoint: '/production/shift-calendars',
  displayLabel: (c) => `[${c.code}] ${c.name}`,
  searchFields: ['code', 'name', 'description'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'effectiveFrom', header: 'From', render: (c) => new Date(c.effectiveFrom).toLocaleDateString() },
    { key: 'effectiveTo', header: 'To', render: (c) => (c.effectiveTo ? new Date(c.effectiveTo).toLocaleDateString() : '-') },
    { key: 'status', header: 'Status', render: (c) => c.status },
  ],
};

export const productionShiftAssignmentAdapter: LookupAdapter<ProductionShiftAssignment> = {
  endpoint: '/production/shift-assignments',
  displayLabel: (a) => `[${a.code}] ${a.operationalPerson?.name || a.operationalPersonId}`,
  searchFields: ['code'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'person', header: 'Person', render: (a) => a.operationalPerson?.name || '-' },
    { key: 'shift', header: 'Shift', render: (a) => a.shift?.name || '-' },
    { key: 'effectiveFrom', header: 'From', render: (a) => new Date(a.effectiveFrom).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (a) => a.status },
  ],
};

export const productionOperationalAssignmentAdapter: LookupAdapter<ProductionOperationalAssignment> = {
  endpoint: '/production/operational-assignments',
  displayLabel: (a) => `[${a.code}] ${a.machine?.name || a.productionLine?.name || a.productionUnit?.name || a.resourceType}`,
  searchFields: ['code'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'resourceType', header: 'Type', render: (a) => a.resourceType },
    { key: 'resource', header: 'Resource', render: (a) => a.machine?.name || a.productionLine?.name || a.productionUnit?.name || '-' },
    { key: 'shift', header: 'Shift', render: (a) => a.shift?.name || '-' },
    { key: 'status', header: 'Status', render: (a) => a.status },
  ],
};

export const operationalPersonAdapter: LookupAdapter<OperationalPerson> = {
  endpoint: '/production/operational-people',
  displayLabel: (p) => `[${p.code}] ${p.name}`,
  searchFields: ['code', 'name', 'phone', 'email'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category' },
    { key: 'isActive', header: 'Active', render: (p) => p.isActive ? 'Yes' : 'No' },
  ],
};
