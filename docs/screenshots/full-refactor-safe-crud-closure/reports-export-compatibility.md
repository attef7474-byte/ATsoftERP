# Reports Export Compatibility

## Export routes (unchanged)

| Route | Controller Method | Export Service Method |
|---|---|---|
| `GET /v1/reports/export/csv/*endpoint` | `exportCsv` | `ReportExportService.exportCsv` |
| `GET /v1/reports/export/excel/*endpoint` | `exportExcel` | `ReportExportService.exportExcel` |

## Dispatch mechanism

`ReportExportService.getReportData` uses a switch statement matching the endpoint path to the correct domain service method — same pattern as the original `reports.service.ts`.

## Endpoint → domain service mapping

| Endpoint | Domain Service Method |
|---|---|
| `maintenance/overview` | `DashboardReportsService.getMaintenanceOverview` |
| `maintenance/requests` | `MaintenanceReportsService.getMaintenanceRequestsReport` |
| `maintenance/downtime` | `MaintenanceReportsService.getMachineDowntimeReport` |
| `maintenance/costs` | `MaintenanceReportsService.getMaintenanceCostsReport` |
| `maintenance/schedules` | `MaintenanceReportsService.getPreventiveSchedulesReport` |
| `inventory/overview` | `DashboardReportsService.getInventoryOverview` |
| `inventory/balances` | `InventoryReportsService.getInventoryBalanceReport` |
| `inventory/count-variance` | `InventoryReportsService.getInventoryCountVarianceReport` |
| `inventory/movements` | `InventoryReportsService.getInventoryMovementsReport` |
| `inventory/adjustments` | `InventoryReportsService.getInventoryAdjustmentsReport` |
| `barcodes/scans` | `BarcodeReportsService.getBarcodeScansReport` |
| `assets` | `SystemReportsService.getAssetsRegisterReport` |
| `parts` | `SystemReportsService.getPartsReport` |
| `partners` | `SystemReportsService.getPartnersReport` |
| `attachments` | `SystemReportsService.getAttachmentsReport` |
| `audit` | `AuditReportsService.getAuditTrailReport` |
| `user-activity` | `AuditReportsService.getUserActivityReport` |
| `notifications` | `AuditReportsService.getNotificationsReport` |
| `machine-log` | `MaintenanceReportsService.getMachineLogReport` |
| `parts-usage` | `MaintenanceReportsService.getPartsUsageReport` |
| `upcoming-preventive` | `MaintenanceReportsService.getUpcomingPreventiveReport` |
| `overdue-preventive` | `MaintenanceReportsService.getOverduePreventiveReport` |
| `low-stock` | `SystemReportsService.getLowStockReport` |

## Response compatibility

- CSV: same BOM-prefixed UTF-8 CSV string, same header/content format
- Excel: same ExcelJS workbook generation, same column/row formatting
- Error handling: returns empty string / null for no-data, controller returns 404 identical to original
- All headers (`Content-Type`, `Content-Disposition`) preserved
