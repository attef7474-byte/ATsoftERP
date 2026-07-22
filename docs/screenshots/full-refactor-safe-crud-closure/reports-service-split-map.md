# Reports Service Split Map

## Original file
`apps/api/src/modules/reports/reports.service.ts` (933 lines)

## Split into domain services

| Domain Service | File | Methods moved |
|---|---|---|
| `DashboardReportsService` | `services/dashboard-reports.service.ts` | `getMaintenanceOverview`, `getInventoryOverview` |
| `MaintenanceReportsService` | `services/maintenance-reports.service.ts` | `getMaintenanceRequestsReport`, `getMachineDowntimeReport`, `getMaintenanceCostsReport`, `getPreventiveSchedulesReport`, `getMachineLogReport`, `getPartsUsageReport`, `getUpcomingPreventiveReport`, `getOverduePreventiveReport` |
| `InventoryReportsService` | `services/inventory-reports.service.ts` | `getInventoryBalanceReport`, `getInventoryCountVarianceReport`, `getInventoryMovementsReport`, `getInventoryAdjustmentsReport` |
| `BarcodeReportsService` | `services/barcode-reports.service.ts` | `getBarcodeScansReport` |
| `SystemReportsService` | `services/system-reports.service.ts` | `getAssetsRegisterReport`, `getPartsReport`, `getPartnersReport`, `getAttachmentsReport`, `getLowStockReport` |
| `AuditReportsService` | `services/audit-reports.service.ts` | `getAuditTrailReport`, `getUserActivityReport`, `getNotificationsReport` |
| `ReportExportService` | `services/report-export.service.ts` | `exportCsv`, `exportExcel` |
| `report-query-utils` | `services/report-query-utils.ts` | `buildDateFilter`, `paginate`, `nowPlusDays` (shared utilities) |

## Compatibility facade

`ReportsService` remains injected by `ReportsController` and delegates all methods to the appropriate domain service.

## Module registration

`ReportsModule` registers all 8 providers: `ReportsService`, `DashboardReportsService`, `MaintenanceReportsService`, `InventoryReportsService`, `BarcodeReportsService`, `SystemReportsService`, `AuditReportsService`, `ReportExportService`.

## Design decisions

- No circular dependencies (domain services only depend on PrismaService and query utils)
- Export service injects all domain services to dispatch report data — avoids duplicating switch logic
- Query utils are plain functions, not injectable — avoids unnecessary DI overhead
- Each domain service is focused on a single domain boundary
- Response shapes are preserved exactly
