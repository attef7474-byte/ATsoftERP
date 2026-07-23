# Table Unification Report

## Defect: Tables not fully unified

## Converted from DataTable → AdminDataGrid (unified green-header standard)
| Page | File | Action |
|------|------|--------|
| Inventory Adjustments | `inventory/adjustments/page.tsx` | Converted to AdminDataGrid |
| Inventory Product Categories | `inventory/product-categories/page.tsx` | Converted to AdminDataGrid |
| Inventory Locations | `inventory/locations/page.tsx` | Converted to AdminDataGrid |
| Inventory Counts | `inventory/counts/page.tsx` | Converted to AdminDataGrid |
| Maintenance Machines | `maintenance/machines/page.tsx` | Converted to AdminDataGrid |
| Maintenance Machine Categories | `maintenance/machine-categories/page.tsx` | Converted to AdminDataGrid |
| Maintenance Machine Documents | `maintenance/machine-documents/page.tsx` | Converted to AdminDataGrid |
| Maintenance Machine Parts | `maintenance/machine-parts/page.tsx` | Converted to AdminDataGrid |
| Maintenance Schedules | `maintenance/schedules/page.tsx` | Converted to AdminDataGrid |
| Maintenance Tasks | `maintenance/tasks/page.tsx` | Converted to AdminDataGrid |
| Maintenance Requests | `maintenance/requests/page.tsx` | Converted to AdminDataGrid |
| Maintenance Checklist Items | `maintenance/checklist-items/page.tsx` | Converted to AdminDataGrid |
| Maintenance Downtime Logs | `maintenance/downtime-logs/page.tsx` | Converted to AdminDataGrid |

## N/A_EXPECTED: Raw `<table>` pages (custom multi-filter toolbar, read-only row-click navigation)
| Page | File | Reason |
|------|------|--------|
| Barcode Records | `barcodes/records/page.tsx` | Custom raw `<table>` with entityType/status Select filters in toolbar; AdminDataGrid built-in search-only toolbar incompatible with multi-filter layout; page is read-only list (all navigation via row-click to detail route); no inline CRUD actions |
| Barcode Scans | `barcodes/scans/page.tsx` | Same as Barcode Records: custom raw `<table>` with purpose/result/entityType Select filters; read-only with row-click navigation; no inline actions |

## Converted (previous batches)
Access roles, users, permissions; Core companies, branches, departments; Inventory warehouses, balances, products, movements; Settings numbering, audit, notification-rules.

## Result
13 legacy DataTable pages converted to AdminDataGrid (green header, standardized toolbar, action dropdowns, RTL support). 2 barcode pages documented N/A_EXPECTED due to custom multi-filter UX requirement incompatible with AdminDataGrid's toolbar design. All remaining main list pages now use the unified AdminDataGrid component.

## Status: CLOSED (13 converted, 2 N/A_EXPECTED with reason)
