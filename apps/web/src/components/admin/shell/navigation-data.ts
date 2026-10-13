import type { ShellIconName } from './shell-icons';
import { isPermissionGranted } from '../../../lib/permission-gate';

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

/**
 * Navigation access classification.
 *
 * Every sidebar entry resolves to exactly one class:
 * - `PUBLIC`          — reachable without an authenticated principal (none in the
 *                       admin shell today; reserved, never inferred by accident).
 * - `AUTHENTICATED`   — any signed-in principal may use it. Inferred when an entry
 *                       declares no `permission`. The page must still be a screen the
 *                       backend does not gate behind a specific grant.
 * - `PERMISSION`      — requires the declared `permission`. Inferred when an entry
 *                       declares `permission`. The key is the exact key the target API
 *                       route enforces through `PermissionsGuard`.
 * - `SUPER_ADMIN`     — reserved for entries that must never be grantable.
 *
 * Classification is derived, not hand-maintained, so it can never drift from the
 * declared permission contract. `classifySidebarItem` is the single source of truth.
 */
export type NavigationAccessClass = 'PUBLIC' | 'AUTHENTICATED' | 'PERMISSION' | 'SUPER_ADMIN';

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

/**
 * Resolve the access class of a sidebar entry. Presence of a `permission` key is the
 * explicit contract; absence means the entry is available to every authenticated user.
 */
export function classifySidebarItem(item: { permission?: string }): NavigationAccessClass {
  return item.permission ? 'PERMISSION' : 'AUTHENTICATED';
}

/**
 * A sidebar entry is visible only to a principal that holds its declared permission.
 *
 * - Entries without a permission are visible to every authenticated principal.
 * - The canonical SUPER_ADMIN bypass mirrors the API guard exactly; the API still
 *   enforces independently of menu visibility.
 * - While the effective permission payload is still unresolved (`permissions === null`)
 *   protected entries are hidden (deny-by-default) so an operator can never see a menu
 *   entry they are not entitled to, even for a single render. Entries that are not
 *   permission-protected remain visible because they are not authorization-sensitive.
 */
export function isSidebarItemVisible(
  item: { permission?: string },
  permissions: string[] | null,
  isSuperAdmin: boolean,
): boolean {
  return isPermissionGranted(item.permission, permissions, isSuperAdmin);
}

const visibleItems = (
  items: SidebarItem[],
  permissions: string[] | null,
  isSuperAdmin: boolean,
): SidebarItem[] => items.filter((item) => isSidebarItemVisible(item, permissions, isSuperAdmin));

/**
 * Drop entries the principal cannot access, then drop any section or group that ends up
 * empty so the menu never shows a heading with nothing under it.
 *
 * Deny-by-default: an unresolved permission payload leaves only non-protected entries
 * visible, so unauthorized entries are never flashed while the permissions load.
 */
export function filterSidebarGroups(
  groups: SidebarGroup[],
  permissions: string[] | null,
  isSuperAdmin: boolean,
): SidebarGroup[] {
  if (isSuperAdmin) return groups;

  return groups.reduce<SidebarGroup[]>((acc, group) => {
    const children = group.children
      ?.map((section) => ({ ...section, items: visibleItems(section.items, permissions, isSuperAdmin) }))
      .filter((section) => section.items.length > 0);

    const items = group.items ? visibleItems(group.items, permissions, isSuperAdmin) : undefined;

    const hasChildren = !!(children && children.length > 0) || !!(items && items.length > 0);
    if (hasChildren) acc.push({ ...group, children, items });
    else if (group.route && isSidebarItemVisible(group, permissions, isSuperAdmin)) acc.push(group);
    return acc;
  }, []);
}

export interface SidebarGroup {
  id: string;
  labelKey: string;
  icon: ShellIconName;
  permission?: string;
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
  '/admin/core/persons': 'organization',
  '/admin/maintenance/machine-categories': 'organization',
  '/admin/maintenance/machine-parts': 'assets',
  '/admin/maintenance/spare-parts': 'maintenance',
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
          { id: 'org-companies', labelKey: 'navigation.companies', route: '/admin/core/companies', permission: 'companies:read' },
          { id: 'org-branches', labelKey: 'navigation.branches', route: '/admin/core/branches', permission: 'branches:read' },
          { id: 'org-administrations', labelKey: 'navigation.administrations', route: '/admin/core/administrations', permission: 'administrations:read' },
          { id: 'org-departments', labelKey: 'navigation.departments', route: '/admin/core/departments', permission: 'department:read' },
          { id: 'org-employees', labelKey: 'navigation.persons', route: '/admin/core/persons', permission: 'operational-person:read' },
          { id: 'org-job-titles', labelKey: 'navigation.jobTitles', route: '/admin/core/job-titles', permission: 'job-title:read' },
          { id: 'org-person-assignments', labelKey: 'navigation.personAssignments', route: '/admin/core/person-assignments', permission: 'person-assignment:read' },
          { id: 'org-supervisor-assignments', labelKey: 'navigation.supervisorAssignments', route: '/admin/core/supervisor-assignments', permission: 'supervisor:read' },
        ],
      },
      {
        id: 'org-operational', labelKey: 'navigation.navSection.operationalData', items: [
          { id: 'org-production-lines', labelKey: 'navigation.productionLines', route: '/admin/maintenance/production-lines', permission: 'productionLines:read' },
          { id: 'org-machine-categories', labelKey: 'navigation.machineCategories', route: '/admin/maintenance/machine-categories', permission: 'machine-category:read' },
          { id: 'org-cost-centers', labelKey: 'navigation.costCenters', route: '/admin/maintenance/cost-centers', permission: 'operational-cost-center:read' },
        ],
      },
    ],
  },

  // 3. Access Control
  {
    id: 'access', labelKey: 'navigation.accessControl', icon: 'access', children: [
      {
        id: 'access-users-section', labelKey: 'navigation.navSection.usersAndPermissions', items: [
          { id: 'access-roles', labelKey: 'navigation.roles', route: '/admin/access/roles', permission: 'roles:read' },
          { id: 'access-permissions', labelKey: 'navigation.permissions', route: '/admin/access/permissions', permission: 'permissions:read' },
        ],
      },
    ],
  },

  // 4. Assets & Equipment
  {
    id: 'assets', labelKey: 'navigation.assetsEquipment', icon: 'settings', children: [
      {
        id: 'assets-assets', labelKey: 'navigation.navSection.assets', items: [
          { id: 'assets-machines', labelKey: 'navigation.machines', route: '/admin/maintenance/machines', permission: 'machine:read' },
          { id: 'assets-machine-documents', labelKey: 'navigation.machineDocuments', route: '/admin/maintenance/machine-documents', permission: 'machine-document:read' },
        ],
      },
      {
        id: 'assets-technical', labelKey: 'navigation.navSection.technicalStructure', items: [
          { id: 'assets-machine-components', labelKey: 'navigation.machineComponents', route: '/admin/maintenance/machine-components', permission: 'machine-component:read' },
        ],
      },
    ],
  },

  // 5. Maintenance
  {
    id: 'maintenance', labelKey: 'navigation.maintenance', icon: 'maintenance', children: [
      {
        id: 'mnt-operations', labelKey: 'navigation.navSection.maintenanceOperations', items: [
          { id: 'mnt-requests', labelKey: 'navigation.maintenanceRequests', route: '/admin/maintenance/requests', permission: 'maintenance-request:read' },
          { id: 'mnt-work-orders', labelKey: 'navigation.maintenanceWorkOrders', route: '/admin/maintenance/work-orders', permission: 'maintenance-work-order:read' },
          { id: 'mnt-tasks', labelKey: 'navigation.maintenanceTasks', route: '/admin/maintenance/tasks', permission: 'maintenance-task:read' },
          { id: 'mnt-schedules', labelKey: 'navigation.maintenanceSchedules', route: '/admin/maintenance/schedules', permission: 'maintenance-schedule:read' },
          { id: 'mnt-checklist-items', labelKey: 'navigation.checklistItems', route: '/admin/maintenance/checklist-items', permission: 'maintenance-checklist:read' },
          { id: 'mnt-downtime-logs', labelKey: 'navigation.downtimeLogs', route: '/admin/maintenance/downtime-logs', permission: 'downtime-log:read' },
        ],
      },
      {
        id: 'mnt-planning', labelKey: 'navigation.navSection.maintenancePlanning', items: [
          { id: 'mnt-calendar', labelKey: 'navigation.maintenanceCalendar', route: '/admin/maintenance/calendar', permission: 'maintenance-calendar:read' },
          { id: 'mnt-workload', labelKey: 'navigation.maintenanceWorkload', route: '/admin/maintenance/workload', permission: 'maintenance-workload:read' },
          { id: 'mnt-sla', labelKey: 'navigation.sla', route: '/admin/maintenance/sla', permission: 'maintenance-request:read' },
          { id: 'mnt-mttr', labelKey: 'navigation.mttr', route: '/admin/maintenance/reliability/mttr', permission: 'maintenance-reliability:read' },
        ],
      },
      {
        id: 'mnt-personnel-section', labelKey: 'navigation.navSection.maintenanceStaff', items: [
          { id: 'mnt-machine-responsibilities', labelKey: 'navigation.machineResponsibilities', route: '/admin/maintenance/machine-responsibilities', permission: 'machine-responsibility:read' },
          { id: 'mnt-accountability', labelKey: 'navigation.maintenanceAccountability', route: '/admin/maintenance/accountability', permission: 'maintenance.dashboard.accountabilityKpis.view' },
        ],
      },
      {
        id: 'mnt-spare-parts-section', labelKey: 'navigation.navSection.maintenanceSpareParts', items: [
          { id: 'mnt-machine-parts', labelKey: 'navigation.machineParts', route: '/admin/maintenance/machine-parts', permission: 'machine-part:read' },
          { id: 'mnt-spare-parts', labelKey: 'navigation.spareParts', route: '/admin/maintenance/spare-parts', permission: 'spare-part:read' },
          { id: 'mnt-spare-part-issues', labelKey: 'navigation.sparePartIssues', route: '/admin/maintenance/spare-part-issues', permission: 'maintenance-stock-issue:read' },
          { id: 'mnt-spare-part-conditions', labelKey: 'navigation.sparePartConditions', route: '/admin/spare-part-conditions', permission: 'spare-part-conditions:read' },
          { id: 'mnt-installed-parts', labelKey: 'navigation.installedParts', route: '/admin/installed-parts', permission: 'installed-parts:read' },
          { id: 'mnt-repair-orders', labelKey: 'navigation.repairOrders', route: '/admin/maintenance/repair-orders', permission: 'repair-orders:read' },
          { id: 'mnt-repair-orders-queue', labelKey: 'navigation.repairablePartsQueue', route: '/admin/maintenance/repair-orders/queue', permission: 'repair-orders:read' },
          { id: 'mnt-bom', labelKey: 'navigation.bom', route: '/admin/maintenance/bom', permission: 'maintenance-bom:read' },
          { id: 'mnt-spare-part-plans', labelKey: 'navigation.sparePartPlans', route: '/admin/maintenance/spare-part-plans', permission: 'preventive-spare-part-plan:read' },
        ],
      },
    ],
  },

  // 6. Inventory
  {
    id: 'inventory', labelKey: 'navigation.inventory', icon: 'inventory', children: [
      {
        id: 'inv-definitions', labelKey: 'navigation.navSection.inventoryDefinitions', items: [
          { id: 'inv-warehouses', labelKey: 'navigation.warehouses', route: '/admin/inventory/warehouses', permission: 'inventory:read' },
          { id: 'inv-locations', labelKey: 'navigation.warehouseLocations', route: '/admin/inventory/locations', permission: 'inventory:read' },
          { id: 'inv-product-categories', labelKey: 'navigation.productCategories', route: '/admin/inventory/product-categories', permission: 'products:read' },
          { id: 'inv-products', labelKey: 'navigation.products', route: '/admin/inventory/products', permission: 'products:read' },
        ],
      },
      {
        id: 'inv-operations', labelKey: 'navigation.navSection.inventoryOperations', items: [
          { id: 'inv-opening-balances', labelKey: 'navigation.openingBalances', route: '/admin/inventory/opening-balances', permission: 'inventory:opening-balance:read' },
          { id: 'inv-movements', labelKey: 'navigation.inventoryMovements', route: '/admin/inventory/movements', permission: 'inventory-movement:read' },
          { id: 'inv-counts', labelKey: 'navigation.inventoryCounts', route: '/admin/inventory/counts', permission: 'inventory-count:read' },
          { id: 'inv-adjustments', labelKey: 'navigation.inventoryAdjustments', route: '/admin/inventory/adjustments', permission: 'inventory-adjustment:read' },
          { id: 'inv-stock-adjustments', labelKey: 'navigation.stockAdjustments', route: '/admin/inventory/stock-adjustments', permission: 'inventory:stock-adjustment:read' },
          { id: 'inv-locks', labelKey: 'navigation.inventoryLocks', route: '/admin/inventory/locks', permission: 'inventory:lock:read' },
        ],
      },
      {
        id: 'inv-monitoring', labelKey: 'navigation.navSection.inventoryMonitoring', items: [
          { id: 'inv-balances', labelKey: 'navigation.inventoryBalances', route: '/admin/inventory/balances', permission: 'inventory-balance:read' },
          { id: 'inv-ledger', labelKey: 'navigation.inventoryLedger', route: '/admin/inventory/ledger', permission: 'inventory-ledger:read' },
          { id: 'inv-reconciliation', labelKey: 'navigation.inventoryReconciliation', route: '/admin/inventory/reconciliation', permission: 'inventory-reconciliation:read' },
          { id: 'inv-governance-audit', labelKey: 'navigation.inventoryAudit', route: '/admin/inventory/governance-audit', permission: 'inventory:audit:read' },
          { id: 'inv-valuation', labelKey: 'navigation.inventoryValuation', route: '/admin/inventory/valuation', permission: 'inventory-valuation:read' },
        ],
      },
    ],
  },

  // 7. Production
  {
    id: 'production', labelKey: 'navigation.production', icon: 'production', children: [
      {
        id: 'prd-master-data', labelKey: 'navigation.navSection.productionMasterData', items: [
          { id: 'prd-units', labelKey: 'navigation.productionUnits', route: '/admin/production/units', permission: 'production-unit:read' },
          { id: 'prd-product-definitions', labelKey: 'navigation.productionProductDefinitions', route: '/admin/production/product-definitions', permission: 'production-product:read' },
        ],
      },
      {
        id: 'prd-shifts', labelKey: 'navigation.navSection.productionShifts', items: [
          { id: 'prd-shifts-list', labelKey: 'navigation.productionShifts', route: '/admin/production/shifts', permission: 'production-shift:read' },
          { id: 'prd-shift-templates', labelKey: 'navigation.productionShiftTemplates', route: '/admin/production/shift-templates', permission: 'production-shift-template:read' },
          { id: 'prd-shift-calendars', labelKey: 'navigation.productionShiftCalendars', route: '/admin/production/shift-calendars', permission: 'production-shift-calendar:read' },
          { id: 'prd-shift-assignments', labelKey: 'navigation.productionShiftAssignments', route: '/admin/production/shift-assignments', permission: 'production-shift-assignment:read' },
          { id: 'prd-operational-assignments', labelKey: 'navigation.productionOperationalAssignments', route: '/admin/production/operational-assignments', permission: 'production-operational-assignment:read' },
          { id: 'prd-shift-handovers', labelKey: 'navigation.productionShiftHandovers', route: '/admin/production/shift-handovers', permission: 'shift-handover:read' },
        ],
      },
      {
        id: 'prd-standards', labelKey: 'navigation.navSection.productionStandards', items: [
          { id: 'prd-capacity-standards', labelKey: 'navigation.productionCapacityStandards', route: '/admin/production/capacity-standards', permission: 'production-capacity-standard:read' },
        ],
      },
      {
        id: 'prd-orders', labelKey: 'navigation.navSection.productionOrders', items: [
          { id: 'prd-orders-list', labelKey: 'navigation.productionOrders', route: '/admin/production/orders', permission: 'production-order:read' },
        ],
      },
      {
        id: 'prd-execution', labelKey: 'navigation.navSection.productionExecution', items: [
          { id: 'prd-runs', labelKey: 'navigation.productionRuns', route: '/admin/production/runs', permission: 'production-run:read' },
        ],
      },
      {
        id: 'prd-points', labelKey: 'navigation.navSection.productionPoints', items: [
          { id: 'prd-measurement-points', labelKey: 'navigation.productionMeasurementPoints', route: '/admin/production/measurement-points', permission: 'production-measurement-point:read' },
        ],
      },
      {
        id: 'prd-losses', labelKey: 'navigation.navSection.productionLosses', items: [
          { id: 'prd-loss-reasons', labelKey: 'navigation.productionLossReasons', route: '/admin/production/loss-reasons', permission: 'production-loss-reason:read' },
          { id: 'prd-downtime', labelKey: 'navigation.productionDowntime', route: '/admin/production/downtime', permission: 'production-downtime:read' },
          { id: 'prd-losses-list', labelKey: 'navigation.productionLosses', route: '/admin/production/losses', permission: 'production-loss:read' },
        ],
      },
      {
        id: 'prd-materials', labelKey: 'navigation.navSection.productionMaterials', items: [
          { id: 'prd-material-documents', labelKey: 'navigation.productionMaterialDocuments', route: '/admin/production/material-documents', permission: 'production-material-document:read' },
          { id: 'prd-material-requirements', labelKey: 'navigation.productionMaterialRequirements', route: '/admin/production/material-requirements', permission: 'production-material-requirement:read' },
          { id: 'prd-fg-receipts', labelKey: 'navigation.productionFinishedGoodsReceipts', route: '/admin/production/finished-goods-receipts', permission: 'production-finished-goods-receipt:read' },
        ],
      },
      {
        id: 'prd-quality', labelKey: 'navigation.navSection.productionQuality', items: [
          { id: 'prd-quality-plans', labelKey: 'navigation.productionQualityPlans', route: '/admin/production/quality/plans', permission: 'production-quality-plan:read' },
          { id: 'prd-inspections', labelKey: 'navigation.productionInspections', route: '/admin/production/quality/inspections', permission: 'production-inspection:read' },
          { id: 'prd-ncrs', labelKey: 'navigation.productionNcrs', route: '/admin/production/quality/ncrs', permission: 'production-ncr:read' },
        ],
      },
      {
        id: 'prd-cost', labelKey: 'navigation.navSection.productionCost', items: [
          { id: 'prd-cost-rates', labelKey: 'navigation.productionCostRates', route: '/admin/production/cost/rates', permission: 'production-cost-rate:read' },
          { id: 'prd-cost-snapshots', labelKey: 'navigation.productionCostSnapshots', route: '/admin/production/cost/snapshots', permission: 'production-cost-snapshot:read' },
          { id: 'prd-cost-transactions', labelKey: 'navigation.productionCostTransactions', route: '/admin/production/cost/transactions', permission: 'production-cost-transaction:read' },
          { id: 'prd-overhead-allocations', labelKey: 'overheadAllocation.title', route: '/admin/production/cost/overhead-allocations', permission: 'production-cost-overhead-allocation:read' },
        ],
      },
      {
        id: 'prd-analytics', labelKey: 'navigation.navSection.productionAnalytics', items: [
          { id: 'prd-performance-targets', labelKey: 'navigation.productionPerformanceTargets', route: '/admin/production/performance-targets', permission: 'production-performance-target:read' },
          { id: 'prd-analytics', labelKey: 'navigation.productionAnalytics', route: '/admin/production/analytics', permission: 'production-analytics:read' },
          { id: 'prd-reliability', labelKey: 'navigation.productionReliability', route: '/admin/production/reliability', permission: 'operational-reliability:read' },
        ],
      },
    ],
  },

  // 8. Barcode
  {
    id: 'barcode', labelKey: 'navigation.barcodes', icon: 'barcode', children: [
      {
        id: 'barcode-operations', labelKey: 'navigation.navSection.barcodeOperations', items: [
          { id: 'barcode-overview', labelKey: 'navigation.barcodes', route: '/admin/barcodes', permission: 'barcode-label:read' },
          { id: 'barcode-generate', labelKey: 'navigation.generate', route: '/admin/barcodes/generate', permission: 'barcode-label:read' },
          { id: 'barcode-print', labelKey: 'navigation.print', route: '/admin/barcodes/print', permission: 'barcode-label:read' },
          { id: 'barcode-scan', labelKey: 'navigation.scan', route: '/admin/barcodes/scan', permission: 'barcode-scan:read' },
          { id: 'barcode-preview', labelKey: 'navigation.preview', route: '/admin/barcodes/preview', permission: 'barcode-label:read' },
        ],
      },
      {
        id: 'barcode-admin', labelKey: 'navigation.navSection.barcodeAdmin', items: [
          { id: 'barcode-records', labelKey: 'navigation.records', route: '/admin/barcodes/records', permission: 'barcode-label:read' },
          { id: 'barcode-templates', labelKey: 'navigation.templates', route: '/admin/barcodes/templates', permission: 'barcode-template:read' },
          { id: 'barcode-product-labels', labelKey: 'navigation.productLabels', route: '/admin/barcodes/product-labels', permission: 'barcode-label:read' },
          { id: 'barcode-machine-cards', labelKey: 'navigation.machineCards', route: '/admin/barcodes/machine-cards', permission: 'barcode-label:read' },
          { id: 'barcode-scans', labelKey: 'navigation.scans', route: '/admin/barcodes/scans', permission: 'barcode-scan:read' },
          { id: 'barcode-print-jobs', labelKey: 'navigation.printJobs', route: '/admin/barcodes/print-jobs', permission: 'barcode-printJobs:read' },
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
          { id: 'rpt-operations', labelKey: 'navigation.operationsReport', route: '/admin/reports/operations', permission: 'reports.operations:read' },
        ],
      },
      {
        id: 'rpt-maintenance', labelKey: 'navigation.navSection.reportsMaintenance', items: [
          { id: 'rpt-mnt-overview', labelKey: 'navigation.maintenanceOverview', route: '/admin/reports/maintenance', permission: 'reports.maintenance:read' },
          { id: 'rpt-mnt-kpis', labelKey: 'navigation.maintenanceKpisReport', route: '/admin/reports/maintenance/kpis', permission: 'reports.maintenance:read' },
          { id: 'rpt-mnt-requests', labelKey: 'navigation.maintenanceRequestsReport', route: '/admin/reports/maintenance/requests', permission: 'reports.maintenance:read' },
          { id: 'rpt-mnt-downtime', labelKey: 'navigation.downtimeReport', route: '/admin/reports/maintenance/downtime', permission: 'reports.maintenance:read' },
          { id: 'rpt-mnt-costs', labelKey: 'navigation.maintenanceCostsReport', route: '/admin/reports/maintenance/costs', permission: 'reports.maintenance:read' },
          { id: 'rpt-mnt-schedules', labelKey: 'navigation.maintenanceSchedulesReport', route: '/admin/reports/maintenance/schedules', permission: 'reports.maintenance:read' },
          { id: 'rpt-assets', labelKey: 'navigation.assetsReport', route: '/admin/reports/assets', permission: 'reports.maintenance:read' },
          { id: 'rpt-machine-log', labelKey: 'navigation.machineLogReport', route: '/admin/reports/machine-log', permission: 'reports.maintenance:read' },
          { id: 'rpt-parts-usage', labelKey: 'navigation.partsUsageReport', route: '/admin/reports/parts-usage', permission: 'reports.maintenance:read' },
          { id: 'rpt-upcoming-pm', labelKey: 'navigation.upcomingPreventiveReport', route: '/admin/reports/upcoming-preventive', permission: 'reports.maintenance:read' },
          { id: 'rpt-overdue-pm', labelKey: 'navigation.overduePreventiveReport', route: '/admin/reports/overdue-preventive', permission: 'reports.maintenance:read' },
          { id: 'rpt-parts', labelKey: 'navigation.partsReport', route: '/admin/reports/parts', permission: 'reports.maintenance:read' },
          { id: 'rpt-low-stock', labelKey: 'navigation.lowStockReport', route: '/admin/reports/low-stock', permission: 'reports.inventory:read' },
        ],
      },
      {
        id: 'rpt-inventory', labelKey: 'navigation.navSection.reportsInventory', items: [
          { id: 'rpt-inv-overview', labelKey: 'navigation.inventoryOverview', route: '/admin/reports/inventory', permission: 'reports.inventory:read' },
          { id: 'rpt-inv-balances', labelKey: 'navigation.inventoryBalancesReport', route: '/admin/reports/inventory/balances', permission: 'reports.inventory:read' },
          { id: 'rpt-inv-movements', labelKey: 'navigation.inventoryMovementsReport', route: '/admin/reports/inventory/movements', permission: 'reports.inventory:read' },
          { id: 'rpt-inv-adjustments', labelKey: 'navigation.inventoryAdjustmentsReport', route: '/admin/reports/inventory/adjustments', permission: 'reports.inventory:read' },
          { id: 'rpt-inv-count-variance', labelKey: 'navigation.countVarianceReport', route: '/admin/reports/inventory/count-variance', permission: 'reports.inventory:read' },
        ],
      },
      {
        id: 'rpt-barcode', labelKey: 'navigation.navSection.reportsBarcode', items: [
          { id: 'rpt-barcode-scans', labelKey: 'navigation.barcodeScansReport', route: '/admin/reports/barcodes/scans', permission: 'reports.barcodes:read' },
        ],
      },
      {
        id: 'rpt-system', labelKey: 'navigation.navSection.reportsSystem', items: [
          { id: 'rpt-audit', labelKey: 'navigation.auditTrailReport', route: '/admin/reports/audit', permission: 'reports.inventory:read' },
          { id: 'rpt-user-activity', labelKey: 'navigation.userActivityReport', route: '/admin/reports/user-activity', permission: 'reports.inventory:read' },
          { id: 'rpt-notifications', labelKey: 'navigation.notificationsReport', route: '/admin/reports/notifications', permission: 'reports.inventory:read' },
          { id: 'rpt-attachments', labelKey: 'navigation.attachmentsReport', route: '/admin/reports/attachments', permission: 'reports.maintenance:read' },
          { id: 'rpt-partners', labelKey: 'navigation.partnersReport', route: '/admin/reports/partners', permission: 'reports.inventory:read' },
        ],
      },
    ],
  },

  // 9. Documents
  {
    id: 'documents', labelKey: 'navigation.documents', icon: 'document', items: [
      { id: 'doc-attachments', labelKey: 'navigation.attachments', route: '/admin/documents/attachments', permission: 'attachments.view' },
    ],
  },

  // 10. System
  {
    id: 'system', labelKey: 'navigation.system', icon: 'settings', children: [
      {
        id: 'sys-settings-section', labelKey: 'navigation.navSection.systemSettings', items: [
          { id: 'sys-settings', labelKey: 'navigation.settingsList', route: '/admin/settings', permission: 'settings:read' },
          { id: 'sys-company', labelKey: 'navigation.companyProfile', route: '/admin/settings/company', permission: 'company:read' },
          { id: 'sys-language', labelKey: 'navigation.language', route: '/admin/settings/language', permission: 'settings.language.view' },
          { id: 'sys-appearance', labelKey: 'navigation.appearance', route: '/admin/settings/appearance', permission: 'settings.appearance.view' },
          { id: 'sys-security', labelKey: 'navigation.security', route: '/admin/settings/security', permission: 'settings.security.view' },
          { id: 'sys-numbering', labelKey: 'navigation.numberSequences', route: '/admin/settings/numbering', permission: 'numbering:read' },
          { id: 'sys-notification-rules', labelKey: 'navigation.notificationRules', route: '/admin/settings/notification-rules', permission: 'settings.notifications.view' },
        ],
      },
      {
        id: 'sys-logs', labelKey: 'navigation.navSection.systemLogs', items: [
          { id: 'sys-audit', labelKey: 'navigation.auditLog', route: '/admin/settings/audit', permission: 'audit:read' },
          { id: 'sys-user-activity', labelKey: 'navigation.userActivity', route: '/admin/settings/audit/user-activity', permission: 'audit:read' },
          { id: 'sys-login-history', labelKey: 'navigation.loginHistory', route: '/admin/settings/audit/login-history', permission: 'audit:read' },
        ],
      },
      {
        id: 'sys-communication', labelKey: 'navigation.navSection.systemCommunication', items: [
          { id: 'sys-notifications', labelKey: 'navigation.notifications', route: '/admin/notifications', permission: 'notifications:read' },
          { id: 'sys-messaging', labelKey: 'navigation.messaging', route: '/admin/messaging', permission: 'messaging:read' },
        ],
      },
    ],
  },
];

// Keep backward compatibility for mobile-menu and any code that still uses navItems
export const navItems: NavItem[] = [];
