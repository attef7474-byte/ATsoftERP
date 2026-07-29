# 02 — Navigation Source Map

## Structure

The sidebar is defined in `apps/web/src/components/admin/shell/navigation-data.ts` using two types:

```typescript
interface NavChild {
  id: string;
  label: string;      // i18n key reference
  href: string;
}

interface NavItem {
  id: string;
  label: string;      // i18n key reference
  href: string;
  icon?: ShellIconName;
  children?: NavChild[];
}
```

## Tree (All Items)

```
Dashboard    /admin/dashboard                            [dashboard icon]

Core:
  ├ Companies           /admin/core/companies
  ├ Branches            /admin/core/branches
  ├ Administrations     /admin/core/administrations
  └ Departments         /admin/core/departments

Access Control:
  ├ Users               /admin/access/users
  ├ Roles               /admin/access/roles
  └ Permissions         /admin/access/permissions

Inventory:
  ├ Warehouses          /admin/inventory/warehouses
  ├ Product Categories  /admin/inventory/product-categories
  ├ Products            /admin/inventory/products
  ├ Inventory Counts    /admin/inventory/counts
  ├ Inventory Movements /admin/inventory/movements
  ├ Inventory Adjustments /admin/inventory/adjustments
  ├ Inventory Balances  /admin/inventory/balances
  ├ Warehouse Locations /admin/inventory/locations
  ├ Opening Balances    /admin/inventory/opening-balances
  ├ Stock Adjustments   /admin/inventory/stock-adjustments
  ├ Inventory Ledger    /admin/inventory/ledger
  ├ Stock Reconciliation /admin/inventory/reconciliation
  ├ Inventory Locks     /admin/inventory/locks
  └ Inventory Audit     /admin/inventory/governance-audit

Barcodes:
  ├ Overview            /admin/barcodes            [barcodes.overview.title]
  ├ Generate            /admin/barcodes/generate
  ├ Print               /admin/barcodes/print
  ├ Scan                /admin/barcodes/scan
  ├ Preview             /admin/barcodes/preview
  ├ Records             /admin/barcodes/records
  ├ Templates           /admin/barcodes/templates
  ├ Product Labels      /admin/barcodes/product-labels
  ├ Machine Cards       /admin/barcodes/machine-cards
  ├ Scan History        /admin/barcodes/scans
  └ Print Jobs          /admin/barcodes/print-jobs

Reports:                  [25 items — largest group]
  ├ Reports Home        /admin/reports
  ├ Maintenance Overview /admin/reports/maintenance
  ├ KPI Report          /admin/reports/maintenance/kpis
  ├ Maintenance Requests Report /admin/reports/maintenance/requests
  ├ Downtime Report     /admin/reports/maintenance/downtime
  ├ Maintenance Costs Report /admin/reports/maintenance/costs
  ├ Maintenance Schedules Report /admin/reports/maintenance/schedules
  ├ Inventory Overview  /admin/reports/inventory
  ├ Inventory Balances Report /admin/reports/inventory/balances
  ├ Inventory Movements Report /admin/reports/inventory/movements
  ├ Inventory Adjustments Report /admin/reports/inventory/adjustments
  ├ Count Variance Report /admin/reports/inventory/count-variance
  ├ Barcode Scans Report /admin/reports/barcodes/scans
  ├ Assets Register     /admin/reports/assets
  ├ Parts Inventory     /admin/reports/parts
  ├ Business Partners   /admin/reports/partners
  ├ Attachments Report  /admin/reports/attachments
  ├ Audit Trail Report  /admin/reports/audit
  ├ User Activity Report /admin/reports/user-activity
  ├ Notifications Report /admin/reports/notifications
  ├ Machine Log Report  /admin/reports/machine-log
  ├ Parts Usage Report  /admin/reports/parts-usage
  ├ Upcoming Preventive Report /admin/reports/upcoming-preventive
  ├ Overdue Preventive Report /admin/reports/overdue-preventive
  └ Low Stock Report    /admin/reports/low-stock

Maintenance:              [25 items — equal largest]
  ├ Machines             /admin/maintenance/machines
  ├ Machine Categories   /admin/maintenance/machine-categories
  ├ Machine Parts        /admin/maintenance/machine-parts
  ├ Spare Parts          /admin/maintenance/spare-parts
  ├ Machine Documents    /admin/maintenance/machine-documents
  ├ Production Lines     /admin/maintenance/production-lines
  ├ Operation Types      /admin/maintenance/operation-types
  ├ Cost Centers         /admin/maintenance/cost-centers
  ├ Maintenance Requests /admin/maintenance/requests
  ├ Maintenance Tasks    /admin/maintenance/tasks
  ├ Maintenance Schedules /admin/maintenance/schedules
  ├ Checklist Items      /admin/maintenance/checklist-items
  ├ Downtime Logs        /admin/maintenance/downtime-logs
  ├ Maintenance Personnel /admin/maintenance/personnel
  ├ Machine Responsibilities /admin/maintenance/machine-responsibilities
  ├ Accountability       /admin/maintenance/accountability
  ├ Maintenance Calendar /admin/maintenance/calendar
  ├ Workload Planning    /admin/maintenance/workload
  ├ Bill of Materials    /admin/maintenance/bom
  ├ Spare Part Plans     /admin/maintenance/spare-part-plans
  ├ Repair Orders        /admin/maintenance/repair-orders
  ├ SLA                  /admin/maintenance/sla
  ├ Installed Parts      /admin/installed-parts         [non-standard path]
  ├ Spare Part Conditions /admin/spare-part-conditions  [non-standard path]
  └ MTTR                 /admin/maintenance/reliability/mttr  [embedded /reliability/]

Search     /admin/search                     [standalone, search icon]
Alerts     /admin/alerts                     [standalone, dashboard icon]

Documents:
  └ Attachments         /admin/documents/attachments  [1 child only]

System:
  ├ All Settings        /admin/settings
  ├ Company Profile     /admin/settings/company
  ├ Language            /admin/settings/language
  ├ Appearance          /admin/settings/appearance
  ├ Security            /admin/settings/security
  ├ Number Sequences    /admin/settings/numbering
  ├ Notification Rules  /admin/settings/notification-rules
  ├ Audit Log           /admin/settings/audit
  ├ User Activity       /admin/settings/audit/user-activity
  └ Login History       /admin/settings/audit/login-history

Notifications  /admin/notifications          [standalone, notification icon]
Messaging      /admin/messaging               [standalone, messaging icon]
```

## Summary Statistics

| Metric | Value |
|--------|-------|
| Groups (collapsible) | 8 (Core, Access, Inventory, Barcodes, Reports, Maintenance, Documents, System) |
| Standalone top-level | 6 (Dashboard, Search, Alerts, Notifications, Messaging) |
| Total nav items (leaves) | 99 |
| Total nav entries (incl. groups) | 107 |
| Largest group | Reports (25), Maintenance (25) |
| Smallest group | Documents (1) |
| i18n keys used | 107 (106 from `navigation.*` + 1 from `barcodes.overview.title`) |
| Icon count | 14 unique icons |
