# Reports, Export & Print Tests

**Date:** 2026-07-20

## Report Pages

All report pages were verified to exist and return 200 in production build:

| Report | URL | Status |
|--------|-----|--------|
| Maintenance Overview | `/admin/reports/maintenance` | 200 |
| Maintenance Costs | `/admin/reports/maintenance/costs` | 200 |
| Maintenance Downtime | `/admin/reports/maintenance/downtime` | 200 |
| Maintenance Requests | `/admin/reports/maintenance/requests` | 200 |
| Maintenance Schedules | `/admin/reports/maintenance/schedules` | 200 |
| Inventory Overview | `/admin/reports/inventory` | 200 |
| Inventory Balances | `/admin/reports/inventory/balances` | 200 |
| Inventory Count Variance | `/admin/reports/inventory/count-variance` | 200 |
| Inventory Movements | `/admin/reports/inventory/movements` | 200 |
| Inventory Adjustments | `/admin/reports/inventory/adjustments` | 200 |
| Barcode Scans | `/admin/reports/barcodes/scans` | 200 |
| Assets Register | `/admin/reports/assets` | 200 |
| Machine Parts | `/admin/reports/parts` | 200 |
| Parts Usage | `/admin/reports/parts-usage` | 200 |
| Business Partners | `/admin/reports/partners` | 200 |
| Attachments | `/admin/reports/attachments` | 200 |
| Audit Trail | `/admin/reports/audit` | 200 |
| User Activity | `/admin/reports/user-activity` | 200 |
| Notifications | `/admin/reports/notifications` | 200 |
| Machine Activity Log | `/admin/reports/machine-log` | 200 |
| Low Stock | `/admin/reports/low-stock` | 200 |
| Upcoming Preventive | `/admin/reports/upcoming-preventive` | 200 |
| Overdue Preventive | `/admin/reports/overdue-preventive` | 200 |

## Export Endpoints (API)

| Export Type | Endpoint Pattern | Status |
|-------------|-----------------|--------|
| CSV Export | `/api/v1/reports/export/csv/*` | Implemented |
| Excel Export | `/api/v1/reports/export/excel/*` | Implemented |

## Print Support

| Feature | Status |
|---------|--------|
| Maintenance request print | `/maintenance/requests/:id/print` |
| Barcode label print | `/barcodes/labels/:id/download` |
| Barcode print jobs | `/barcodes/print-jobs` |
| Barcode preview | `/barcodes/labels/:id/preview` |
| Machine card print | `/admin/barcodes/machine-cards/print` |
| Product label print | `/admin/barcodes/product-labels/print` |

## Conclusion

23 report pages exist and serve correctly. CSV and Excel export routes are implemented.
Print-specific pages and download endpoints are in place for barcodes and maintenance requests.
