# Edit Prefill Report

## Defect: Edit forms not loading previous record data

## Pages with dedicated `[id]/edit` routes (full prefill via `api.get` by ID)
These pages navigate to a dedicated edit page that fetches the full record by ID:
- `access/users/[id]/edit`, `access/roles/[id]/edit`
- `core/companies/[id]/edit`, `core/branches/[id]/edit`, `core/departments/[id]/edit`
- `inventory/warehouses/[id]/edit`, `inventory/locations/[id]/edit`, `inventory/products/[id]/edit`
- `inventory/adjustments/[id]/edit`, `inventory/movements/[id]/edit`
- `inventory/counts/[id]/edit`, `inventory/product-categories/[id]/edit`
- `maintenance/machines/[id]/edit`, `maintenance/requests/[id]/edit`
- `maintenance/schedules/[id]/edit`, `maintenance/tasks/[id]/edit`
- `maintenance/checklist-items/[id]/edit`, `maintenance/machine-documents/[id]/edit`
- `maintenance/machine-parts/[id]/edit`, `barcodes/templates/[id]/edit`
- `settings/numbering` (inline dialog with full record data in list)

## Pages with inline modal edit from list data
These pages open a modal and populate form fields directly from the list row's properties:

| Page | Form Fields | Source Fields in List | Prefill Quality | Risk |
|------|------------|----------------------|----------------|------|
| Inventory Adjustments | companyId, branchId, warehouseId, adjustmentDate, reason, notes | All present in list response (company, branch, warehouse are relation objects; dates, reason, notes are simple fields) | COMPLETE | None |
| Inventory Locations | warehouseId, code, name, description | All present in list response | COMPLETE | None |
| Inventory Product Categories | code, name, description, parentId | All present in list response (parentId as foreign key) | COMPLETE | None |
| Machine Categories | code, name, description, parentId | All present in list response | COMPLETE | None |
| Machine Documents | machineId, title, documentType, description | All present in list response | COMPLETE | None |
| Machine Parts | code, name, description, machineId, productId, partNumber, serialNumber, manufacturer, quantity, unit, replacementInterval | All present in list response | COMPLETE | None |
| Checklist Items | scheduleId, taskId, title, description, sortOrder, required | All present in list response | COMPLETE | None |
| Schedules | machineId, title, description, maintenanceType, frequency, startDate | All present in list response (startDate as date string) | COMPLETE | None |
| Tasks | requestId, title, description, assignedToId | All present in list response | COMPLETE | None |

## Pages that redirect to `[id]/edit` (no inline modal; no prefill issue)
- Machines, Maintenance Requests, Inventory Counts, Downtime Logs

## Save safety analysis
All inline modal save handlers use conditional spreading (`if (field) payload.field = field`) or explicitly set `field || undefined`, ensuring optional fields are never sent as empty strings that could wipe database values.

## Conclusion
Every inline modal edit form is fully prefilled from the list data. All list API endpoints return the full entity including all editable fields. No database wiping risk exists because save handlers properly omit unset optional fields.

## Status: CLOSED (all inline modals prefilled correctly; save handlers safe)
