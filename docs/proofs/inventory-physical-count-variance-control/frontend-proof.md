# Frontend Proof — Physical Count Pages

## Pages Created

### List Page: `/admin/inventory/physical-counts/`
- File: `apps/web/src/app/admin/inventory/physical-counts/page.tsx`
- AdminDataGrid with columns: countNumber, company, warehouse, status, lines count, count date
- Filters: company, branch, warehouse, status
- Action bar: New, Refresh, View
- Row click to select, actions menu with View

### Create Page: `/admin/inventory/physical-counts/new/`
- File: `apps/web/src/app/admin/inventory/physical-counts/new/page.tsx`
- Form fields: company (F9), branch (F9), warehouse (F9), notes
- Dynamic product line entries with F9 product lookup
- Creates count header + lines in one API call

### Detail Page: `/admin/inventory/physical-counts/[id]/`
- File: `apps/web/src/app/admin/inventory/physical-counts/[id]/page.tsx`
- Info cards: company, warehouse, date
- Summary cards: total lines, variance in, variance out, total variance
- Workflow buttons dynamically shown based on status:
  - DRAFT: Submit (disabled until all lines counted), Cancel
  - SUBMITTED: Approve, Reject
  - APPROVED: Post (disabled if no variance), Cancel
- Lines table with inline quantity editing
- Variance displayed color-coded (green=positive/increase, red=negative/decrease)
- ConfirmDialog for workflow actions
- Reject modal with reason textarea

## Modified Files

### i18n Translations
- `apps/web/src/lib/i18n/types.ts`: Added `physicalCount` and `varianceControl` namespaces
- `apps/web/src/lib/i18n/locales/en/inventory.ts`: Added physicalCount and varianceControl translations
- `apps/web/src/lib/i18n/locales/ar/inventory.ts`: Added Arabic translations
- `apps/web/src/lib/i18n/locales/en/common.ts`: Added COUNT_VARIANCE_IN, COUNT_VARIANCE_OUT movement type labels
- `apps/web/src/lib/i18n/locales/ar/common.ts`: Added Arabic COUNT_VARIANCE labels

### Movement Types
- `apps/web/src/lib/admin-types/inventory-movement.ts`: Added COUNT_VARIANCE_IN, COUNT_VARIANCE_OUT to InventoryMovementType
