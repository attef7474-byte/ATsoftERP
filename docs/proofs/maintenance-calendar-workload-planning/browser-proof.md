## Browser UI Proof — Maintenance Calendar & Workload Planning

- **File**: `browser-proof.pw.ts`
- **Date**: 2026-07-26
- **Result**: 38/38 PASSED

### Test Summary

| # | Test | Status | Time |
|---|------|--------|------|
| T01 | Login works | PASS | 4.5s |
| T02 | Arabic mode works | PASS | 7.4s |
| T03 | English mode works | PASS | 7.5s |
| T04 | No raw i18n keys visible | PASS | 7.4s |
| T05 | No console errors | PASS | 7.5s |
| T06 | No API network failures | PASS | 7.4s |
| T07 | No ChunkLoadError | PASS | 7.4s |
| T08 | No _next/static failures | PASS | 7.4s |
| T09 | Calendar route returns 200 | PASS | 7.4s |
| T10 | Calendar has content or empty state | PASS | 7.4s |
| T11 | Preventive section loads clean | PASS | 7.4s |
| T12 | Emergency section loads clean | PASS | 7.4s |
| T13 | Link navigation opens request/schedule | PASS | 7.4s |
| T14 | Date range filter interaction | PASS | 7.4s |
| T15 | Personnel filter interaction | PASS | 7.4s |
| T16 | Machine filter loads clean | PASS | 7.4s |
| T17 | Status/priority/SLA filter loads clean | PASS | 7.4s |
| T18 | Workload dashboard returns 200 | PASS | 7.4s |
| T19 | Unassigned planning page loads clean | PASS | 7.4s |
| T20 | Overdue planning page loads clean | PASS | 7.4s |
| T21 | SLA due planning page loads clean | PASS | 7.5s |
| T22 | Personnel workload rendered | PASS | 7.4s |
| T23 | Machine workload loads clean | PASS | 7.4s |
| T24 | Production line workload loads clean | PASS | 7.4s |
| T25 | Planning/unassigned page loads clean | PASS | 7.4s |
| T26 | Planned dates interaction | PASS | 7.5s |
| T27 | Reschedule interaction | PASS | 7.4s |
| T28 | Assign work page loads clean | PASS | 7.4s |
| T29 | Notifications/SLA alerts page loads clean | PASS | 9.4s |
| T30 | Spare parts workflow loads clean | PASS | 9.4s |
| T31 | Preventive schedules loads clean | PASS | 9.4s |
| T32 | Emergency requests loads clean | PASS | 9.4s |
| T33 | Checklist items loads clean | PASS | 9.4s |
| T34 | Downtime logs loads clean | PASS | 9.4s |
| T35 | Requests list loads clean | PASS | 9.4s |
| T36 | Requests list (edit prefill) loads clean | PASS | 9.4s |
| T37 | Machines list loads clean | PASS | 9.4s |
| T38 | Screenshots disabled by user | PASS | 2ms |

### Collector Summary
- Console errors: **0**
- Chunk load errors: **0**
- Failed API calls: **0**
- Failed _next/static: **0**
- Raw i18n keys leaked: **0**

### Validated Routes
- `/admin/maintenance/calendar` — 200
- `/admin/maintenance/workload` — 200
- `/admin/maintenance/planning/unassigned` — 200
- `/admin/maintenance/planning/overdue` — 200
- `/admin/maintenance/planning/sla-due` — 200
- `/admin/maintenance/schedules` — 200
- `/admin/maintenance/requests` — 200
- `/admin/maintenance/spare-parts` — 200
- `/admin/maintenance/checklist-items` — 200
- `/admin/maintenance/downtime-logs` — 200
- `/admin/maintenance/machines` — 200
