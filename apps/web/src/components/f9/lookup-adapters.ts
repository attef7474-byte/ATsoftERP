import { LookupAdapter } from './types';
import type { Company, Branch, Department, Warehouse, ProductCategory, Product, MachineCategory, Machine, User, Role, MaintenanceRequest, MaintenanceTask, MaintenanceSchedule, InventoryCount, InventoryMovement, InventoryAdjustment, WarehouseLocation } from '../../lib/admin-types';

export const companyAdapter: LookupAdapter<Company> = {
  endpoint: '/companies',
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
    { key: 'maintenanceType', header: 'Type', render: (s) => s.maintenanceType },
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
  endpoint: '/inventory/warehouses',
  displayLabel: (l) => `[${l.code}] ${l.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (l) => l.status },
  ],
};
