# ATsofterp UX-1B-2D — Maintenance Analytics, KPIs and Dashboard

- Status: **COMPLETE**
- Date: 2026-08-02
- Branch: `main` (5 commits ahead of `origin/main`)

## 1. Task Scope

Complete the maintenance analytics / KPIs / dashboard vertical slice:

- Backend maintenance dashboard and reliability KPI endpoints scoped to the active
  company/branch operational context.
- Reports (maintenance requests, downtime, costs, schedules, KPI overview, backlog
  trend, schedule compliance) scoped and connected to the same context.
- Report CSV/Excel export endpoints working for tabular reports.
- Frontend dashboard pages connected to the real scoped API with loading, empty,
  and error states.
- Meaningful tests for dashboard, reliability, and reports services.
- Runtime proof across the real `Frontend → API → Service → Database` path,
  including cross-tenant isolation checks.
- No mock data, no placeholders, no disabled validation.

## 2. Root Cause Fixed This Session

Report CSV/Excel export of multi-segment endpoints (e.g. `maintenance/requests`)
returned `404 {"message":"No data to export"}` while the equivalent report endpoint
returned rows.

- Cause: NestJS 11 / Express 5 (path-to-regexp v8.4.2) captures the `*endpoint`
  wildcard as an **array** of segments (`["maintenance","requests"]`) for
  multi-segment paths. The export service switch then matched no string case and
  returned `null` → `404`. Single-segment endpoints (e.g. `machine-log`) arrived as
  strings and worked.
- Fix: normalize the param in `ReportsController.exportCsv`/`exportExcel`
  (`Array.isArray(endpoint) ? endpoint.join('/') : endpoint`) before delegating, and
  pass the active context to the export service.
- Verified with path-to-regexp v8.4.2 directly and with live HTTP probes (encoded
  slash `maintenance%2Frequests` previously returned 200; now plain
  `maintenance/requests` returns 200 too).

## 3. Files Created

- `apps/api/src/modules/factory/maintenance/maintenance-dashboard/maintenance-dashboard.service.spec.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-reliability/maintenance-reliability.service.spec.ts`
- `apps/api/src/modules/reports/services/maintenance-reports.service.spec.ts`
- `ux1b2d-proof.ps1` (runtime proof script)
- `docs/proofs/atsofterp-ux1b2d-maintenance-analytics-kpis-dashboard-report.md` (this report)

## 4. Files Modified

Task-created/modified this session:

- `apps/api/src/modules/reports/reports.controller.ts` — normalized wildcard export
  endpoint params (`string | string[]`), passed active context into
  `exportCsv`/`exportExcel`.

Pre-existing dirty-tree changes (UX-1B-2C baseline + UX-1B-2D scoping work already
present when the task resumed) that were verified, not re-created:

- `apps/api/src/modules/factory/maintenance/maintenance-dashboard/maintenance-dashboard.service.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-dashboard/maintenance-dashboard.controller.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-reliability/maintenance-reliability.service.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-reliability/maintenance-reliability.controller.ts`
- `apps/api/src/modules/factory/maintenance/downtime-logs/downtime-logs.service.ts`
- `apps/api/src/modules/reports/reports.service.ts`
- `apps/api/src/modules/reports/services/maintenance-reports.service.ts`
- `apps/api/src/modules/reports/services/dashboard-reports.service.ts`
- `apps/api/src/modules/reports/services/report-export.service.ts`
- `apps/api/prisma/schema.prisma`
- Frontend: `apps/web/src/app/admin/maintenance/dashboard/*` (including
  `cost-kpis/page.tsx` with the `topRequestsByCost` contract), `reliability/mttr`,
  `apps/web/src/app/admin/reports/maintenance/*`
- i18n: `apps/web/src/lib/i18n/locales/{ar,en}/maintenance.ts`

## 5. Database Models / Migrations

- No new migration was created by UX-1B-2D.
- `prisma validate` passes against the existing dirty-tree schema.
- No destructive or reset operations were performed.

## 6. API Endpoints Changed

- `GET /reports/export/csv/*endpoint` — fixed multi-segment endpoint support
  (`maintenance/requests`, `maintenance/downtime`, `machine-log`, …), now context-scoped.
- `GET /reports/export/excel/*endpoint` — same fix and scoping.
- All scoped endpoints verified live (list in section 11).

## 7. Frontend Routes

- No new routes added this session.
- Verified existing dashboard/report pages are wired to the scoped API:
  `/admin/maintenance/dashboard` (summary, cost-kpis, overdue, upcoming-preventive,
  sla-overdue, current-downtime, open-requests, critical, machines-under-maintenance,
  sla-escalated), `/admin/maintenance/reliability/mttr`,
  `/admin/reports/maintenance/{kpis,costs,downtime,requests,schedules}`.

## 8. Permissions

- No new permission keys. Export and report routes reuse existing keys
  (`reports.maintenance:read`, `reports.inventory:read`, `reports.barcodes:read`).

## 9. Tests

Focused Jest (3 suites, 28 tests) — **ALL PASS**:

```
PASS maintenance-dashboard.service.spec.ts
PASS maintenance-reliability.service.spec.ts
PASS maintenance-reports.service.spec.ts
Test Suites: 3 passed, 3 total
Tests:       28 passed, 28 total
```

Full API Jest: **268 tests passed**, 23 suites passed, 18 suites failed — the 18
failing suites are pre-existing empty (0-byte) placeholder specs in unrelated
domains (workflow-engine, request-policy, request-notifications, auth.service,
roles.guard, numbering.helpers, condition-evaluator, template-rendering, iot/mqtt,
hr-requests, business-rules). Not caused by and not touched by this task.

## 10. Build and Validation Results

| Check | Result |
| --- | --- |
| `prisma validate` | PASS |
| API `tsc --noEmit` | PASS |
| Web `next build` | PASS |
| `i18n:check` (3531 keys EN/AR) | PASS |
| `raw-keys:check` | PASS |
| `git diff --check` | PASS (exit 0, LF→CRLF warnings only) |

## 11. Runtime Proof Results

Live API `http://localhost:4000/api/v1` (restarted to load the controller fix).
Tenant A = `COM-000001`/HQ, Tenant B = `QA_CORP`/QA_BRN.

**19 passed, 0 failed, 19 total.**

- Login with admin → OK; machine lists: A=2, B=0.
- Dashboard summary: open=6, critical=0, totalCost=0, mttr=148.63h,
  mtbf=0.704h, totalDowntime=2675.34h.
- Reliability KPIs (days=365, 18 events each): mttr=148.63h, mtbf=0.704h,
  totalDowntime=2675.34h, repeatFailureRate=0, availability=47.67%.
- Cost analytics: `reports/maintenance/costs/analysis` totalCost=0, machines=1,
  costByMachine rows=2; `dashboard/cost-kpis` totalCost=0, monthly=0, top=0.
- Reports: `reports/maintenance/requests` total=69 rows=5;
  `kpi-overview` cards=18; `backlog-trend` byMonth=2; `schedule-compliance` cards=6.
- Exports: CSV `maintenance/requests` → 200, 3540 bytes (BOM-prefixed);
  Excel `maintenance/requests` → 200, 8097 bytes; CSV/Excel `maintenance/downtime` → 200.

## 12. Tenant-Isolation Proof

Tenant B attempted to access tenant A's machine (`cmrx68p3i0000r095f0kcrqnz`).
All attempts rejected with 404 (record-not-found canonical error):

- `GET /maintenance/machines/{A-id}` under B → 404
- `GET /maintenance/dashboard/open-requests?machineId={A-id}` under B → 404
- `GET /maintenance/reliability/mttr?machineId={A-id}` under B → 404
- `GET /reports/maintenance/requests?machineId={A-id}` under B → 404
- Tenant B machine list contains no tenant-A machine (leak = false)

Note: tenant B has no machines, so isolation was proven in the reverse direction
(B attempting to reach A's record) plus list non-leak. This exercises the same
machine-scope predicate used in both directions.

## 13. Known Limitations

- Export of summary-shaped endpoints (`maintenance/overview`, `kpi-overview`,
  `backlog-trend`, `schedule-compliance`, `costs/analysis`) returns
  `404 {"message":"No data to export"}` because the export service only serializes
  `rows`-shaped tabular reports. This is pre-existing design behavior, not a
  regression from this fix. Tabular exports (requests, downtime, machine-log) work.
- The frontend currently does not invoke the report export endpoints (only the
  audit export page uses `export/csv`); the endpoints are verified via API.
- `topRequestsByCost` / cost KPIs return 0 totals in the seed database (no cost
  records exist yet for the sampled machines); endpoints, shapes, and pagination
  are verified.

## 14. Pre-Existing Issues Encountered

- 18 empty placeholder Jest suites (see section 9). Left untouched.
- Git working tree is intentionally dirty (63 modified, 15 untracked) carrying the
  UX-1B-2C baseline and UX-1B-2D scoping work; no reset/cleanup was performed per
  task instruction.

## 15. Git Status

- Branch: `main`, 5 commits ahead of `origin/main`.
- 63 modified files, 15 untracked files (includes new specs, proof script, this
  report, the UX-1B-2C migration directory).
- No files staged, no commits created (commit only on explicit request).

## 16. Commit and Tag Status

- No commits, pushes, merges, rebases, or tags were performed.
