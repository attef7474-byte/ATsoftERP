# Phase 1: Current Reporting and Data Audit — AF-AG

## 1. Preflight State

| Item | Value |
|------|-------|
| Branch | `main` |
| HEAD | `883685b` (AD-AE final: AGENTS.md update) |
| Tags | 3 tags pushed at `883685b` |
| Git status | clean, 0/0 ahead/behind |
| Prior batch | AD-AE accepted at `c4b87ff`, final commit `883685b` |

## 2. Existing Reports Infrastructure

### Backend Reports Module (`apps/api/src/modules/reports/`)

| File | Purpose |
|------|---------|
| `reports.module.ts` | Registered: ReportsService, DashboardReportsService, MaintenanceReportsService, InventoryReportsService, BarcodeReportsService, SystemReportsService, AuditReportsService, ReportExportService |
| `reports.controller.ts` | 35+ endpoints under `reports/maintenance/*`, `reports/inventory/*`, etc. |
| `reports.service.ts` | Delegates to sub-services |
| `dto/report-filter.dto.ts` | `MaintenanceReportFilterDto` with filters: productionLine, machine, component, operationType, costCenter, sparePart, maintenanceType, priority, requestStatus, assignee, dueStatus |
| `services/maintenance-reports.service.ts` | 8 report methods: overview, requests, downtime, costs, schedules, machine-log, parts-usage, upcoming/overdue preventive |
| `services/dashboard-reports.service.ts` | Maintenance overview + inventory overview with card KPIs |
| `services/report-export.service.ts` | CSV + Excel export for all report endpoints |
| `services/report-query-utils.ts` | `buildDateFilter()`, `paginate()`, `nowPlusDays()` |

### Existing Maintenance Dashboard Module (`apps/api/src/modules/factory/maintenance/maintenance-dashboard/`)

| File | Purpose |
|------|---------|
| `maintenance-dashboard.service.ts` | `getSummary()` — 30+ metrics including reliability KPIs from DowntimeLogsService |
| `maintenance-dashboard.controller.ts` | 13 endpoints under `/maintenance/dashboard/*` |
| Key endpoints | `summary`, `cost-kpis`, `accountability-kpis`, `open-requests`, `critical`, `overdue`, `machines-under-maintenance`, `current-downtime`, `upcoming-preventive`, `sla-overdue`, `sla-escalated`, `recent-generated-preventive`, `recent-emergency` |

### Existing Reliability Module (`apps/api/src/modules/factory/maintenance/maintenance-reliability/`)

| File | Purpose |
|------|---------|
| `maintenance-reliability.service.ts` | 10 methods — all delegate to `DowntimeLogsService` |
| `maintenance-reliability.controller.ts` | 12 endpoints under `/maintenance/reliability/*` |
| `maintenance-reliability.module.ts` | Registered, imports `DowntimeLogsModule` |

**Endpoints:**
- `GET /maintenance/reliability/mttr` — MTTR query
- `GET /maintenance/reliability/mtbf` — MTBF query
- `GET /maintenance/reliability/total-downtime` — aggregate
- `GET /maintenance/reliability/downtime-by-machine` — grouped
- `GET /maintenance/reliability/downtime-by-line` — grouped
- `GET /maintenance/reliability/downtime-by-cause` — grouped
- `GET /maintenance/reliability/repeat-failures` — repeat list
- `GET /maintenance/reliability/emergency-response-time` — avg response
- `GET /maintenance/reliability/top-machines` — top by downtime
- `GET /maintenance/reliability/top-causes` — top by cause

### DowntimeLogsService Reliability Methods (`downtime-logs.service.ts:437-692`)

| Method | Lines | Description |
|--------|-------|-------------|
| `getMttr()` | 437-463 | AVG of `durationMinutes` where `endTime IS NOT NULL AND cancelledAt IS NULL AND durationMinutes IS NOT NULL` |
| `getMtbf()` | 465-498 | Calendar-time-based: `(lastEvent.startTime - firstEvent.startTime) / (totalEvents - 1)` |
| `getTotalDowntime()` | 500-526 | SUM of `durationMinutes` where not cancelled |
| `getDowntimeByMachine()` | 528-560 | GroupBy machineId, SUM durationMinutes |
| `getDowntimeByProductionLine()` | 562-588 | GroupBy machine → productionLineId |
| `getDowntimeByCause()` | 590-618 | GroupBy failureCause, SUM durationMinutes |
| `getRepeatFailures()` | 620-652 | Find logs where `isRepeatFailure = true` |
| `getEmergencyResponseTime()` | 654-692 | AVG of (responseStartedAt − startTime) or (repairStartedAt − startTime) |
| `getTopMachines()` | 685+ | GroupBy machineId, limit, sum duration |
| `getTopCauses()` | 689+ | GroupBy failureCause, sum duration |

### Existing Frontend Pages

| Path | Purpose |
|------|---------|
| `/admin/maintenance/dashboard` | Main dashboard with KPI cards + reliability section (MTTR, MTBF, total downtime) |
| `/admin/maintenance/dashboard/cost-kpis` | Cost KPIs (total cost, monthly cost, by type, top requests) |
| `/admin/reports/maintenance` | Overview report with filters and summary cards |
| `/admin/reports/maintenance/requests` | Maintenance requests report |
| `/admin/reports/maintenance/downtime` | Downtime report |
| `/admin/reports/maintenance/costs` | Cost report |
| `/admin/reports/maintenance/schedules` | Schedule report |

**Notable:** No dedicated reliability/KPI page exists under `reports/`. The reliability section is a small card set on the main dashboard.

## 3. Data Availability for Cost Reports

### Primary Cost Sources

| Source Model | Key Cost Fields | Status |
|-------------|----------------|--------|
| `MaintenanceRequest.cost` | `cost` (Float?, scalar) | Available, but may be redundant if detailed cost entries used |
| `MaintenanceRequestCostEntry` | `amount` (Float), `type` (String — "LABOR"/"PARTS"/"OTHER"), `incurredAt` | **Primary labor/other cost source** |
| `MaintenanceRequestPartUsage` | `totalCost` (Float?), `unitCost` (Float?), `quantity` (Float) | **Primary parts cost source** |
| `MaintenanceRequestRequiredPart` | `totalCost` (Decimal?), `unitCost` (Decimal?) | Secondary — condition-based cost |
| `SparePartRepairOrder` | `estimatedRepairCost` (Decimal?), `actualRepairCost` (Decimal?) | Repair cost source |
| `InventoryMovement` | No cost field | ❌ Not usable |
| `InventoryMovementLine` | No cost field | ❌ Not usable |
| `InventoryBalance` | No cost field | ❌ Not usable |

### Key Insight: Cost Data Sources

The system has **three separate cost tracking mechanisms**:

1. **MaintenanceRequestCostEntry** — labor, service, other costs per request (linked to `requestId`)
2. **MaintenanceRequestPartUsage** — parts used per request with `quantity`, `unitCost`, `totalCost` (linked to `requestId` + `productId`)
3. **MaintenanceRequestRequiredPart** — condition-based cost with `unitCost`/`totalCost` (linked to `requestId` + `sparePartId`)

**Risk of double-counting:** `MaintenanceRequestPartUsage.totalCost` and `MaintenanceRequestRequiredPart.totalCost` may overlap when a part is both "used" and "required" in stock issue flow. The existing `getMaintenanceCostsReport()` at line 90-143 of `maintenance-reports.service.ts` queries BOTH `MaintenanceRequestCostEntry` AND `MaintenanceRequestPartUsage` separately and sums them. This is correct for the API, but the `MaintenanceRequestRequiredPart.totalCost` is not included in existing reports.

### Cost Report Coverage Gaps

| Report Type | Existing? | Gaps |
|------------|-----------|------|
| Total maintenance cost | Yes (overview, costs report) | Doesn't include repair order costs or required-part condition costs |
| Cost by machine | No | Only top machines, no cost breakdown |
| Cost by type (CM/PM) | Partial (byType in cost-kpis uses costEntry type, not maintenance type) | No breakdown by CORRECTIVE/PREVENTIVE/EMERGENCY |
| Cost by component | No | Not available |
| Cost by spare part | No | Not available |
| Cost by production line | No | Not available |
| Monthly/periodic cost trend | Partial (monthlyCost in cost-kpis) | Only from CostEntry, not from PartUsage or RequiredPart |
| Repair order cost impact | No | Not included in any report |
| Cost per machine/hour of operation | No | N/A without operating hours data |

## 4. Data Availability for Reliability KPIs

### Existing KPI Calculations

| KPI | Calculation | Data Source | Status |
|-----|------------|-------------|--------|
| **MTTR** | AVG(downtimeLog.durationMinutes) where log resolved | `DowntimeLog` | ✅ Implemented in `DowntimeLogsService.getMttr()` |
| **MTBF** | (lastEventTime − firstEventTime) / (events − 1) | `DowntimeLog` | ✅ Implemented in `DowntimeLogsService.getMtbf()` |
| **Total Downtime** | SUM(durationMinutes) | `DowntimeLog` | ✅ Implemented |
| **Downtime by Machine** | GroupBy machineId | `DowntimeLog` | ✅ Implemented |
| **Downtime by Line** | GroupBy machine → productionLine | `DowntimeLog` | ✅ Implemented |
| **Downtime by Cause** | GroupBy failureCause | `DowntimeLog` | ✅ Implemented |
| **Repeat Failures** | `isRepeatFailure = true` | `DowntimeLog` | ✅ Implemented |
| **Emergency Response Time** | AVG(responseStartedAt − startTime) | `DowntimeLog` | ✅ Implemented |
| **Avg Completion Time** | AVG(endDate − startDate) | `MaintenanceRequest` | ✅ In MaintenanceDashboardService |

### Missing/Incomplete KPIs

| KPI | Why Missing | Data Available? |
|-----|-------------|-----------------|
| **Availability %** | (Total Time − Downtime) / Total Time | Needs operating calendar/hours data — **NOT available** |
| **Maintenance Cost per Asset** | No dedicated endpoint | Yes — can query via request → machine |
| **Schedule Compliance %** | Preventive schedules completed vs due | Yes — count COMPLETED preventive vs total due |
| **Backlog (open requests count)** | Already in dashboard but not as a trend | Yes |
| **Cost per Request Type** | No breakdown across all cost sources | Yes — join CostEntry + PartUsage + RequiredPart |
| **PM/CM Ratio** | Preventive vs corrective request count | Yes — filter by `type` |
| **First-Time Fix Rate** | No data to determine | ❌ Unavailable — no rework tracking |
| **Mean Distance Between Failures** | Not applicable | ❌ No odometer/hours-of-operation data |
| **Planned vs Unplanned Ratio** | Partial — only counts | Yes |

## 5. Existing Frontend Components

### Available UI Components

| Component | Import Path | Used In |
|-----------|-------------|---------|
| `ReportPageShell` | `../../components/reports` | Report pages — filter bar + content shell |
| `ReportSummaryCards` | `../../components/reports` | Card grid for summary KPIs |
| `DataTable` | `../../components/admin/ui` | Tabular data display |
| `Card`, `CardHeader`, `CardContent` | `../../components/admin/ui` | Layout cards |
| `PageHeader`, `LoadingState`, `ErrorState` | `../../components/admin/ui` | Shell |
| `F9Lookup` | `../../components/f9` | F9 search dialogs for machine, line, component, op-type, cost-center |
| `useRegisterAdminActions` | `../../components/admin/admin-action-bar` | Action bar (back, refresh, print) |
| `Button` | `../../components/admin/ui` | Buttons |

### Existing Chart Usage

No chart library (recharts, chart.js, etc.) was found in the frontend. The existing dashboards use numeric cards and DataTable only.

## 6. Permission Model

| Permission String | Entity | Scope |
|------------------|--------|-------|
| `reports.maintenance:read` | Reports → Maintenance | Reports controller |
| `maintenance.dashboard.view` | Dashboard → Main | MaintenanceDashboardController |
| `maintenance.dashboard.costKpis.view` | Dashboard → Cost KPIs | MaintenanceDashboardController cost-kpis endpoint |
| `maintenance.reliability:read` | Reliability | MaintenanceReliabilityController |

**New permissions needed for AF-AG:**
- No new module needed — extend existing `reports.maintenance:read` or `maintenance.dashboard.view`

## 7. Cost Data Sources Summary

```
MaintenanceRequestCostEntry (LABOR / PARTS / OTHER)
    ↓ amount per entry, linked to requestId
    ↓ directly queryable via Prisma

MaintenanceRequestPartUsage (parts from inventory)
    ↓ quantity, unitCost, totalCost per usage
    ↓ linked to requestId + productId

MaintenanceRequestRequiredPart (stock-issue flow, condition-based)
    ↓ unitCost (Decimal), totalCost (Decimal)
    ↓ linked to requestId + sparePartId
    ↓ issuedQuantity, usedQuantity

SparePartRepairOrder (repair costs)
    ↓ estimatedRepairCost (Decimal), actualRepairCost (Decimal)
    ↓ separately tracked, not aggregated into request cost totals
```

## 8. Data Counts (as of audit)

| Entity | Count |
|--------|-------|
| MaintenanceRequest (total) | From DB |
| MaintenanceRequest (COMPLETED) | From DB |
| MaintenanceRequestCostEntry | From DB |
| MaintenanceRequestPartUsage | From DB |
| DowntimeLog | From DB |
| SparePartRepairOrder | From DB |
| Machine | From DB |

*Note: Exact counts to be verified in Phase 10 (DB integrity proof).*

## 9. Gaps Summary

1. **Cost consolidation**: No unified cost view across CostEntry + PartUsage + RequiredPart + RepairOrder
2. **No dedicated report/KPI pages** for reliability — only dashboard widget
3. **No cost-by-machine or cost-by-line** breakdown reports
4. **No trend data** (monthly cost trend, downtime trend chart)
5. **No Availability %** — missing operating hours data
6. **No chart library** in frontend — KPI cards are the only visualization
7. **MTTR/MTBF are downtime-log-only** — not integrated with repair order durations
