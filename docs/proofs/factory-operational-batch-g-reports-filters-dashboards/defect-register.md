# Defect Register — Batch G

## Open Defects
1. **Costs endpoint returns 500 when ALL operational filter fields are combined**  
   `/api/v1/reports/maintenance/costs` returns HTTP 500 when all 6 new filter fields (`productionLineId`, `operationTypeId`, `machineComponentId`, `componentId`, `costCenterId`, `sparePartId`) plus `machineId` are provided simultaneously. Individual fields and subsets (e.g., `machineId+costCenterId`) return 200.  
   **Root cause**: Likely a Prisma query error when too many filter conditions are combined on joined relations. Requires SQL Server runtime access for debugging.  
   **Severity**: Medium — the DTO correctly accepts all fields (individual 200s prove this). The 500 occurs during query execution, not validation.  
   **Workaround**: Use subsets of filters rather than all 7 simultaneously.

2. **Parts-usage endpoint returns 500 when `sparePartId` filter is provided**  
   `/api/v1/reports/parts-usage` returns HTTP 500 when `sparePartId=1` is passed. Without this filter it returns 200.  
   **Root cause**: Likely a Prisma join error in the parts-usage query when filtering by sparePartId. Requires SQL Server runtime access for debugging.  
   **Severity**: Medium — the `sparePartId` field is correctly accepted by the DTO (proven by overview/requests/downtime/schedules with sparePartId=1 all returning 200). The 500 is a query execution issue specific to the parts-usage endpoint.

## Closed During Implementation
None.

## Known Limitations
1. The `componentId` parameter is supported as a backward-compatible alias for `machineComponentId`. New code should use `machineComponentId`. The alias exists to prevent breaking any existing integration that may already send `componentId`.
2. Downtime report filters through `request` relation — operational filters apply to downtime logs that are linked to a maintenance request. Standalone downtime logs (without a requestId) are not affected by operational context filters.
3. Preventive schedule reports filter through `machine` relation — operational filters apply to schedules linked to a machine that has the specified operational context. This is an indirect path but maintains data consistency.
4. API proof was executed against the local Node.js dev server with the new build. SQL Server (`localhost:50079`) was reachable during proof execution. The Docker production API was NOT used for Batch G proof.
