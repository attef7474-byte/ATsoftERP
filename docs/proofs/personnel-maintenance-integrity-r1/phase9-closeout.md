# Phase 9 closeout — Preventive Maintenance Due-Date Authority

Status: COMPLETE
Branch: `fix/personnel-maintenance-integrity-r1-integrated`
Proof database: `ATsoftERP_PERSONNEL_P78_20261122` (controlled disposable clone)
Production migration applied: NO
Production writes: NO
Secrets: REDACTED

## 1. Scope completed

Phase 9 established one canonical preventive due-date authority:

`effectiveDueDate = nextDueDate ?? startDate`

The same authority now drives Schedules list/detail, Schedule execute context, Upcoming, Overdue, Calendar, maintenance dashboard cards, operations dashboard due counts, maintenance reports, print models, and batch/manual generation boundaries. States remain `inactive`, `expired`, `overdue`, `dueSoon`, and `notDue`, reusing the existing 7/30-day horizons.

Generation is transactional and deterministic:

* Anchored cadence is derived from the schedule start; generation time never resets the cadence.
* `startDate` is never mutated.
* `lastGeneratedAt` is claimed with a conditional `updateMany` before request creation and `nextDueDate` advancement.
* A repeated manual generation for the same occurrence returns HTTP 409 and creates no second request, advancement, or audit event.
* Batch generation selects only schedules whose effective due is `<= now` and advances only the claimed occurrence.
* Existing sensitive `GENERATE` audit events are preserved; no new audit category was invented.

No schema migration was required. Existing `MaintenanceSchedule.startDate`, `nextDueDate`, `lastGeneratedAt`, and status fields were sufficient.

## 2. Files created

* `apps/api/src/modules/factory/maintenance/maintenance-schedules/schedule-due-authority.ts`
* `apps/api/src/modules/factory/maintenance/maintenance-schedules/schedule-due-authority.spec.ts`
* `docs/proofs/personnel-maintenance-integrity-r1/phase9-runtime-api-proof.json`
* `docs/proofs/personnel-maintenance-integrity-r1/phase9-runtime-browser-proof.json`
* `docs/proofs/personnel-maintenance-integrity-r1/phase9-validation-results.json`
* `docs/proofs/personnel-maintenance-integrity-r1/phase9-closeout.md`

## 3. Files modified

API:

* `apps/api/src/modules/factory/maintenance/maintenance-schedules/maintenance-schedules.service.ts`
* `apps/api/src/modules/factory/maintenance/maintenance-schedules/maintenance-schedules.service.spec.ts`
* `apps/api/src/modules/factory/maintenance/preventive-maintenance/preventive-maintenance.service.ts`
* `apps/api/src/modules/factory/maintenance/maintenance.service.ts`
* `apps/api/src/modules/factory/maintenance/maintenance-dashboard/maintenance-dashboard.service.ts`
* `apps/api/src/modules/factory/maintenance/maintenance-calendar-workload/maintenance-calendar-workload.service.ts`
* `apps/api/src/modules/dashboard/dashboard.service.ts`
* `apps/api/src/modules/factory/production/shift-handovers/shift-handovers.service.ts`
* `apps/api/src/modules/reports/services/dashboard-reports.service.ts`
* `apps/api/src/modules/reports/services/maintenance-reports.service.ts`

Web:

* `apps/web/src/app/admin/maintenance/schedules/page.tsx`
* `apps/web/src/app/admin/maintenance/schedules/[id]/page.tsx`
* `apps/web/src/app/admin/maintenance/schedules/[id]/execute/page.tsx`
* `apps/web/src/app/admin/maintenance/preventive/upcoming/page.tsx`
* `apps/web/src/app/admin/maintenance/preventive/overdue/page.tsx`
* `apps/web/src/app/admin/maintenance/preventive/calendar/page.tsx`
* `apps/web/src/app/admin/maintenance/dashboard/overdue/page.tsx`
* `apps/web/src/app/admin/maintenance/dashboard/upcoming-preventive/page.tsx`
* `apps/web/src/app/admin/reports/maintenance/schedules/page.tsx`
* `apps/web/src/components/print/maintenance-schedules-print.ts`
* `apps/web/src/lib/admin-types/maintenance.ts`
* `apps/web/src/lib/i18n/locales/en/maintenance.ts`
* `apps/web/src/lib/i18n/locales/ar/maintenance.ts`
* `apps/web/tests/maintenance-overdue-print.test.ts`
* `apps/web/tests/maintenance-upcoming-print.test.ts`
* `apps/web/tests/maintenance-schedules-print.test.ts`

Governance:

* `docs/governance/inspection-pitfalls-register.md`

## 4. Database models and migrations changed

None. No Prisma model, migration, constraint, or index was changed. Prisma format, validate, and generate were run with the authorized disposable-clone `DATABASE_URL` supplied only in the command environment.

## 5. API endpoints and consumers affected

* `GET /maintenance/schedules` and `GET /maintenance/schedules/:id` now expose API-derived `effectiveDueDate` and `dueStatus`.
* Manual `POST /maintenance/schedules/:id/generateRequest` rejects a future effective due with HTTP 409 and is idempotent per occurrence.
* `GET /preventive-maintenance/upcoming`, `GET /preventive-maintenance/overdue`, and `GET /preventive-maintenance/calendar` use the same due authority and DB predicates.
* `POST /preventive-maintenance/generateDueTasks` generates only effective-due occurrences and returns HTTP 201.
* `GET /dashboard/operations` and maintenance dashboard/report due cards use the same states and horizons.
* Calendar workload, shift handover, and maintenance report consumers use the canonical helper instead of raw `startDate` comparisons.

## 6. Frontend routes affected

* `/admin/maintenance/schedules`
* `/admin/maintenance/schedules/[id]`
* `/admin/maintenance/schedules/[id]/execute`
* `/admin/maintenance/preventive/upcoming`
* `/admin/maintenance/preventive/overdue`
* `/admin/maintenance/preventive/calendar`
* `/admin/maintenance/dashboard/overdue`
* `/admin/maintenance/dashboard/upcoming-preventive`
* `/admin/reports/maintenance/schedules`

## 7. Permissions, tenancy, and audit

No new permission key was added. Existing maintenance, preventive, dashboard, report, and schedule-generation permissions were reused and enforced in the backend. Tenant and branch context remains derived from the authenticated operational context; body-supplied tenant/branch values are not trusted.

API proof verified:

* Company A sees its controlled rows; Company B sees zero rows in list/report/calendar.
* Company B receives 404 for foreign detail, PATCH, and transaction references.
* Unauthorized branch access and RBAC deny cases were rejected.
* Generation audit action was `GENERATE`, with no duplicate audit event.

Browser proof temporarily granted only `notifications:read` and `settings.appearance.view` in the disposable clone for app-shell stability, then revoked both exact grants. No temporary grant remains.

## 8. Tests and results

* Focused API due authority/service: 2 suites, 31 tests — PASS.
* Focused API consumer regression subset: 9 suites, 121 tests — PASS.
* Focused Web print logic: 3 suites, 14 tests — PASS.
* Full API: 264 suites, 5360 tests — PASS.
* Full Web: 138 suites, 2598 tests — PASS.
* API runtime proof: 11 checks — PASS.
* Browser runtime proof: 26 checks — PASS.

The first full Web run exposed 2 stale print fixtures that still supplied `startDate`; they were migrated to `effectiveDueDate` and the final full Web suite was green.

## 9. Build and validation results

* Prisma format/validate/generate — PASS.
* API typecheck/build — PASS.
* Web typecheck/build — PASS. The Web build used `NEXT_PUBLIC_API_URL=http://127.0.0.1:4001/api/v1` at build time.
* `npm run ui-baseline:check` (UI baseline, i18n parity, raw keys, permission UI) — PASS.
* `npm run credentials:check` — PASS, before and after proof-process cleanup.
* `npm run route-contract:check` — expected baseline retained: `MALFORMED=3`, `UNRESOLVED=3`, `MISMATCHES=0`.
* `git diff --check` — PASS.
* Conflict-marker and mixed-EOL scans — PASS.
* No unrelated route-contract baseline change was introduced.

## 10. Runtime proof results

API proof fixture states A–F were `overdue`, `notDue`, `dueSoon`, `overdue`, `inactive`, and `expired`, matching the canonical authority. DB-level filters matched UI states. Manual generation advanced A to the next anchored occurrence, returned 409 on repeat, and created one audit event. Batch generation advanced only the remaining due occurrence.

Browser proof ran EN/LTR and AR/RTL across Schedules, schedule detail, Upcoming, Overdue, Calendar, both maintenance dashboard pages, Schedules report, and generation/reload. It verified zero raw translation keys or fallback text, zero console errors, zero page errors, and zero HTTP 4xx/5xx responses. G was generated once; G's due advanced from `2026-11-22T21:07:46.679Z` to `2026-11-29T21:07:46.679Z` with one `GENERATE` audit event. Independent fixture H remained overdue with zero generated requests, preserving the AR/RTL Overdue proof after G advanced.

Final reconciliation tokens:

* `SCHEDULE_ROWS_LOST=0`
* `DUPLICATE_GENERATED_REQUESTS=0`
* `INVALID_NEXT_DUE_DATES=0`
* `CROSS_TENANT_RESULTS=0`
* `UNINTENDED_START_DATE_MUTATIONS=0`

## 11. Known limitations and pre-existing findings

* The Schedules page search field updates local state but does not refetch; browser proof therefore relies on exact fixture cleanup and latest-row visibility rather than search filtering. This is outside the Phase 9 due-authority scope.
* Full API Jest emits a non-failing worker force-exit warning after all tests pass; it was observed before Phase 9 and was not introduced by this work.
* The route-contract checker retains its accepted baseline of 3 malformed and 3 unresolved dynamic call sites with zero mismatches.
* The API and Web proof launcher scripts exited with code 1 after their child servers were intentionally stopped during cleanup; this is expected.

## 12. Cleanup and git status

Only Phase 9 proof-owned PIDs 26552 (API, port 4001) and 10564 (Web, port 3322) were stopped. Both ports were verified released. Temporary command environment variables were not left set. Final credentials check passed.

Git baseline before the final commit:

* Branch: `fix/personnel-maintenance-integrity-r1-integrated`
* HEAD: `32ad5cee5c27bd0c3469c4170fb21601a4738aec`
* `origin/main`: `8c62740f3c95890a9daa99c93bf32aa5efe80026`
* `git rev-list --left-right --count HEAD...origin/main`: `12 0`

Only explicit Phase 9 owned files were staged. `.tmp/`, `test-results/`, generated artifacts, and environment files were not staged. The final commit and push were performed on the named branch; no merge to `main`, deployment, production migration, or production write occurred.
