import type { LookupAdapter } from './types';
import {
  companyAdapter,
  branchAdapter,
  administrationAdapter,
  departmentAdapter,
  warehouseAdapter,
  productCategoryAdapter,
  productAdapter,
  machineCategoryAdapter,
  machineAdapter,
  userAdapter,
  roleAdapter,
  maintenanceRequestAdapter,
  maintenanceTaskAdapter,
  maintenanceScheduleAdapter,
  inventoryCountAdapter,
  inventoryMovementAdapter,
  inventoryAdjustmentAdapter,
  warehouseLocationAdapter,
  barcodeLabelAdapter,
  systemSettingAdapter,
  numberSequenceAdapter,
  notificationAdapter,
  auditLogAdapter,
  machinePartAdapter,
  downtimeLogAdapter,
  operationTypeAdapter,
  costCenterAdapter,
  productionLineAdapter,
  machineComponentAdapter,
} from './lookup-adapters';
import type {
  Company, Branch, Administration, Department, Warehouse, ProductCategory, Product,
  MachineCategory, Machine, User, Role, MaintenanceRequest, MaintenanceTask,
  MaintenanceSchedule, InventoryCount, InventoryMovement, InventoryAdjustment,
  WarehouseLocation, BarcodeLabel, SystemSetting, NumberSequence, Notification,
  AuditLog, MachinePart, DowntimeLog, OperationType, CostCenter, ProductionLine,
  MachineComponent,
} from '../../lib/admin-types';

export interface UnifiedSearchEntity {
  entityType: string;
  labelKey: string;
  adapter: LookupAdapter<any>;
  detailRoute: (item: any) => string;
  subtitle?: (item: any) => string;
  permission?: string;
  sanitize?: (item: any) => any;
}

const registry: UnifiedSearchEntity[] = [
  {
    entityType: 'company',
    labelKey: 'core.companies',
    adapter: companyAdapter as LookupAdapter<any>,
    detailRoute: (item: Company) => `/admin/core/companies/${item.id}`,
    subtitle: (item: Company) => item.legalName || item.code,
  },
  {
    entityType: 'branch',
    labelKey: 'core.branches',
    adapter: branchAdapter as LookupAdapter<any>,
    detailRoute: (item: Branch) => `/admin/core/branches/${item.id}`,
    subtitle: (item: Branch) => item.company?.name || item.code,
  },
  {
    entityType: 'administration',
    labelKey: 'core.administrations',
    adapter: administrationAdapter as LookupAdapter<any>,
    detailRoute: (item: Administration) => `/admin/core/administrations/${item.id}`,
    subtitle: (item: Administration) => item.branch?.name || item.code,
  },
  {
    entityType: 'department',
    labelKey: 'core.departments',
    adapter: departmentAdapter as LookupAdapter<any>,
    detailRoute: (item: Department) => `/admin/core/departments/${item.id}`,
    subtitle: (item: Department) => item.company?.name || item.code,
  },
  {
    entityType: 'warehouse',
    labelKey: 'inventory.warehouses',
    adapter: warehouseAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/inventory/warehouses`,
    subtitle: (item: Warehouse) => item.company?.name || item.code,
  },
  {
    entityType: 'productCategory',
    labelKey: 'inventory.productCategories',
    adapter: productCategoryAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/inventory/product-categories`,
    subtitle: (item: ProductCategory) => item.code,
  },
  {
    entityType: 'product',
    labelKey: 'inventory.products',
    adapter: productAdapter as LookupAdapter<any>,
    detailRoute: (item: Product) => `/admin/inventory/products/${item.id}`,
    subtitle: (item: Product) => item.category?.name || item.code,
  },
  {
    entityType: 'machineCategory',
    labelKey: 'maintenance.machineCategories',
    adapter: machineCategoryAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/maintenance/machine-categories`,
    subtitle: (item: MachineCategory) => item.code,
  },
  {
    entityType: 'machine',
    labelKey: 'maintenance.machines',
    adapter: machineAdapter as LookupAdapter<any>,
    detailRoute: (item: Machine) => `/admin/maintenance/machines/${item.id}`,
    subtitle: (item: Machine) => item.category?.name || item.code,
  },
  {
    entityType: 'user',
    labelKey: 'access.users',
    adapter: userAdapter as LookupAdapter<any>,
    detailRoute: (item: User) => `/admin/access/users/${item.id}`,
    subtitle: (item: User) => item.email,
  },
  {
    entityType: 'role',
    labelKey: 'access.roles',
    adapter: roleAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/access/roles`,
    subtitle: (item: Role) => item.code,
  },
  {
    entityType: 'maintenanceRequest',
    labelKey: 'maintenance.maintenanceRequests',
    adapter: maintenanceRequestAdapter as LookupAdapter<any>,
    detailRoute: (item: MaintenanceRequest) => `/admin/maintenance/requests/${item.id}`,
    subtitle: (item: MaintenanceRequest) => item.machine?.name || '',
  },
  {
    entityType: 'maintenanceTask',
    labelKey: 'maintenance.maintenanceTasks',
    adapter: maintenanceTaskAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/maintenance/tasks`,
    subtitle: (item: MaintenanceTask) => item.request?.requestNumber || '',
  },
  {
    entityType: 'maintenanceSchedule',
    labelKey: 'maintenance.maintenanceSchedules',
    adapter: maintenanceScheduleAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/maintenance/schedules`,
    subtitle: (item: MaintenanceSchedule) => item.machine?.name || '',
  },
  {
    entityType: 'inventoryCount',
    labelKey: 'inventoryCounting.counts',
    adapter: inventoryCountAdapter as LookupAdapter<any>,
    detailRoute: (item: InventoryCount) => `/admin/inventory/counts/${item.id}`,
    subtitle: (item: InventoryCount) => item.warehouse?.name || item.countNumber,
  },
  {
    entityType: 'inventoryMovement',
    labelKey: 'inventoryCounting.movements',
    adapter: inventoryMovementAdapter as LookupAdapter<any>,
    detailRoute: (item: InventoryMovement) => `/admin/inventory/movements/${item.id}`,
    subtitle: (item: InventoryMovement) => item.warehouse?.name || item.movementNumber,
  },
  {
    entityType: 'inventoryAdjustment',
    labelKey: 'inventoryCounting.adjustments',
    adapter: inventoryAdjustmentAdapter as LookupAdapter<any>,
    detailRoute: (item: InventoryAdjustment) => `/admin/inventory/adjustments/${item.id}`,
    subtitle: (item: InventoryAdjustment) => item.warehouse?.name || item.adjustmentNumber,
  },
  {
    entityType: 'warehouseLocation',
    labelKey: 'inventory.locations.title',
    adapter: warehouseLocationAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/inventory/locations`,
    subtitle: (item: WarehouseLocation) => item.code,
  },
  {
    entityType: 'barcodeLabel',
    labelKey: 'barcodes.barcodeLabels',
    adapter: barcodeLabelAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/barcodes/print`,
    subtitle: (item: BarcodeLabel) => item.entityType,
  },
  {
    entityType: 'systemSetting',
    labelKey: 'settings.title',
    adapter: systemSettingAdapter as LookupAdapter<any>,
    detailRoute: (item: SystemSetting) => `/admin/settings`,
    subtitle: (item: SystemSetting) => item.group,
    sanitize: (item: SystemSetting) => ({
      ...item,
      value: (item.isSystem || /secret|password|token|api_key|key/i.test(item.key))
        ? '••••••••' : item.value,
    }),
  },
  {
    entityType: 'numberSequence',
    labelKey: 'settings.numbering.title',
    adapter: numberSequenceAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/settings/numbering`,
    subtitle: (item: NumberSequence) => `${item.prefix}${String(item.currentNumber + 1).padStart(item.padding, '0')}${item.suffix || ''}`,
  },
  {
    entityType: 'notification',
    labelKey: 'notifications.title',
    adapter: notificationAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/notifications`,
    subtitle: (item: Notification) => item.type,
  },
  {
    entityType: 'auditLog',
    labelKey: 'settings.audit.title',
    adapter: auditLogAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/settings/audit`,
    subtitle: (item: AuditLog) => item.user?.name || '',
    sanitize: (item: AuditLog) => ({
      ...item,
      details: item.details ? '[REDACTED]' : null,
    }),
  },
  {
    entityType: 'machinePart',
    labelKey: 'maintenance.machineParts',
    adapter: machinePartAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/maintenance/machine-parts`,
    subtitle: (item: MachinePart) => item.machine?.name || item.partNumber || '',
  },
  {
    entityType: 'downtimeLog',
    labelKey: 'maintenance.downtimeLogs',
    adapter: downtimeLogAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/maintenance/downtime-logs`,
    subtitle: (item: DowntimeLog) => `${item.durationMinutes || 0} min`,
  },
  {
    entityType: 'operationType',
    labelKey: 'maintenance.operationTypes',
    adapter: operationTypeAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/maintenance/operation-types`,
    subtitle: (item: OperationType) => item.code,
  },
  {
    entityType: 'costCenter',
    labelKey: 'maintenance.costCenters',
    adapter: costCenterAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/maintenance/cost-centers`,
    subtitle: (item: CostCenter) => item.code,
  },
  {
    entityType: 'productionLine',
    labelKey: 'maintenance.productionLines',
    adapter: productionLineAdapter as LookupAdapter<any>,
    detailRoute: () => `/admin/maintenance/production-lines`,
    subtitle: (item: ProductionLine) => item.code,
  },
  {
    entityType: 'machineComponent',
    labelKey: 'maintenance.machineComponents',
    adapter: machineComponentAdapter as LookupAdapter<any>,
    detailRoute: (item: MachineComponent) => `/admin/maintenance/machine-components/${item.id}`,
    subtitle: (item: MachineComponent) => item.machine?.name || item.code,
  },
];

export function getUnifiedSearchRegistry(): UnifiedSearchEntity[] {
  return registry;
}
