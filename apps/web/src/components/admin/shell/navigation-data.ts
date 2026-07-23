import type { ShellIconName } from './shell-icons';

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

export const navItems: NavItem[] = [
  {
    id: 'dashboard', label: 'navigation.dashboard', href: '/admin/dashboard', icon: 'dashboard',
  },
  {
    id: 'core', label: 'navigation.core', href: '#', icon: 'core', children: [
      { id: 'core-companies', label: 'navigation.companies', href: '/admin/core/companies' },
      { id: 'core-branches', label: 'navigation.branches', href: '/admin/core/branches' },
      { id: 'core-administrations', label: 'navigation.administrations', href: '/admin/core/administrations' },
      { id: 'core-departments', label: 'navigation.departments', href: '/admin/core/departments' },
    ],
  },
  {
    id: 'access', label: 'navigation.accessControl', href: '#', icon: 'access', children: [
      { id: 'access-users', label: 'navigation.users', href: '/admin/access/users' },
      { id: 'access-roles', label: 'navigation.roles', href: '/admin/access/roles' },
      { id: 'access-permissions', label: 'navigation.permissions', href: '/admin/access/permissions' },
    ],
  },
  {
    id: 'inventory', label: 'navigation.inventory', href: '#', icon: 'inventory', children: [
      { id: 'inv-warehouses', label: 'navigation.warehouses', href: '/admin/inventory/warehouses' },
      { id: 'inv-product-categories', label: 'navigation.productCategories', href: '/admin/inventory/product-categories' },
      { id: 'inv-products', label: 'navigation.products', href: '/admin/inventory/products' },
      { id: 'inv-counts', label: 'navigation.inventoryCounts', href: '/admin/inventory/counts' },
      { id: 'inv-movements', label: 'navigation.inventoryMovements', href: '/admin/inventory/movements' },
      { id: 'inv-adjustments', label: 'navigation.inventoryAdjustments', href: '/admin/inventory/adjustments' },
      { id: 'inv-balances', label: 'navigation.inventoryBalances', href: '/admin/inventory/balances' },
      { id: 'inv-locations', label: 'navigation.warehouseLocations', href: '/admin/inventory/locations' },
    ],
  },
  {
    id: 'barcodes', label: 'navigation.barcodes', href: '#', icon: 'barcode', children: [
      { id: 'barcode-overview', label: 'barcodes.overview.title', href: '/admin/barcodes' },
      { id: 'barcode-generate', label: 'navigation.generate', href: '/admin/barcodes/generate' },
      { id: 'barcode-print', label: 'navigation.print', href: '/admin/barcodes/print' },
      { id: 'barcode-scan', label: 'navigation.scan', href: '/admin/barcodes/scan' },
      { id: 'barcode-preview', label: 'navigation.preview', href: '/admin/barcodes/preview' },
      { id: 'barcode-records', label: 'navigation.records', href: '/admin/barcodes/records' },
      { id: 'barcode-templates', label: 'navigation.templates', href: '/admin/barcodes/templates' },
      { id: 'barcode-product-labels', label: 'navigation.productLabels', href: '/admin/barcodes/product-labels' },
      { id: 'barcode-machine-cards', label: 'navigation.machineCards', href: '/admin/barcodes/machine-cards' },
      { id: 'barcode-scans', label: 'navigation.scans', href: '/admin/barcodes/scans' },
      { id: 'barcode-print-jobs', label: 'navigation.printJobs', href: '/admin/barcodes/print-jobs' },
    ],
  },
  {
    id: 'reports', label: 'navigation.reports', href: '#', icon: 'report', children: [
      { id: 'rpt-mnt-overview', label: 'navigation.maintenanceOverview', href: '/admin/reports/maintenance' },
      { id: 'rpt-mnt-requests', label: 'navigation.maintenanceRequestsReport', href: '/admin/reports/maintenance/requests' },
      { id: 'rpt-mnt-downtime', label: 'navigation.downtimeReport', href: '/admin/reports/maintenance/downtime' },
      { id: 'rpt-mnt-costs', label: 'navigation.maintenanceCostsReport', href: '/admin/reports/maintenance/costs' },
      { id: 'rpt-mnt-schedules', label: 'navigation.maintenanceSchedulesReport', href: '/admin/reports/maintenance/schedules' },
      { id: 'rpt-inv-overview', label: 'navigation.inventoryOverview', href: '/admin/reports/inventory' },
      { id: 'rpt-inv-balances', label: 'navigation.inventoryBalancesReport', href: '/admin/reports/inventory/balances' },
      { id: 'rpt-inv-movements', label: 'navigation.inventoryMovementsReport', href: '/admin/reports/inventory/movements' },
      { id: 'rpt-inv-adjustments', label: 'navigation.inventoryAdjustmentsReport', href: '/admin/reports/inventory/adjustments' },
      { id: 'rpt-inv-count-variance', label: 'navigation.countVarianceReport', href: '/admin/reports/inventory/count-variance' },
      { id: 'rpt-barcode-scans', label: 'navigation.barcodeScansReport', href: '/admin/reports/barcodes/scans' },
      { id: 'rpt-assets', label: 'navigation.assetsReport', href: '/admin/reports/assets' },
      { id: 'rpt-parts', label: 'navigation.partsReport', href: '/admin/reports/parts' },
      { id: 'rpt-partners', label: 'navigation.partnersReport', href: '/admin/reports/partners' },
      { id: 'rpt-attachments', label: 'navigation.attachmentsReport', href: '/admin/reports/attachments' },
      { id: 'rpt-audit', label: 'navigation.auditTrailReport', href: '/admin/reports/audit' },
      { id: 'rpt-user-activity', label: 'navigation.userActivityReport', href: '/admin/reports/user-activity' },
      { id: 'rpt-notifications', label: 'navigation.notificationsReport', href: '/admin/reports/notifications' },
      { id: 'rpt-machine-log', label: 'navigation.machineLogReport', href: '/admin/reports/machine-log' },
      { id: 'rpt-parts-usage', label: 'navigation.partsUsageReport', href: '/admin/reports/parts-usage' },
      { id: 'rpt-upcoming-pm', label: 'navigation.upcomingPreventiveReport', href: '/admin/reports/upcoming-preventive' },
      { id: 'rpt-overdue-pm', label: 'navigation.overduePreventiveReport', href: '/admin/reports/overdue-preventive' },
      { id: 'rpt-low-stock', label: 'navigation.lowStockReport', href: '/admin/reports/low-stock' },
    ],
  },
  {
    id: 'maintenance', label: 'navigation.maintenance', href: '#', icon: 'maintenance', children: [
      { id: 'mnt-machines', label: 'navigation.machines', href: '/admin/maintenance/machines' },
      { id: 'mnt-machine-categories', label: 'navigation.machineCategories', href: '/admin/maintenance/machine-categories' },
      { id: 'mnt-machine-parts', label: 'navigation.machineParts', href: '/admin/maintenance/machine-parts' },
      { id: 'mnt-machine-documents', label: 'navigation.machineDocuments', href: '/admin/maintenance/machine-documents' },
      { id: 'mnt-production-lines', label: 'navigation.productionLines', href: '/admin/maintenance/production-lines' },
      { id: 'mnt-operation-types', label: 'navigation.operationTypes', href: '/admin/maintenance/operation-types' },
      { id: 'mnt-cost-centers', label: 'navigation.costCenters', href: '/admin/maintenance/cost-centers' },
      { id: 'mnt-requests', label: 'navigation.maintenanceRequests', href: '/admin/maintenance/requests' },
      { id: 'mnt-tasks', label: 'navigation.maintenanceTasks', href: '/admin/maintenance/tasks' },
      { id: 'mnt-schedules', label: 'navigation.maintenanceSchedules', href: '/admin/maintenance/schedules' },
      { id: 'mnt-checklist-items', label: 'navigation.checklistItems', href: '/admin/maintenance/checklist-items' },
      { id: 'mnt-downtime-logs', label: 'navigation.downtimeLogs', href: '/admin/maintenance/downtime-logs' },
    ],
  },
  {
    id: 'search', label: 'navigation.search', href: '/admin/search', icon: 'search',
  },
  {
    id: 'alerts', label: 'navigation.alerts', href: '/admin/alerts', icon: 'dashboard',
  },
  {
    id: 'documents', label: 'navigation.documents', href: '#', icon: 'document', children: [
      { id: 'doc-attachments', label: 'navigation.attachments', href: '/admin/documents/attachments' },
    ],
  },
  {
    id: 'system', label: 'navigation.system', href: '#', icon: 'settings', children: [
      { id: 'sys-settings', label: 'navigation.settingsList', href: '/admin/settings' },
      { id: 'sys-company', label: 'navigation.companyProfile', href: '/admin/settings/company' },
      { id: 'sys-language', label: 'navigation.language', href: '/admin/settings/language' },
      { id: 'sys-appearance', label: 'navigation.appearance', href: '/admin/settings/appearance' },
      { id: 'sys-security', label: 'navigation.security', href: '/admin/settings/security' },
      { id: 'sys-numbering', label: 'navigation.numberSequences', href: '/admin/settings/numbering' },
      { id: 'sys-notification-rules', label: 'navigation.notificationRules', href: '/admin/settings/notification-rules' },
      { id: 'sys-audit', label: 'navigation.auditLog', href: '/admin/settings/audit' },
      { id: 'sys-user-activity', label: 'navigation.userActivity', href: '/admin/settings/audit/user-activity' },
      { id: 'sys-login-history', label: 'navigation.loginHistory', href: '/admin/settings/audit/login-history' },
    ],
  },
  {
    id: 'notifications', label: 'navigation.notifications', href: '/admin/notifications', icon: 'notification',
  },
  {
    id: 'messaging', label: 'navigation.messaging', href: '/admin/messaging', icon: 'messaging',
  },
];
