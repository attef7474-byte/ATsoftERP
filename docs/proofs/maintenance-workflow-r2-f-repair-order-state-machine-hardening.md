# R2-F — Repair-Order State Machine Hardening (Source + Closeout)

- **Program:** Maintenance / CMMS
- **Status:** **CLOSED** (implementation + localization + backend + UI + full regression + real-DB API proof + real-browser EN/AR proof + UI click-through + production read-only scan all green)
- **Date:** 2026-09-27
- **Branch:** `maintenance-workflow-r2`
- **Baseline commit:** `fb35e29b8be6bb7eb00601e1b8e9454853100a74`
- **Source commit:** `66762876` — `fix(maintenance): harden repair-order state machine`
- **Closeout commit:** `R2_F_CLOSEOUT_COMMIT` — `docs(maintenance): close R2-F repair-order state machine`
- **Schema change:** none — `R2_F_MIGRATION_REQUIRED=NO` (verified against the live production schema, §7.2)
- **Permission change:** none — `R2_F_PERMISSION_CHANGES_EXPECTED=NONE` (six pre-existing seeded keys reused, §4.2)
- **Runtime proof:** real application, real SQL Server database, real browser automation, authenticated sessions. No mocks, no fake data, no placeholders, no skipped gates.

> Proof environment note: every runtime check below ran against the disposable clone
> `ATsoftERP_R2C_BROWSER_20260924`. The production database `ATsoftERP_DB` was only ever
> **read** (§7.2). No destructive database operation was executed at any point.

---

## 1. Task objective (authoritative)

Close the R2-F slice for **repair-order state machine hardening**. The defect was that the
spare-part repair order lifecycle was not governed by a single authoritative state machine.
Transitions were spread across loosely-guarded endpoints, the UI offered actions the backend
would refuse, one transition silently destroyed inspection evidence, and condition stock was
mutated with a read-modify-write that a concurrent completion could race negative.

R2-F requires:

1. One **canonical transition matrix** in the backend, fail-closed, with an explicit
   source-status guard per route.
2. **Compare-and-set status claims** so a transition cannot be applied twice or from a stale
   status read.
3. **Compare-and-set condition-balance mutation** so concurrent outbound consumption can
   never drive a condition balance negative.
4. **Claim-safe intake**: a repair order may not be opened against stock that other active
   repair orders already claim.
5. A UI action set that is **derived from the same matrix** and never offers an action the
   backend rejects.
6. **Evidence preservation**: a not-repairable verdict after test must not overwrite the
   inspection result.
7. Full **Arabic/English**, **RTL/LTR**, permission, tenant and audit coverage.

**Non-goals (unchanged and still enforced):** no schema/migration change; no weakening of
inventory or stock transactional authority; no new domain; no super-admin bypass; no
production writes.

---

## 2. Canonical transition matrix (single source of truth)

Implemented in `repair-orders.service.ts` as `ALLOWED_TRANSITIONS`, with a per-route
`assertSourceStatus` guard so a route can only be entered from a status that actually has an
edge to the route's target.

| From | Allowed targets |
| --- | --- |
| `DRAFT` | `OPEN`, `CANCELLED` |
| `OPEN` | `IN_INSPECTION`, `CANCELLED` |
| `IN_INSPECTION` | `INSPECTION_FAILED`, `APPROVED_FOR_REPAIR`, `DRAFT` |
| `INSPECTION_FAILED` | `SCRAPPED`, `CANCELLED` |
| `APPROVED_FOR_REPAIR` | `UNDER_REPAIR`, `CANCELLED` |
| `UNDER_REPAIR` | `UNDER_TEST`, `WAITING_PARTS`, `SCRAPPED`, `CANCELLED` |
| `WAITING_PARTS` | `UNDER_REPAIR`, `CANCELLED` |
| `UNDER_TEST` | `COMPLETED_SERVICEABLE`, `COMPLETED_PARTIAL`, `COMPLETED_NOT_REPAIRABLE`, `UNDER_REPAIR` |
| `COMPLETED_SERVICEABLE`, `COMPLETED_PARTIAL`, `COMPLETED_NOT_REPAIRABLE`, `SCRAPPED`, `CANCELLED` | *(terminal — no outgoing transitions)* |

Two deliberate, documented properties:

- `IN_INSPECTION → DRAFT` is **declared but unrouted**. The edge exists in the matrix; no
  route targets `DRAFT`. The backend therefore fails closed on it, and the UI test asserts the
  edge has no action bound to it. This is intentional, not an oversight.
- `startRepair` is reachable from `APPROVED_FOR_REPAIR` and `UNDER_TEST` but **not** from
  `WAITING_PARTS`. Returning from a parts wait is a distinct, separately audited transition
  (`resumeFromPartsWait`). The backend enforces this; the UI mirrors it. A test asserts the
  UI action is *not* a superset of the backend guard.

Cancellation is **not** available from `IN_INSPECTION` or `UNDER_TEST`: those states have no
cancel edge. An order in inspection must first record an inspection result; an order under
test must first go back to repair. This was the original UI defect (see §3.2).

---

## 3. Source changes

### 3.1 Backend — `apps/api/src/modules/factory/maintenance/repair-orders/`

| File | Change |
| --- | --- |
| `repair-orders.service.ts` | Canonical `ALLOWED_TRANSITIONS`; `assertSourceStatus` per route; CAS status claims; CAS condition-balance mutation; claim-safe intake; evidence-preserving not-repairable completion; terminal claim release; audit on every transition. |
| `repair-orders.controller.ts` | Lifecycle routes bound to the guarded service methods, each with an explicit permission. |
| `dto/repair-order.dto.ts` | Validation for the new lifecycle inputs (`OpenRepairOrderDto`, `RecordInspectionResultDto`, `WaitForPartsDto`, `ResumeFromPartsWaitDto`, `CompleteNotRepairableDto`, …). |
| `repair-orders.r2f.spec.ts` | **New.** R2-F regression suite — 234 tests. |
| `../spare-part-conditions/spare-part-conditions.service.ts` | Removed an invalid `where.limit` that made `limit` a hard filter instead of a page size (§3.4). |
| `../spare-part-conditions/spare-part-conditions.service.spec.ts` | Three regression tests for the pagination fix. |
| `src/common/i18n/api-messages.ts` | Backend repair-order message catalogue entries. |

**Inventory safety — the concurrency fix.** Condition balances are mutated with a
conditional (compare-and-set) `updateMany` whose `where` clause carries the sufficiency
precondition, rather than a read-modify-write:

```
where: { id, quantity: { gte: qty }, availableQuantity: { gte: qty } }   // direction OUT
data:  { quantity: { decrement: qty }, availableQuantity: { decrement: qty } }
```

If the precondition fails, `updateMany` affects zero rows and the service raises
`stock.insufficientConditionBalance`. Two concurrent completions that read the same
`quantity` can no longer each compute a new value and let the last writer drive the balance
negative — the check and the write are a single atomic row operation, so the guard cannot be
raced past.

**Claim semantics (documented, not changed by R2-F).** `SparePartConditionBalance.availableQuantity`
mirrors `quantity`; it is *not* on-hand-minus-reserved and has no reserved concept. A repair
claim is an **active repair-order aggregate** (`sum(reservedQuantity)` over non-terminal
orders), and it is *not* a balance decrement. The balance is only reduced when stock actually
leaves (completion, scrap, not-repairable).

**Intake concurrency limit (stated honestly).** Claim aggregation and the claim write happen
in one transaction, so an over-claim is rejected. However, the *balance read* used to seed
that check happens outside the transaction. Intake claim safety is therefore transactional
but **not fully serializable** under true concurrency. This is recorded as a known limitation
(§9), not claimed as airtight. Outbound consumption *is* fully guarded by the CAS above.

**Evidence preservation.** `completeNotRepairable` previously wrote the reason into
`inspectionResult`, destroying the inspection evidence. It now appends to
`failureDescription` as `Not repairable after test: <reason>` and leaves `inspectionResult`
intact. Proven at runtime (§6.1) and by regression test.

**`COMPLETED_PARTIAL` residual semantics.** A partial completion permits untouched residual
stock: the terminal order releases its whole claim while only the *processed* quantity
(`.repairedQuantity + .scrappedQuantity`) leaves the source pool. This is intentional and is
pinned by a regression test so it cannot be silently changed.

**`createFromReplacementHistory`** delegates to `this.create(...)` and therefore inherits
claim-safe intake rather than duplicating it.

### 3.2 Frontend — `apps/web/`

| File | Change |
| --- | --- |
| `repair-orders/repair-order-actions.ts` | **New.** Plain, testable `REPAIR_ACTIONS` definition (route, permission, source statuses, label key, input requirement, danger flag) plus `availableActions()`. No JSX, so it is directly unit-testable. |
| `repair-orders/page.tsx` | Consumes the shared action module; action enablement is `def.statuses.includes(order.status) && can(def.permission)`; icon names are mapped to JSX in the page. |
| `tests/repair-order-actions.test.ts` | **New.** Parses the *real* backend `ALLOWED_TRANSITIONS` and per-route source guards out of the service, and asserts the UI set is sound (no over-approximation), terminal states expose nothing, every backend edge is reachable, routes are unique, and cancel is offered exactly from the six cancellable statuses. |
| `tests/repair-order-action-labels.test.ts` | **New.** Resolves every action label key against the real EN and AR dictionaries. |
| `src/lib/i18n/locales/{en,ar}/maintenance.ts` | Repair-order action labels. |

The original UI defect: cancel was offered from `IN_INSPECTION` and `UNDER_TEST`, where the
backend has no cancel edge, so the user got a dead button and a rejected request. The
backend-parity test caught both. It also caught that action labels rendered as
missing-key fallbacks, because the repair-order label block had been filed under an unused
`sparePartRequest` namespace; the block was relocated into `maintenance` in both locales and
four keys that already existed in `maintenance` (`repairOrders`, `repairedQuantity`,
`estimatedCost`, `actualCost`) were dropped from the moved block rather than duplicated.

### 3.3 Routes and permissions

Lifecycle routes (all `@Permissions`-guarded, all tenant/branch scoped through
`@CurrentActiveContext`):

```
POST /maintenance/repair-orders/:id/open
POST /maintenance/repair-orders/:id/start-inspection
POST /maintenance/repair-orders/:id/inspection-result
POST /maintenance/repair-orders/:id/approve-repair
POST /maintenance/repair-orders/:id/start-repair
POST /maintenance/repair-orders/:id/wait-for-parts
POST /maintenance/repair-orders/:id/resume-from-parts-wait
POST /maintenance/repair-orders/:id/start-test
POST /maintenance/repair-orders/:id/complete-serviceable
POST /maintenance/repair-orders/:id/complete-partial
POST /maintenance/repair-orders/:id/complete-not-repairable
POST /maintenance/repair-orders/:id/scrap
POST /maintenance/repair-orders/:id/cancel
```

### 3.4 Pre-existing defect fixed in passing

`spare-part-conditions.service.ts` applied the page size as a `where.limit` **filter**
alongside `take`, so a page could return fewer rows than requested (or none) once any other
filter was present. `where.limit` was removed; `take: query.limit || 100` is authoritative.
Three regression tests were added. This was found by the R2-F proof, is a real bug, and is
included in the source commit.

---

## 4. Tests

### 4.1 Results

| Suite | Command | Result |
| --- | --- | --- |
| API (full) | `npm run test:api` | **171 suites / 3374 tests passed** |
| API R2-F focused | `jest repair-orders.r2f.spec` | **234 passed** |
| API condition movements focused | `jest spare-part-conditions.service.spec` | **12 passed** |
| Web logic (full) | `npm run test:web-logic` | **41 suites / 1043 tests passed** |

The full API count moved 3371 → 3374, exactly the three added movement-pagination tests.

### 4.2 Permission coverage

Six **pre-existing, already-seeded** permission keys are reused; no permission was invented:

`repair-orders:read`, `repair-orders:create`, `repair-orders:manage`,
`repair-orders:complete`, `repair-orders:scrap`, `repair-actions:create`

The backend requires them per route and the UI applies the same key per action
(`def.permission`). Confirmed seeded in the existing seed scripts, so
`R2_F_PERMISSION_CHANGES_EXPECTED=NONE` holds.

### 4.3 Not verified / out of scope

No permission **denial** browser test was executed for a non-admin role in this slice; the
denial path is covered at the guard/unit level and by `route-contract:check`. Recorded as a
residual gap in §9, not as a pass.

---

## 5. Validation gates (all green, final working tree)

| # | Gate | Command | Result |
| --- | --- | --- | --- |
| 1 | API typecheck | `tsc --noEmit` (api) | pass, no output |
| 2 | Web typecheck | `tsc --noEmit` (web) | pass, exit 0 |
| 3 | API tests | `npm run test:api` | 171 / 3374 pass |
| 4 | Web tests | `npm run test:web-logic` | 41 / 1043 pass |
| 5 | Prisma validate | `npx prisma validate` | schema valid |
| 6 | Full build | `npm run build` | pass; `/admin/maintenance/repair-orders` in route output |
| 7 | i18n consistency | `npm run i18n:check` | 6187 EN = 6187 AR, 22 namespaces, 9795 literal `t()` keys resolve |
| 8 | Raw-key safety | `npm run raw-keys:check` | pass |
| 9 | Route contract | `npm run route-contract:check` | 1118 matched, 0 malformed, 0 unresolved, 0 mismatches |
| 10 | UI/i18n baseline | `npm run ui-baseline:check` | `UI VERIFICATION PASSED` |
| 11 | Credentials | `npm run credentials:check` | no hardcoded credentials |
| 12 | Whitespace | `git diff --check` | clean |

Lint is **not** a gate: `npm run lint` runs the deprecated interactive `next lint` and
`apps/web/eslint.config.mjs` is empty. This is pre-existing tooling debt and was deliberately
not expanded into scope. No source validation in this slice depends on it.

---

## 6. Runtime proof (real API, real database, real browser)

All against the disposable clone `ATsoftERP_R2C_BROWSER_20260924`, proof API on `:4010`,
proof web on `:3010` (user services on `:3000`/`:4000` untouched). The clone proof account
`r2e-proof-admin-T1@atsofterp.local` was used; its password is read at runtime and was never
persisted or printed.

### 6.1 API proof — 24/24 passed

Proven against the real service and database:

- Condition movement pagination returns the requested page size with tenant filter applied.
- Over-claim beyond available condition stock is rejected.
- Full lifecycle `DRAFT → OPEN → IN_INSPECTION → APPROVED_FOR_REPAIR → UNDER_REPAIR → UNDER_TEST → COMPLETED_NOT_REPAIRABLE` succeeds.
- **Evidence preserved**: `inspectionResult` still holds the original inspection text after
  the not-repairable completion, and the reason is appended to `failureDescription`.
- Source condition stock decreased by exactly the processed quantity (19 → 17 at that point).
- Exactly one `OUT` movement and no spurious `IN` movement was written.
- Every action from a terminal state is rejected.
- Cancel is rejected from `IN_INSPECTION` and `UNDER_TEST`; accepted from the six statuses
  that have the edge.
- The frozen R2-E order is unchanged by the proof run.

### 6.2 Browser proof — 35/35 passed

Authenticated Playwright run against the real admin UI:

- Login succeeds and the repair-order grid loads.
- All rendered rows expose exactly the action set the matrix allows.
- Terminal rows expose no actions at all.
- The frozen order renders `DRAFT` with Open / Cancel.
- English renders LTR and Arabic renders RTL, with all labels resolved (no missing-key text).
- Zero console errors.

### 6.3 UI click-through proof — 11/11 passed (new)

A build passing is not proof, so an order was driven forward using **only real clicks in the
browser** — no direct state manipulation — to prove `Frontend → API → Permission → Service →
Database → Result`:

| Step | Clicked | Observed result |
| --- | --- | --- |
| 1 | created an order in the browser session | `DRAFT`, menu = `Open Repair Order, Cancel` |
| 2 | **Open Repair Order** | menu becomes `Start Inspection, Cancel` (i.e. status is now `OPEN`) |
| 3 | **Start Inspection** | menu becomes `Record Inspection Result` **only** — no cancel, confirming the §2 rule in the real UI |
| 4 | **Record Inspection Result** → `Not Repairable` + evidence + failure description | menu becomes `Scrap, Cancel` (i.e. status is now `INSPECTION_FAILED`) |
| 5 | **Scrap** | order is terminal |
| 6 | re-opened the menu | **no actions remain** |
| 7 | console inspection | zero console errors |

This also exercised the conditional `failureDescription` field, which is only rendered once a
not-repairable verdict is chosen — a correct progressive-disclosure behaviour that a
first, deliberately naive proof attempt initially misread as a dead end.

---

## 7. Database verification (read-only)

### 7.1 Clone final state — clean

Read-only verification of `ATsoftERP_R2C_BROWSER_20260924`:

- Status histogram: `CANCELLED` ×12, `SCRAPPED` ×3, `COMPLETED_NOT_REPAIRABLE` ×1,
  `COMPLETED_SERVICEABLE` ×1, `DRAFT` ×1 (the frozen order only).
- **No active proof orders remain**; **no non-terminal proof orders remain**; **no terminal
  order retains a reserved claim**.
- Claim sums: only the frozen `DRAFT` holds `reservedQuantity = 4`; every other order is 0.
- Condition balances: `USED_REPAIRABLE = 16`, `USED_SERVICEABLE = 3`. The reconciliation is
  complete and attributable to recorded movements: start 19, minus 2 for the
  not-repairable completion, minus 1 for the click-through scrap; 3 converted to
  `USED_SERVICEABLE` by the R2-E completion.
- Condition movement ledger: 10 movements, including `SCM-000031` (`REPAIR_NOT_REPAIRABLE`,
  OUT) and `SCM-000032` (`REPAIR_SCRAPPED`, OUT).
- 90 audit events for repair orders, each carrying `previousStatus` / `newStatus` and the
  transition payload.
- 16 terminal orders were additionally probed with a cancel request and **all 16 correctly
  rejected it with HTTP 400** — terminal immutability proven in bulk, not by assumption.

### 7.2 Production read-only scan — clean, and no migration needed

Against `ATsoftERP_DB`, read-only, with a hard assertion that the active database really is
`ATsoftERP_DB` before any query runs:

| Check | Result |
| --- | --- |
| Repair orders carrying an R2-F/R2-E proof marker | **0** |
| Repair orders using the R2-F proof numbers (`RPO-000013`…`RPO-000020`) | **0** |
| Audit rows for repair entities carrying proof markers | **0** |
| Condition movements carrying proof markers | **0** |
| Inventory movements carrying proof markers | **0** |
| The frozen R2-E order | **absent** — it only ever existed in the clone |
| Total production repair orders | **0** (module not yet populated in production) |

**`R2_F_MIGRATION_REQUIRED=NO` is now proven against the live production schema**, not merely
asserted: all 20 columns R2-F reads and writes are already present in production
`spare_part_repair_orders` — `source_quantity`, `reserved_quantity`, `repaired_quantity`,
`scrapped_quantity`, `remaining_quantity`, `target_condition`, `status`, `source_type`,
`inspection_result`, `failure_description`, `opened_at`, `inspection_started_at`,
`repair_started_at`, `test_started_at`, `completed_at`, `cancelled_at`, `cancel_reason`,
`condition_in_movement_id`, `condition_out_movement_id`, `inventory_scrap_movement_id`.

---

## 8. Tenant and branch isolation

- Every route takes the active operational context from `@CurrentActiveContext` and resolves
  company/branch server-side; no client-supplied company or branch is trusted.
- The repair order carries no `companyId` of its own — tenancy is derived through
  `warehouseId → Warehouse.companyId`, and the warehouse must belong to the active company and
  a compatible branch before stock is touched.
- The clone proof exercised the real warehouse-scoped balance endpoint and the real
  tenant-filtered movement list.
- The `spare-part-conditions` pagination fix is itself a tenant-isolation-relevant change: the
  tenant filter is applied in the query while the removed `where.limit` no longer silently
  truncated tenant-scoped results.
- Cross-company read/write by id is covered by existing suite coverage plus the 3374-test
  regression; the new R2-F tests assert the guarded transitions reject a mismatched source
  status rather than relying on tenant shape alone.

---

## 9. Known limitations and honest caveats

1. **Intake claim safety is transactional but not fully serializable.** The balance read that
   seeds the claim check happens outside the claim transaction (§3.1). Outbound consumption is
   fully CAS-guarded; intake is not. Not claimed as airtight.
2. **Permission-denial browser test not executed** for a non-admin role in this slice (§4.3).
   Denial is covered at guard/unit level only.
3. **A test-suite teardown warning is pre-existing**: Jest reports
   "A worker process has failed to exit gracefully". All 171 suites and 3374 tests pass; this
   is a leaked-handle warning, not a failure, and predates R2-F.
4. **Lint is not a usable gate** in this repository (§5).
5. **`SparePartConditionMovement` has no quantity column** in the Prisma schema (production
   has an extra unmapped `quantity` column). Repair consumption quantity is therefore applied
   to the balance and referenced through the order and the movement notes rather than being
   self-describing on the movement row. This is a **pre-existing schema observation**, out of
   R2-F scope, and no migration was made.
6. **Pre-existing production schema drift, unrelated to R2-F and not touched**: production
   `inventory_movements` uses camelCase columns (`sourceType`, `movementType`, `companyId`,
   `warehouseId`) whereas `schema.prisma` maps those fields to snake_case. R2-F never queries
   `inventory_movements`, so this does not block or affect R2-F, but it is reported here
   because it was observed during the read-only scan and would affect inventory work.
7. **Clone-only fixture history, disclosed rather than hidden**: during an early cleanup run a
   script referenced a non-existent ids key and cancelled the frozen R2-E order
   `RPO-000001`. It was restored immediately to its original business state (`DRAFT`,
   `reservedQuantity = 4`, cancellation fields cleared) and the cleanup guard now fails closed
   on a missing key. Two honest residue notes remain: (a) the `SPARE_PART_REPAIR_CANCELLED`
   audit event for that order still exists in the **clone**, and it was deliberately **not
   deleted**, because deleting an audit row would falsify history; (b) the restore bumped the
   clone row's `updatedAt`. The order's business fields are identical to the frozen baseline.
   Production was never involved (`PROD_FROZEN_ORDER=absent`, §7.2).
8. **Proof scripts live outside the repository** in the temp working directory, consistent with
   the R2-C/R2-D/R2-E precedent, so no proof tooling is committed.

---

## 10. Definition-of-done checklist

| Requirement | Status |
| --- | --- |
| Canonical fail-closed state machine | done — §2 |
| CAS status claims | done — §3.1 |
| CAS condition-balance mutation (no negative stock) | done — §3.1 |
| Claim-safe intake, with limitation stated | done — §3.1, §9.1 |
| Evidence preservation on not-repairable | done — §3.1, §6.1 |
| Real backend routes, DTO validation, thin controller | done — §3.1, §3.3 |
| Permissions defined, seeded, enforced, applied in UI | done — §4.2 (no new keys) |
| Audit on every transition | done — §6.1, §7.1 (90 events) |
| Frontend connected to the real API | done — §6.2, §6.3 |
| UI action set derived from the backend matrix | done — §3.2, backend-parity test |
| Arabic + English, RTL + LTR | done — §5 gate 7, §6.2 |
| No schema change, no production write | done — §7.2 |
| Tests meaningful and passing | done — §4.1 |
| Runtime workflow proven, not just compiled | done — §6.1, §6.2, §6.3 |
| No unrelated files changed | done — 9 modified, 5 new, all R2-F |
| Limitations reported honestly | done — §9 |

**Final status: COMPLETE.**
