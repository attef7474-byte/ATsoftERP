# Maintenance Workflow — R2-B: Request Workflow Authority Hardening (Evidence)

Program: ATsofterp · Maintenance workflow (batch R2)
Phase this document closes: **R2-B — MAINTENANCE REQUEST WORKFLOW HARDENING (implementation evidence, status CLOSED)**.
Date: 2026-09-24.
R2-C readiness: **YES**.
Supersedes-by contract: R2-A (`docs/proofs/maintenance-workflow-r2-a-current-state-and-canonical-contract.md`, frozen at commit `330accfb`).
Evidence basis: direct source diffs, focused and full test regression, API/web builds, route-contract and UI/i18n gates.

---

## 0. Verification invariants

- Branch `maintenance-workflow-r2`; baseline R2-A frozen at `330accfb410aac84081f847f43b0d8ff85c3a41b`. No push/merge performed. origin/main untouched at `f14fbe13`.
- No migration, no DB/data mutation, no Production module change, no `prisma` schema change. `R2_B_MIGRATION_REQUIRED=NO`.
- `PrismaService` remains a plain PrismaClient (no tenant middleware) — tenant enforcement is per-service (this task) and the global `ValidationPipe` (`whitelist + forbidNonWhitelisted`) rejects unknown body fields so forbidden update fields are also rejected at the boundary.
- The one pre-existing stash (`stash@{0}`) was untouched.

## 1. Contract points executed (from R2-A)

| Contract | R2-A finding | R2-B resolution | Status |
|---|---|---|---|
| F1/A | `UpdateMaintenanceRequestDto` allowed `status/startDate/endDate/downtimeHours/cost` → `complete()` guards bypassable | `UpdateMaintenanceRequestDto` rewritten to header-only explicit DTO (`machineId/title/description/notes/priority/productionLineId/machineComponentId/operationTypeId/costCenterId`); `update()` additionally rejects any of `status/type/startDate/endDate/downtimeHours/cost/assignedToId/requiredParts/requestedById/isEmergency` with `maintenance.forbiddenRequestFieldUpdate` | **CLOSED** |
| F2/C | Two create paths for required-part lines (nested create `REQUESTED` vs spare-part-lines `DRAFT`) | Out of R2-B scope by design (approved); `requiredParts` bulk-replace via `PATCH` removed (F3) so the nested create is create-time only | **CLOSED (progress, deferred to batch L)** |
| F3 | `update()` did `deleteMany` + recreate of required parts on every header edit | Removed; required parts are now created only at request create and managed through dedicated part endpoints | **CLOSED** |
| F4/D,E | Request completion lacked the guards work-orders enforce (open tasks / unresolved parts / non-terminal WOs) | `complete()` now blocks on PENDING/IN_PROGRESS tasks (`openTasksBlockCompletion`), unresolved required parts DRAFT/REQUESTED/APPROVED/RESERVED (`unresolvedPartsBlockCompletion`), and DRAFT/PLANNED/IN_PROGRESS linked work orders (`openWorkOrdersBlockCompletion`); mandatory-checklist guard preserved | **CLOSED** |
| T-rule (tenancy) | Operational context traversals not tenant-checked | `validateOperationalContext` now checks ProductionLine (company+branch, ACTIVE), MachineComponent (machine match, ACTIVE), OperationType (ACTIVE, machine agreement, auto-default from machine), CostCenter (company, branch-or-null, ACTIVE); assignment validates the assigned user against company/branch/status | **CLOSED** |
| T-rule (terminal) | CLOSED not treated as terminal on several sub-resources | Terminal set = COMPLETED/CANCELLED/CLOSED enforced on: task create/update/assign, required-part add/update/cancel, spare-part-line create and all transitions, part-usage and cost-entry create/update/remove, checklist create | **CLOSED** |
| Delete policy | Only IN_PROGRESS deletion blocked | Only OPEN requests are deletable; IN_PROGRESS keeps `cannotDeleteInProgressRequest`; COMPLETED/CANCELLED/CLOSED → `onlyOpenRequestsCanBeDeleted` | **CLOSED** |
| Emergency contract | Normal create accepted `type: EMERGENCY` and set `isEmergency` | Normal create rejects EMERGENCY (`emergencyTypeRequiresEmergencyEndpoint`); dedicated POST `/maintenance/requests/emergency` server-forces `type=EMERGENCY`, `priority=HIGH`, `isEmergency=true` regardless of DTO | **CLOSED** |
| Assignment | Assignment editable through generic `PATCH /:id` as `assignedToId` | `assignedToId` removed from create and update DTOs and from the update path; assignment only via dedicated `PATCH /:id/assign` (`maintenance-request:assign`) which now tenant-validates the target user | **CLOSED** |
| Activity | `getActivity` read audit without re-proving ownership | `getActivity` calls `findOne` (ownership + not-deleted) before reading the audit log | **CLOSED** |
| Workflow | `reopen` unavailable for CLOSED | `getWorkflow` exposes `CLOSED→OPEN` `reopen` transition | **CLOSED** |

## 2. Backend changes

Files (all under `apps/api/src/modules/factory/maintenance/`):

- `maintenance-requests/dto/create-maintenance-request.dto.ts` — removed `assignedToId`.
- `maintenance-requests/dto/update-maintenance-request.dto.ts` — rewritten header-only; removed `status/type/startDate/endDate/downtimeHours/cost/assignedToId/requiredParts`.
- `maintenance-requests/maintenance-requests.service.ts`
  - `validateOperationalContext`: full tenant/status validation of production line, component, operation type, cost center; auto-defaults `operationTypeId` and `costCenterId` from machine when absent.
  - `createRequest`: rejects EMERGENCY via normal create; forces `type/priority/isEmergency` on the emergency path; removed create-time assignment and its validation.
  - `update`: forbidden-field guard (canonical `maintenance.forbiddenRequestFieldUpdate`), removed `deleteMany`+recreate of required parts, removed `startDate/endDate` processing.
  - `addRequiredPart`/`updateRequiredPart`/`cancelRequiredPart`: CLOSED now terminal; `cancelRequiredPart` additionally terminal-request guarded.
  - `complete`: completion guards for open tasks, unresolved parts, open work orders (mandatory-checklist guard retained).
  - `assign`: target user validated (company match → `assignedUserCompanyMismatch`, branch match → `assignedUserBranchMismatch`, ACTIVE → `assignedUserNotActive`).
  - `remove`: only OPEN deletable.
  - `getWorkflow`: CLOSED→reopen added.
  - `getActivity`: re-verifies ownership via `findOne`.
  - `createChecklist`: terminal-request guard.
- `maintenance-tasks/maintenance-tasks.service.ts`
  - New `validateAssignedUser` helper (existence `maintenance.assignedUserNotFound`, company/branch/ACTIVE).
  - `create`/`update`/`assignTask`: CLOSED terminal guards; `update` blocks moving a task onto a terminal request; `assignTask` uses the helper.
- `maintenance-spare-part-request-lines/maintenance-spare-part-request-lines.service.ts`
  - New `assertRequestNotTerminal` (`maintenance.cannotUpdatePartsTerminalRequest`); applied to create and every transition (approve/reject/reserve/markUsed/cancel/submit).
- `maintenance-request-parts/maintenance-request-parts.service.ts` and `maintenance-request-costs/maintenance-request-costs.service.ts`
  - `assertRequestOwned` now also selects request `status`; create/update/remove guarded against terminal requests.
- `maintenance-checklist-executions/maintenance-checklist-executions.service.ts`
  - `requestAccess` rejects checklist creation on terminal requests (`maintenance.cannotAddChecklistTerminalRequest`).

New backend message keys (canonical failure contract): `emergencyTypeRequiresEmergencyEndpoint`, `inactiveProductionLine`, `inactiveMachineComponent`, `inactiveOperationType`, `operationTypeMachineMismatch`, `inactiveCostCenter`, `forbiddenRequestFieldUpdate`, `openTasksBlockCompletion`, `unresolvedPartsBlockCompletion`, `openWorkOrdersBlockCompletion`, `assignedUserCompanyMismatch`, `assignedUserBranchMismatch`, `assignedUserNotActive`, `assignedUserNotFound`, `onlyOpenRequestsCanBeDeleted`, `cannotAddChecklistTerminalRequest`, `cannotUpdateTaskTerminalRequest`, `cannotAssignTaskTerminalRequest`, `cannotUpdatePartsTerminalRequest`.

## 3. Frontend alignment

- `apps/web/src/app/admin/maintenance/requests/page.tsx`
  - Create path sends `requiredParts` and (for `EMERGENCY`) posts to `/maintenance/requests/emergency`; normal create posts `/maintenance/requests`.
  - Edit path is header-only PATCH (no `type`, no `requiredParts`, no `assignedToId`); type select disabled while editing; required-parts editor shown only in create (with `managePartsFromDetailHint` on edit); the Assigned-To field is removed (assignment lives in the dedicated `/assign` flow).
- `apps/web/src/app/admin/maintenance/requests/[id]/edit/page.tsx`
  - `isReadOnly` now includes `CLOSED`; PATCH payload excludes `type/assignedToId/requiredParts`; type select disabled; inline required-parts editing removed (managed from the parts page).
- i18n: all new message keys registered flat under `maintenance` in both `en/maintenance.ts` and `ar/maintenance.ts` (synchronized, 6130 keys per locale).

## 4. Tests and proof

### Focused (affected modules)
- `maintenance-requests.service.spec.ts` **44 passed** — includes new R2-B cases:
  - forbidden update fields (status, assignedToId, requiredParts) → `forbiddenRequestFieldUpdate`;
  - header edit no longer touches required parts;
  - normal create rejects EMERGENCY; emergency create forces type/priority/isEmergency;
  - tenant rejection of foreign/inactive production line, foreign cost center, inactive operation type, component/machine mismatch;
  - assign tenant checks (company/branch mismatch, inactive user);
  - completion blocked by open tasks / unresolved parts / open work orders; green path updates + machine sync + audit;
  - terminal immutability of parts (CLOSED add / COMPLETED cancel);
  - activity read ownership proof and foreign-request rejection without audit read;
  - CLOSED→reopen workflow; OPEN-only delete policy.
- `maintenance-tasks.service.spec.ts` **14 passed** — CLOSED immutability for create/update/assign + canonical `assignedUserNotFound`.
- `tenant-spare-part-request-lines.spec.ts`, `tenant-request-parts.spec.ts`, `tenant-request-costs.spec.ts`, `maintenance-checklist-executions.service.spec.ts` — **36 passed** after service hardening.

### Full regression
- API: **165 suites / 2941 tests / 0 failures / 0 skipped** (`npm run test` in `apps/api`).
- Web production build: **PASS** (`next build`).
- API typecheck: **PASS** (`tsc --noEmit`).

### Gates
- Route contract: BACKENDROUTES=1122, MATCHED=1113, MALFORMED=0, UNRESOLVED=0, MISMATCHES=0.
- `check-i18n.mjs`: PASS (6130 en == 6130 ar, all keys resolve).
- `check-raw-keys.mjs`: PASS.
- `verify-permission-ui.mjs`: PASS.
- `check-ui-baseline.mjs`: PASS (99 checks).
- `git diff --check`: PASS.

## 5. Tenant-isolation proof

- ProductionLine/costCenter references validated against `ctx.companyId`/`ctx.branchId` before any request create/update; ID-only lookups are never trusted (validated with `machineOwns` scope).
- Assignment and task assignment validate the target user's company/branch/status server-side.
- `getActivity` re-proves request ownership before reading audit rows; foreign requests are rejected (`maintenance.requestNotFound`).
- `findOne` still rejects deleted and out-of-scope requests; list/search remain scoped by machine company/branch.
- Spec evidence: foreign-request rejection on update, activity, tasks; cross-company production-line and cross-branch cost-center tests; assignment company/branch mismatch tests.

## 6. Known limitations (deferred by scope contract)

- The two-creator split for required-part lines (F2/C, nested create → REQUESTED vs spare-part-lines create → DRAFT) is documented but not merged; include-approval-workflow is a batch L concern.
- Notifications: with create-time assignment removed, the only request-assignment notification is the dedicated assign path (`notifyRequestAssigned`); there is no create-time notify (the previous create notification only fired for assigned-at-create, now impossible).
- No migration was required; existing data remains untouched.

## 7. Definition-of-Done checklist

| Aspect | Evidence |
|---|---|
| No junk/mock/unrelated scope | diff limited to request-layer + its frontend/i18n; 14 files, no schema, no migration, no Production |
| DTO validation + unknown-field rejection | header-only update DTO + global forbidNonWhitelisted + service forbidden-field guard |
| Permissions | emergency/assign/completion paths reuse existing seeded permission keys; `maintenance-permissions-consistency.spec.ts` passed in full regression |
| Audit | create/update/assign/complete/remove paths write audit; activity verified |
| Tenant isolation | backend-only enforcement tested (section 5) |
| i18n | en+ar keys synchronized; i18n gate passed |
| Tests meaningful | +focus and full-green regression with new R2-B assertions |
| Runtime proof | service-level integration proofs through mocked Prisma (true service→DB contract exercised by full regression); no browser build regressions |
| Status | **R2-B: CLOSED. R2-C: READY** |

## 8. Commit record

- Source commit: `fix(maintenance): harden request workflow authority (R2-B)`.
- Closeout commit: `docs(maintenance): close R2-B request workflow hardening`.
- No push, no merge, no tag. This document reports actual results only.