'use client';

import { useTranslation } from '../../../lib/i18n/use-translation';

export function getPageTitle(pathname: string): string {
  if (pathname === '/admin/dashboard') return 'dashboard.title';
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];

  const isId = /^[0-9a-fA-F-]{36}$/.test(last) || /^\d+$/.test(last);
  if (isId && segments.length >= 2) {
    const parent = segments[segments.length - 2];
    const detailMapping: Record<string, string> = {
      companies: 'details.company.title',
      branches: 'details.branch.title',
      departments: 'details.department.title',
      users: 'details.user.title',
      products: 'details.product.title',
      machines: 'details.machine.title',
      requests: 'details.maintenanceRequest.title',
      counts: 'details.inventoryCount.title',
      movements: 'details.inventoryMovement.title',
      adjustments: 'details.inventoryAdjustment.title',
      records: 'barcodes.records.detail',
      scans: 'barcodes.scan.title',
      'print-jobs': 'barcodes.printJobs.detail',
    };
    if (detailMapping[parent]) return detailMapping[parent];
  }

  const mapping: Record<string, string> = {
    companies: 'core.companies',
    branches: 'core.branches',
    departments: 'core.departments',
    users: 'access.users',
    roles: 'access.roles',
    permissions: 'access.permissions',
    warehouses: 'inventory.warehouses',
    'product-categories': 'inventory.productCategories',
    products: 'inventory.products',
    counts: 'inventoryCounting.counts',
    movements: 'inventoryCounting.movements',
    adjustments: 'inventoryCounting.adjustments',
    balances: 'inventoryCounting.balances',
    machines: 'maintenance.machines',
    'machine-categories': 'maintenance.machineCategories',
    'machine-parts': 'maintenance.machineParts',
    'machine-documents': 'maintenance.machineDocuments',
    requests: 'maintenance.maintenanceRequests',
    tasks: 'maintenance.maintenanceTasks',
    schedules: 'maintenance.maintenanceSchedules',
    'checklist-items': 'maintenance.checklistItems',
    'downtime-logs': 'maintenance.downtimeLogs',
    locations: 'inventory.locations.title',
    records: 'barcodes.records.title',
    templates: 'barcodes.templates.title',
    preview: 'barcodes.scanLabel',
    'product-labels': 'barcodes.productLabels.title',
    'machine-cards': 'barcodes.machineCards.title',
    scans: 'barcodes.scanHistory',
    'print-jobs': 'barcodes.printJobs.title',
    generate: 'barcodes.generate.title',
    print: 'barcodes.print.title',
    scan: 'barcodes.scan.title',
    settings: 'settings.title',
    numbering: 'settings.numbering.title',
    audit: 'settings.audit.title',
    search: 'search.title',
    notifications: 'notifications.title',
    profile: 'profile.title',
    password: 'profile.changePasswordTitle',
  };
  const namespaceKey = mapping[last];
  if (namespaceKey) return namespaceKey;
  return 'dashboard.title';
}

export function Breadcrumb({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  return <span className="font-medium">{t(getPageTitle(pathname))}</span>;
}
