# Reports, Export, and Print

> User Manual — Section 7

## Purpose

View operational reports, export data to CSV or Excel, and print.

## Who Uses This

All users with report permissions.

## Available Reports

| Report | Endpoint | Description |
|--------|----------|-------------|
| Assets | `/reports/assets` | Asset register |
| Inventory Overview | `/reports/inventory/overview` | Stock summary |
| Inventory Balances | `/reports/inventory/balances` | Stock levels |
| Inventory Movements | `/reports/inventory/movements` | Stock transactions |
| Inventory Adjustments | `/reports/inventory/adjustments` | Adjustment records |
| Count Variance | `/reports/inventory/count-variance` | Count vs balance differences |
| Maintenance Overview | `/reports/maintenance/overview` | Maintenance activity |
| Maintenance Requests | `/reports/maintenance/requests` | Request log |
| Maintenance Downtime | `/reports/maintenance/downtime` | Downtime analysis |
| Maintenance Costs | `/reports/maintenance/costs` | Cost data |
| Maintenance Schedules | `/reports/maintenance/schedules` | Schedule status |
| Partners | `/reports/partners` | Business partners |
| Low Stock | `/reports/low-stock` | Products below threshold |
| User Activity | `/reports/user-activity` | User actions |
| Notifications | `/reports/notifications` | Notification log |
| Attachments | `/reports/attachments` | File records |
| Barcode Scans | `/reports/barcodes/scans` | Scan history |
| Audit | `/reports/audit` | Audit trail |
| Machine Log | `/reports/machine-log` | Machine events |
| Parts Usage | `/reports/parts-usage` | Part consumption |
| Parts | `/reports/parts` | Parts catalog |
| Upcoming Preventive | `/reports/upcoming-preventive` | Future PM tasks |
| Overdue Preventive | `/reports/overdue-preventive` | Past-due PM tasks |

## Viewing a Report

1. Navigate to **Reports** in the sidebar
2. Select a report category
3. Use filters (date range, status, etc.)
4. Click **View** or **Load**

## Exporting to CSV

1. While viewing a report, click **Export CSV**
2. The file downloads automatically

## Exporting to Excel

1. Click **Export Excel**
2. The .xlsx file downloads (generated server-side via exceljs)

## Printing

1. Click **Print** on a report
2. The browser print dialog opens
3. Select your printer or **Save as PDF**
4. **Note**: PDF is browser print-to-PDF, not server-side PDF generation

## Expected Result

- Reports load with real data
- CSV files open in Excel or any text editor
- Excel .xlsx files open in Excel with formatted columns
- Print dialog offers PDF save option

## Permissions Required

- Reports: `reports:read`

## Related API Routes

- `GET /api/v1/reports/{report-name}`
- `GET /api/v1/reports/export/csv/{endpoint}`
- `GET /api/v1/reports/export/excel/{endpoint}`
