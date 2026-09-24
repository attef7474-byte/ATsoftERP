# Maintenance Workflow — R2-A: Current-State Authority and Canonical Contract

Program: ATsofterp · Maintenance workflow (batch R2)
Phase this document closes: **R2-A — current-state audit (evidence)**.
Scope: read-only audit. No implementation, no migration, no DB/data mutation.
Date: 2026-09-24.
Evidence basis: direct source reads (NestJS services/controllers/DTOs, `apps/api/prisma/schema.prisma`), frontend route audit, permission-seed verification. Line numbers refer to files at HEAD `f14fbe13` (`docs(roadmap): finalize approved ATsoftERP master roadmap closeout`).

---

## 0. Verification invariants (read-only mode)

- Working tree clean at HEAD `f14fbe13cf76e871b03a9029933a53e9ced950aa`; branch `main`; origin/main identical.
- One stash exists (`stash@{0}`) — read-only, untouched, must not be popped during the audit.
- `PrismaService` is a plain PrismaClient — **no tenant middleware**. Tenant checks are per-service method checks.
- Global `ValidationPipe` (`apps/api/src/main.ts`): `whitelist`, `forbidNonWhitelisted`, `transform` — unknown body fields are rejected.
- Backend has permission guards on every endpoint (JwtAuthGuard + PermissionsGuard). No endpoint relies on frontend-only enforcement.
- No build/test/DB was executed; this phase is evidence-from-source only. Runtime proof for fixes is scheduled for R2-B..J.

## 1. Current-state authority map (source of truth inventory)

| Entity | Schema model (line) | Canonical role in the workflow | Backend authority |
|---|---|---|---|
| MaintenanceRequest | `MaintenanceRequest` (2643) | Demand/intake: OPEN default (2636a, `@default("OPEN")`), machine/component/priority/type/emergency | `maintenance-requests.service.ts` (792) |
| MaintenanceRequestRequiredPart | (2721) | Part requirement + approval line (`status @default("REQUESTED")`, 2735) | `maintenance-requests.service.ts` (addRequiredPart) **and** `maintenance-spare-part-request-lines.service.ts` (two create paths — F2/C) |
| MaintenanceWorkOrder | `MaintenanceWorkOrder` (3279) | Execution authority: DRAFT→PLANNED→IN_PROGRESS→COMPLETED/CANCELLED; `actualCost` computed at completion | `maintenance-work-orders.service.ts` (1148) |
| MaintenanceWorkOrderPart | (3342) | WO parts (free-form, NOT tied to required parts) | work-orders service |
| MaintenanceWorkOrderCostEntry | (3370) | WO cost entries (ledger-immutable after posting) | work-orders service |
| MaintenanceRequestPartUsage | (3241) | **Legacy parallel** manual part-usage records (no inventory effect) | `maintenance/request-parts` controller (F12/Path C) |
| MaintenanceRequestCostEntry | (3260) | **Legacy parallel** manual cost records (no ledger) | `maintenance/request-costs` controller (F12/S-5) |
| MaintenanceTask | — | Request tasks | `maintenance-tasks.service.ts` |
| MaintenanceChecklistExecution | (3389) | Mandatory/blocking checks at request complete | maintenance-checklist service |
| DowntimeLog | (3168) | Downtime records (request/emergency created without status/end) | downtime-logs + requests service |
| InventoryBalance + InventoryMovement | (1652, 1822) | **Physical authority**: `@@unique(warehouseId, productId, batchNumber, serialNumber)`; movements immutable | `maintenance-stock-issue.service.ts` + inventory module |
| SparePartConditionBalance / Movement | (3763, 3788) | Condition ledger for repairable stock | spare-part-conditions service |
| OperationalCostTransaction | (5417) | **Monetary cost ledger** (sourceFingerprint = immutable identity) | cost module + work-orders completion posting |
| MachineInstalledPart (+Reading) | (3930, 3993) | Installed-state record | `installed-parts-replacement.service.ts` (592) |
| SparePartReplacementHistory | (4012) | Immutable replacement trace | installed-parts-replacement service |
| SparePartRepairOrder | (3829) | Repairable lifecycle (DRAFT default) | `repair-orders.service.ts` |
| SparePartRepairAction | (3907) | Repair actions | repair-actions endpoints |

### Batch L required-part approval workflow
`DRAFT → REQUESTED (submit) → APPROVED (approve) → RESERVED (reserve) → USED (markUsed)`; lateral `REJECTED`, `CANCELLED`.
- Endpoints: `maintenance/requests/:requestId/parts` (POST create `maintenance-request-parts:create`, PATCH :lineId/approve, PATCH :lineId/reserve; plus submit/reject).
- **Initial-state split (F2/C)**: `maintenance-requests` `addRequiredPart`/create-with-parts creates lines with schema default `REQUESTED` — the submit step is skipped on that path; `spare-part-request-lines` `create()` explicitly sets `DRAFT`. Only DRAFT lines can transition through the approval flow; REQUESTED lines jump straight to APPROVED. Two competing handlers exist for the same entity.

### MaintenanceRequest state machine (documented current behavior)
`OPEN → IN_PROGRESS → COMPLETED (→ CLOSED, close) / CANCELLED`; `reopen(): COMPLETED/CLOSED → OPEN`.
- Dedicated endpoints: POST :id/start, POST :id/complete, POST :id/cancel, POST :id/reopen, POST :id/close (with permission keys `maintenance-request:start|complete|cancel|reopen|close|createEmergency|workflow|activity.view|attachments.view|print|checklist.view|checklist.manage|summary`).
- **Bypass (F1/A)**: `UpdateMaintenanceRequestDto` (`update-maintenance-request.dto.ts:6-31`) allows `status` (`IsIn ['OPEN','IN_PROGRESS','COMPLETED','CANCELLED']`), `startDate`, `endDate`, `downtimeHours`, `cost`; `update()` spreads `...rest` into the Prisma update and only rejects COMPLETED/CANCELLED/CLOSED. OPEN→COMPLETED direct writes therefore bypass `complete()` guards (checklist, machine-status sync, downtime aggregation, SLA/notifications).

### MaintenanceWorkOrder state machine (documented — the strongest authority)
`DRAFT → PLANNED → IN_PROGRESS → COMPLETED / CANCELLED`; dedicated `PATCH :id/status` transition endpoint with per-transition permission keys (`plan|start|complete|cancel`, `issueParts`, `part:*`, `cost:*`).
- `complete()` idempotent (serializable tx + UPDLOCK), ledger-immutable (`assertCostEntryMutable` via fingerprint), and **blocks partially-issued part lines** (~service lines 640-648) — the guard that is missing on the request. Contrast F4 (D/E).
- `issueParts()` atomic: validates PLANNED/IN_PROGRESS, warehouse (company/branch/type), current valuation policy; creates INVENTORY_MOVEMENT, applies `applyValuedIssue`, posts PRIMARY_COST ledger, single physical decrement, sets part FULLY_ISSUED/PARTIALLY_ISSUED; over-issue guarded (P2034 retry).
- `UpdateMaintenanceWorkOrderDto` omits `status` and `parts` (parts via dedicated endpoints guarded on DRAFT/PLANNED + issuedQuantity 0) → **no status bypass** on work orders (unlike F1/A).

### SparePartRepairOrder state machine (documented — partially unreachable)
`ALLOWED_TRANSITIONS` (`repair-orders.service.ts:17-31`):
```
DRAFT → [OPEN, CANCELLED]
OPEN → [IN_INSPECTION, CANCELLED]
IN_INSPECTION → [INSPECTION_FAILED, APPROVED_FOR_REPAIR, DRAFT]
INSPECTION_FAILED → [SCRAPPED, CANCELLED]
APPROVED_FOR_REPAIR → [UNDER_REPAIR, CANCELLED]
UNDER_REPAIR → [UNDER_TEST, WAITING_PARTS, SCRAPPED, CANCELLED]
WAITING_PARTS → [UNDER_REPAIR, CANCELLED]
UNDER_TEST → [COMPLETED_SERVICEABLE, COMPLETED_PARTIAL, COMPLETED_NOT_REPAIRABLE, UNDER_REPAIR]
COMPLETED_* / SCRAPPED / CANCELLED → terminal
```
Reachability findings in F10.

## 2. Proven findings (verdict per disputed item)

Verdict legend: `PROVEN_DEFECT` = defect proven at source with business impact; `PROVEN_GAP` = protection gap proven at source (may require R2-B..J); `ALIGNED` = behavior matches canonical contract; `UNCONFIRMED` = not proven at source.

| ID | Requirement check | Evidence (file:line) | Verdict |
|---|---|---|---|
| F1/A | Generic PATCH cannot bypass status transitions on requests | `update-maintenance-request.dto.ts:6-31`; `maintenance-requests.service.ts` `update()` passes `...rest` incl. `status/startDate/endDate/downtimeHours/cost`; guard rejects only COMPLETED/CANCELLED/CLOSED | **PROVEN_DEFECT (HIGH)** — OPEN→COMPLETED direct write evades checklist/machine/SLA/downtime aggregation |
| F2/C | Required-part initial state + single create path | schema 2735 `@default("REQUESTED")` vs `maintenance-spare-part-request-lines.service.ts` `create()` sets DRAFT; dual endpoints `maintenance/requests/:requestId/required-parts` and `maintenance/requests/:requestId/parts` | **PROVEN_DEFECT** — one entity, two creation semantics; REQUESTED path skips submit and only reaches APPROVED |
| F3 | `update()` required-parts REPLACE_ALL destructive risk | `maintenance-requests.service.ts` `update()`: when `requiredParts` provided (incl. `[]`), deleteMany all + recreate; no status check on replaced lines | **PROVEN_DEFECT (HIGH)** — wipes issued/reserved/approved lines and any downstream references |
| F4/D,E | Request `complete()` must fail on unfinished tasks / partially-issued parts | `maintenance-requests.service.ts` `complete()`: only mandatory checklist + downtime aggregation; no task scan, no part-issuance scan. Contrast work-order `complete()` block at `maintenance-work-orders.service.ts:640-648` | **PROVEN_GAP (D,E)** — request can be completed with open tasks and PENDING/REQUESTED/APPROVED parts |
| F4/F,G | Request complete/close must fail while work orders are OPEN | `complete()`/`close()` (requests service) never query `MaintenanceWorkOrder`; `close()` requires only COMPLETED | **PROVEN_GAP (F,G)** |
| F5/H | `reopen()` restores consumed side effects | requests `reopen()`: OPEN, endDate→null, downtimeHours→0; no machine-state reset, no SLA/task restart, notifications not re-fired | **PROVEN_GAP** |
| F6/I | CLOSED requests must be fully immutable (header + sub-resources) | Header: update() rejects CLOSED. Sub-resources: `maintenance-tasks.service.ts:43` blocks COMPLETED/CANCELLED **only** (not CLOSED); `addRequiredPart` blocks COMPLETED/CANCELLED only; `spare-part-request-lines` `create()` is stricter (blocks CLOSED); `cancelRequiredPart` has no status/terminal guard | **PROVEN_GAP (I)** — closed requests remain mutable through tasks/required-parts/part-lines |
| F7/J | All cross-entity references tenant-validated | requests `validateOperationalContext()`: machine ownership + productionLine/component match checked; but `productionLineId`/`operationTypeId`/`costCenterId` resolved by `findUnique(id)` **without company filter**; `assignedToId` checked for user existence only; work-order `create()` asserts `maintenanceRequest` company/branch but not machine-match; WO sparePart/product refs existence-checked, not tenant-checked | **PROVEN_GAP (J)** — cross-tenant reference possible; WO machine↔request mismatch allowed until completion cost attribution |
| F8/K | `getActivity()` tenant-isolated | requests `getActivity()`: loads request then reads `auditLog` by (entity, entityId) without re-verifying owning request ownership on read | **PROVEN_GAP (K)** — audit read by id is cross-tenant readable |
| F9 | Old/new part identity preserved at replacement & stock issue | `issue()` → `recordReplacementInTx(...)` called **without** oldInstalledPartId/oldSparePartId (persisted null); `dto/issue-stock.dto.ts` has no old-installed-part fields; `markInstalledPartRemovedInTx` (`installed-parts-replacement.service.ts:224`) has **no production caller** → old installed part remains ACTIVE while new part also ACTIVE; condition-IN for the removed part is written under the **new** catalog id; `findRepairableQueue`/`createFromReplacementHistory` key repairable identity by `h.newSparePartId` | **PROVEN_DEFECT (HIGH)** — identity of the removed/repairable part is corrupted when old and new catalog ids differ |
| F10 | Repair workflow fully reachable; result fields persisted | `ALLOWED_TRANSITIONS` (17-31): DRAFT→OPEN declared but **no endpoint calls transition('OPEN')** (`create()` leaves DRAFT; first user action is only cancel). Unreachable: IN_INSPECTION→INSPECTION_FAILED, WAITING_PARTS, COMPLETED_NOT_REPAIRABLE. `inspectionResult` never written; `actualRepairCost` never persisted (not in any DTO); repairDescription written only at completeServiceable; `UpdateRepairStatusDto` (`repair-order.dto.ts:45-48`) accepts repairDescription/notes but services ignore the body | **PROVEN_DEFECT** — state dead-ends + lost business fields |
| F11 | Work-order authority residual integrity | `UPDATE` on WO has **no status guard** (`UpdateMaintenanceWorkOrderDto` omits status/parts but allows machineId/requestId/warehouseId) → executed WO can be re-targeted to another machine/request; `actualCost` computed from manual part `totalCost` (stockIssueStatus != PENDING) + manual cost entries, **not** from ledger/valuation; complete() does not auto-close the source request, mark installed parts, or link replacement history; no create-from-request endpoint | **PROVEN_GAP** (authority itself ALIGNED: transitions + issue atomicity + ledger immutability + partial-issue guard) |
| F12/Path C | Single non-dup path for part usage | `maintenance/request-parts` (usage, `maintenance-request-part:*`) and `maintenance/request-costs` (`maintenance-request-cost:*` in `seed.ts`) create records with **no inventory/movement/ledger effect** — parallel to work-order part/cost authority | **PROVEN_GAP** — legacy parallel records usable against the same request |
| F13 | markUsed is a real consumption | `spare-part-request-lines` `markUsed()`: sets status USED only — no inventory movement, no balance decrement, no MachineInstalledPart, no cost; afterwards stock-issue `issue()` refuses (requires APPROVED/RESERVED) | **PROVEN_DEFECT** — USED lines consume nothing |
| F14 | Legacy return keeps physical twin-sync | `returnStock()`: blocked under ACTIVE valuation; in legacy path updates only `quantity`, not `quantityBase` (physical authority = `SUM(quantityBase)`) | **PROVEN_GAP** — twin divergence |
| F15 | Repair create/cancel adjust condition balances | `repair-orders` `create()`: no decrement of condition balance availableQuantity (over-booking); `cancel()` zeroes reservedQuantity without restoring availableQuantity | **PROVEN_GAP** (ties into F9) |
| F16 | Emergency request type integrity | `createEmergency()`: forces `isEmergency=true` + priority HIGH + downtime log (no status/endTime), but preserves DTO `type` — emergency request can carry a non-EMERGENCY type | **PROVEN_GAP** (validation) |
| F17 | Emergency/cycle hygienic open of permission key | `seed-cmms-permission-keys.ts:85` `maintenance-request:createEmergency` seeded; all workflow keys seeded (see §3) | **ALIGNED** |

## 3. Permission & tenant matrix (verified at seed)

Permission keys verified as seeded (exact lines):
- Requests: `maintenance-request:*` start/complete/cancel/assign/reopen/close/workflow/activity.view/attachments.view/print/checklist.view/checklist.manage/summary/createEmergency (`seed-cmms-permission-keys.ts:28-85`); part `maintenance-request-required-part:*` (`:87-90`); parts-lines `maintenance-request-parts:*` (create/request/approve/reject/reserve/use/cancel, `:150-158`); stock-issue `maintenance-stock-issue:*` (`:171-172`).
- Work orders: `maintenance-work-order:*` plan/start/complete/cancel/issueParts, `maintenance-work-order-part:*`, `maintenance-work-order-cost:*` (`seed.ts:235-247`).
- Repair: `repair-orders:*` read/create/manage/complete/scrap, `repair-actions:*` read/create (`seed.ts:209-215`).

Tenant checks confirmed present: request/machine/component validation; WO warehouse+request company/branch assertions; stock-issue machine/warehouse assertions; installed-parts machine assertion. Gaps listed in F7/F8.

## 4. Frontend reachability (route/UX audit, R2-A)

- `apps/web/src/app/admin/maintenance/**` and `admin/installed-parts/**` implement requests (list+CRUD modal, detail with workflow/parts/stock-issue/history/replacement-history/assign/cost/edit), edit/print/workflow pages, work-orders, repair-orders, installed-parts, tasks, spare-parts, spare-part-plans, SLA, schedules, workload, checklist-items, downtime-logs, machines.
- RTL/LTR: i18n provider + en/ar dictionaries + sidebar nav present.
- Gaps: **no "create work order from request" button/prefill** (work-order create pulls machine from elsewhere); **repair-orders UI is read-only** — no transition action buttons (mirrors F10); **no stock-return trigger** in the UI; raw UUID ids in URL params (tenant-safe at API level; UX-safety to harden).
- These UI gaps are part of R2-I and are consistent with the backend gaps F10/F11.

## 5. Canonical target contract (authoritative for R2-B..J)

- **T1 Single status authority**: status changes only through dedicated transition endpoints; generic update DTOs never accept status (requests included).
- **T2 CLOSED is terminal** for the request header AND all sub-resources (tasks, required parts, part lines, cost/usage entries, stock issue).
- **T3 One create path for required parts** (spare-part-request-lines), initial DRAFT, approval via that path; request-level `requiredParts`/`addRequiredPart` retired.
- **T4 Request complete is validated**: no OPEN tasks, no PENDING/REQUESTED/APPROVED parts, no OPEN work orders; machine status sync; SLA closed; downtime aggregated; audit entries — mirrored GUARDS in complete()/close().
- **T5 Work orders are created from requests** (create-from-request), parts link to required parts; WO complete coordinates the source request (progress lock, installed parts, replacement history, cost roll-up) — no free-form orphan execution.
- **T6 Stock issue is the only path that consumes inventory**; `markUsed`/usage lines route through issue(); USED is derived state, not a pure flag.
- **T7 Old/new part identity is always recorded** (old InstalledPart id + catalog, new InstalledPart row, condition movement keyed correctly); repairable identity comes from the real condition balance, never `newSparePartId`.
- **T8 Repair lifecycle fully reachable and persisted**: DRAFT→OPEN path, INSPECTION_FAILED, WAITING_PARTS, COMPLETED_NOT_REPAIRABLE reachable; `inspectionResult`, `repairDescription`, `actualRepairCost` persisted; create/cancel adjust condition balances atomically.
- **T9 Every cross-entity reference is tenant-scoped** (operationType/costCenter/productionLine/sparePart/product/user); audit/activity reads re-verify owning record ownership.
- **T10 Cost authority is the ledger**: request/usage manual cost entries retired; request actualCost/usage derived from work-order ledger + valuation.

## 6. R2 phase plan (downstream, executable from this contract)

| Phase | Scope | Schema/migration needed |
|---|---|---|
| R2-B | T1/T2/T3 single-path + terminal enforcement (DTO/guards) | none |
| R2-C | T4 request completion guards (tasks/parts/WO/machine) | none |
| R2-D | T6 markUsed retirement + issue()-as-only-path | none |
| R2-E | T7 old/new identity at issue + installed-part integrity + repairable keying (F9) | yes (issue DTO + backfill for repairable keying) |
| R2-F | T8 repair lifecycle reachability + persisted fields + condition-balance adjust (F10/F15) | yes (any additional result columns if needed; `inspectionResult.accepted` mapping) |
| R2-G | T5 work-order-from-request + part linkage + request coordination | likely (linkage) |
| R2-H | T9 tenant hardening (F7/F8) | none |
| R2-I | UI/RTL workflow (create-from-request, repair transition buttons, stock-return, i18n) | none |
| R2-J | T10 cost authority derivation; request-cost/usage legacy deprecation | none |

Each phase requires per-AGENTS proof: unit + service tests, API authorization test, tenant-isolation test, browser proof, Arabic/English RTL/LTR, and honest closeout. All former evidence statements in this doc are to be re-verified by tests before each phase closes.

## 7. R2-A closeout fields

- `TASK_STATUS`: COMPLETE (audit scope; fixes NOT delivered — R2-A is evidence-only)
- `EVIDENCE_DOC`: `docs/proofs/maintenance-workflow-r2-a-current-state-and-canonical-contract.md`
- `MIGRATION_REQUIRED_FOR_R2_B`: no (R2-B..C..D are code-only). Schema work starts at R2-E/R2-F/R2-G with reviewed phased migrations.
- `UNCONFIRMED`: none blocking R2-B; F9/F10 impact requires an isolated fix-phase proof before merge.
- `GIT`: tree clean at HEAD `f14fbe13`; only this new proof file untracked; no commits, no stash operations, no env modifications.
- `R2_B_READY`: TRUE — contract frozen, evidence recorded, next phase executable.