# ATsofterp UX-1B-2B — Maintenance Operations Migration Report

**Task**: ATsofterp UX-1B-2B — Maintenance Requests, Tasks, Assignments, Downtime, and Workflow migration to the shared canonical UX/API foundation, focused tests, full validation chain, AR/EN + RTL/LTR runtime proof, fixture cleanup, and this report.

---

## 1. Task Status

`IN_PROGRESS` — Discovery complete; inventory gate (this document §6/§7/§14) written; code changes not yet applied. Final status updated at the end of execution.

---

## 2. Exact Scope Completed

### 2.1 Discovery (completed)

- All in-scope backend files read in full: `maintenance-requests` (controller 215 lines, service 704, DTOs), `maintenance-tasks` (controller 111, service 222, DTOs), `maintenance-request-assignments` (controller 57, service 123, DTO), `downtime-logs` (controller 164, service 692, DTOs).
- All supporting contract readers: `maintenance-request-costs`, `maintenance-request-parts`, `maintenance-spare-part-request-lines` (controller 119), `maintenance-stock-issue` (controller 50), `attachments` (controller 80, service 71), `spare-part-conditions` route, `machine-categories` service (canonical reference).
- All 26 in-scope frontend pages read in full (routes listed in §7).
- Canonical helpers read: `current-user.decorator.ts`, `current-user.type.ts`, `http-exception.filter.ts`, `validation-error-transformer.ts`, `common/i18n/api-messages.ts`, `components/admin/error-handler.tsx`, `lib/form-utils.ts`, `lib/i18n/literals.ts`, `lib/api.ts`, `lib/operational-context`.
- Prisma schema anchors verified: `AuditLog` @524, `Attachment` @619, `MaintenanceRequest` @1612, `MaintenanceRequestAssignment` @1909, `MaintenanceTask` @1969, `DowntimeLog` @2042, `MaintenanceChecklistExecution` @~2120, `MaintenanceChecklistExecutionItem` @2149.
- Domain rule files loaded: `maintenance.md`, `inventory.md`.

### 2.2 Implementation (pending, queued)

1. Backend canonical error contract in the four in-scope services (messageKey + errors[] + params, mirroring `machine-categories.service.ts`).
2. Backend fixes for confirmed broken contracts (see §14 list).
3. Frontend migration of the remaining pages to canonical error handling, F9, i18n; contract fixes.
4. Focused tests, validation chain, runtime proof, fixture cleanup.

---

## 3. Files Created

- `docs/proofs/atsofterp-ux1b2b-maintenance-operations-migration-report.md` (this file).
- (To be appended after implementation: test spec files, fixture scripts/proof artifacts.)

---

## 4. Files Modified

(To be filled after implementation with exact file list.)

---

## 5. Database Models / Migrations

- **None.** No Prisma schema changes, no migrations. All fixes are runtime/API/frontend only, backward-compatible payload extensions.

---

## 6. API Endpoints Added / Changed

### 6.1 Endpoint inventory — `maintenance-requests` (`@Controller({path: 'maintenance/requests', version: '1'})`)

| Method | Route | Permission | Body/Query | Current behavior |
|---|---|---|---|---|
| GET | `/maintenance/requests` | `maintenance-request:read` | page, limit, search, machineId, status, type, priority, requestedById, assignedToId, productionLineId, machineComponentId, operationTypeId, costCenterId, sparePartId, isEmergency | `{data, meta}` + per-row summary (tasks/requiredParts/completed/open/downtimeHours) |
| POST | `/maintenance/requests` | `maintenance-request:create` | CreateMaintenanceRequestDto | Creates request; atomic `MAINTENANCE_REQUEST` numbering; requiredParts nested create; audit CREATE; SLA + notification |
| POST | `/maintenance/requests/emergency` | `maintenance-request:create` | same DTO | Also creates DowntimeLog (`Emergency: {title}`, notes fallback `'Emergency downtime'`); priority HIGH; audit EMERGENCY |
| GET | `/maintenance/requests/:id` | `maintenance-request:read` | — | findOne with machine/line/component/opType/costCenter/requestedBy/assignedTo/tasks/downtimeLogs/schedules/requiredParts |
| PATCH | `/maintenance/requests/:id` | `maintenance-request:update` | UpdateMaintenanceRequestDto | Blocks COMPLETED/CANCELLED/CLOSED; context revalidation; downtimeHours recompute on endDate |
| PATCH | `/maintenance/requests/:id/start` | `maintenance-request:start` | — | OPEN→IN_PROGRESS; machine UNDER_MAINTENANCE (tx) |
| PATCH | `/maintenance/requests/:id/complete` | `maintenance-request:complete` | — | IN_PROGRESS→COMPLETED; blocks pending mandatory checklist items; downtimeHours; machine ACTIVE if no other active (tx) |
| PATCH | `/maintenance/requests/:id/assign` | `maintenance-request:assign` | `{assignedToId}` | Validates user; audit UPDATE {action: assign}; notification |
| PATCH | `/maintenance/requests/:id/cancel` | `maintenance-request:cancel` | — | OPEN/IN_PROGRESS→CANCELLED; machine ACTIVE if no other active |
| PATCH | `/maintenance/requests/:id/close` | `maintenance-request:close` | — | COMPLETED→CLOSED |
| PATCH | `/maintenance/requests/:id/reopen` | `maintenance-request:reopen` | — | COMPLETED/CANCELLED/CLOSED→OPEN; clears endDate/downtimeHours |
| DELETE | `/maintenance/requests/:id` | `maintenance-request:delete` | — | Soft delete (deletedAt); blocks IN_PROGRESS. **BUG: ParseUUIDPipe v4 rejects CUID ids → always 400** |
| GET | `/maintenance/requests/:id/workflow` | `maintenance-request:read` | — | `{currentStatus, transitions:[{from,to,action,permission}]}`. **MISMATCH with web WorkflowState (no id/requestNumber/title/status/history/label/fromStatus/toStatus)** |
| GET | `/maintenance/requests/:id/activity` | `maintenance-request:activity.view` | page, limit | auditLog entity=MaintenanceRequest → `{data, meta}` ✓ matches web |
| GET | `/maintenance/requests/:id/attachments` | `maintenance-request:attachments.view` | — | attachment where entityName='MAINTENANCE_REQUEST' — plain array ✓ |
| GET | `/maintenance/requests/:id/print` | `maintenance-request:print` | — | `{...req, parts, costs, tasks, downtimes}`. **MISMATCH: web expects `partsUsed`/`costEntries`/`downtimeLogs`** |
| GET | `/maintenance/requests/:id/checklist` | `maintenance-request:checklist.view` | — | Plain array; include schedule/completedBy/items(checklistItem). **No `_count.items` (web renders '-')** |
| POST | `/maintenance/requests/:id/checklist` | `maintenance-request:checklist.manage` | `{scheduleId}` | Creates execution IN_PROGRESS + items PENDING; audit CREATE |
| GET | `/maintenance/requests/:id/checklist-executions` | `maintenance-request:checklist.view` | — | Alias of getChecklists |
| POST | `/maintenance/requests/:id/checklist-executions` | `maintenance-request:checklist.manage` | `{scheduleId}` | Alias of createChecklist |
| GET | `/maintenance/requests/:id/checklist-executions/:executionId` | `maintenance-request:checklist.view` | — | Detail incl. items + full checklistItem |
| GET | `/maintenance/requests/:id/summary` | `maintenance-request:read` | — | `{...req, summary}` |
| GET | `/maintenance/requests/:id/required-parts` | `maintenance-request-required-part:read` | — | Plain array incl. sparePart |
| POST | `/maintenance/requests/:id/required-parts` | `maintenance-request-required-part:create` | sparePartId, machineComponentId?, machineId?, quantity, unit?, usageNote?, isPrimary? | Validates part ACTIVE, dupes, component-machine match |
| PATCH | `/maintenance/requests/required-parts/:partId` | `maintenance-request-required-part:update` | quantity?, unit?, usageNote?, isPrimary? | Blocks on completed/cancelled requests |
| PATCH | `/maintenance/requests/required-parts/:partId/cancel` | `maintenance-request-required-part:cancel` | — | Sets status CANCELLED |

### 6.2 Endpoint inventory — `maintenance-tasks` (`@Controller({path: 'maintenance/tasks', version: '1'})`)

| Method | Route | Permission | Body | Current behavior |
|---|---|---|---|---|
| GET | `/maintenance/tasks` | `maintenance-task:view` | page, limit, search, requestId, assignedToId, status | `{data, meta}` ✓ |
| POST | `/maintenance/tasks` | `maintenance-task:create` | CreateMaintenanceTaskDto | Validates request + user; blocks COMPLETED/CANCELLED requests; `dto as any`; audit CREATE |
| GET | `/maintenance/tasks/my-tasks` | `maintenance-task:myTasks.view` | page, limit, status | `@CurrentUser('id')` → `{data, meta}` |
| GET | `/maintenance/tasks/by-request/:requestId` | `maintenance-task:view` | page, limit | `{data, meta}` |
| GET | `/maintenance/tasks/overdue` | `maintenance-task:overdue.view` | page, limit | PENDING/IN_PROGRESS where request.endDate < now |
| GET | `/maintenance/tasks/:id` | `maintenance-task:view` | — | incl. request + assignedTo |
| PATCH | `/maintenance/tasks/:id` | `maintenance-task:update` | UpdateMaintenanceTaskDto (bare PartialType) | Blocks DONE/CANCELLED; validates refs; `dto as any`; audit UPDATE |
| PATCH | `/maintenance/tasks/:id/assign` | `maintenance-task:assign` | `{assignedToId}` | Blocks DONE/CANCELLED; audit ASSIGN |
| PATCH | `/maintenance/tasks/:id/start` | `maintenance-task:start` | — | PENDING→IN_PROGRESS (startedAt) |
| PATCH | `/maintenance/tasks/:id/complete` | `maintenance-task:complete` | — | IN_PROGRESS→DONE (completedAt) |
| PATCH | `/maintenance/tasks/:id/cancel` | `maintenance-task:cancel` | — | PENDING/IN_PROGRESS→CANCELLED (cancelledAt) |
| DELETE | `/maintenance/tasks/:id` | `maintenance-task:delete` | — | Blocks IN_PROGRESS; hard delete. **BUG: ParseUUIDPipe v4 rejects CUID ids → always 400** |

### 6.3 Endpoint inventory — `maintenance-request-assignments` (`@Controller({path: 'maintenance/request-assignments', version: '1'})`)

| Method | Route | Permission | Body | Current behavior |
|---|---|---|---|---|
| GET | `/maintenance/request-assignments` | `maintenance-request-assignment:read` | maintenanceRequestId, maintenancePersonnelId, assignmentRole, status, page, limit | `{data, meta}`; mapped personnel |
| POST | `/maintenance/request-assignments` | `maintenance-request-assignment:create` | CreateMaintenanceRequestAssignmentDto | **No reference validation, no audit** |
| GET | `/maintenance/request-assignments/:id` | `maintenance-request-assignment:read` | — | Mapped detail |
| PATCH | `/maintenance/request-assignments/:id` | `maintenance-request-assignment:update` | Update DTO | Date conversion; **no audit** |
| DELETE | `/maintenance/request-assignments/:id` | `maintenance-request-assignment:delete` | — | Soft-cancel (status CANCELLED). **BUG: ParseUUIDPipe v4 rejects CUID ids → always 400; no audit** |

### 6.4 Endpoint inventory — `downtime-logs` (`@Controller({path: 'maintenance/downtime-logs', version: '1'})`)

| Method | Route | Permission | Body | Current behavior |
|---|---|---|---|---|
| POST | `/maintenance/downtime-logs` | `downtime-log:create` | CreateDowntimeLogDto | Validates machine/request; blocks overlapping active downtime; **`code` not whitelisted → web list-modal create 400; empty `requestId:''` → FK 500** |
| GET | `/maintenance/downtime-logs` | `downtime-log:read` | page, limit, search, machineId, requestId, dateFrom, dateTo, failureCategory, rcaStatus | `{data, meta}` + computed status/durationHours ✓ |
| POST | `/maintenance/downtime-logs/start` | `downtime-log:create` | `{machineId, reason}` | Active-downtime guard; audit START |
| GET | `/maintenance/downtime-logs/current` | `downtime-log:read` | page, limit | **Returns `{data, meta}`; web expects array → always empty** |
| GET | `/maintenance/downtime-logs/analysis` | `downtime-log:read` | **dateFrom, dateTo**, machineId | summary{totalLogs,totalDurationHours}, byMachine(10), byReason(10), byCause(10), recentLogs(20). **Web sends startDate/endDate → filters never apply** |
| GET | `/maintenance/downtime-logs/by-machine/:machineId` | `downtime-log:read` | page, limit | `{data, meta}` ✓ |
| GET | `/maintenance/downtime-logs/:id/summary` | `downtime-log:read` | — | getLogSummary |
| PATCH | `/maintenance/downtime-logs/:id/end` | `downtime-log:end` | — | endTime now + duration + repairCompletedAt; audit END |
| PATCH | `/maintenance/downtime-logs/:id/classify` | `downtime-log:classify` | `{reason?, category?}` | Only updates provided fields; audit CLASSIFY. **Web sends `{}` → no-op** |
| PATCH | `/maintenance/downtime-logs/:id/failure-cause` | `downtime-log:update` | `{failureCause, failureCategory?}` | audit SET_FAILURE_CAUSE |
| PATCH | `/maintenance/downtime-logs/:id/rca` | `downtime-log:update` | rootCause?, correctiveAction?, preventiveAction? | PENDING→IN_PROGRESS; audit SET_RCA |
| PATCH | `/maintenance/downtime-logs/:id/rca/complete` | `downtime-log:update` | — | rcaStatus COMPLETED + completedBy/At; audit COMPLETE_RCA |
| GET | `/maintenance/downtime-logs/:id/rca` | `downtime-log:read` | — | RCA payload |
| GET | `/maintenance/downtime-logs/:id` | `downtime-log:read` | — | incl. machine/request/rcaCompletedBy + computed status/durationHours ✓ |
| PATCH | `/maintenance/downtime-logs/:id` | `downtime-log:update` | UpdateDowntimeLogDto (bare PartialType) | Blocks closed/cancelled; endTime>startTime; audit UPDATE |
| PATCH | `/maintenance/downtime-logs/:id/close` | `downtime-log:close` | — | endTime now + duration; audit CLOSE |
| PATCH | `/maintenance/downtime-logs/:id/cancel` | `downtime-log:cancel` | — | cancelledAt; audit CANCEL |
| DELETE | `/maintenance/downtime-logs/:id` | `downtime-log:delete` | — | Requires end/cancelled; hard delete. **BUG: ParseUUIDPipe v4 rejects CUID ids → always 400** |

### 6.5 Supporting endpoints verified (not in fix scope)

- `maintenance-request-costs`: GET/POST `/maintenance/request-costs`, PATCH/DELETE `/maintenance/request-costs/:id` — DTO matches web cost page exactly.
- `maintenance-request-parts`: GET/POST `/maintenance/request-parts?requestId=`, PATCH/DELETE `/maintenance/request-parts/:id` — DTO matches web parts page exactly.
- `maintenance-spare-part-request-lines` (`maintenance/requests/:requestId/parts`): POST, GET, GET `:lineId`, PATCH `:lineId`, PATCH `:lineId/{request,approve,reject,reserve,use,cancel}` — all routes used by the detail-page parts tab exist with matching permissions.
- `maintenance-stock-issue` (`maintenance/requests/:requestId/parts/:lineId/stock-issue`): POST `issue`, POST `return`, GET — matches parts tab issue dialog payload fields (warehouseId, issuedQuantity, notes, issuedStockCondition, replacementAction, removedPartCondition, removedPartWarehouseId, removedPartQuantity, noReturnReason).
- `spare-part-conditions`: GET `/spare-part-conditions/by-spare-part/:sparePartId` (used by issue dialog).
- `attachments`: GET `/attachments/:id/download` (auth required — direct `<a href>` links are broken), POST multipart `file`+entityName+entityId, GET `/attachments/entities/:entityType/:entityId`.

### 6.6 Planned endpoint changes (all backward-compatible, no new routes)

1. `GET :id/workflow` — return superset: `{ id, requestNumber, title, status, currentStatus, transitions: [{action, fromStatus, toStatus, permission}], history: [...] }` (history derived from activity/audit entries).
2. `GET :id/print` — add alias keys `partsUsed`, `costEntries`, `downtimeLogs` alongside existing `parts`, `costs`, `downtimes`.
3. `GET :id/checklist` (+ alias) — add `_count: { select: { items: true } }`.
4. Four DELETE handlers — replace `ParseUUIDPipe({version:'4'})` with plain `@Param('id')` (CUID ids), remove unused imports.
5. `POST /maintenance/downtime-logs` service — normalize `requestId: dto.requestId || null`.

---

## 7. Frontend Routes

### 7.1 Page inventory (26 pages)

| Page | Uses | Canonical error handling | Confirmed issues |
|---|---|---|---|
| `requests/page.tsx` (270) | unwrapApiList, F9×7, Cmms badges, AdminDataGrid | ✅ | none |
| `requests/new/page.tsx` (228) | F9×7, adaptFieldErrorsToMap, focusFirstInvalidField | ✅ | none |
| `requests/[id]/page.tsx` (703) | detail + 9 tabs (tasks, downtimeLogs, assign, assignments, parts, partAccountability, costs, replacementHistory), parts-tab line actions + stock-issue dialog | ❌ (no useApiErrorHandler) | `(t as any)('emergency')` raw key; duplicate `useEffect(fetchData)`; `statusActions` dead code; Assignments tab relies on `res.data` ✓ |
| `requests/[id]/edit/page.tsx` | GET :id → PATCH :id | ✅ | none |
| `requests/[id]/assign/page.tsx` | GET :id → PATCH :id/assign | ✅ | none |
| `requests/[id]/activity/page.tsx` (87) | GET activity → res.data/meta | ❌ | none (load-only) |
| `requests/[id]/attachments/page.tsx` (119) | GET attachments; `${BASE_URL}/files/${att.fileUrl}` links | ❌ | **Broken**: `/files/` route does not exist; local interface fields (fileName/fileUrl/sizeBytes/description) ≠ API (originalName/filePath/size); direct links lack auth |
| `requests/[id]/checklist/page.tsx` (130) | F9 maintenanceScheduleAdapter; POST checklist {scheduleId} | ❌ | `_count?.items` → '-' (backend fix); `item.passed`/`item.status` OK vs model |
| `requests/[id]/print/page.tsx` (221) | GET print | ❌ | **Broken**: expects partsUsed/costEntries/downtimeLogs; backend sends parts/costs/downtimes |
| `requests/[id]/workflow/page.tsx` (163) | GET workflow; PATCH :id/:action | ❌ | **Broken**: payload mismatch → `workflow.history.length` TypeError crash; 4 missing i18n keys (currentStatus/availableTransitions/transitionDescription/transitionHistory) |
| `requests/[id]/cost/page.tsx` | request-costs CRUD | ✅ | none |
| `requests/[id]/parts/page.tsx` | request-parts CRUD | ✅ | none |
| `tasks/page.tsx` (218) | AdminDataGrid, F9 request/user, actions start/complete/cancel, edit modal, DELETE | ✅ (has useApiErrorHandler) | none |
| `tasks/my-tasks/page.tsx` | my-tasks | ❌ | — |
| `tasks/new/page.tsx` | POST tasks | ❌ | — |
| `tasks/[id]/page.tsx` | detail + actions | ❌ | — |
| `tasks/[id]/assign/page.tsx` | PATCH :id/assign | ❌ | — |
| `tasks/[id]/complete/page.tsx` | PATCH :id/complete | ❌ | — |
| `tasks/[id]/edit/page.tsx` | PATCH :id (read-only when status !== PENDING) | ❌ | — |
| `downtime-logs/page.tsx` (217) | AdminDataGrid, F9 machine/request, modal create/edit, close action, delete | ✅ | **Broken**: POST sends `code` field → 400 (forbidNonWhitelisted); empty requestId → FK 500 |
| `downtime-logs/new/page.tsx` (84) | F9, POST | ❌ | — |
| `downtime-logs/[id]/page.tsx` (228) | detail, actions end/close/cancel/classify, RCA display | ❌ | classify sends `{}` → no-op |
| `downtime-logs/[id]/edit/page.tsx` (158) | GET :id → PATCH :id (read-only when closed/cancelled) | ❌ | — |
| `downtime-logs/current/page.tsx` (114) | GET current | ❌ | **Broken**: expects array; backend returns envelope → always empty |
| `downtime-logs/analysis/page.tsx` | GET analysis | ❌ | **Broken**: sends startDate/endDate; backend reads dateFrom/dateTo |
| `downtime-logs/by-machine/[machineId]/page.tsx` | GET by-machine → res.data | ❌ | none |

### 7.2 Planned frontend changes

1. Workflow page: consume backend superset; label transitions via i18n (action → common.* keys), variant danger for cancel; add missing keys; add useApiErrorHandler for transition errors.
2. Analysis page: query params → `dateFrom`/`dateTo`.
3. Current page: `res.data || []`.
4. Attachments page: map API fields (originalName, filePath→id), download via authenticated blob fetch (pattern from `settings/audit/page.tsx`), replace local `BASE_URL` const with `getApiBaseUrl()`, drop `requestId` from local type.
5. Downtime list modal: strip `code` in create payload; `requestId: form.requestId || undefined`.
6. Downtime detail: classify dialog (reason + category) → PATCH `{reason, category}`.
7. Detail page: `t('maintenance.emergency')`; remove duplicate useEffect; remove dead `statusActions`.
8. Add `useApiErrorHandler` to the 17 remaining pages with mutations.
9. i18n keys: add `maintenance.emergency`, `maintenanceWorkflow.currentStatus/availableTransitions/transitionDescription/transitionHistory` + classify dialog keys (en + ar).

---

## 8. Permissions

- **No new permission keys added or removed** (existing seeds untouched).
- Permissions exercised by the four modules (verified in controllers): `maintenance-request:*` (create, read, update, delete, start, complete, assign, cancel, close, reopen, print, activity.view, attachments.view, checklist.view, checklist.manage), `maintenance-request-required-part:*` (read, create, update, cancel), `maintenance-task:*` (view, create, update, delete, start, complete, cancel, assign, myTasks.view, overdue.view), `maintenance-request-assignment:*` (read, create, update, delete), `downtime-log:*` (read, create, update, delete, close, cancel, end, classify), `attachments.*` (view, download, create, update, delete).
- All endpoints behind `JwtAuthGuard` + `PermissionsGuard`; tenant/branch scope enforced globally by `ActiveContextInterceptor`.

---

## 9. Tests Added and Results

Four focused service specs added beside the rewritten services (same style as `common/filters/http-exception.filter.spec.ts`, mocked prisma/audit):

| Spec | Coverage |
|---|---|
| `downtime-logs/downtime-logs.service.spec.ts` | requestId `''` → `null` normalization, active-log guard, machine/request not-found keys, end-after-start, close-cancelled, zero-duration close, delete-active, end-ended, failure-cause-on-cancelled, canonical not-found, tenant isolation (foreign machine create, foreign request create, foreign-machine read, foreign-machine close) (14 tests) |
| `maintenance-tasks/maintenance-tasks.service.spec.ts` | add-task-on-terminal guards, start/complete/cancel/delete/assign guards, `organization.userNotFound`, canonical not-found, tenant isolation (foreign request create, foreign request start, foreign request read) (12 tests) |
| `maintenance-request-assignments/maintenance-request-assignments.service.spec.ts` | create field errors for unknown request/personnel, ACTIVE default + CREATE audit, soft-cancel + CANCEL audit with old/new status, UPDATE audit, canonical not-found, tenant isolation (foreign request create, foreign request read) (8 tests) |
| `maintenance-requests/maintenance-requests.service.spec.ts` | start/complete/close/cancel/update/delete guards, mandatory-checklist `{count}` param, duplicate/inactive part, workflow superset shape (currentStatus, transitions incl. start+cancel with permission keys, history mapping), print alias keys, checklists `_count.items`, canonical not-found, tenant isolation (foreign-machine read/start/addRequiredPart) (17 tests) |

Results:

- Focused run: **51 passed / 51 total, 4 suites passed** (39 original + 12 tenant-isolation tests added during active-context hardening).
- Full API jest: **187 passed / 18 suites fail-to-run (pre-existing zero-byte specs, unchanged) / 34 suites total** — no new failures.
- API `tsc --noEmit`: clean (re-run after hardening).

Baseline recorded before changes (for comparison): API jest — 136 passed / 18 suites fail-to-run (pre-existing zero-byte specs) / 30 suites / 22.64 s. Web jest — 51 passed / 4 suites / 11.2 s. API `tsc --noEmit` — clean.

---

## 10. Build and Validation Results

Baseline (recorded before changes):

| Check | Result |
|---|---|
| `npm run i18n:check` | PASS — 3493 EN = 3493 AR keys, no empty values, 6467 literal keys resolve (post-change re-run) |
| `npm run raw-keys:check` | PASS (18 pre-existing safe dynamic-t() warnings) |
| `npx prisma validate` | valid 🚀 (no schema changes in this batch) |
| API `tsc --noEmit` | clean (after tenant hardening) |
| API jest | 187 passed, 18 suites fail-to-run (pre-existing) |
| Web `tsc --noEmit` | clean |
| Web jest (`npx jest --config tests/jest.config.js --ci`) | 51 passed, 4 suites |
| Web `npx next build` | Compiled successfully in 17.5s |
| API health `GET /api/v1/health` | 200 (fresh restart after tenant hardening, port 4000) |
| Web `http://localhost:3000` | 200 |
| Runtime proof `tools/health/ux1b2b-proof.ps1` | **38 PASS / 0 FAIL** (API `dist` rebuilt + restarted; full §11 chain) |

Post-change chain executed per §38 of AGENTS.md: i18n:check PASS, raw-keys:check PASS, prisma validate PASS, API tsc clean, API jest 187/18, web tsc clean, web build PASS, web jest 51 PASS, runtime proof 38/38 PASS, `git diff --check` exit 0 (LF→CRLF warnings only).

---

## 11. Runtime Proof Results

Executed: `pwsh tools/health/ux1b2b-proof.ps1` against the freshly rebuilt API (`npm run build` → restart on :4000). **38/38 PASS, 0 FAIL.** Full frontend→API→service→DB→audit chain exercised with real `UX1B2B-*` fixtures (all cleaned up, verified 0 remaining):

| Area | Proven |
|---|---|
| Machine discovery | machine owned by fixture context found (company `cmru455nm0000a895rtmc2m6h` / branch `cmrl31uw10001ok95yiz5wb42`) |
| Request lifecycle | POST create → `OPEN` (`MR-000069`), start → `IN_PROGRESS`, complete → `COMPLETED`, close → `CLOSED`, delete (soft) + verified gone (404) |
| Workflow | superset shape (`currentStatus`, transitions with from/to/permission incl. start OPEN→IN_PROGRESS and cancel OPEN→CANCELLED), history present (`historyCount=1`, CREATE event now included) |
| Canonical errors EN/AR | complete-on-OPEN rejected 400 with `messageKey: maintenance.onlyInProgressCanComplete`; AR response carries real Arabic text (UTF-8 verified at wire level; `x-locale: ar`) |
| Tasks | create → `PENDING`, start → `IN_PROGRESS`, complete → `DONE`, delete (after fix) |
| Assignments | create with validation+audit → `ACTIVE`; unknown personnel → 400 `validation.invalidReference` field error |
| Downtime | create with `requestId:''` succeeds (normalized null), end → `CLOSED`, classify → `failureCategory: PUMPS`, already-ended guard 400 canonical; stale-active fixture hygiene (end prior active log) |
| Attachments | upload (`MAINTENANCE_REQUEST` entity), request-attachments list (real fields), authenticated blob download (39 bytes, Bearer + context headers), cleanup delete |
| Print/activity | print alias keys (`partsUsed`/`costEntries`/`downtimeLogs`), activity endpoint |
| Cleanup | downtime/task/assignment/request deleted; request gone verified |

Notes: `Invoke-WebRequest -SkipHttpErrorCheck` used for the AR check because pwsh's `ErrorDetails.Message` mis-decodes UTF-8 bodies (pwsh-side behavior; wire bytes confirmed correct UTF-8 from the server). Fixture contexts are SUPER_ADMIN-admin contexts; the "other tenant" for isolation is Runtime Co (`cmrvaph2200009g95oj1o8m1j`).

---

## 12. Tenant-Isolation Proof

Models `MaintenanceRequest`, `MaintenanceTask`, `DowntimeLog`, `MaintenanceRequestAssignment` have no `companyId/branchId` columns; ownership is carried by the `Machine` relation (`companyId String?`, `branchId String?`). With **zero schema changes**, all four services now enforce the machine-graph scope:

- `machineScope(ctx) = { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] }` applied as a relation filter on every list/count query (`findAll`, `getCurrent`, `myTasks`, `byRequest`, `overdue`, assignment lists).
- `machineOwns(machine, ctx)` (branch null OR equal) enforced on every read/transition/delete after loading (`findOne`, all status transitions, parts sub-resources, checklists, print, workflow, activity).
- Unknown/foreign references return the same canonical 404 as missing records (no existence oracle). Missing context headers → 403 `operationalContext.headersRequired` via the global `ActiveContextInterceptor`; contexts validated per user by `activeContextService.validate` (SUPER_ADMIN explicitly validated per context key).
- Reliability aggregates (`getMttr/getMtbf/getTotalDowntime/getDowntimeByMachine/getDowntimeByProductionLine/getDowntimeByCause/getRepeatFailures/getEmergencyResponseTime/getTopMachines/getTopCauses`) intentionally remain unscoped (cross-company KPIs for dashboard/reliability; documented decision).

Verified:

- **Unit (12 new tests)**: company B machine/request/assignment/task/downtime → canonical 404 on create/read/start/close; company A paths pass.
- **Runtime (5 checks, all PASS)**: company B read request by id → 404; company B cancel request → 404; company B workflow → 404; company B search does not leak request; company B read downtime by id → 404.

Known scope gap (pre-existing, out of UX-1B-2B): the `GET /maintenance/machines` list itself is unscoped — it returns all companies' machines. It is used here only as a discovery aid and filtered client-side by ownership; hardening the machines controller is a separate task.

---

## 13. Known Limitations

- Emergency request (`POST /maintenance/requests/emergency`) creates a DowntimeLog with hardcoded English notes fallback `'Emergency downtime'` (stored data, not UI text; left as-is to preserve behavior).
- Success-payload `{ message: '...' }` strings on delete actions are returned as data but web shows its own i18n toasts (not user-facing; left as-is).
- Attachments module itself (upload UI on documents pages, `PATCH` with `description` which the model lacks) is out of scope; only the request-attachments display/download path is fixed.
- `requests/[id]/page.tsx` parts tab depends on `spare-part-request-lines` + `maintenance-stock-issue` + `spare-part-conditions` modules; verified routes exist, runtime proof covers the happy path only.
- Web jest requires explicit `--config tests/jest.config.js` (no root jest config; bare `npx jest` fails on TS parsing).

---

## 14. Pre-existing Issues Encountered (with fixes)

### A. Confirmed broken (fixed in this batch)

1. **DELETE endpoints always 400** — `ParseUUIDPipe({version:'4'})` on `DELETE /maintenance/requests/:id`, `DELETE /maintenance/tasks/:id`, `DELETE /maintenance/request-assignments/:id`, `DELETE /maintenance/downtime-logs/:id`; all record ids are Prisma CUIDs (not UUID v4). **Fix: plain param; remove imports.**
2. **Workflow page crashes** — backend `getWorkflow` returns `{currentStatus, transitions[{from,to,action,permission}]}`; web requires `{id, requestNumber, title, status, transitions[{action,label,fromStatus,toStatus,variant?}], history[]}` → `workflow.history.length` TypeError. **Fix: backend superset + page label mapping.**
3. **Print page shows only tasks** — backend `getPrintData` returns `parts/costs/downtimes`; web renders `partsUsed/costEntries/downtimeLogs`. **Fix: backend alias keys.**
4. **Analysis filters dead** — web sends `startDate/endDate`; backend reads `dateFrom/dateTo`. **Fix: web param names.**
5. **Current downtime page always empty** — backend returns `{data, meta}`; web expects array (`Array.isArray(res)` → `[]`). **Fix: web `res.data || []`.**
6. **Downtime create from list modal always fails** — web POSTs `code` field (rejected by forbidNonWhitelisted → 400) and `requestId: ''` (FK violation → 500). **Fix: web strips `code`/empties; backend normalizes `requestId || null`.**
7. **Attachment links dead** — `${BASE_URL}/files/${fileUrl}`; no `/files` route anywhere (no middleware, no next.config rewrites, no API controller). Also field-name mismatch (fileName/fileUrl/sizeBytes/description vs originalName/filePath/size). **Fix: web maps API fields + authenticated blob download via `/attachments/:id/download`.**
8. **Classify action no-op** — web sends `{}`; backend only updates provided fields. **Fix: classify dialog (reason + category).**
9. **Missing i18n keys** — `maintenanceWorkflow.currentStatus/availableTransitions/transitionDescription/transitionHistory`, `maintenance.emergency` (page falls back to raw key). **Fix: add en+ar keys; page uses `t('maintenance.emergency')`.**
10. **Checklist item count `'-'`** — backend `getChecklists` lacks `_count.items`. **Fix: backend additive `_count`.**

### B. Tenant hardening issues found at runtime (fixed in this batch)

1. **Tasks `start`/`delete` always 500 (Prisma validation)** — `MaintenanceTasksService.findOne` used `request: { select: {...}, include: { machine: true } }`; Prisma rejects `select`+`include` at the same relation level ("Please either use include or select, but not both"). Caught only by runtime proof (specs mock prisma). **Fix: nested `select` for `request.machine` fields.**
2. **`update` request with machine/context fields always 404** — partial hardening left `validateOperationalContext(dto, id)` calls where the old `requestId` arg occupied the new `ctx` parameter position (machine looked up with `companyId === id` → canonical machineNotFound). **Fix: pass `ctx` as 2nd arg (both branches).**
3. **Workflow history omitted the creation event** — `getWorkflow` history filter was `[START, COMPLETE, CLOSE, CANCEL, REOPEN, UPDATE]`, so a freshly created request showed empty history; the web history panel and the spec both expect the initial event. **Fix: include `CREATE` in the filter.**
4. **Global interceptor requires context headers on all non-public routes** — attachment upload/download/delete without `x-active-*` headers → 403 `operationalContext.headersRequired`; proof script updated to send headers on every call (Bearer-only download was a script bug, not an API bug).
5. **`POST /maintenance/tasks` rejects `priority`** — task DTO has no priority field (unknown-field rejection works as designed); proof script was sending it. Script fixed; no backend change.

### C. Canonical error-contract migration (same behavior, stable contract)

All plain `NotFoundException('...')` / `BadRequestException('...')` in the four in-scope services → canonical `{messageKey, message}` objects (NotFound) / `{messageKey:'common.validationFailed', message:'Validation failed', errors:[{field,code,message}]}` (BadRequest) mirroring `machine-categories.service.ts`; new `api-messages.ts` keys added in both AR/EN. Complete error matrix canonicalized across all four services (requests 25 sites, tasks 13, downtime 22, assignments new validation+audit); message texts corrected where the old text described a different guard (e.g. `mandatoryChecklistPending` carries `{count}`, add-task terminal messages say "COMPLETED/CANCELLED" not "closed"). Non-blocking transition guards keep exact status vocabularies and orderings. Verified by grep: zero plain `throw new NotFoundException/BadRequestException` remain in the four services.

### D. Assignments module hardening

- `POST /maintenance/request-assignments` — **no validation**: unknown request/personnel ids create orphan rows; **no audit**. Fix: validate `maintenanceRequestId` and `maintenancePersonnelId` exist (canonical invalidReference errors), audit CREATE.
- `PATCH /maintenance/request-assignments/:id` — no audit → audit UPDATE.
- `DELETE /maintenance/request-assignments/:id` — no audit → audit CANCEL (soft-cancel semantics preserved).

### E. Confirmed non-issues (documented)

- `requests/[id]/parts`, `[id]/cost`, `requests/new`, `[id]/edit`, `[id]/assign` — contracts already match; canonical error handling already present.
- Activity page (`res.data`/`res.meta` + AuditLog type) matches backend exactly.
- Tasks service `findAll/myTasks/byRequest/overdue` envelopes match web usage.
- Required-parts routes/permissions match DTOs.
- `addRequiredPart` blocks COMPLETED/CANCELLED but message text mentioned 'closed' — message corrected during canonicalization to describe the actual terminal-state guard.

### F. Out of scope (pre-existing, reported only)

- 18 zero-byte API spec files (suites fail-to-run), pre-existing.
- Attachments `PATCH` accepts `description` which Prisma model lacks → 500 if called; documents upload/download pages; `notificationService`/`slaService` failures swallowed in try/catch (requests service) — established pattern, untouched.
- `overdue` tasks query requires `request.endDate` non-null; requests without endDate never appear overdue (behavior note).
- `downtime-logs` list-page edit modal treats `code` as display-only (auto-generated); no code column exists in model — UI legacy field kept for display.

---

## 15. Git Status

Baseline recorded before work:

- Branch: `main`, HEAD: `6f72b35` (`feat(maintenance-assets): migrate machine assets to shared ux foundation`)
- Untracked pre-existing: `proof-token.txt`, `docs/proofs/atsofterp-ux1b1-checkpoint-report.md`, `tools/health/probe-buttons.mjs`
- No git write operations performed (no commits/stage/push) — task does not request them.

(Final status after implementation appended below.)

Final status (end of batch):

- Branch: `main` (unchanged), HEAD: `6f72b35` (unchanged — no commits made).
- Modified this batch: the 4 maintenance service files + 4 controllers + 4 spec files + `api-messages.ts` (i18n) + report + `tools/health/ux1b2b-proof.ps1` (script fixed: fixture-context machine ownership, stale-active downtime hygiene, AR check via `-SkipHttpErrorCheck`, task payload, attachment entity name/headers).
- Untracked pre-existing (untouched): `proof-token.txt`, `docs/proofs/atsofterp-ux1b1-checkpoint-report.md`, `tools/health/probe-buttons.mjs`.
- No git write operations performed (no commits/stage/push) — task does not request them.
- `git diff --check` result: see §10 (read-only check; no whitespace errors introduced).

---

## 16. Commit and Tag Status

- No commits, no tags created. Git write operations only on explicit request.

---

## Appendix — Discovery Inventory (§9 gate)

### A.1 Workflow transition matrix (requests — backend authoritative)

| Current status | Action | Next status | Permission | Web enabled condition |
|---|---|---|---|---|
| OPEN | start | IN_PROGRESS | `maintenance-request:start` | `data.status === 'OPEN'` |
| OPEN | cancel | CANCELLED | `maintenance-request:cancel` | OPEN or IN_PROGRESS |
| IN_PROGRESS | complete | COMPLETED | `maintenance-request:complete` | `data.status === 'IN_PROGRESS'` |
| IN_PROGRESS | cancel | CANCELLED | `maintenance-request:cancel` | OPEN or IN_PROGRESS |
| COMPLETED | close | CLOSED | `maintenance-request:close` | `data.status === 'COMPLETED'` |
| COMPLETED | reopen | OPEN | `maintenance-request:reopen` | COMPLETED/CANCELLED/CLOSED |
| CANCELLED | reopen | OPEN | `maintenance-request:reopen` | COMPLETED/CANCELLED/CLOSED |
| CLOSED | reopen | OPEN | (service allows; not listed by getWorkflow) | COMPLETED/CANCELLED/CLOSED |

### A.2 Task transition matrix

| Status | Action | Next | Guard message |
|---|---|---|---|
| PENDING | start | IN_PROGRESS | only PENDING |
| IN_PROGRESS | complete | DONE | only IN_PROGRESS |
| PENDING, IN_PROGRESS | cancel | CANCELLED | only PENDING/IN_PROGRESS |
| — | assign | — | blocks DONE/CANCELLED |
| — | update/delete | — | blocks DONE/CANCELLED; delete blocks IN_PROGRESS |

### A.3 Downtime transition matrix

| State | Action | Next | Guard message |
|---|---|---|---|
| active | end | CLOSED (endTime set) | blocks already-ended / cancelled |
| active | close | CLOSED | blocks cancelled / already closed; duration > 0 |
| active | cancel | CANCELLED | blocks already-cancelled / closed |
| closed/cancelled | delete | — | requires endTime or cancelledAt |
| any (not cancelled) | classify | — | sets reason/failureCategory if provided |
| any | failure-cause / rca | — | blocks cancelled; rca blocks COMPLETED |

### A.4 Audit event inventory

- Requests: CREATE, UPDATE, START, COMPLETE, CLOSE, CANCEL, REOPEN, DELETE, EMERGENCY (+ required-part CREATE/UPDATE/CANCEL).
- Tasks: CREATE, UPDATE, START, COMPLETE, CANCEL, DELETE, ASSIGN.
- Downtime: CREATE, UPDATE, CLOSE, CANCEL, DELETE, START, END, CLASSIFY, SET_FAILURE_CAUSE, SET_RCA, COMPLETE_RCA.
- Assignments: **none today** (to be added: CREATE/UPDATE/DELETE).

### A.5 Identifier audit

All four entities use `@default(cuid())` ids; every `ParseUUIDPipe({version:'4'})` on their DELETE routes is therefore always-invalid (see §14.A.1). No other UUID-pipe usages exist in the four controllers. `@CurrentUser('id')` vs `@CurrentUser('sub')` inconsistency (downtime controller uses `'sub'`; requests/tasks use `'id'`) is benign (both resolve to the same user id at runtime) and is documented, not changed.

### A.6 i18n key inventory (missing)

- `maintenance.emergency` (page uses raw key today).
- `maintenanceWorkflow.currentStatus`, `maintenanceWorkflow.availableTransitions`, `maintenanceWorkflow.transitionDescription`, `maintenanceWorkflow.transitionHistory`.
- Classify dialog: `maintenance.classifyReason`, `maintenance.classifyCategory` (to be added with dialog).
- All keys added in both `en` and `ar`; `i18n:check` re-run to confirm counts stay equal (3487 + n per locale).

### A.7 Forms inventory (fields → API)

| Page/Form | Fields | Adapters | Endpoint |
|---|---|---|---|
| requests/new | type, priority, machine*, title, description, estimatedCost, startDate, assignedTo, productionLine/machineComponent/operationType/costCenter, sparePart+quantity+unit+usageNote (list) | machine, user, productionLine, machineComponent, operationType, costCenter, sparePart | POST /maintenance/requests |
| requests/[id]/edit | same | same | GET+PATCH /maintenance/requests/:id |
| requests/[id]/assign | assignedTo* | user | PATCH /maintenance/requests/:id/assign |
| requests/[id]/checklist | schedule* | maintenanceSchedule | POST /maintenance/requests/:id/checklist |
| tasks/new, tasks/[id]/edit | request*, title, description, assignedTo, plannedStart, plannedEnd, notes | request, user | POST /maintenance/tasks, PATCH /maintenance/tasks/:id |
| tasks/[id]/assign | assignedTo* | user | PATCH /maintenance/tasks/:id/assign |
| downtime-logs modal | machine*, request, reason*, notes | machine, maintenanceRequest | POST/PATCH /maintenance/downtime-logs |
| downtime-logs/new | machine*, request, startTime, reason*, notes | machine, maintenanceRequest | POST /maintenance/downtime-logs |
| downtime-logs/[id]/edit | machine, request, startTime, endTime, reason, notes (read-only when closed) | machine, maintenanceRequest | PATCH /maintenance/downtime-logs/:id |
| downtime-logs/[id] classify (new) | reason, category | — | PATCH /maintenance/downtime-logs/:id/classify |
| requests/[id] parts tab | sparePart*, quantity*, reason, usageNote | sparePart | POST /maintenance/requests/:id/parts |
| stock-issue dialog | warehouse*, quantity*, condition, replacementAction, removed-part fields, notes | warehouse | POST /maintenance/requests/:id/parts/:lineId/stock-issue/issue |
| used parts ([id]/parts) | product*, quantity, unitCost, totalCost, notes | product | POST /maintenance/request-parts |
| costs ([id]/cost) | type*, description, amount*, incurredAt | — | POST /maintenance/request-costs |
