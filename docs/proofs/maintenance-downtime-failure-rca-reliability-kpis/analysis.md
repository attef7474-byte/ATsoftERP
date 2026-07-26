# Maintenance Downtime + Failure Analysis + RCA + Reliability KPIs — Current State Audit

## Date
2026-07-26

## Scope
Audit of current schema, backend, frontend, permissions, and i18n for downtime, failure, RCA, and reliability KPI support.

---

## Matrix

| Area | Model/Table | Page | API | Current behavior | Missing behavior | Needs migration | Needs backend | Needs frontend | Decision | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Downtime logging | DowntimeLog | downtime-logs/list, new, [id], [id]/edit, current, analysis, by-machine | CRUD + start/end/classify/close/cancel | Full CRUD with start/end timestamps, duration calc, free-text reason, machine + request links | No structured failure cause, no RCA fields, no reliability KPI | Yes | Yes | Yes | Add failure/RCA fields to DowntimeLog, add RCA+KPI endpoints | PENDING |
| Downtime → Request link | MaintenanceRequest.downtimeLogs, requestId | Request detail shows downtime | Emergency auto-creates downtime log | Emergency requests auto-create downtime log entry; `downtimeHours` aggregated from logs | No preventive/planned downtime link | No | No | No | Already works for emergency | ADEQUATE |
| Failure cause | DowntimeLog.reason | downtime detail shows reason | classify endpoint writes reason+notes | Free-text reason field with classify endpoint | No structured failure cause, no failure category lookup | Yes | Yes | Yes | Add failureCause + failureCategory fields | PENDING |
| Failure category | None | None | None | No failure category support | No category model or field | Yes | Yes | Yes | Add failureCategory string field | PENDING |
| Root cause analysis (RCA) | None | None | None | No RCA support anywhere | No rootCause, correctiveAction, preventiveAction, rcaStatus | Yes | Yes | Yes | Add all RCA fields to DowntimeLog | PENDING |
| Corrective action | None | None | None | No corrective action support | No correctiveAction field | Yes | Yes | Yes | Add correctiveAction field | PENDING |
| Preventive action | None | None | None | No preventive action support | No preventiveAction field | Yes | Yes | Yes | Add preventiveAction field | PENDING |
| MTTR | None (i18n keys exist) | None | None | i18n keys defined (`downtimeAnalysis.mttr`) but unused | No MTTR computation endpoint or UI | No | Yes | Yes | Add MTTR computation to dashboard | PENDING |
| MTBF | None (i18n keys exist) | None | None | i18n keys defined (`downtimeAnalysis.mtbf`) but unused | No MTBF computation endpoint or UI | No | Yes | Yes | Add MTBF computation to dashboard | PENDING |
| Repeat failure detection | None | None | None | No repeat failure detection | No isRepeatFailure flag or group tracking | Yes | Yes | Yes | Add isRepeatFailure + repeatedFailureGroupId | PENDING |
| Production impact | None | None | None | No production impact tracking | No machineStopped or productionImpact fields | Yes | Yes | Yes | Add machineStopped + productionImpact | PENDING |
| Detection/response/repair timestamps | None | None | None | No structured timestamps for MTTR calc | No detectedAt, responseStartedAt, repairStartedAt, repairCompletedAt | Yes | Yes | Yes | Add timestamps to DowntimeLog | PENDING |
| Downtime by machine | DowntimeLog | downtime-logs/by-machine, analysis page, machine downtime tab | GET /by-machine/:machineId, GET /analysis | By-machine grouping exists in analysis + dedicated by-machine page | No dedicated per-machine total downtime card in dashboard | No | Yes | Yes | Add per-machine downtime KPIs to dashboard | PENDING |
| Downtime by production line | DowntimeLog (via machine→productionLine) | Downtime report has productionLine filter | None | Production line filter exists on report page, but no API endpoint | No dedicated by-production-line API | No | Yes | Yes | Add by-production-line KPI endpoint | PENDING |
| Downtime by cause/reason | DowntimeLog | analysis page has by-reason table | GET /analysis returns byReason | Analysis page groups by reason field | No structured cause grouping | Yes | Yes | Yes | Group by failureCause instead of reason | PENDING |
| Downtime by personnel | DowntimeLog→MaintenanceRequest→assignments | None | None | No personnel link to downtime | No by-personnel API | No | Yes | Yes | Add by-personnel endpoint using request assignments | PENDING |
| Dashboard cards | MaintenanceDashboard | dashboard/page.tsx | GET /maintenance/dashboard/summary | Cards for open, critical, overdue, machines, current downtime, upcoming, costs, completion rate | No MTTR, MTBF, total downtime, top machines, top causes cards | No | Yes | Yes | Add reliability KPI cards | PENDING |
| Reports | Reports/Maintenance | reports/maintenance/downtime | reports.maintenance:read | Full downtime report with filters and export | No reliability KPI report section | No | Yes | Yes | Add reliability section to reports | PENDING |

---

## Detailed Findings

### 1. Schema
- **DowntimeLog** (lines 1435-1457): Has id, machineId, requestId, startTime, endTime, durationMinutes, reason, notes, cancelledAt, createdAt, updatedAt
- **No** failureCause, failureCategory, rootCause, correctiveAction, preventiveAction, detectedAt, responseStartedAt, repairStartedAt, repairCompletedAt, isRepeatFailure, repeatedFailureGroupId, machineStopped, productionImpact, rcaStatus, rcaCompletedByUserId, rcaCompletedAt
- **No** FailureCauseCategory or FailureCause reference tables
- **User** model (line 361) has no relation for RCA completion

### 2. Backend
- **DowntimeLogsController**: CRUD + start, end, close, cancel, classify, current, analysis, byMachine, logSummary — 14 endpoints
- **DowntimeLogsService**: Full service with all methods — 329 lines
- **No** RCA endpoints (setFailureCause, setRootCause, setCorrectiveAction, setPreventiveAction, completeRCA)
- **No** reliability KPI endpoints (MTTR, MTBF, top downtime machines, downtime by cause, repeat failures)
- **DTOs**: CreateDowntimeLogDto has machineId (req), requestId, startTime, endTime, durationMinutes, reason (req), notes — no failure/RCA fields

### 3. Frontend
- **DowntimeLog type**: 12 fields (no failure/RCA fields)
- **Downtime detail page**: Shows machine, request, status, reason, start/end time, duration, notes — no failure/RCA section
- **Dashboard**: 8 KPI cards — no reliability/MTTR/MTBF cards
- **i18n**: MTBF/MTTR/availability keys exist in `downtimeAnalysis` namespace but are unused

### 4. Permissions
- **downtime-log**: create, read, update, delete, close, cancel, startDowntime, endDowntime, classify, current, analysis, byMachine, logSummary
- **No** failure/RCA/reliability permission keys
- **maintenance-dashboard**: summary, openRequests, overdueTasks, upcomingPM, currentDowntime, recentActivity, costSummary, partsUsage, accountabilityKpis — no reliability KPIs

---

## Proposed Changes

### Schema Additions (all nullable, non-destructive)
| Field | Type | Model | Notes |
|---|---|---|---|
| failureCause | String? | DowntimeLog | Structured failure cause description |
| failureCategory | String? | DowntimeLog | Category like MECHANICAL, ELECTRICAL, etc. |
| rootCause | String? | DowntimeLog | Root cause analysis result |
| correctiveAction | String? | DowntimeLog | Corrective action taken |
| preventiveAction | String? | DowntimeLog | Preventive action recommended |
| detectedAt | DateTime? | DowntimeLog | When failure was detected |
| responseStartedAt | DateTime? | DowntimeLog | When response started |
| repairStartedAt | DateTime? | DowntimeLog | When repair started |
| repairCompletedAt | DateTime? | DowntimeLog | When repair completed |
| isRepeatFailure | Boolean? | DowntimeLog | Whether this is a repeat failure |
| repeatedFailureGroupId | String? | DowntimeLog | Group ID for linking repeat failures |
| machineStopped | Boolean? | DowntimeLog | Whether machine was stopped |
| productionImpact | String? | DowntimeLog | Description of production impact |
| rcaStatus | String? | DowntimeLog | PENDING / IN_PROGRESS / COMPLETED |
| rcaCompletedByUserId | String? | DowntimeLog | User who completed RCA |
| rcaCompletedAt | DateTime? | DowntimeLog | When RCA was completed |

### New Backend Endpoints
| Method | Route | Permission | Purpose |
|---|---|---|---|
| PATCH | /maintenance/downtime-logs/:id/failure-cause | downtime-log:update | Set failure cause + category |
| PATCH | /maintenance/downtime-logs/:id/rca | downtime-rca:update | Set root cause, corrective/preventive action |
| PATCH | /maintenance/downtime-logs/:id/rca/complete | downtime-rca:complete | Mark RCA complete |
| GET | /maintenance/downtime-logs/:id/rca | downtime-log:read | Get RCA details |
| GET | /maintenance/reliability/mttr | maintenance-reliability:read | MTTR by machine/line/date |
| GET | /maintenance/reliability/mtbf | maintenance-reliability:read | MTBF by machine/line/date |
| GET | /maintenance/reliability/total-downtime | maintenance-reliability:read | Total downtime minutes |
| GET | /maintenance/reliability/downtime-by-machine | maintenance-reliability:read | Downtime grouped by machine |
| GET | /maintenance/reliability/downtime-by-line | maintenance-reliability:read | Downtime by production line |
| GET | /maintenance/reliability/downtime-by-cause | maintenance-reliability:read | Downtime by failure cause |
| GET | /maintenance/reliability/repeat-failures | maintenance-reliability:read | Repeat failure detection |
| GET | /maintenance/reliability/emergency-response-time | maintenance-reliability:read | Avg emergency response time |
| GET | /maintenance/reliability/top-machines | maintenance-reliability:read | Top machines by downtime |
| GET | /maintenance/reliability/top-causes | maintenance-reliability:read | Top causes by downtime |

### New Permissions
| Key | Module | Action |
|---|---|---|
| downtime-rca:update | downtime-rca | update |
| downtime-rca:complete | downtime-rca | complete |
| maintenance-reliability:read | maintenance-reliability | read |

### New i18n Keys
See frontend-proof.md for full list.

---

## Conclusion
Current state has basic downtime logging but no failure analysis, RCA, or reliability KPI support. All proposed changes are safe nullable additions that preserve existing data. No destructive operations. No HR/Finance/BI/Inventory activation.
