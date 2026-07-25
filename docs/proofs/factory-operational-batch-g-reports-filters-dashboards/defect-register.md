# Defect Register — Batch G

## Open Defects
None.

## Closed During Implementation
1. **Costs endpoint returns 500 when ALL operational filter fields are combined**  
   **Root cause**: `getMaintenanceCostsReport` at `maintenance-reports.service.ts:106` set `whereParts.sparePartId = filters.sparePartId` on a query targeting `MaintenanceRequestPartUsage`. This model does NOT have a `sparePartId` field — it uses `productId` to link to `Product`. The `SparePart` model has a `productId` optional relation to `Product`, but `MaintenanceRequestPartUsage.productId` points directly to `Product`. Filtering by the non-existent `sparePartId` field caused a Prisma runtime error.  
   **Fix**: Added a SparePart lookup to resolve `sparePartId → productId`, then filter by `productId`. If the SparePart has no linked product, the query returns empty.  
   **File**: `apps/api/src/modules/reports/services/maintenance-reports.service.ts`, `getMaintenanceCostsReport` method.  
   **Verification**: `/api/v1/reports/maintenance/costs` with all 7 filter fields returns 200, empty dataset.  
   **Status**: CLOSED.

2. **Parts-usage endpoint returns 500 when `sparePartId` filter is provided**  
   **Root cause**: `getPartsUsageReport` at `maintenance-reports.service.ts:209` set `where.sparePartId = filters.sparePartId` on a query targeting `MaintenanceRequestPartUsage`. Same root cause as defect #1.  
   **Fix**: Added a SparePart lookup to resolve `sparePartId → productId`, then filter by `productId`.  
   **File**: `apps/api/src/modules/reports/services/maintenance-reports.service.ts`, `getPartsUsageReport` method.  
   **Verification**: `/api/v1/reports/parts-usage` with `sparePartId=1` returns 200, empty dataset.  
   **Status**: CLOSED.

## Closed During Implementation
None.

## Known Limitations
1. The `componentId` parameter is supported as a backward-compatible alias for `machineComponentId`. New code should use `machineComponentId`. The alias exists to prevent breaking any existing integration that may already send `componentId`.
2. Downtime report filters through `request` relation — operational filters apply to downtime logs that are linked to a maintenance request. Standalone downtime logs (without a requestId) are not affected by operational context filters.
3. Preventive schedule reports filter through `machine` relation — operational filters apply to schedules linked to a machine that has the specified operational context. This is an indirect path but maintains data consistency.
4. API proof was executed against the local Node.js dev server with the new build. SQL Server (`localhost:50079`) was reachable during proof execution. The Docker production API was NOT used for Batch G proof.
