# Production live monitoring — implementation and closeout proof (2026-11-19)

Starting baseline: branch `feat/production-live-monitoring`, `HEAD = origin/main = 2065ef1d8cee7f3a7ac48ec6515197e5006fa12a`, divergence 0/0. All 25 implementation files were already staged by the previous session and were preserved unchanged at resume. Gitignored pre-release rollback artifacts (`.tmp/`, `backups/`, `tools/backup/backups/`, and `.tmp/production-monitoring-20261119/pre-existing-artifacts/`) were preserved.

## 1. Architecture and authority

Read-only endpoint: `GET /api/v1/reports/production/monitoring`, guarded by `JwtAuthGuard`, `PermissionsGuard` and the existing `production-analytics:read` key. The controller is thin; `ProductionMonitoringService` composes bulk reads over `ProductionRun`, `ProductionOutputEvent`, `ProductionMeasurementPoint` and `ProductionLine`/`Machine` operational data. No table, migration, permission key, audit mutation or business writer was added.

There is exactly one output-calculation authority: `deriveRunTotals` in `apps/api/src/modules/factory/production-runs/production-runs.util.ts`. It was extended with an optional `OutputWindow`; analytics and monitoring both call it. `deriveRunOutputByUnit` is a thin unit-partitioned projection over that same function, and `addUnitOutputs` only adds totals for identical units. No second calculation path exists.

## 2. Time windows and timezone

Canonical analytics timezone authority is `ANALYTICS_TIMEZONE = 'UTC'` (`production-analytics.constants.ts`) and is unchanged. The monitoring response returns `timezone: 'UTC'` and `generatedAt`; the Web page renders timestamps with that returned timezone, not the browser clock.

* `NOW` — cumulative authoritative output of every currently `RUNNING`/`PAUSED` run assigned to the resource.
* `CURRENT SHIFT` — from resolved shift start to the server generation instant.
* `TODAY` — from current UTC calendar day `00:00` to `generatedAt`.
* `MONTH TO DATE` — from first day of the current UTC month `00:00` to `generatedAt`.

Boundary and cross-day behaviour is proven in `production-monitoring.service.spec.ts` and in the preserved analytics regression test `capacityVariance() reuses the canonical output window and attributes corrections to original production`.

## 3. Shift resolution without audit writes

`resolveMonitoringShift` is a pure resolver. It shares the precedence helper `resolveCalendarDay` (`production-shifts/calendar-day.util.ts`) with the existing audited interactive resolver, but monitoring never calls the audited service. Calendar-entry overrides win over template days; non-working days yield no shift; active shift masters are the fallback. Yesterday and today are evaluated for overnight shifts (`20:00 → 04:00` is one window) with half-open membership `[from, to)`. More than one eligible active window is reported as `dataQuality.ambiguousShift` rather than guessed. Test: `honors calendar overrides and non-work days without logging a resolve mutation`.

## 4. Structured classification

Exact seeded `OperationType.code` values only — never resource names:

* `MANUFACTURING`, `EXTRUSION`, `FRYING`, `MIXING` → `MANUFACTURING`
* `PACKAGING`, `FILLING` → `PACKAGING`
* every other code, including null → `UNCLASSIFIED`

Machine operation type takes precedence over its parent line. `MachineCategory` is a configurable hierarchy without a canonical stage discriminator and is deliberately not interpreted. Unclassified resources remain visible under `غير مصنف / Unclassified`. The classification contract is tested for both grouping and name-independence.

## 5. Line, machine and unit aggregation

Line rows group by the run's `productionLineId`; machine rows group only by a recorded `machineId`. Output attached to a line with `machineId = null` is never copied into machine rows — it is exposed in `dataQuality.unassignedToMachine` and labelled `غير منسوب لماكينة / Unassigned to Machine`. Inaccessible machine references do not expose foreign resources and do not discard valid line output. Factory summary counts each run once via the line classification, independently of display projections. `PACK` and `KG` (or any incompatible units) are kept in separate `UnitOutput` rows; `addUnitOutputs` matches on the exact unit string and uses `Prisma.Decimal` addition. Tests cover mixed-unit resources, multiple runs, machine attribution and unassigned output.

## 6. Correction, reset and measurement-point semantics

Corrections are immutable events tied to `correctsEventId`. Window filtering uses the **original production event's** `occurredAt`, so a correction posted later but targeting an event outside the window cannot create false output in the current window. `netEventQuantities` subtracts corrections from the original event; `deriveRunTotals` never treats a correction or a reset as standalone positive production. Only `FINAL_OUTPUT` events on a measurement point with `isAuthoritativeFinal = true` contribute to headline output; intermediate points stay traceability-only. Tests: `applies corrections to the original output and ignores resets and non-authoritative measurement points`, `assigns a correction to its original production day`, and `uses the same corrected output authority for unit-safe window projection`.

## 7. Tenant and branch isolation

All operational reads use company and branch from the server's active context. Line, machine, shift, calendar, run, product-definition, measurement-point and correction references are all context-scoped. Company-wide machines follow the existing branch-null convention with their parent line constrained to the active scope. Client company/branch properties are rejected by the DTO (unknown fields are not accepted). Tests cover missing-context denial, client company/branch manipulation, foreign-company and foreign-branch resource denial, and permission allow/deny.

## 8. Frontend and polling

Route `/admin/production/monitoring` renders a factory summary plus manufacturing lines, packaging lines, packaging machines, other/unclassified resources, current products/runs/status, four unit-aware windows and last authoritative event time. Arabic/RTL and English/LTR key pairs are complete. The polling hook uses a 5,000 ms interval, an in-flight guard, `AbortController`, generation guards on context/scope change, suspend-while-hidden with immediate refresh on becoming visible, last-successful-data retention on transient errors, and a real manual refresh action. Navigation uses the existing `production-analytics:read` permission and the eight prior tabbed workspaces remain structurally tested.

## 9. Fresh verification results (resume session)

| Gate | Result |
| --- | --- |
| Focused API tests (monitoring, analytics, runs util, shift calendars) | **4 suites, 86 tests passed** |
| Focused Web tests (`production-monitoring*`) | **2 suites, 21 tests passed** |
| Full API regression | **229 suites, 4954 tests passed** |
| Full Web regression | **129 suites, 2413 tests passed** |
| API typecheck | PASS (`tsc --noEmit`) |
| Web typecheck | PASS (`tsc --noEmit`) |
| API isolated build | PASS (`tsc`) |
| Web isolated build | PASS (`next build`; monitoring route emitted) |
| Prisma validate | PASS (schema valid, 95 migrations present) |
| `prisma migrate status` | **HEALTHY — `Database schema is up to date!`** using root `.env` + `apps/api/prisma.config.ts` (authorized runtime connection); `NEW_MIGRATION=NO` |
| i18n check | PASS — 7359 EN / 7359 AR keys, 11525 literal `t()` keys resolved |
| UI baseline / permission UI / raw keys / credentials | PASS |
| `git diff --check` | PASS |

The earlier `P1011 TLS` failure was caused by invoking Prisma from the wrong working directory without the root `.env`; rerunning with the deployment's own config mechanism succeeded without schema changes.

The Web counts above are the final post-fix results after commit `98040b8cdd369fdafb85bd21222a9015e5091869`. The API code and API test results are unchanged from the feature commit `8d361b2b0cd58968e2fce5db965808b6c65ab856`. The post-fix Web gates re-run cleanly: focused Web 2 suites / 21 tests, full Web 129 suites / 2413 tests, Web typecheck PASS, Web build PASS (`FpwTzGnSPacuyQbSCc9GB`), i18n PASS, UI baseline PASS, and `git diff --check` PASS.

## 10. SQL read proof and live-data limitation

`sql-proof.ts` (gitignored temp proof harness) was rerun against the actual SQL Server database in read-only mode at closeout. Result: **PASS**, 11 active branch contexts, `businessWrites = 0`, `dashboardWrites = 0` for every context, 0 foreign-company/branch leaks, and independent SQL reconciliations matched the service projection for every resource/window/unit. 15 physical SQL reads per context; no write statement was emitted.

Exact live source counts: `ProductionRun` (non-deleted) = **4**, `ProductionOutputEvent` = **0**. No run currently qualifies for the active/output monitoring projection. Therefore:

```text
LIVE_NONZERO_OUTPUT_PROOF=NOT_AVAILABLE
LIVE_NONZERO_NOW_RECONCILIATION=NOT_PROVABLE_FROM_CURRENT_PRODUCTION_DATA
REASON=NO_CANONICAL_PRODUCTION_OUTPUT_EVENTS
AUTOMATED_FIXTURE_RECONCILIATION=PASS
LIVE_EMPTY_STATE_BROWSER_PROOF=PASS
```

No synthetic production events were created. Nonzero behaviour (windows, multiple runs, corrections, resets, authoritative points, machine/line attribution, mixed units) is proven by the automated fixtures, not by live production data.

## 11. Deployment and browser proof

`DEPLOYMENT_STATUS=COMPLETE`
`FEATURE_SHA=8d361b2b0cd58968e2fce5db965808b6c65ab856`
`FINAL_FIX_SHA=98040b8cdd369fdafb85bd21222a9015e5091869`
`DEPLOYED_SHA=98040b8cdd369fdafb85bd21222a9015e5091869`
`DEPLOYED_SOURCE=main`
`HEAD=origin/main=98040b8cdd369fdafb85bd21222a9015e5091869`, divergence `0/0`
`WEB_BUILD_ID=FpwTzGnSPacuyQbSCc9GB`
`DATABASE_WRITES=0`, `MIGRATION=NONE`

The exact final `main` SHA was deployed with the staged artifact-swap script `.tmp/production-monitoring-20261119/deploy-main-98040b8c.ps1`. State: `.tmp/production-monitoring-20261119/deployment-state-main-98040b8c.json`. Log: `.tmp/production-monitoring-20261119/deployment-main-98040b8c.log`. The previous deployed release (`8d361b2b…`) and its rollback artifacts were preserved under `.tmp/production-monitoring-20261119/release-main-98040b8c/rollback/`; the earlier release directory was not deleted. Services `ATsoftERP_API` and `ATsoftERP_Web` are Running. Health proof: `http://localhost:4000/api/v1/health` 200, `http://localhost:3000/api/v1/health` 200, `http://localhost:3000/admin/production/monitoring` 200, unauthenticated `http://localhost:4000/api/v1/reports/production/monitoring` 401.

Browser authentication used the already-valid local session JWT present in the browser profile (`sub` matched the displayed administrator, `exp` still valid). No password, token value, secret, or credential file was read into or emitted by this proof; no credential was disclosed and no database write was performed. UI credential re-entry was not repeated because a valid deployed-app session was already available.

`BROWSER_PROOF=PASS`

* Arabic/RTL: `/admin/production/monitoring` rendered with `lang="ar"`, `dir="rtl"`, Arabic labels including `مراقبة الإنتاج`, `ملخص المصنع`, `الإنتاج الآن`, `الوردية الحالية`, `إنتاج اليوم`, `إنتاج الشهر`, `خطوط التغليف`, `ماكينات التغليف`, `غير منسوب لماكينة`. Live empty-state data rendered as four unit-safe zeros with no synthetic events.
* English/LTR: the in-page language toggle produced `lang="en"`, `dir="ltr"` and English labels `Production Monitoring`, `Factory Summary`, `Now`, `Current Shift`, `Today`, `Month to Date`, `Packaging Lines`, `Packaging Machines`, `Unassigned to Machine`, with the same zero output.
* Five-second polling: 35 monitoring `GET /api/v1/reports/production/monitoring` requests were observed. Consecutive intervals were `4991–5009 ms` for 14 steady cycles; the two non-5-second deltas were an immediate refresh caused by the locale change and a manual refresh, both expected.
* Manual refresh: clicking the visible `Refresh` control emitted one additional monitoring `GET` which completed 200.
* Suspend/resume: with `document.hidden` forced true and `visibilitychange` dispatched, 0 monitoring requests occurred during a 12-second observation; restoring `document.hidden=false` and dispatching `visibilitychange` produced exactly one immediate 200 response.
* Read-only behavior: every monitoring request was HTTP `GET`; no POST/PATCH/DELETE write was emitted by the monitoring page. The only non-GET request in the whole page capture was the pre-existing `POST /api/v1/auth/context/validate` (201).
* Console: 0 error messages and 0 warning messages.
* Network: 0 failed requests, 0 unexpected 4xx/5xx responses, 0 failed chunks; captured requests were not truncated and none were dropped. The monitoring response body matched the service projection with `timezone: "UTC"`, one active `SHIFT-04` window, 4 lines, 4 machines, empty summary, and 0 events.
* Live nonzero output remains unavailable because the canonical `ProductionOutputEvent` table has 0 rows; no fake output was created. `LIVE_NONZERO_OUTPUT_PROOF=NOT_AVAILABLE`.

## 12. Browser-detected response-shape defect and fix

The first deployed browser proof exposed a real frontend defect: `useProductionMonitoring` typed the shared API client result as `{ data: ProductionMonitoringResponse }`, but `apps/web/src/lib/api.ts` returns the unwrapped JSON body. The HTTP requests were 200 and the SQL/service projection was correct, but `setData(response.data)` stored `undefined`, leaving the page permanently at `Loading...`. This was not visible in the earlier unit tests because the hook test mock incorrectly returned the same wrapper.

Fix in `apps/web/src/lib/use-production-monitoring.ts`: request `api.get<ProductionMonitoringResponse>` directly and call `setData(response)`. The hook test mock was corrected to the real unwrapped envelope and a dedicated regression test `consumes the unwrapped response body returned by the shared API client` was added. After this fix the real browser rendered the complete Arabic and English monitoring workspace. No API, schema, permission, audit, migration, or business-rule code changed.
