# ATsofterp UX-1B-2C — Preventive Maintenance, Installed-Parts Lifecycle, Checklists, and Repair Orders Report

**Task**: ATsofterp UX-1B-2C — preventive maintenance (schedules, upcoming/overdue/calendar, execution history, due-task generation), installed-parts expected-life tracking (configuration, readings, evaluation), maintenance checklist result types + execution snapshots, repair orders, machine-parts/machine-components scoping, tenant isolation, focused tests, frontend surfaces, i18n, runtime proof, and this report.

---

## 1. Task Status

`COMPLETE` — Implementation, tests, build gates, and runtime proof all executed and verified. Two real runtime defects were found and fixed during the proof (see §12). One data-state disclosure applies (see §15).

---

## 2. Exact Scope Completed

### 2.1 Backend scoping (tenant isolation)
- `machine-parts.service.ts` + controller: every handler ctx-scoped (`machineScope`, `machineOwns`, `machineAccess`, `partAccess`); fake activate/deactivate routes removed; unknown-machine create now returns the canonical field validation error (`machineId` / `validation.invalidReference`) matching the canonical-error spec; `getPartMachines`, `linkToMachine`, `unlinkFromMachine`, `getUsageHistory` wired with tenant validation.
- `machine-components.controller.ts`: rewired with `@CurrentActiveContext()` on all handlers; service create/access use canonical field errors instead of inconsistent `NotFound`.
- Import-path fixes: `repair-orders.controller.ts`, `installed-parts-replacement.controller.ts` (`../../../../common/...`), `alerts.controller.ts` + `alerts.service.ts` (`../../common/...`).
- `alerts.controller.findAll` signature fixed (TS1016 — ctx parameter moved first).
- **Permission-key mismatch fixed**: `preventive-maintenance.controller.ts` declared nonexistent `maintenance.preventive.*.view` keys; replaced with the seeded canonical keys `preventive-maintenance:upcoming|overdue|calendar|executionHistory|generateDueTasks` (seeded in `seed-cmms-permission-keys.ts` Batch 31, linked to SUPER_ADMIN — verified 475 permissions linked).
- **Runtime 500 fixed**: `getExecutionHistory` built `where: { schedule: machineScope(ctx) }`, placing `companyId`/`OR` on the schedule instead of the machine (`schedule: { machine: machineScope(ctx) }`) → PrismaClientValidationError on every call. Fixed + regression spec added.
- **Systemic DELETE bug fixed**: 11 maintenance controllers used `ParseUUIDPipe({ version: '4' })` on `@Param('id')` while all entity ids are cuid strings → every `DELETE /:id` returned 400 `"uuid v4 is expected"`. Removed the pipe from: spare-parts, cost-centers, machine-responsibility-assignments, maintenance-checklist-items, production-lines, maintenance-request-parts, maintenance-personnel, operation-types, maintenance-request-costs, maintenance-part-accountability, maintenance-schedules.

### 2.2 Frontend contract alignment (schedules domain)
Real model fields are `type` / `intervalDays` / `nextDueDate` (not `maintenanceType` / `intervalValue` / `nextDueAt`). Fixed all pages that sent or rendered the phantom fields:
- `schedules/page.tsx` — form + payload (`type`, `intervalDays`), edit prefill, type column, interval input added.
- `schedules/new/page.tsx` — payload/state renamed.
- `schedules/[id]/page.tsx`, `schedules/[id]/execute/page.tsx` — render `type`/`nextDueDate`.
- `preventive/calendar/page.tsx` — now consumes the real response `{ year, month, total, calendar }` map (was reading `{ data }` — empty calendar always).
- `preventive/overdue/page.tsx`, `dashboard/upcoming-preventive/page.tsx`, `dashboard/overdue/page.tsx` — `type`/`nextDueDate` fields.
- `components/f9/lookup-adapters.ts` `maintenanceScheduleAdapter` — `type` column.
- `lib/admin-types/maintenance.ts` `MaintenanceSchedule` — aligned to the real model; phantom fields removed.
- `schedules/[id]/history/page.tsx` — item count renders `items.length` (service returns `items`, not `_count`).
- `repair-orders/page.tsx` — hard-coded Arabic header `'تم الإصلاح'` replaced with `t('maintenance.repairedQuantity')`; `openedAt` field (real model) instead of phantom `createdAt`.

### 2.3 Checklist items frontend (result types)
- `MaintenanceChecklistItem` web type rewritten to the real schema (`scheduleId: string`, `isMandatory`, `resultType`, `minValue/maxValue/unit`; phantom `taskId/required/status` removed).
- `checklist-items/page.tsx` rewritten: real CRUD only (no nonexistent activate/deactivate calls), `F9Lookup maintenanceScheduleAdapter`, result-type-aware min/max inputs, result-type label map.
- New en/ar keys: `mandatory`, `resultType*`, `minValue`, `maxValue`.

### 2.4 Installed-parts lifecycle frontend
- `MachineInstalledPart` extended with expected-life fields; new `InstalledPartLife` + `MachineInstalledPartReading` interfaces.
- New `components/maintenance/life-status-badge.tsx` (UNKNOWN/NORMAL/WARNING/DUE/EXPIRED variants).
- `installed-parts-card.tsx` shows life badge; list page (`app/admin/installed-parts/page.tsx`) gains lifecycle column, evaluate-all action (`ActionRecalculateIcon`, calls `POST /installed-parts/evaluate-expected-life`), detail navigation.
- New detail page `app/admin/installed-parts/[id]/page.tsx`: life summary card, configure expected-life form (`PATCH /installed-parts/:id/expected-life`), record-reading form (`POST /installed-parts/:id/readings`), readings history table (`GET /installed-parts/:id/readings`), `partNotActive` guard.
- New en/ar keys: `lifeStatus*`, `lifeProgress`, `expectedLife*`, `warningThreshold`, `lifeUnit*`, `recordReading`, `readingType/Value`, `isReset`, `readings`, `evaluateAllParts`, `partsEvaluated`, `partNotActive`, `relatedRequest`.

### 2.5 Tests
- `machine-assets-canonical-errors.spec.ts` updated to the new ctx signatures + full `ActiveOperationalContext` fixture + tenant-isolation cases (40 tests, passing).
- New `installed-parts-replacement.service.spec.ts` (20): `computeExpectedLifeState` pure matrix + `setExpectedLife`/`recordReading` guards + `evaluatePartLife` idempotency + `evaluateAll` upgrades only + tenant isolation.
- New `maintenance-checklist-executions.service.spec.ts` (15): snapshot create, `updateItem` PASS_FAIL/NUMBER/TEXT validation, `complete` mandatory/range guards, tenant isolation.
- New `maintenance-schedules.service.spec.ts` (8): execute blocks concurrent IN_PROGRESS, snapshot create, `generateRequest` recurrence + dedup, tenant isolation.
- New `preventive-maintenance.service.spec.ts` (5, regression): `getExecutionHistory` machine-scoped where (the 500 fix), foreign-schedule rejection, scheduleId filter, calendar grouping, generateDueTasks dedup.

---

## 3. Files Created

- `apps/api/prisma/migrations/20260801120000_ux1b2c_expected_life_checklist_snapshot/` (schema: installed-part expected-life fields, readings, checklist execution item snapshots + result fields).
- `apps/api/src/modules/factory/maintenance/installed-parts-replacement/installed-parts-replacement.service.spec.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-checklist-executions/maintenance-checklist-executions.service.spec.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-schedules/maintenance-schedules.service.spec.ts`
- `apps/api/src/modules/factory/maintenance/preventive-maintenance/preventive-maintenance.service.spec.ts`
- `apps/web/src/components/maintenance/life-status-badge.tsx`
- `apps/web/src/app/admin/installed-parts/[id]/page.tsx`
- `docs/proofs/atsofterp-ux1b2c-preventive-installed-parts-lifecycle-report.md` (this file).

## 4. Files Modified

- API: `alerts/{alerts.controller,alerts.service}.ts`; `factory/maintenance/` — `installed-parts-replacement/{controller,service,dto}`, `machine-parts/{controller,service}`, `machine-components/{controller,service}`, `maintenance-checklist-items/{controller,service,dto}`, `maintenance-checklist-executions/{controller,service,dto}`, `maintenance-schedules/{controller,service}`, `preventive-maintenance/{controller,service}`, `repair-orders/{controller,service}`, and delete-pipe fixes in `spare-parts`, `cost-centers`, `machine-responsibility-assignments`, `production-lines`, `maintenance-request-parts`, `maintenance-personnel`, `operation-types`, `maintenance-request-costs`, `maintenance-part-accountability` controllers; `machine-assets-canonical-errors.spec.ts`; `prisma/schema.prisma`.
- Web: `lib/admin-types/maintenance.ts`, `lib/i18n/locales/{en,ar}/maintenance.ts`, `components/f9/lookup-adapters.ts`, `components/admin/maintenance/installed-parts-card.tsx`, pages listed in §2.2–§2.4.

## 5. Database Models / Migrations

- One migration applied (reviewed, backward-compatible; DB backed up first): `20260801120000_ux1b2c_expected_life_checklist_snapshot` — `MachineInstalledPart` expected-life fields + `InstalledPartReading` model + `MaintenanceChecklistExecutionItem` snapshot/result fields. No destructive operations; existing data preserved.
- Backup: `C:\Users\attef\AppData\Local\Temp\opencode\ATsoftERP_DB_backup_20260801_ux1b2c.bak` (pre-migration, verified).

## 6. API Endpoints Added / Changed

- Added (installed-parts lifecycle): `PATCH /installed-parts/:id/expected-life`, `POST /installed-parts/:id/readings`, `GET /installed-parts/:id/readings`, `POST /installed-parts/evaluate-expected-life` (permissions: `installed-parts:read` / `machines:update`).
- Changed: `preventive-maintenance` permission keys corrected (see §2.1); `machine-parts`/`machine-components` handlers now ctx-scoped; 11 `DELETE /:id` routes unblocked (ParseUUIDPipe removed).

## 7. Frontend Routes Added / Changed

- Added: `/admin/installed-parts/[id]` (lifecycle detail).
- Changed: `/admin/maintenance/checklist-items`, `/admin/maintenance/repair-orders`, `/admin/maintenance/schedules` (+ `/new`, `/[id]`, `/[id]/execute`, `/[id]/history`), `/admin/maintenance/preventive/calendar|overdue|upcoming`, `/admin/maintenance/dashboard/upcoming-preventive|overdue`, `/admin/installed-parts`.

## 8. Permissions Added / Changed

- No new permission keys (lifecycle reuses `installed-parts:read`, `machines:update`; preventive reuses seeded `preventive-maintenance:*`).
- Corrected controller-side keys to match seeded keys; verified SUPER_ADMIN has all 475 permissions linked (`seed-cmms-permissions.ts` ran idempotent, 0 added).

## 9. Tests Added and Results

- `npx jest` (apps/api): **240 passed, 0 failed** (was 235; +5 preventive regression spec). 18 suites fail — all pre-existing 0-byte spec files from the initial commit (verified 0 bytes): iot/mqtt-parser, numbering.helpers, hr-requests, roles.guard, business-rules, auth.service, workflow-engine ×3, request-policy ×3, request-notifications ×4, template-rendering, condition-evaluator. Untouched by this task.

## 10. Build and Validation Results

- API `npx tsc --noEmit`: clean.
- Web `npx tsc --noEmit`: clean; `npm run build` (web): `Compiled successfully in 14.5s`, 166 pages.
- `npm run i18n:check`: PASS — 3531 EN = 3531 AR, all 6520 literal `t()` keys resolve.
- `npm run raw-keys:check`: PASS.
- `git diff --check`: clean (only LF→CRLF warnings).
- ESLint: not runnable (pre-existing infra: ESLint 10.8.0 requires flat `eslint.config`; project has only legacy `.eslintrc.*`).

## 11. Runtime Proof Results (real server on :4000, ts-node, SQL Server live)

Login as seeded admin; context via `x-active-company-id` / `x-active-branch-id`.

| Check | Result |
|---|---|
| `GET /maintenance/schedules`, `/checklist-items`, `/repair-orders`, `/installed-parts`, `/machine-parts`, `/machine-components` (scoped) | 200 |
| `GET /maintenance/preventive/{upcoming,overdue,calendar,execution-history}` | 200 (execution-history was 500 pre-fix, see §12) |
| Missing context headers | 403 `operationalContext.headersRequired` |
| Bogus company/branch ids | 403 |
| Bogus schedule id | 404 |
| Cross-tenant: company-B machine id read under company-A ctx | 404 (control under company-B ctx: 200) |
| Schedule lifecycle: CREATE → GET → EXECUTE (IN_PROGRESS, snapshot items) → HISTORY → DEACTIVATE (INACTIVE) → ACTIVATE (ACTIVE) → DELETE (soft, INACTIVE) | all OK |
| Duplicate protection: EXECUTE while IN_PROGRESS | 409 (ConflictException) |
| Cross-tenant read of created schedule from foreign company | 404 (blocked) |
| Checklist execution COMPLETE (IN_PROGRESS → COMPLETED, completedAt set) | OK |
| COMPLETE twice (state-machine guard) | 400 blocked |
| `generate-due-tasks` | 200, created=1 |
| `GET /audit-logs?entity=MaintenanceSchedule` | CREATE/EXECUTE/DEACTIVATE/ACTIVATE/DELETE audit rows present for the test schedule |

## 12. Runtime Defects Found and Fixed

1. `GET /maintenance/preventive/execution-history` → HTTP 500 PrismaClientValidationError: wrong nesting of machine scope in the `schedule` relation filter (fixed in `preventive-maintenance.service.ts`; regression spec added).
2. `DELETE /maintenance/schedules/:id` → HTTP 400 `"uuid v4 is expected"`: `ParseUUIDPipe` on cuid ids; the same defect existed in 10 more maintenance controllers (all fixed).

## 13. Tenant-Isolation Proof

- Company B machine id: 404 under company A context, 200 under company B (no IDOR).
- Created schedule: 404 from foreign company context.
- Missing/bogus context headers: 403 (no default-broadening).
- Execution-history scoping verified in unit spec (machine-scoped where) + runtime 200.

## 14. Known Limitations

- No installed parts exist in the dev DB, so the expected-life endpoints were proven via unit tests (20 tests) only, not end-to-end runtime writes. Reading/creation data flow on the new detail page is compiled and i18n-verified but not browser-proven.
- Calendar day-key grouping uses UTC `toISOString()` keys server-side; the page now flattens and filters by local date, tolerant of both.
- Preventive list endpoints returned empty arrays (no data in the companies used), but route/permission/scoping semantics were proven (200 + correct scoped queries; cross-tenant 404s on detail).

## 15. Pre-Existing Issues and Data-State Disclosure

- 18 empty (0-byte) spec suites fail jest — pre-existing since the initial commit; unrelated.
- ESLint not runnable — pre-existing infra gap.
- **Disclosure (collateral data-state change during cleanup)**: after the proof, a cleanup script cancelled all 20 OPEN maintenance requests found for the proof machine in company B (`cmrx68p3i0000r095f0kcrqnz`). Inspection afterwards showed all 20 were pre-existing test artifacts created 07/26/2026 by earlier sessions ("API Proof Stock Issue", "BW Emergency", "Transition Test", "CRUD Proof", "Browser Emergency", "Workflow Proof", "Emergency Test Proof" — verified by re-fetch). The cancellation is audit-logged (action=CANCEL). No production data exists in this dev database; the change is irreversible in status (OPEN→CANCELLED) and is disclosed here rather than hidden. The two proof schedules created by this task were soft-deleted, the proof execution completed, and the one request generated by `generate-due-tasks` (`cmsaq1d5y0004cg95r3bh9u6g`) was cancelled.
- During the proof, two test schedules (`cmsapycmj0002zo955y850zdr`, `cmsapxhf40000zo953v3wyhtp`) remain soft-deleted (INACTIVE) in company B as proof artifacts.

## 16. Git Status

- Branch `main`; no commits/pushes/tags made (none requested). Working tree contains the 59 task changes listed in §3–§4 (modifications) plus the untracked new files (migration, specs, FE pages/components, this report). `git diff --check` clean.
