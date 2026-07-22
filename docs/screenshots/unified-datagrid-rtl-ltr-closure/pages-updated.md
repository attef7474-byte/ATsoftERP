# Pages Updated

## Phase 1 (Current Release)
The following pages were updated from DataTable to AdminDataGrid:

| # | Page | Route | Actions | Filters | Sort | RTL/LTR |
|---|------|-------|---------|---------|------|---------|
| 1 | Number Sequences | /admin/settings/numbering | Edit, View | Per-column text/select | Yes | Yes |
| 2 | Notification Rules | /admin/settings/notification-rules | Edit, Activate, Deactivate, Delete | Per-column text/select | Yes | Yes |
| 3 | Audit Log | /admin/settings/audit | (detail modal via row) | External + per-column | Yes | Yes |
| 4 | User Activity | /admin/settings/audit/user-activity | (none, read-only) | Per-column text | Yes | Yes |
| 5 | Login History | /admin/settings/audit/login-history | (none, read-only) | Per-column text | Yes | Yes |
| 6 | Products | /admin/inventory/products | View, Edit, Activate, Deactivate | Per-column text/select | Yes | Yes |
| 7 | Warehouses | /admin/inventory/warehouses | Edit, Activate, Deactivate | Per-column text/select | Yes | Yes |
| 8 | Inventory Movements | /admin/inventory/movements | View, Edit, Post, Cancel | Per-column text/select | Yes | Yes |
| 9 | Inventory Balances | /admin/inventory/balances | (none, read-only) | Per-column text | Yes | Yes |

## Components Created/Modified
- **NEW**: apps/web/src/components/admin/admin-data-grid.tsx (AdminDataGrid + types)
- **MODIFIED**: apps/web/src/app/globals.css (grid-specific CSS classes)
- **MODIFIED**: apps/web/src/lib/i18n/types.ts (added 'grid' namespace)
- **MODIFIED**: apps/web/src/lib/i18n/locales/en.ts (added grid namespace keys)
- **MODIFIED**: apps/web/src/lib/i18n/locales/ar.ts (added grid namespace keys)

## Pages Remaining for Future Phases
Other pages still using old DataTable that could be migrated:
- /admin/inventory/adjustments
- /admin/inventory/locations
- /admin/inventory/product-categories
- /admin/inventory/counts
- /admin/maintenance/machines
- /admin/maintenance/requests
- /admin/maintenance/tasks
- /admin/maintenance/schedules
- /admin/maintenance/downtime-logs
- /admin/maintenance/machine-parts
- /admin/maintenance/machine-documents
- /admin/core/companies, branches, departments
- /admin/access/users, roles
- /admin/notifications
- /admin/alerts
- /admin/barcodes/*
- /admin/reports/*
- /admin/documents/attachments
