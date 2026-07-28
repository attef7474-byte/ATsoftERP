# Phase 2: KPI Formula Contract — AF-AG

## 1. Scope

New/enhanced endpoints and frontend pages for **maintenance cost analysis**, **reliability KPIs**, and **schedule compliance**. No schema changes.

## 2. KPI Definitions

### 2.1 Cost KPIs

| KPI | Formula | Data Sources | Notes |
|-----|---------|-------------|-------|
| **Total Maintenance Cost** | SUM(CostEntry.amount) + SUM(PartUsage.totalCost) + SUM(RequiredPart.totalCost) WHERE request.deletedAt IS NULL | `MaintenanceRequestCostEntry`, `MaintenanceRequestPartUsage`, `MaintenanceRequestRequiredPart` | Deduplicate: PartUsage and RequiredPart may overlap — use PartUsage as primary, RequiredPart only when PartUsage does not exist for same request+product |
| **Cost by Request Type** | GROUP BY request.type, SUM(all cost sources) | Same as above + `MaintenanceRequest.type` | Types: CORRECTIVE, PREVENTIVE, EMERGENCY, PREDICTIVE, MODIFICATION |
| **Cost by Machine** | GROUP BY request.machineId, SUM(all cost sources) | Same + `MaintenanceRequest.machineId` | — |
| **Cost by Production Line** | GROUP BY request → machine.productionLineId, SUM(all cost sources) | Same + `Machine.productionLineId` | — |
| **Cost by Cost Type** | GROUP BY CostEntry.type (LABOR/PARTS/OTHER), SUM(amount) | `MaintenanceRequestCostEntry.type` | Only CostEntry has typed costs |
| **Cost Trend (Monthly)** | GROUP BY MONTH(incurredAt), SUM(CostEntry.amount) across months | `MaintenanceRequestCostEntry.incurredAt` | Monthly breakdown for last 12 months |
| **Parts Cost Trend (Monthly)** | GROUP BY MONTH(PartUsage.createdAt), SUM(totalCost) | `MaintenanceRequestPartUsage.createdAt` | Monthly breakdown for last 12 months |
| **Maintenance Cost per Active Machine** | TotalCost / COUNT(active machines) | Aggregated | Simple average cost per machine |
| **Repair Order Cost Impact** | SUM(actualRepairCost) WHERE status IN (COMPLETED_SERVICEABLE, SCRAPPED) | `SparePartRepairOrder.actualRepairCost` | Separate from request costs |

### 2.2 Reliability KPIs

| KPI | Formula | Data Sources | Notes |
|-----|---------|-------------|-------|
| **MTTR (Mean Time To Repair)** | AVG(durationMinutes) WHERE endTime NOT NULL AND cancelledAt IS NULL AND durationMinutes NOT NULL | `DowntimeLog.durationMinutes` | Already implemented — reuse |
| **MTBF (Mean Time Between Failures)** | (lastEvent.startTime − firstEvent.startTime) / (totalEvents − 1) | `DowntimeLog.startTime` | Already implemented — reuse. Label as "approximate" |
| **Total Downtime** | SUM(durationMinutes) WHERE cancelledAt IS NULL | `DowntimeLog.durationMinutes` | Already implemented — reuse |
| **System Availability (Approximate)** | (TotalPeriodHours − TotalDowntimeHours) / TotalPeriodHours × 100 | `DowntimeLog.durationMinutes` + period bounds | **Labeled `approximateAvailability`** — assumption: 24/7 operations |
| **Downtime by Machine** | GROUP BY machineId, SUM(durationMinutes) | `DowntimeLog` | Already implemented — reuse |
| **Downtime by Cause** | GROUP BY failureCause, SUM(durationMinutes) | `DowntimeLog.failureCause` | Already implemented — reuse |
| **Downtime by Production Line** | GROUP BY machine → productionLineId, SUM(durationMinutes) | `DowntimeLog` + `Machine` | Already implemented — reuse |
| **Repeat Failure Rate** | COUNT(isRepeatFailure = true) / COUNT(total) × 100 | `DowntimeLog.isRepeatFailure` | New calculation |
| **Emergency Response Time** | AVG(responseStartedAt − startTime) WHERE both NOT NULL | `DowntimeLog.startTime`, `responseStartedAt` | Already implemented — reuse |
| **Avg Request Completion Time** | AVG(endDate − startDate) WHERE COMPLETED AND both timestamps NOT NULL | `MaintenanceRequest.startDate`, `endDate` | Already in MaintenanceDashboardService |
| **Avg Response Time (SLA)** | AVG( responseDueAt − createdAt ) WHERE responseDueAt NOT NULL | `MaintenanceRequest.createdAt`, `responseDueAt` | New |
| **Avg Repair Time (SLA)** | AVG( completeDueAt − startDueAt ) WHERE both NOT NULL | `MaintenanceRequest.startDueAt`, `completeDueAt` | New |

### 2.3 Schedule Compliance KPIs

| KPI | Formula | Data Sources | Notes |
|-----|---------|-------------|-------|
| **PM Schedule Compliance Rate** | COUNT(COMPLETED preventive requests in period) / COUNT(schedules due in period) × 100 | `MaintenanceRequest` (type=PREVENTIVE, status=COMPLETED) + `MaintenanceSchedule` | New |
| **Overdue Schedules** | COUNT(ACTIVE schedules WHERE endDate < now) | `MaintenanceSchedule` | Already in dashboard |
| **Upcoming Schedules (7/30 day)** | COUNT(ACTIVE schedules WHERE endDate BETWEEN now AND now+N days) | `MaintenanceSchedule` | Already in reports |
| **Compliance Trend (Monthly)** | COUNT(COMPLETED preventive) / COUNT(due) by month | `MaintenanceRequest` + `MaintenanceSchedule` | New |

### 2.4 Operational KPIs

| KPI | Formula | Data Sources | Notes |
|-----|---------|-------------|-------|
| **PM vs CM Ratio** | COUNT(type=PREVENTIVE) / COUNT(type=CORRECTIVE) × 100 | `MaintenanceRequest.type` | New |
| **Emergency %** | COUNT(isEmergency=true) / COUNT(total) × 100 | `MaintenanceRequest.isEmergency` | New |
| **Open Backlog** | COUNT(status IN (OPEN, IN_PROGRESS)) | `MaintenanceRequest.status` | Already in dashboard |
| **Backlog Trend (Monthly)** | COUNT(open) by month | `MaintenanceRequest` | New — by createdAt month |
| **SLA Overdue %** | COUNT(slaStatus=OVERDUE) / COUNT(total WITH slaStatus NOT NULL) × 100 | `MaintenanceRequest.slaStatus` | New |

## 3. New API Endpoints

### Reports Module Enhancements (existing controller)

| Method | Endpoint | Purpose | New? |
|--------|----------|---------|------|
| GET | `/reports/maintenance/costs/analysis` | Consolidated cost breakdown with trends | **NEW** |
| GET | `/reports/maintenance/costs/by-machine` | Cost grouped by machine | **NEW** |
| GET | `/reports/maintenance/costs/by-type` | Cost by request type (CM/PM/EM) | **NEW** |
| GET | `/reports/maintenance/kpi-overview` | All KPIs consolidated in one endpoint | **NEW** |
| GET | `/reports/maintenance/schedule-compliance` | PM compliance rate + trend | **NEW** |
| GET | `/reports/maintenance/backlog-trend` | Open request backlog by month | **NEW** |
| GET | `/maintenance/reliability/repeat-failure-rate` | Repeat failure % | **NEW** |
| GET | `/maintenance/reliability/availability` | Approximate system availability | **NEW** |
| GET | `/maintenance/reliability/sla-times` | Avg response/repair time | **NEW** |

### Reuse Existing Endpoints (no change needed)

- `GET /maintenance/reliability/mttr`
- `GET /maintenance/reliability/mtbf`
- `GET /maintenance/reliability/total-downtime`
- `GET /maintenance/reliability/downtime-by-machine`
- `GET /maintenance/reliability/downtime-by-cause`
- `GET /maintenance/reliability/downtime-by-line`
- `GET /maintenance/reliability/repeat-failures`
- `GET /maintenance/reliability/emergency-response-time`
- `GET /maintenance/reliability/top-machines`
- `GET /maintenance/reliability/top-causes`
- `GET /maintenance/dashboard/summary`
- `GET /maintenance/dashboard/cost-kpis`

## 4. New Frontend Pages

| Route | Title | Content |
|-------|-------|---------|
| `/admin/reports/maintenance/kpis` | Maintenance KPIs Overview | All KPI cards in one page (cost, reliability, compliance, operational) |
| `/admin/reports/maintenance/costs` | Enhanced: add consolidated cost analysis tab to existing cost report | Cost breakdown by machine/type/monthly trend tables |
| (New tab would be cleaner as separate page) | — | — |

Actually, simpler approach: Add **one new dedicated page** at `/admin/reports/maintenance/kpis` that shows all KPIs, plus add **cost analysis endpoints** to the reports API and enhance the existing cost report page to show the additional breakdowns.

## 5. No-Schema Constraint

All KPI calculations must use existing schema fields only. No new columns, tables, or enums.

## 6. i18n Keys Required

New keys needed in `maintenance.ts` EN/AR:

| Key | EN Default | AR Default |
|-----|-----------|------------|
| `kpiOverview` | Maintenance KPIs Overview | نظرة عامة على مؤشرات الصيانة |
| `totalMaintenanceCost` | Total Maintenance Cost | إجمالي تكلفة الصيانة |
| `costByType` | Cost by Request Type | التكلفة حسب نوع الطلب |
| `costByMachine` | Cost by Machine | التكلفة حسب الماكينة |
| `costByLine` | Cost by Production Line | التكلفة حسب خط الإنتاج |
| `monthlyCostTrend` | Monthly Cost Trend | اتجاه التكلفة الشهرية |
| `partsCostTrend` | Parts Cost Trend | اتجاه تكلفة قطع الغيار |
| `approxAvailability` | Availability (Approx) | التوفر (تقريبي) |
| `repeatFailureRate` | Repeat Failure Rate | معدل الأعطال المتكررة |
| `pmCmRatio` | PM / CM Ratio | نسبة الصيانة الوقائية/التصحيحية |
| `emergencyPercentage` | Emergency % | نسبة الطوارئ |
| `slaOverduePercentage` | SLA Overdue % | نسبة تجاوز SLA |
| `avgResponseTime` | Avg Response Time | متوسط وقت الاستجابة |
| `avgRepairTime` | Avg Repair Time | متوسط وقت الإصلاح |
| `scheduleCompliance` | Schedule Compliance | الالتزام بالجدول |
| `complianceRate` | Compliance Rate | معدل الالتزام |
| `complianceTrend` | Compliance Trend | اتجاه الالتزام |
| `maintenanceCostPerMachine` | Cost per Active Machine | التكلفة لكل ماكينة نشطة |
| `repairOrderCostImpact` | Repair Order Cost Impact | تأثير تكلفة أوامر الإصلاح |
| `correctiveMaintenance` | Corrective Maintenance | الصيانة التصحيحية |
| `preventiveMaintenance` | Preventive Maintenance | الصيانة الوقائية |
| `emergencyMaintenance` | Emergency Maintenance | الصيانة الطارئة |
| `totalPeriod` | Total Period | الفترة الإجمالية |
| `events` | Events | أحداث |
| `hours` | Hours | ساعات |
| `minutes` | Minutes | دقائق |
| `hoursShort` | h | سا |
| `costReport` | Cost Analysis Report | تقرير تحليل التكاليف |
| `kpiReport` | KPI Report | تقرير مؤشرات الأداء |
| `reliabilityReport` | Reliability Report | تقرير الاعتمادية |
| `complianceReport` | Compliance Report | تقرير الالتزام |
| `backlogTrend` | Backlog Trend | اتجاه الأعمال المتراكمة |
| `noCostData` | No cost data available | لا توجد بيانات تكلفة متوفرة |
| `noDowntimeData` | No downtime data available | لا توجد بيانات توقف متوفرة |
| `noKpiData` | No KPI data available | لا توجد بيانات مؤشرات متوفرة |
| `notAvailable` | N/A | غير متاح |

## 7. Permissions

| Permission | Scope | Notes |
|-----------|-------|-------|
| `reports.maintenance:read` | Existing — covers new maintenance report endpoints | No new permission needed |
| `maintenance.reliability:read` | Existing — covers new reliability endpoints | No new permission needed |

## 8. Acceptance Criteria

1. All new endpoints return correctly calculated KPIs
2. No duplicate cost counting (PartUsage is primary; RequiredPart only supplement)
3. Reliability KPIs match existing dashboard calculations
4. Frontend pages load without 404
5. i18n keys exist in both EN and AR
6. All existing functionality continues to work
7. Build/typecheck passes
8. Git status clean
