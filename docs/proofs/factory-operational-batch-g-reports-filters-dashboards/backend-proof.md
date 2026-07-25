# Backend Proof — Batch G

## Files Modified

| File | Change |
|------|--------|
| `apps/api/src/modules/reports/dto/report-filter.dto.ts` | Added productionLineId, machineComponentId, componentId, operationTypeId, costCenterId, sparePartId |
| `apps/api/src/modules/reports/services/report-query-utils.ts` | Added same fields to ReportQuery interface |
| `apps/api/src/modules/reports/services/maintenance-reports.service.ts` | Updated all 8 methods to filter by new fields |
| `apps/api/src/modules/reports/services/dashboard-reports.service.ts` | Updated getMaintenanceOverview to filter by new fields |

## Filter Behavior

| Filter | Target Model | Behavior |
|--------|-------------|----------|
| productionLineId | MaintenanceRequest | productionLineId field |
| machineId | MaintenanceRequest (existing) | Preserved |
| machineComponentId / componentId | MaintenanceRequest | machineComponentId field; componentId is alias |
| operationTypeId | MaintenanceRequest | operationTypeId field |
| costCenterId | MaintenanceRequest | costCenterId field |
| sparePartId (overview/requests/downtime/schedules) | MaintenanceRequestRequiredPart | Filters requests having requiredParts with matching sparePartId |
| sparePartId (costs report, parts-usage report) | MaintenanceRequestPartUsage via SparePart→productId | Resolves sparePartId to productId via SparePart lookup, then filters by productId. MaintenanceRequestPartUsage has no direct sparePartId field. |
| For DowntimeLog | — | Filters through request.relation (productionLineId, operationTypeId, costCenterId, machineComponentId) |
| For MaintenanceSchedule | — | Filters through machine.relation (productionLineId, operationTypeId, defaultCostCenterId) |
| For MaintenanceRequestPartUsage | — | Filters through request.relation |
| For overview | — | Applies requestWhere for request-based queries, machineWhere for schedule/downtime |

## Validation
- prisma validate: PASS
- prisma generate: PASS
- build:api: PASS
- typecheck: PASS
