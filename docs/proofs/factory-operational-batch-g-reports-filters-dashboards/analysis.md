# Batch G — Maintenance Operational Reports / Filters / Dashboards

## Audit Result

### Existing reports module (NOT rebuilt)
- `apps/api/src/modules/reports/` — fully implemented
- 5 maintenance report backend endpoints under `/reports/maintenance/*`
- CSV/Excel export via `report-export.service.ts`

### Existing frontend pages
- `apps/web/src/app/admin/reports/maintenance/`
  - overview, requests, downtime, costs, schedules

### Shared components
- `ReportPageShell`, `ReportSummaryCards`, `ReportExportButton`

### i18n
- `en/reports.ts` and `ar/reports.ts` — both fully synchronized
- `en/maintenance.ts` and `ar/maintenance.ts` — operational context labels exist

### Navigation
- All report links in `navigation-data.ts` under `reports` section

### Permissions
- `reports.maintenance:read` already seeded

### F9 adapters
- `productionLineAdapter`, `machineAdapter`, `machineComponentAdapter`, `operationTypeAdapter`, `costCenterAdapter`, `sparePartAdapter` — all exist

### Gap found
- `MaintenanceReportFilterDto` was missing: `productionLineId`, `operationTypeId`, `machineComponentId`, `costCenterId`, `sparePartId`
- Frontend pages only used `machineAdapter` — missing the other 5 operational filters

### Implementation
- Added 5 missing fields to DTO
- Supported `componentId` as backward-compatible alias for `machineComponentId`
- Updated all backend service methods to use new filters
- Updated all 5 frontend pages with operational context F9 filters
