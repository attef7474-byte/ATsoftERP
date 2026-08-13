# Task17 R1 P0 — Tenant-Write Remediation (Consolidated Proof)

Module scope: tenant isolation for the 11 R1 inventory + maintenance + business-partner write families.

- BASE_SHA: `3b51445a4d542513f03d1d3cf57cafff5dd6a8df`
- INTEGRATED_SHA: `f9980e50ada88f4f6687a2f76e98f456b6e5bfca`
- Branch: `fix/task17-r1-p0-tenant-write-remediation`
- Scope: backend tenant-write hardening ONLY. No schema changes, no migrations, no UI, no permission keys, no `.env`.

Authoritative scope source: `request.activeContext` (`ActiveOperationalContext`) resolved by the global
`ActiveContextInterceptor` from `x-active-company-id` / `x-active-branch-id` headers and validated against the
authenticated user's grants. Client-supplied `companyId` / `branchId` in body or query are never trusted by the
hardened services; the interceptor additionally rejects top-level body/query tenant fields that mismatch the active
context (`active-context.service.ts: assertRequestMatches`).

---

## 1. The 11 R1 services

| # | SERVICE | MODULE | HARDENED WRITES |
|---|---|---|---|
| 1 | `spare-part-conditions` | `factory/maintenance/spare-part-conditions` | `recordMovement` |
| 2 | `inventory-balances` | `factory/inventory-balances` | `recalculate` |
| 3 | `inventory` (root) | `factory/inventory` | warehouse/location create, update, remove, activate/deactivate; `updateLocation` re-pointing |
| 4 | `inventory-adjustments` | `factory/inventory-adjustments` | create, update, `generateFromCount`, addLine, updateLine, removeLine |
| 5 | `inventory-opening-balances` | `factory/inventory-opening-balances` | create, update, post, addLine, updateLine, removeLine |
| 6 | `inventory-operational-receipts` | `factory/inventory-operational-receipts` | create, update, post, addLine, updateLine, removeLine |
| 7 | `inventory-stock-transfers` | `factory/inventory-stock-transfers` | create, update, post, addLine, updateLine, removeLine |
| 8 | `inventory-physical-counts` | `factory/inventory-physical-counts` | create, update, addLine, enterCount, post |
| 9 | `maintenance-stock-issue` | `factory/maintenance/maintenance-stock-issue` | `issue`, `returnStock` |
| 10 | `preventive-spare-part-plan` | `factory/maintenance/preventive-spare-part-plan` | update (machine/schedule re-pointing), transition |
| 11 | `business-partners` | `business-partners/partners` | create, update, remove |

Related hardening already integrated before this task and re-verified as unchanged: `inventory-stock-adjustments`
(T17B-01) and `inventory-movements` (T17B-02) — their spec suites are part of the R1 focused run below.

---

## 2. Tenant rules (backend-authoritative)

1. **Write context from the active context only.** `create` methods store `companyId: ctx.companyId` /
   `branchId: ctx.branchId` (never DTO values). Where the DTO is spread, the ctx values override.
2. **`update` strips tenant fields.** `const { companyId, branchId, ...rest } = dto;` — client tenant fields are never
   written. `business-partners.update` and `inventory.updateWarehouse` follow the same destructure-and-drop pattern.
3. **`findOne`/`findAll` always carry the active context.** `findOne` uses `assertRowInContext(row, ctx, ...)`;
   `findAll` scopes `companyId: ctx.companyId` (+ exact or inclusive `branchId` per module rule). Client filters that
   would widen scope are ignored or rejected.
4. **Relations are validated against the context** on the same client that performs the mutation.

---

## 3. Warehouse branch-null rule

`assertRowInContext` / `rowInContext` (tenant-guards.ts): a row is in-context when `companyId === ctx.companyId` AND
the row's `branchId` is `null` (company-level / legacy) or equals `ctx.branchId`. A non-null branch that differs from
the active branch is rejected. Warehouse guards (`assertWarehouseInContext`) require the warehouse to belong to the
active company and, when the warehouse has a branch, to the active branch. Query-side scoping uses the same rule
(`branchId: { in: [ctx.branchId, null] }` for cross-branch-visible flows such as movements; exact `branchId` for
branch-owned documents such as stock adjustments, documented in T17B-01 §3.2).

---

## 4. Relation validation

Every referenced record is validated in-context before and inside the mutation transaction:

- Warehouse: `assertWarehouseInContext(client, warehouseId, ctx)` — on the root client before the write and again on
  the transaction client inside `$transaction`.
- Location: any `warehouseLocationId` must belong to the effective document warehouse
  (`loc.warehouseId === warehouseId`), validated both before and inside the transaction.
- Machine: `assertMachineInContext` / `machineInContext` — machine must match active company (+branch when set).
- Schedule: `validateScheduleAndMachine` (preventive-spare-part-plan) — schedule must exist (else NotFound), its
  machine must be in-context, and a re-pointed machine must match the schedule's machine.
- Inventory count: `assertInventoryCountInContext` (adjustments) — count must be in-context on the root client and on
  the tx client.
- Maintenance request / part line: `findPartLineOrFail` (maintenance-stock-issue) — line must belong to the request
  and its machine must be in-context; line ops additionally verify `line.adjustmentId === id` /
  `line.physicalCountId === id` after the owning document passed `findOne`.
- Movement/condition references: an `inventoryMovementId` on a condition movement must belong to the active company.

---

## 5. TOCTOU strategy

Every inventory-mutating or re-pointing write revalidates ownership and relation context on the SAME client that
performs the mutation:

- The root `PrismaService` is used only for the initial context check and reads.
- The mutation runs inside `prisma.$transaction(async (tx) => { ... })` and re-runs the same
  `assertWarehouseInContext(tx, ...)` / `assertInventoryCountInContext(tx, ...)` / location checks with the
  transaction client before any create/update/delete or balance/movement side effect.
- Document/movement numbers are generated inside the transaction with
  `generateNumberAtomicWithClient(<KEY>, tx)` so counters roll back with a failed transaction
  (opening-balances, operational-receipts, stock-transfers, physical-counts, adjustments, stock-adjustments,
  inventory-movements, maintenance-stock-issue).
- Balance recalculation (`inventory-balances.recalculate`) deletes and rebuilds balances strictly within the active
  company/branch warehouse scope in one transaction.

Known R2-deferred numbering observation (NOT an R1 tenant defect): `spare-part-conditions.recordMovement` and
`installed-parts-replacement.recordReplacementInTx` still use the own-transaction `generateNumberAtomic(...)`, so a
failed write can consume a sequence counter. This has no cross-tenant write effect and is tracked for a future
consistency pass.

---

## 6. Tenant-field immutability

- `create`: `companyId`/`branchId` always written from `ctx`, overriding any DTO value (spread order guarantees the
  override).
- `update`: `companyId`/`branchId` destructured out of the DTO and never written
  (opening-balances, operational-receipts, stock-transfers, business-partners, inventory root warehouse update).
- Interceptor: `assertRequestMatches` rejects a top-level body/query `companyId`/`branchId` that does not exactly
  match the active context, as defense-in-depth for every HTTP write.
- DTOs without tenant fields (`update-physical-count`, `update-warehouse-location`, etc.) cannot carry them; DTOs that
  accept them are ignored at the service layer.

---

## 7. Test matrix (focused R1 suites)

All suites are mocked-Prisma unit tests. 13 suites / 251 tests, all passing.

| SERVICE | DIRECT FOCUSED SPEC | TESTS | KEY COVERAGE |
|---|---|---|---|
| inventory-opening-balances | `inventory-opening-balances.service.spec.ts` | 11 | foreign warehouse re-point rejected; tenant fields never written; location membership; in-tx revalidation + in-tx numbering; foreign post rejected; foreign line/location rejection |
| inventory-operational-receipts | `inventory-operational-receipts.service.spec.ts` | 5 | foreign warehouse re-point; tenant fields never written; location membership; in-tx revalidation + numbering; foreign post |
| inventory-stock-transfers | `inventory-stock-transfers.service.spec.ts` | 9 | source/destination foreign re-point rejected; tenant fields never written; source location membership; same-warehouse guard; in-tx dual revalidation; foreign post (both warehouses) |
| inventory-physical-counts | `inventory-physical-counts.service.spec.ts` | 6 | foreign warehouse re-point; location membership; in-tx revalidation; foreign post; line location mismatch |
| inventory-adjustments | `inventory-adjustments.service.spec.ts` | 9 | foreign warehouse re-point; foreign count reference; line location membership; foreign count generation; in-tx revalidation + numbering; foreign post; line ops location checks |
| inventory-balances | `inventory-balances.service.spec.ts` | 3 | recalculate deleteMany + rebuild scoped to tenant warehouse; movement/adjustment source scoping |
| inventory (root) | `inventory.service.spec.ts` | 2 | updateLocation foreign-warehouse re-point rejected; same-company allowed |
| preventive-spare-part-plan | `preventive-spare-part-plan.service.spec.ts` | 7 | foreign plan machine; machineId-only re-point to foreign machine; machine/schedule mismatch; valid machineId-only update; foreign schedule machine; NotFound schedule |
| maintenance-stock-issue | `maintenance-stock-issue.service.spec.ts` | 11 | foreign request; foreign line machine (company + branch); foreign warehouse (issue + removedPartWarehouse); foreign location; returnStock foreign request, foreign stored warehouse (company + branch), no stored warehouse; getIssues foreign machine — all with zero side effects |
| spare-part-conditions | `spare-part-conditions.service.spec.ts` | 9 | foreign warehouse recordMovement (zero side effects); foreign/nonexistent maintenance request; foreign inventory movement reference; in-context success; foreign balance/movement reads; foreign warehouse list |
| business-partners | `partners.service.spec.ts` | 11 | create never writes client tenant fields; duplicate code; foreign findOne (company + branch); foreign update (company + branch) with zero update calls; tenant-field ownership stealing stripped; foreign remove (company + branch); owned soft-delete |
| inventory-stock-adjustments (T17B-01) | `inventory-stock-adjustments.service.spec.ts` | 99 | full 14-method tenant matrix incl. in-tx hostile re-reads, atomic double-post claim |
| inventory-movements (T17B-02) | `inventory-movements.service.spec.ts` | 73 | movement tenant matrix incl. branch-null rule, in-tx numbering |

### Zero-side-effect coverage

Foreign-tenant rejection paths assert that no mutation side effect occurs:

- maintenance-stock-issue: `$transaction` not entered; `inventoryMovement.create`, `inventoryBalance.update`,
  `sparePartConditionBalance.update`, `sparePartConditionMovement.create` not called for foreign request, foreign
  machine, foreign warehouse, foreign stored warehouse, and foreign/nonexistent location paths.
- spare-part-conditions: `sparePartConditionBalance.update` and `sparePartConditionMovement.create` not called for
  foreign warehouse, foreign/nonexistent maintenance request, and foreign movement reference.
- business-partners: `businessPartner.update` not called for foreign update/remove.

---

## 8. Full test run result (already reported at INTEGRATED_SHA)

- 13 focused R1 suites: 251 tests passed, 0 failed.
- Full API suite at integration time: 1279 tests passed (94 suites, 76 passed); the 18 failing suites are
  PRE-EXISTING EMPTY (0-byte, no `describe`) spec files in unrelated modules (iot/mqtt, hr-requests, numbering.helpers,
  auth guards/roles, business-rules, workflow-engine, request-policy, request-notifications, template-rendering).
  None are touched by this change set; they are intentionally left unfixed.
- ESLint is not installed (absent from root and `apps/api` package.json) — `ESLINT=NOT_RUN_PREEXISTING_TOOLING_MISSING`.

---

## 9. No schema / migrations / destructive DB proof

- No Prisma model, migration, seed, permission, or frontend change is part of R1.
- `prisma migrate` was never executed; no `prisma db push`; no database deletion; no `migrate reset`; no truncation.
- Runtime proof against a live shared database was NOT performed for this R1 hardening (consistent with prior
  T17B-01/T17B-02 live-proof policy: no destructive or shared-DB mutation). Proof of the tenant rules is established
  by the focused mocked-Prisma suites and the same-client transaction design.
- A future runtime proof must avoid the number-sequence side effects recorded in T17B-01 §5.D unless sequence
  restoration is explicitly planned.

---

## 10. R2-deferred findings (out of R1 scope, intentionally not fixed here)

1. `inventory.service.ts findAllWarehouses` / `findAllLocations` accept a client `companyId` / `warehouseId` query
   filter without forcing context — read-only list endpoints, not R1 write paths. Recommend scoping these reads to
   the active context in a follow-up.
2. `spare-part-conditions.recordMovement` and `installed-parts-replacement.recordReplacementInTx` use the
   own-transaction `generateNumberAtomic(...)`, so a failed write may consume a sequence counter (consistency, not a
   cross-tenant defect).
3. `maintenance-stock-issue.issue` performs the part-line/machine pre-check on the root client; the transaction
   re-validates the warehouses but not the machine. The machine cannot be changed by client input in this flow, so no
   cross-tenant write is possible; a future in-tx machine recheck would close the residual TOCTOU window.

---

## 11. Adversarial scan result (read-only, no production changes made)

| GATE | RESULT |
|---|---|
| `R1_CROSS_TENANT_WRITE_PATHS` | 0 |
| `R1_BY_ID_WRITE_IDOR_GAPS` | 0 |
| `R1_RELATION_AUTHORITY_GAPS` | 0 |
| `R1_WRITE_TOCTOU_GAPS` | 0 |
| `R1_TENANT_FIELD_TAMPERING_PATHS` | 0 |

No real remaining R1 P0 defect was proven; no production source was modified by the closeout scan. The only closeout
change set is the three added focused spec files and this document.

---

## 12. Closeout follow-up (this branch)

- Added `maintenance-stock-issue.service.spec.ts`, `spare-part-conditions.service.spec.ts`,
  `partners.service.spec.ts` (31 tests) closing the three R1 services that previously had no direct focused spec.
- Added this consolidated proof document.
- Validation gates at closeout: API typecheck PASS, Prisma validate PASS, API build PASS, i18n check PASS
  (5388 EN = 5388 AR), UI baseline check PASS, credentials check PASS, `git diff --check` PASS.
- No schema, migration, permission, seed, or frontend change.
