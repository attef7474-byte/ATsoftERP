import type { ShellIconName } from './shell-icons';

// Backward-compatible types
export interface NavChild {
  id: string;
  label: string;
  href: string;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: ShellIconName;
  children?: NavChild[];
}

// New types for restructured sidebar
export interface SidebarItem {
  id: string;
  labelKey: string;
  route: string;
  permission?: string;
}

export interface SidebarSection {
  id: string;
  labelKey: string;
  items: SidebarItem[];
}

export interface SidebarGroup {
  id: string;
  labelKey: string;
  icon: ShellIconName;
  route?: string;
  children?: SidebarSection[];
  items?: SidebarItem[];
}

// Map of route prefixes to group ids for auto-open on navigation
export const routeGroupMap: Record<string, string> = {
  '/admin/dashboard': 'dashboard',
  '/admin/core': 'organization',
  '/admin/access': 'access',
  '/admin/maintenance/machines': 'assets',
  '/admin/maintenance/machine-categories': 'assets',
  '/admin/maintenance/machine-parts': 'assets',
  '/admin/maintenance/machine-documents': 'assets',
  '/admin/maintenance/production-lines': 'organization',
  '/admin/maintenance/operation-types': 'organization',
  '/admin/maintenance/cost-centers': 'organization',
  '/admin/maintenance': 'maintenance',
  '/admin/installed-parts': 'maintenance',
  '/admin/spare-part-conditions': 'maintenance',
  '/admin/inventory': 'inventory',
  '/admin/production': 'production',
  '/admin/barcodes': 'barcode',
  '/admin/reports': 'reports',
  '/admin/documents': 'documents',
  '/admin/settings': 'system',
  '/admin/notifications': 'system',
  '/admin/messaging': 'system',
  '/admin/search': 'search',
  '/admin/alerts': 'alerts',
};

export const sidebarGroups: SidebarGroup[] = [
  // 1. Dashboard
  {
    id: 'dashboard', labelKey: 'navigation.dashboard', icon: 'dashboard', route: '/admin/dashboard',
  },

  // 2. Organization
  {
    id: 'organization', labelKey: 'navigation.organization', icon: 'core', children: [
      {
        id: 'org-structure', labelKey: 'navigation.navSection.orgStructure', items: [
          { id: 'org-companies', labelKey: 'navigation.companies', route: '/admin/core/companies' },
          { id: 'org-branches', labelKey: 'navigation.branches', route: '/admin/core/branches' },
          { id: 'org-administrations', labelKey: 'navigation.administrations', route: '/admin/core/administrations' },
          { id: 'org-departments', labelKey: 'navigation.departments', route: '/admin/core/departments' },
          { id: 'org-organizational-units', labelKey: 'navigation.organizationalUnits', route: '/admin/core/organizational-units' },
        ],
      },
      {
        id: 'org-operational', labelKey: 'navigation.navSection.operationalData', items: [
          { id: 'org-production-lines', labelKey: 'navigation.productionLines', route: '/admin/maintenance/production-lines' },
          { id: 'org-operation-types', labelKey: 'navigation.operationTypes', route: '/admin/maintenance/operation-types' },
          { id: 'org-cost-centers', labelKey: 'navigation.costCenters', route: '/admin/maintenance/cost-centers' },
        ],
      },
    ],
  },

  // 3. Access Control
  {
    id: 'access', labelKey: 'navigation.accessControl', icon: 'access', children: [
      {
        id: 'access-users-section', labelKey: 'navigation.navSection.usersAndPermissions', items: [
          { id: 'access-users', labelKey: 'navigation.users', route: '/admin/access/users' },
          { id: 'access-roles', labelKey: 'navigation.roles', route: '/admin/access/roles' },
          { id: 'access-permissions', labelKey: 'navigation.permissions', route: '/admin/access/permissions' },
        ],
      },
    ],
  },

  // 4. Assets & Equipment
  {
    id: 'assets', labelKey: 'navigation.assetsEquipment', icon: 'settings', children: [
      {
        id: 'assets-assets', labelKey: 'navigation.navSection.assets', items: [
          { id: 'assets-machines', labelKey: 'navigation.machines', route: '/admin/maintenance/machines' },
          { id: 'assets-machine-categories', labelKey: 'navigation.machineCategories', route: '/admin/maintenance/machine-categories' },
          { id: 'assets-machine-documents', labelKey: 'navigation.machineDocuments', route: '/admin/maintenance/machine-documents' },
        ],
      },
      {
        id: 'assets-technical', labelKey: 'navigation.navSection.technicalStructure', items: [
          { id: 'assets-machine-components', labelKey: 'navigation.machineComponents', route: '/admin/maintenance/machine-components' },
          { id: 'assets-machine-parts', labelKey: 'navigation.machineParts', route: '/admin/maintenance/machine-parts' },
        ],
      },
    ],
  },

  // 5. Maintenance
  {
    id: 'maintenance', labelKey: 'navigation.maintenance', icon: 'maintenance', children: [
      {
        id: 'mnt-operations', labelKey: 'navigation.navSection.maintenanceOperations', items: [
          { id: 'mnt-requests', labelKey: 'navigation.maintenanceRequests', route: '/admin/maintenance/requests' },
          { id: 'mnt-work-orders', labelKey: 'navigation.maintenanceWorkOrders', route: '/admin/maintenance/work-orders' },
          { id: 'mnt-tasks', labelKey: 'navigation.maintenanceTasks', route: '/admin/maintenance/tasks' },
          { id: 'mnt-schedules', labelKey: 'navigation.maintenanceSchedules', route: '/admin/maintenance/schedules' },
          { id: 'mnt-checklist-items', labelKey: 'navigation.checklistItems', route: '/admin/maintenance/checklist-items' },
          { id: 'mnt-downtime-logs', labelKey: 'navigation.downtimeLogs', route: '/admin/maintenance/downtime-logs' },
        ],
      },
      {
        id: 'mnt-planning', labelKey: 'navigation.navSection.maintenancePlanning', items: [
          { id: 'mnt-calendar', labelKey: 'navigation.maintenanceCalendar', route: '/admin/maintenance/calendar' },
          { id: 'mnt-workload', labelKey: 'navigation.maintenanceWorkload', route: '/admin/maintenance/workload' },
          { id: 'mnt-sla', labelKey: 'navigation.sla', route: '/admin/maintenance/sla' },
          { id: 'mnt-mttr', labelKey: 'navigation.mttr', route: '/admin/maintenance/reliability/mttr' },
        ],
      },
      {
        id: 'mnt-personnel-section', labelKey: 'navigation.navSection.maintenanceStaff', items: [
          { id: 'mnt-personnel', labelKey: 'navigation.maintenancePersonnel', route: '/admin/maintenance/personnel' },
          { id: 'mnt-machine-responsibilities', labelKey: 'navigation.machineResponsibilities', route: '/admin/maintenance/machine-responsibilities' },
          { id: 'mnt-accountability', labelKey: 'navigation.maintenanceAccountability', route: '/admin/maintenance/accountability' },
        ],
      },
      {
        id: 'mnt-spare-parts-section', labelKey: 'navigation.navSection.maintenanceSpareParts', items: [
          { id: 'mnt-spare-parts', labelKey: 'navigation.spareParts', route: '/admin/maintenance/spare-parts' },
          { id: 'mnt-spare-part-conditions', labelKey: 'navigation.sparePartConditions', route: '/admin/spare-part-conditions' },
          { id: 'mnt-installed-parts', labelKey: 'navigation.installedParts', route: '/admin/installed-parts' },
          { id: 'mnt-repair-orders', labelKey: 'navigation.repairOrders', route: '/admin/maintenance/repair-orders' },
          { id: 'mnt-bom', labelKey: 'navigation.bom', route: '/admin/maintenance/bom' },
          { id: 'mnt-spare-part-plans', labelKey: 'navigation.sparePartPlans', route: '/admin/maintenance/spare-part-plans' },
        ],
      },
    ],
  },

  // 6. Inventory
  {
    id: 'inventory', labelKey: 'navigation.inventory', icon: 'inventory', children: [
      {
        id: 'inv-definitions', labelKey: 'navigation.navSection.inventoryDefinitions', items: [
          { id: 'inv-warehouses', labelKey: 'navigation.warehouses', route: '/admin/inventory/warehouses' },
          { id: 'inv-locations', labelKey: 'navigation.warehouseLocations', route: '/admin/inventory/locations' },
          { id: 'inv-product-categories', labelKey: 'navigation.productCategories', route: '/admin/inventory/product-categories' },
          { id: 'inv-products', labelKey: 'navigation.products', route: '/admin/inventory/products' },
        ],
      },
      {
        id: 'inv-operations', labelKey: 'navigation.navSection.inventoryOperations', items: [
          { id: 'inv-opening-balances', labelKey: 'navigation.openingBalances', route: '/admin/inventory/opening-balances' },
          { id: 'inv-movements', labelKey: 'navigation.inventoryMovements', route: '/admin/inventory/movements' },
          { id: 'inv-counts', labelKey: 'navigation.inventoryCounts', route: '/admin/inventory/counts' },
          { id: 'inv-adjustments', labelKey: 'navigation.inventoryAdjustments', route: '/admin/inventory/adjustments' },
          { id: 'inv-stock-adjustments', labelKey: 'navigation.stockAdjustments', route: '/admin/inventory/stock-adjustments' },
          { id: 'inv-locks', labelKey: 'navigation.inventoryLocks', route: '/admin/inventory/locks' },
        ],
      },
      {
        id: 'inv-monitoring', labelKey: 'navigation.navSection.inventoryMonitoring', items: [
          { id: 'inv-balances', labelKey: 'navigation.inventoryBalances', route: '/admin/inventory/balances' },
          { id: 'inv-ledger', labelKey: 'navigation.inventoryLedger', route: '/admin/inventory/ledger' },
          { id: 'inv-reconciliation', labelKey: 'navigation.inventoryReconciliation', route: '/admin/inventory/reconciliation' },
          { id: 'inv-governance-audit', labelKey: 'navigation.inventoryAudit', route: '/admin/inventory/governance-audit' },
        ],
      },
    ],
  },

  // 7. Production
  {
    id: 'production', labelKey: 'navigation.production', icon: 'production', children: [
      {
        id: 'prd-master-data', labelKey: 'navigation.navSection.productionMasterData', items: [
          { id: 'prd-units', labelKey: 'navigation.productionUnits', route: '/admin/production/units' },
          { id: 'prd-product-definitions', labelKey: 'navigation.productionProductDefinitions', route: '/admin/production/product-definitions' },
        ],
      },
      {
        id: 'prd-shifts', labelKey: 'navigation.navSection.productionShifts', items: [
          { id: 'prd-shifts-list', labelKey: 'navigation.productionShifts', route: '/admin/production/shifts' },
          { id: 'prd-shift-templates', labelKey: 'navigation.productionShiftTemplates', route: '/admin/production/shift-templates' },
          { id: 'prd-shift-calendars', labelKey: 'navigation.productionShiftCalendars', route: '/admin/production/shift-calendars' },
          { id: 'prd-shift-assignments', labelKey: 'navigation.productionShiftAssignments', route: '/admin/production/shift-assignments' },
          { id: 'prd-operational-assignments', labelKey: 'navigation.productionOperationalAssignments', route: '/admin/production/operational-assignments' },
        ],
      },
      {
        id: 'prd-standards', labelKey: 'navigation.navSection.productionStandards', items: [
          { id: 'prd-capacity-standards', labelKey: 'navigation.productionCapacityStandards', route: '/admin/production/capacity-standards' },
        ],
      },
      {
        id: 'prd-orders', labelKey: 'navigation.navSection.productionOrders', items: [
          { id: 'prd-orders-list', labelKey: 'navigation.productionOrders', route: '/admin/production/orders', permission: 'production-order:read' },
        ],
      },
    ],
  },

  // 8. Barcode
  {
    id: 'barcode', labelKey: 'navigation.barcodes', icon: 'barcode', children: [
      {
        id: 'barcode-operations', labelKey: 'navigation.navSection.barcodeOperations', items: [
          { id: 'barcode-overview', labelKey: 'navigation.barcodes', route: '/admin/barcodes' },
          { id: 'barcode-generate', labelKey: 'navigation.generate', route: '/admin/barcodes/generate' },
          { id: 'barcode-print', labelKey: 'navigation.print', route: '/admin/barcodes/print' },
          { id: 'barcode-scan', labelKey: 'navigation.scan', route: '/admin/barcodes/scan' },
          { id: 'barcode-preview', labelKey: 'navigation.preview', route: '/admin/barcodes/preview' },
        ],
      },
      {
        id: 'barcode-admin', labelKey: 'navigation.navSection.barcodeAdmin', items: [
          { id: 'barcode-records', labelKey: 'navigation.records', route: '/admin/barcodes/records' },
          { id: 'barcode-templates', labelKey: 'navigation.templates', route: '/admin/barcodes/templates' },
          { id: 'barcode-product-labels', labelKey: 'navigation.productLabels', route: '/admin/barcodes/product-labels' },
          { id: 'barcode-machine-cards', labelKey: 'navigation.machineCards', route: '/admin/barcodes/machine-cards' },
          { id: 'barcode-scans', labelKey: 'navigation.scans', route: '/admin/barcodes/scans' },
          { id: 'barcode-print-jobs', labelKey: 'navigation.printJobs', route: '/admin/barcodes/print-jobs' },
        ],
      },
    ],
  },

  // 8. Reports & Analytics
  {
    id: 'reports', labelKey: 'navigation.reportsAnalytics', icon: 'report', children: [
      {
        id: 'rpt-main', labelKey: 'navigation.navSection.reportsMain', items: [
          { id: 'rpt-index', labelKey: 'navigation.reportsHome', route: '/admin/reports' },
        ],
      },
      {
        id: 'rpt-maintenance', labelKey: 'navigation.navSection.reportsMaintenance', items: [
          { id: 'rpt-mnt-overview', labelKey: 'navigation.maintenanceOverview', route: '/admin/reports/maintenance' },
          { id: 'rpt-mnt-kpis', labelKey: 'navigation.maintenanceKpisReport', route: '/admin/reports/maintenance/kpis' },
          { id: 'rpt-mnt-requests', labelKey: 'navigation.maintenanceRequestsReport', route: '/admin/reports/maintenance/requests' },
          { id: 'rpt-mnt-downtime', labelKey: 'navigation.downtimeReport', route: '/admin/reports/maintenance/downtime' },
          { id: 'rpt-mnt-costs', labelKey: 'navigation.maintenanceCostsReport', route: '/admin/reports/maintenance/costs' },
          { id: 'rpt-mnt-schedules', labelKey: 'navigation.maintenanceSchedulesReport', route: '/admin/reports/maintenance/schedules' },
          { id: 'rpt-assets', labelKey: 'navigation.assetsReport', route: '/admin/reports/assets' },
          { id: 'rpt-machine-log', labelKey: 'navigation.machineLogReport', route: '/admin/reports/machine-log' },
          { id: 'rpt-parts-usage', labelKey: 'navigation.partsUsageReport', route: '/admin/reports/parts-usage' },
          { id: 'rpt-upcoming-pm', labelKey: 'navigation.upcomingPreventiveReport', route: '/admin/reports/upcoming-preventive' },
          { id: 'rpt-overdue-pm', labelKey: 'navigation.overduePreventiveReport', route: '/admin/reports/overdue-preventive' },
          { id: 'rpt-parts', labelKey: 'navigation.partsReport', route: '/admin/reports/parts' },
          { id: 'rpt-low-stock', labelKey: 'navigation.lowStockReport', route: '/admin/reports/low-stock' },
        ],
      },
      {
        id: 'rpt-inventory', labelKey: 'navigation.navSection.reportsInventory', items: [
          { id: 'rpt-inv-overview', labelKey: 'navigation.inventoryOverview', route: '/admin/reports/inventory' },
          { id: 'rpt-inv-balances', labelKey: 'navigation.inventoryBalancesReport', route: '/admin/reports/inventory/balances' },
          { id: 'rpt-inv-movements', labelKey: 'navigation.inventoryMovementsReport', route: '/admin/reports/inventory/movements' },
          { id: 'rpt-inv-adjustments', labelKey: 'navigation.inventoryAdjustmentsReport', route: '/admin/reports/inventory/adjustments' },
          { id: 'rpt-inv-count-variance', labelKey: 'navigation.countVarianceReport', route: '/admin/reports/inventory/count-variance' },
        ],
      },
      {
        id: 'rpt-barcode', labelKey: 'navigation.navSection.reportsBarcode', items: [
          { id: 'rpt-barcode-scans', labelKey: 'navigation.barcodeScansReport', route: '/admin/reports/barcodes/scans' },
        ],
      },
      {
        id: 'rpt-system', labelKey: 'navigation.navSection.reportsSystem', items: [
          { id: 'rpt-audit', labelKey: 'navigation.auditTrailReport', route: '/admin/reports/audit' },
          { id: 'rpt-user-activity', labelKey: 'navigation.userActivityReport', route: '/admin/reports/user-activity' },
          { id: 'rpt-notifications', labelKey: 'navigation.notificationsReport', route: '/admin/reports/notifications' },
          { id: 'rpt-attachments', labelKey: 'navigation.attachmentsReport', route: '/admin/reports/attachments' },
          { id: 'rpt-partners', labelKey: 'navigation.partnersReport', route: '/admin/reports/partners' },
        ],
      },
    ],
  },

  // 9. Documents
  {
    id: 'documents', labelKey: 'navigation.documents', icon: 'document', items: [
      { id: 'doc-attachments', labelKey: 'navigation.attachments', route: '/admin/documents/attachments' },
    ],
  },

  // 10. System
  {
    id: 'system', labelKey: 'navigation.system', icon: 'settings', children: [
      {
        id: 'sys-settings-section', labelKey: 'navigation.navSection.systemSettings', items: [
          { id: 'sys-settings', labelKey: 'navigation.settingsList', route: '/admin/settings' },
          { id: 'sys-company', labelKey: 'navigation.companyProfile', route: '/admin/settings/company' },
          { id: 'sys-language', labelKey: 'navigation.language', route: '/admin/settings/language' },
          { id: 'sys-appearance', labelKey: 'navigation.appearance', route: '/admin/settings/appearance' },
          { id: 'sys-security', labelKey: 'navigation.security', route: '/admin/settings/security' },
          { id: 'sys-numbering', labelKey: 'navigation.numberSequences', route: '/admin/settings/numbering' },
          { id: 'sys-notification-rules', labelKey: 'navigation.notificationRules', route: '/admin/settings/notification-rules' },
        ],
      },
      {
        id: 'sys-logs', labelKey: 'navigation.navSection.systemLogs', items: [
          { id: 'sys-audit', labelKey: 'navigation.auditLog', route: '/admin/settings/audit' },
          { id: 'sys-user-activity', labelKey: 'navigation.userActivity', route: '/admin/settings/audit/user-activity' },
          { id: 'sys-login-history', labelKey: 'navigation.loginHistory', route: '/admin/settings/audit/login-history' },
        ],
      },
      {
        id: 'sys-communication', labelKey: 'navigation.navSection.systemCommunication', items: [
          { id: 'sys-notifications', labelKey: 'navigation.notifications', route: '/admin/notifications' },
          { id: 'sys-messaging', labelKey: 'navigation.messaging', route: '/admin/messaging' },
        ],
      },
    ],
  },
];

// Keep backward compatibility for mobile-menu and any code that still uses navItems
export const navItems: NavItem[] = [];
