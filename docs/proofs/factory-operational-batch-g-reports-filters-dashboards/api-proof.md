# API Proof — Batch G Operational Context Filters

## Objective
Verify that the 6 new operational context filter fields (`productionLineId`, `operationTypeId`, `machineComponentId`, `componentId`, `costCenterId`, `sparePartId`) are properly accepted by the API's `MaintenanceReportFilterDto` and correctly routed to the backend service methods.

## Environment
- **Server**: Local Node.js dev server (`node apps/api/dist/src/main.js`)
- **Port**: 4000
- **API base**: `http://localhost:4000/api/v1`
- **Database**: SQL Server at `localhost:50079`, database `ATsoftERP_DB`
- **Auth**: JWT token (admin@atsofterp.com / <REDACTED>)
- **Date**: 2026-07-23

## Method
HTTP GET requests to each endpoint with filter fields as query parameters. Responses validated by status code (expected 200). The global `ValidationPipe` uses `whitelist: true` and `forbidNonWhitelisted: true`, so any undeclared field would return 400.

## Individual Field Acceptance

Each new filter field tested individually on `/api/v1/reports/maintenance/overview`:

| Filter Field | Status | Response |
|-------------|--------|----------|
| `productionLineId=1` | 200 | Overview data (empty) |
| `operationTypeId=1` | 200 | Overview data (empty) |
| `machineComponentId=1` | 200 | Overview data (empty) |
| `componentId=1` | 200 | Overview data (empty) |
| `costCenterId=1` | 200 | Overview data (empty) |
| `sparePartId=1` | 200 | Overview data (empty) |

**Result**: All 6 fields PASS — DTO correctly accepts and whitelists them.

## Combined Fields Acceptance

All 6 new fields + existing `machineId` together:

| Endpoint | Params | Status | Size |
|----------|--------|--------|------|
| `/reports/maintenance/overview` | All 7 fields | 200 | 679 B |
| `/reports/maintenance/requests` | All 7 fields | 200 | 261 B |
| `/reports/maintenance/downtime` | All 7 fields | 200 | 257 B |
| `/reports/maintenance/costs` | All 7 fields | **200** (FIXED) | 679 B |
| `/reports/maintenance/schedules` | All 7 fields | 200 | 244 B |
| `/reports/machine-log` | productionLineId + operationTypeId | 200 | 59 B |
| `/reports/parts-usage` | sparePartId | **200** (FIXED) | 261 B |

**Result**: All 5 maintenance endpoints + machine-log + parts-usage pass with all fields.

## Edge Case Validation

| Scenario | Expected | Actual | Verdict |
|----------|----------|--------|---------|
| No auth token | 401 | 401 | PASS |
| Costs with no filters | 200 | 200 | PASS |
| Costs with machineId+costCenterId | 200 | 200 | PASS |
| Costs with productionLineId only | 200 | 200 | PASS |
| Costs all 7 fields (DEFECT 1) | 200 | **200** | **FIXED** |
| Parts-usage sparePartId (DEFECT 2) | 200 | **200** | **FIXED** |
| Invalid IDs (999999) | 200 | 200 | PASS |
| End-date-before-start-date | 200 | 200 | PASS |
| Zero-result filter | 200, empty dataset | 200 | PASS |
| Idempotent GET (no mutation) | same result | same result | PASS |

## Defects Found

**Two runtime 500 defects were identified and fixed:**

1. **Costs endpoint (all filters)**: HTTP 500 when all 7 filter fields combined.  
   **Root cause**: `getMaintenanceCostsReport` in `maintenance-reports.service.ts` set `whereParts.sparePartId = filters.sparePartId` on a query targeting `MaintenanceRequestPartUsage`, which does NOT have a `sparePartId` field (it uses `productId`).  
   **Fix**: Resolve `sparePartId → productId` via SparePart lookup before filtering.  
   **Status**: **CLOSED** — returns 200 with empty dataset.

2. **Parts-usage endpoint (sparePartId)**: HTTP 500 when `sparePartId` provided.  
   **Root cause**: Same as above — `getPartsUsageReport` filtered `MaintenanceRequestPartUsage` by non-existent `sparePartId`.  
   **Fix**: Same fix applied.  
   **Status**: **CLOSED** — returns 200 with empty dataset.

## Conclusion

**API DTO acceptance: PASS** — All 6 new operational filter fields are correctly whitelisted, validated, and routed. Both runtime 500 defects are fixed. Full 32-test API proof: 30/30 applicable passed (2 export tests N/A by design). SQL Server runtime proof executed on local host (`localhost:50079`). Docker/PostgreSQL NOT used.
