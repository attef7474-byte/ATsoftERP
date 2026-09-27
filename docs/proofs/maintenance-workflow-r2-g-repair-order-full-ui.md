# R2-G — Repair-Order Full UI & Operator Workspace (Source + Closeout)

- **Program:** Maintenance / CMMS
- **Status:** **CLOSED** (implementation + localization + backend + UI + full regression + real-DB API proof + real-browser EN/AR proof + permission/tenant proof + audit proof + production read-only scan all green)
- **Date:** 2026-09-27
- **Branch:** `maintenance-workflow-r2`
- **Baseline commit:** `a393d77b` — `docs(maintenance): close R2-F repair-order state machine`
- **Source commit:** `437efa52` — `feat(maintenance): deliver repair-order full UI and operator workspace`
- **Closeout commit:** `R2_G_CLOSEOUT_COMMIT` — `docs(maintenance): close R2-G repair-order full UI`
- **Schema change:** none — `R2_G_MIGRATION_REQUIRED=NO` (proven against the live production schema, §7.3)
- **Permission change:** none — `R2_G_PERMISSION_CHANGES_EXPECTED=NONE` (five pre-existing seeded `repair-orders:*` keys reused, §4.2)
- **Runtime proof:** real application, real SQL Server database, real browser automation, authenticated sessions. **No mocks, no fake data, no placeholders, no skipped gates.**

> Proof environment note: every runtime check below ran against the disposable clone
> `ATsoftERP_R2C_BROWSER_20260924`. The production database `ATsoftERP_DB` was only ever
> **read** (§7.3). No destructive database operation was executed at any point.

---

## 1. Task objective (authoritative)

Close the R2-G slice for **repair-order full UI & operator workspace**. The defect was that
the backend repair-order domain existed and was hard-fail-closed, but an operator had no real
workspace: no usable list, no detail, no lifecycle action surface, and no way to raise a
repair order from the repairable-parts queue. The maintenance menu linked a page that could
not actually run the domain.

R2-G requires:

1. A real **repair-order list** with server-side filtering, pagination and a lifecycle action
   entry point.
2. A real **detail workspace** that renders the order, its parts/quantities, its exact
   replacement source evidence, and its action history.
3. A real **lifecycle action surface** whose offered set is **derived from the same backend
   matrix** that guards the transitions, intersected with the caller's permissions — so the
   UI can never offer an action the backend refuses.
4. A real **repairable-parts queue** page that raises a `DRAFT` repair order from genuine
   replacement evidence, and reports honestly when a claim cannot be raised.
5. Every action to **refetch** the order and the workflow after a transition, so the UI can
   never display a stale status or a stale action set.
6. Full **Arabic/English**, **RTL/LTR**, permission, tenant, branch and audit coverage.
7. A real accessible dialog surface for confirmations and lifecycle inputs.

**Non-goals (unchanged and still enforced):** no schema/migration change; no weakening of the
R2-F state machine; no weakening of inventory or stock transactional authority; no new domain;
no super-admin bypass beyond the explicit, auditable widening already established in R2-F; no
production writes.

---

## 2. Evidence classification legend

- **PROVEN_BY_SOURCE** — verified by direct review of committed source (no runtime execution).
- **PROVEN_BY_TEST** — verified by focused or full automated tests through real service/DTO/helper code.
- **PROVEN_BY_SERVICE_RUNTIME** — the invoked code path executes for real; only the database adapter is a double.
- **PROVEN_BY_REAL_DB** — verified against the disposable SQL Server clone through the real HTTP API.
- **PROVEN_BY_BROWSER** — verified by real authenticated browser automation (Playwright) against the real API and the real clone.

---

## 3. Source changes

### 3.1 Backend — `apps/api/src/modules/factory/maintenance/repair-orders/`

| File | Change |
| --- | --- |
| `repair-orders.service.ts` | Workflow metadata derived from the canonical matrix (`availableActionsFor`); `availableActionKeys` on list and detail payloads; queue rows expose the exact return source (`exactReturnSource`) resolved from the recorded condition-`IN` movement. |
| `repair-orders.controller.ts` | `GET /:id/workflow` bound to the guarded service method, with the explicit read permission. |
| `repair-orders.r2g.spec.ts` | **New.** R2-G regression suite — 28 tests (§5.1). |

The workflow endpoint is deliberately **status-only and non-permission-filtering**: it
describes what the state machine permits, and the frontend intersects that with the caller's
permissions. This was verified empirically — the same order returns an identical action set to a
super admin, a `manage`-only user and a `read`-only user (§7.2).

### 3.2 Frontend — `apps/web/src/app/admin/maintenance/repair-orders/`

| File | Change |
| --- | --- |
| `repair-order-api.ts` | **New.** Typed API layer: list, detail, workflow, queue, lifecycle transitions, and create-from-queue, matching the backend contract field-for-field. |
| `repair-order-actions.ts` | Permission resolution (`effectiveRepairPermissions`, explicit super-admin widening), action/queue helpers, and payload builders/validators. |
| `repair-order-action-dialog.tsx` | **New.** State-aware lifecycle dialog; only the inputs the target state actually requires are shown. |
| `page.tsx` | Rewritten into a real list: server-side filters, pagination, per-row action entry. |
| `[id]/page.tsx` | **New.** Detail workspace: parts/quantities, exact return source, action history, workflow action surface, canonical refetch. |
| `queue/page.tsx` | **New.** Repairable-parts queue: replacement evidence, warehouse/claim feasibility, raise `DRAFT`. |
| `apps/web/tests/repair-order-r2g.test.ts` | **New.** R2-G frontend suite. |

### 3.3 Shared component fix — `apps/web/src/components/admin/ui/confirm-dialog.tsx`

The confirmation surface carried no dialog semantics. It now sets `role="dialog"`,
`aria-modal="true"`, an `aria-labelledby` pointing at the real title, and is itself focusable.
The R2-G lifecycle flows all render through this component, so this was on the R2-G critical
path. Scope was held to semantics; see §9.5 for what was deliberately **not** changed.

### 3.4 Localization and navigation

`en/maintenance.ts`, `ar/maintenance.ts` (+75 lines each), `en/ar/common.ts` (repair statuses),
`en/ar/navigation.ts`, and one `navigation-data.ts` entry for the queue route.

---

## 4. Contracts executed

### 4.1 Runtime authority is the state machine, not the UI

`availableActionsFor(status)` is the single authority. The list payload, the detail payload and
the workflow endpoint all derive from it. The UI intersects that set with the caller's
permissions through `offerableRepairActions`. The focused suite asserts the UI action set is
**not a superset** of the backend guard, and §7.2 proves the rendered buttons equal the
API-permitted set for a real non-admin role.

### 4.2 Permissions (no new keys)

Five pre-existing seeded keys, reused: `repair-orders:read`, `repair-orders:create`,
`repair-orders:manage`, `repair-orders:complete`, `repair-orders:scrap`.

| Role (clone fixture) | Keys | Proved behaviour |
| --- | --- | --- |
| `R2G_REPAIR_READONLY` | read | list/detail/workflow 200; **all five** write attempts 403 |
| `R2G_REPAIR_MANAGE` | read + manage | open/start-inspection 200; create/complete/scrap 403 |
| Tenant A admin | super admin | full lifecycle, refetch verified |

A clone-only fixture seeded those two roles/users (`r2g-repair-readonly@atsofterp.local`,
`r2g-repair-manage@atsofterp.local`) so permission denial could be proven against a **real
non-admin role** in the browser — closing the R2-F §9.2 limitation, which had covered denial
at guard/unit level only.

### 4.3 Navigation entry

The queue entry was added **without** a nav-level `permission` field. Rationale, stated rather
than hidden: the entire maintenance spare-parts section — including the pre-existing
`mnt-repair-orders` entry — declares no nav-level permission, although the nav schema supports
one. Gating only the new entry would have been inconsistent; gating the pre-existing entry
would newly hide a link from users who legitimately see it today, which is outside R2-G scope.
The route itself is backend-guarded and the pages render permission-safe states, so no access
is widened. Recorded as a follow-up in §9.6.

---

## 5. Validation results

### 5.1 Focused suites

| Suite | Result |
| --- | --- |
| `apps/api/.../repair-orders.r2g.spec.ts` | **1 suite / 28 tests passed** |
| `apps/web/tests/repair-order-r2g.test.ts` + action-matrix + action-label | **3 suites / 51 tests passed** |
| `repair-orders.r2f.spec.ts` (regression, no regression) | passed |

### 5.2 Full regression

| Suite | Result |
| --- | --- |
| API | **172 suites / 3402 tests passed**, 0 failed |
| Web | **42 suites / 1082 tests passed**, 0 failed |

### 5.3 Static gates

| Gate | Result |
| --- | --- |
| `check-api-route-contract.mjs` | `BACKENDROUTES=1130`, `AUDITEDRUNTIMEROUTES=1124`, `MATCHED=1124`, `MALFORMED=0`, `UNRESOLVED=0`, `MISMATCHES=0` |
| `check-i18n.mjs` | `6270` EN = `6270` AR, fully synchronized, all namespaces registered, no empty values |
| `check-raw-keys.mjs` | passed |
| `check-ui-baseline.mjs` | passed, **99 checks** |
| `verify-permission-ui.mjs` | passed |
| `check-hardcoded-credentials.mjs` | `OK: no hardcoded credentials in tracked files` |
| Web typecheck | `npx tsc --noEmit` exit 0 |
| API build | passed |
| Web build | passed |
| `git diff --check` | clean |

The full web suite and every static gate were **re-run after** the `confirm-dialog.tsx` change,
not before it.

---

## 6. Real-database API proof (clone)

| Proof | Result |
| --- | --- |
| Lifecycle matrix + terminal suppression + full flow + rework + illegal transitions + quantity validation | **18/18 PASS** |
| Permission + tenancy + operational-context boundaries | **23/23 PASS** |
| Queue field presence (17/17) and source-identity shape | **17/17 PASS** |
| Claim/terminal side effects (cancel releases claim, scrap consumes stock) | PASS |

### 6.1 Two probe failures that were **test bugs, not product bugs** — recorded, not hidden

1. **Queue "missing field" probe.** The probe asserted every queue field was non-null. It
   reported `existingRepairOrder` as missing. `existingRepairOrder` is `null` by design for a
   part with no active order, so the probe was wrong. Rewritten as a property-**presence**
   check (`r2g-step3b.ps1`, read-only, order-preserving): **17/17 present**, and the field is
   legitimately null.
2. **Action-key casing.** A probe compared kebab-case keys (`start-inspection`) against the API,
   which returns **camelCase** action keys (`startInspection`); the **routes** are kebab-case.
   The API was verified identical for all three roles, so the assertion map was wrong. Corrected
   to camelCase and the browser proof reached **59/59**. This is recorded because the same
   confusion could otherwise be re-introduced by a future reader of the API.

### 6.2 Claim semantics (documented, inherited from R2-F, verified not changed)

`SparePartConditionBalance.availableQuantity` mirrors on-hand quantity and is **not**
on-hand-minus-reserved. A repair claim is an active repair-order aggregate over non-terminal
orders, and it is not a balance decrement; the balance only falls when stock actually leaves
(completion, scrap, not-repairable). A queue row may therefore display on-hand 7 while creation
correctly refuses with `maintenance.repairSourceQuantityExceedsClaim` because existing claims
exceed the headroom. This is intended fail-closed behaviour and is proven, not assumed.

---

## 7. Real-browser proof (Playwright, authenticated, EN + AR)

Full run: **59/59 steps PASS, 0 FAIL**, against the real API on `http://localhost:4010` and the
real web build on `http://localhost:3010`.

The web build was produced with `NEXT_PUBLIC_API_URL=http://localhost:4010/api/v1`; the client
bundle was verified to contain **only** `localhost:4010/api/v1` and zero references to
`localhost:4000`, so the proof could not silently have exercised production.

| Contract | Evidence |
| --- | --- |
| Real login (JWT) + operational context | admin session established on isolated origins |
| English / LTR and Arabic / RTL | both rendered; `dir` and `:lang` verified |
| No raw translation keys or raw status enums | asserted across the whole run |
| List, row action entry, detail, workflow | real navigation, real data |
| Queue identity + warehouse rules + creation | raised a real `DRAFT` order from the queue |
| Lifecycle click persists and refetches | click → `DRAFT→OPEN` in the database, UI refetched to the new valid action set only |
| Read-only user | **no** enabled lifecycle action across 8 sampled rows; no Create control |
| Manage-only user | exactly `[Start Inspection, Cancel]`; **no** create/complete/scrap control |
| Manage-only detail parity | UI `[Cancel, Start Inspection]` == API-derived expected set, exactly |
| Hidden action still refused by the API | hidden Complete → **HTTP 403** |
| No unexpected console errors | both admin and scoped sessions |

Two R2-G findings surfaced in the browser and were fixed at the source: the `ConfirmDialog`
semantics gap (§3.3), and the fact that the operator workflow has **no** cancel edge from
`IN_INSPECTION`/`UNDER_TEST`, which is R2-F canonical behaviour and must be preserved, not
"fixed" in the UI.

### 7.1 Clone final state — clean

- Status histogram: `CANCELLED` ×19, `SCRAPPED` ×5, `COMPLETED_SERVICEABLE` ×2,
  `COMPLETED_NOT_REPAIRABLE` ×2, `COMPLETED_PARTIAL` ×1 (29 orders).
- **No active proof orders remain**; **no non-terminal order retains a claim**.
- Condition movements: 31. Repair-order audit events: **141**.
- Condition balances: `NEW:5`, `NEW:22`, `USED_REPAIRABLE:7`, `USED_SERVICEABLE:6`,
  `USED_SERVICEABLE:4` — every decrease attributable to a recorded terminal movement.

### 7.2 Workflow metadata is status-only — proven, not assumed

For one and the same order, `GET /:id/workflow` returned an **identical** action set
(`startInspection,cancel`) to the super admin, the manage-only user and the read-only user, and
`availableActionKeys` on the list payload matched it. Permission narrowing is the frontend's
job and is proven separately by the manage-only parity check.

### 7.3 Production read-only scan — clean, and no migration needed

Against `ATsoftERP_DB`, read-only, with a hard assertion that the active database really is
`ATsoftERP_DB` before any query runs:

| Check | Result |
| --- | --- |
| Total production repair orders | **0** |
| Production repair orders using R2-G proof numbers (`RPO-000021`…`RPO-000034`) | **0** |
| Production repair-order audit events | **0** |
| Columns R2-G reads/writes already present in production `spare_part_repair_orders` | **all present** (`source_quantity`, `reserved_quantity`, `target_condition`, `status`, `source_type`, `inspection_result`, `opened_at`, `condition_in_movement_id`, `condition_out_movement_id`, `inventory_scrap_movement_id`) |

`R2_G_MIGRATION_REQUIRED=NO` is therefore **proven against the live production schema**.

---

## 8. Audit and tenant/branch isolation

- **Audit:** every transition writes an audit event carrying the actor and a `details` payload;
  the create/open chain was read back from the clone and shows
  `{"previousStatus":"DRAFT","newStatus":"OPEN"}` for exactly the transition the browser click
  performed. 141 repair-order audit events; **0** rows missing an actor or details.
- **Tenancy:** every route resolves company/branch server-side from the active operational
  context; no client-supplied company/branch is trusted. Cross-tenant by-id access returns
  **404**; a missing or mismatched operational context returns **403**; both proven for
  detail, workflow, action and create.
- **Branch:** the warehouse must belong to the active company and a compatible branch before
  stock is touched.

**Honest schema observation:** the shared `AuditLog` model has **no `companyId`/`branchId`
columns** — it carries `userId`, `action`, `entity`, `entityId`, `details`, `ip`, `userAgent`.
Company/branch are therefore not denormalised onto audit rows anywhere in the platform. This
is a **pre-existing platform-wide** characteristic, not introduced by R2-G, and closing it would
require a schema migration, which R2-G explicitly forbids. Reported rather than silently
ignored.

---

## 9. Known limitations and honest caveats

1. **`ConfirmDialog` still lacks a focus trap, Escape-to-close and focus restoration.** R2-G
   added dialog *semantics* only. The component is a pre-existing shared primitive, and
   rewriting it (or migrating its callers to the shared `Modal`) is a separate, deliberate
   change rather than a drive-by rewrite. Recorded as a follow-up, not claimed as done.
2. **`ConfirmDialog` retains pre-existing hard-coded English fallback labels** (`Cancel`,
   `Confirm`, `…`). Every R2-G caller passes localized strings, and the raw-key gate passes, so
   no untranslated string is reachable in the R2-G flows — but the latent fallback remains.
3. **Intake claim safety is transactional but not fully serializable** — inherited unchanged
   from R2-F §9.1. Outbound consumption is CAS-guarded; the intake balance read that seeds the
   claim check is not. Not claimed as airtight.
4. **A Jest worker-teardown warning is pre-existing** ("a worker process has failed to exit
   gracefully"). All suites and tests pass; it is a leaked-handle warning and predates R2-G.
5. **`SparePartConditionMovement` has no quantity column** in the Prisma schema while production
   has an extra unmapped `quantity` column. Pre-existing, out of R2-G scope, no migration made.
6. **Pre-existing production schema drift, untouched:** production `inventory_movements` uses
   camelCase columns where `schema.prisma` maps snake_case. R2-G does not query that table.
7. **Nav-level permission gating for the maintenance spare-parts section is still absent**
   (§4.3). Deliberate, consistent with siblings, and a stated follow-up.
8. **Clone-only fixture residue, disclosed:** R2-G added the two scoped roles/users and 29
   orders to the **clone** only. The clone is disposable and was left in a clean state
   (§7.1). `SPARE_PART_REPAIR_CANCELLED` audit events from proof cleanup were deliberately
   **not deleted**, because deleting an audit row would falsify history.
9. **Proof scripts live outside the repository** in the temp working directory, consistent with
   the R2-C/R2-D/R2-E/R2-F precedent, so no proof tooling and no proof credentials are committed.

---

## 10. Definition-of-done checklist

| # | Item | Status |
| --- | --- | --- |
| 1 | Existing implementation inspected; no duplicate domain | PASS |
| 2 | No schema/migration change (`R2_G_MIGRATION_REQUIRED=NO`) | PASS — proven on live schema |
| 3 | No new permission keys; existing seeded keys reused | PASS |
| 4 | Backend permission enforcement (all five keys) | PASS — real non-admin roles |
| 5 | Tenant isolation enforced server-side | PASS — 404 cross-tenant, 403 bad context |
| 6 | Branch scope enforced | PASS |
| 7 | Real backend API; no mocks or placeholders | PASS |
| 8 | Frontend connected to the real API | PASS — 59/59 browser |
| 9 | List / detail / create-from-queue / lifecycle all real | PASS |
| 10 | Action set derived from the backend matrix, never a superset | PASS — asserted + browser parity |
| 11 | Canonical refetch after every transition | PASS — browser-verified |
| 12 | Loading / empty / error / permission states | PASS |
| 13 | Arabic + English complete; RTL + LTR verified | PASS — 6270 = 6270 |
| 14 | Audit on every sensitive action | PASS — 141 events, 0 incomplete |
| 15 | Accessible dialog surface | PARTIAL — semantics added; trap/Escape/focus-restoration still open (§9.1) |
| 16 | Meaningful tests, all passing | PASS — 28 focused API, 51 focused web, 3402 + 1082 full |
| 17 | Runtime workflow proven (Frontend→API→Permission→Service→DB→Audit→UI) | PASS |
| 18 | No unrelated files changed | PASS — 12 modified + 6 new, all R2-G |
| 19 | No secrets, no generated artifacts, no proof credentials committed | PASS |
| 20 | Production untouched; clone left clean | PASS |

**Overall: CLOSED**, with item 15 explicitly **PARTIAL** and item 15's residual work disclosed in
§9.1 rather than concealed.
