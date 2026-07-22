# Reports Route Compatibility

## Route → Method mapping (unchanged)

| HTTP Route | Controller Method | Delegates To |
|---|---|---|
| `GET /v1/reports/maintenance/overview` | `getMaintenanceOverview` | `DashboardReportsService.getMaintenanceOverview` |
| `GET /v1/reports/maintenance/requests` | `getMaintenanceRequests` | `MaintenanceReportsService.getMaintenanceRequestsReport` |
| `GET /v1/reports/maintenance/downtime` | `getMachineDowntime` | `MaintenanceReportsService.getMachineDowntimeReport` |
| `GET /v1/reports/maintenance/costs` | `getMaintenanceCosts` | `MaintenanceReportsService.getMaintenanceCostsReport` |
| `GET /v1/reports/maintenance/schedules` | `getPreventiveSchedules` | `MaintenanceReportsService.getPreventiveSchedulesReport` |
| `GET /v1/reports/inventory/overview` | `getInventoryOverview` | `DashboardReportsService.getInventoryOverview` |
| `GET /v1/reports/inventory/balances` | `getInventoryBalances` | `InventoryReportsService.getInventoryBalanceReport` |
| `GET /v1/reports/inventory/count-variance` | `getInventoryCountVariance` | `InventoryReportsService.getInventoryCountVarianceReport` |
| `GET /v1/reports/inventory/movements` | `getInventoryMovements` | `InventoryReportsService.getInventoryMovementsReport` |
| `GET /v1/reports/inventory/adjustments` | `getInventoryAdjustments` | `InventoryReportsService.getInventoryAdjustmentsReport` |
| `GET /v1/reports/barcodes/scans` | `getBarcodeScans` | `BarcodeReportsService.getBarcodeScansReport` |
| `GET /v1/reports/assets` | `getAssetsRegister` | `SystemReportsService.getAssetsRegisterReport` |
| `GET /v1/reports/parts` | `getParts` | `SystemReportsService.getPartsReport` |
| `GET /v1/reports/partners` | `getPartners` | `SystemReportsService.getPartnersReport` |
| `GET /v1/reports/attachments` | `getAttachments` | `SystemReportsService.getAttachmentsReport` |
| `GET /v1/reports/audit` | `getAuditTrail` | `AuditReportsService.getAuditTrailReport` |
| `GET /v1/reports/user-activity` | `getUserActivity` | `AuditReportsService.getUserActivityReport` |
| `GET /v1/reports/notifications` | `getNotifications` | `AuditReportsService.getNotificationsReport` |
| `GET /v1/reports/machine-log` | `getMachineLog` | `MaintenanceReportsService.getMachineLogReport` |
| `GET /v1/reports/parts-usage` | `getPartsUsage` | `MaintenanceReportsService.getPartsUsageReport` |
| `GET /v1/reports/upcoming-preventive` | `getUpcomingPreventive` | `MaintenanceReportsService.getUpcomingPreventiveReport` |
| `GET /v1/reports/overdue-preventive` | `getOverduePreventive` | `MaintenanceReportsService.getOverduePreventiveReport` |
| `GET /v1/reports/low-stock` | `getLowStock` | `SystemReportsService.getLowStockReport` |

## Controller signature compatibility

- All `@Get`, `@Permissions`, `@ApiOperation` decorators are unchanged
- Controller constructor still injects `ReportsService`
- All DTO types (`MaintenanceReportFilterDto`, `InventoryReportFilterDto`, `BarcodeReportFilterDto`) unchanged
- Response shapes are binary identical to pre-split
