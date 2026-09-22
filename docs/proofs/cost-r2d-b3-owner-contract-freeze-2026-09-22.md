# COST-R2D-B3 Owner Contract Freeze — Posting + Reconciliation of the Canonical Cost Ledger

- **Contract ID**: COST-R2D-B3
- **Title**: Canonical Cost Ledger Posting + Reconciliation for FINAL Overhead Allocations
- **Document type**: Owner-frozen engineering contract (P0 freeze artifact)
- **Date**: 2026-09-22
- **Phase**: COST-R2D-B3-P0 (owner contract freeze; **docs-only**)
- **Status**: `FROZEN` (owner authority), `READY_FOR_IMPLEMENTATION`
- **Implementation executed**: **NO** — this phase only freezes the contract. No source, schema, migration, seed, test, or runtime change is part of this freeze.

---

## 0. Authority and Position in the Engineering Contract

This document is the normative B3 contract. It is issued under:

1. The owner authority prompt of 2026-09-22, which is the highest authority for B3 decisions and explicitly instructs the exact B3 contract title, objective, grain, provenance mapping, security, API and UI scope, and freeze/closeout discipline.
2. The Engineering Constitution (`docs/architecture/atsoft-erp-engineering-constitution-v1.0.md`), sections covering ledger append-only integrity, monetary conservation, tenancy isolation, permissions, audit, migration safety, and test proof.
3. `ATsofterp` standing rules (`AGENTS.md`): real connected functionality, no parallel ledger, no duplicate domain, no mock data, no parallel UI patterns, Arabic/English RTL/LTR, Define-of-Done.
4. The accepted and CLOSED stage proofs:
   - `docs/proofs/cost-r2d-b2-implementation-contract-2026-09-15.md` (B2 implementation contract; its ¶7 deferred the B3 ledger/posting to a `LATER_PHASE`).
   - `docs/proofs/cost-r2d-b2-production-closeout-2026-09-22.md` (B2 closeout: allocation engine FINAL-only, immutable; ledger untouched).

B2 closeout phrase cited as the B3 trigger: `LATER_PHASE: OperationalCostTransaction adapter/posting, ledger reconciliation, reversal/replacement` (B2 implementation contract ¶19). The primary B2 contract report `prt_069970abf00174T7AQAZFSXg20` and its local evidence folder `ATsofterp-COST-R2D-B2-CONTRACT-20260914` were found empty during discovery; this omission is explicitly resolved by the owner freeze prompt, which furnishes the authoritative B3 decision set. No other known contract document defines B3.

---

## 1. Objective (frozen)

Enable posting of FINAL B2 overhead allocations into the existing canonical cost ledger (`OperationalCostTransaction`) one atomic PRIMARY ledger line per eligible FINAL allocation line, with exactly-once per-line semantics, monetary conservation, reconciliation at allocation-catalog scope, append-only immutability, canonical reversal/replacement, and full tenancy/permission/audit enforcement — reusing the existing R1B/R1C ledger machinery and the B1/B2 shared `sp_getapplock` boundary.

Out of scope and explicitly rejected for B3: general ledger integration, accounts payable, foreign exchange, energy/depreciation cost import, finished-goods/inventory capitalization, COGS, reopening B1 periods, mutation or recalculation of FINAL B2 allocations, and any new ledger table.

---

## 2. Scope Limit of This Document

This is a **frozen contract**, not an implementation. It binds the implementation phase to the decisions below and separates:

- **REPOSITORY-PROVEN FACTS** — read-only evidence from the current code/migrations (file:line citations), and
- **OWNER-FROZEN DECISIONS** — normative choices this document makes binding.

Any future B3 implementation must follow both; any deviation requires a new freeze.

---

# PART A — REPOSITORY-PROVEN FACTS (read-only evidence)

## A.1 Canonical ledger target

- Model: `OperationalCostTransaction` — `apps/api/prisma/schema.prisma:5417`, `@@map("operational_cost_transactions")` (`schema.prisma:5531`).
- Physical table creation: `apps/api/prisma/migrations/20260806140000_add_operational_cost_transactions/migration.sql:129`.
- R1B canonical dimensions: `costNature`, `costPurpose`, `entryRole`, `sourceLineId`, `postedAt`, `departmentId`, `maintenanceWorkOrderId`, `maintenanceRequestId` added in `20260903000000_cost_r1b_canonical_ledger_foundation/migration.sql:28-35`.

## A.2 Idempotency machineries (all already deployed, live-only)

1. **Request-scoped uniqueness**: `@@unique([companyId, branchId, clientRequestId])` (`schema.prisma:5503`); SQL `operational_cost_transactions_tenant_request_key` (`20260806140000.../migration.sql:168`). Unfiltered → a `clientRequestId` is single-use per tenant for the entire lifecycle.
2. **sourceFingerprint filtered unique index**: column `sourceFingerprint NVARCHAR(1000)` (`20260806210000.../migration.sql:42`); unique where `sourceFingerprint IS NOT NULL AND status='POSTED' AND reversedAt IS NULL` (`...:50-53`). Live-only: a reversed original and a REVERSAL row are excluded, so a corrected re-valuation of the same source is already allowed after reversal.
3. **Canonical line-key filtered unique index**: `operational_cost_transactions_canonical_line_key` on `(companyId, branchId, sourceType, sourceId, sourceLineId, entryRole)` where `sourceLineId IS NOT NULL AND entryRole='PRIMARY_COST' AND status='POSTED' AND reversedAt IS NULL` (`20260903000000.../migration.sql:53-55`).
4. **Canonical writer**: `postLedgerEntryWithinTransaction` (single writer for ALL ledger rows, incl. `requestPayloadFingerprint`, `sourceFingerprint`, `entryRole`, reversal link, audit, source-change watermark) — `production-cost.service.ts:1720-1840`.
5. **Idempotent resolve**: `resolveIdempotentPost` returns the existing row on identical request+payload; conflicts on identical request + different payload (`production-cost.service.ts:248-253`).
6. **Fingerprint composition**: `${sourceType}:${sourceId}:${eventType}`, null for `MANUAL`/`REVERSAL` (`production-cost.service.ts:275-278`).

## A.3 Canonical reversal machinery (reusable)

- `reverseLedgerEntry` — writes a REVERSAL row derived strictly from the ORIGINAL_LEDGER_EVENT amount (amount negated, standard positive, variance negated), blocks double reversal and reversing-a-reversal, and marks the original with `reversedById`/`reversedAt` (`production-cost.service.ts:1847-1879`, original invalidation at `...:1786-1791`).
- Immediate consequence: **replacement is already possible** — reverse the original (filtered indexes now allow repeating the same `sourceFingerprint`/`sourceLineId`), then post a NEW PRIMARY with a NEW `clientRequestId`.

## A.4 Check-constraint vocabulary currently deployed (bounded, controlled)

Current `operational_cost_transactions` CHECK constraints after R1B/R2B/R2C:

- `source_type_ck` (R2B re-add, `20260903120000.../migration.sql:24-33`; empty-table repair `20260903010000...`, re-trusted `20260903030000...`): `PRODUCTION_ORDER, PRODUCTION_RUN, OUTPUT_EVENT, FG_RECEIPT, MATERIAL_DOCUMENT, QUALITY_DISPOSITION, DOWNTIME, REVERSAL, MANUAL, INVENTORY_MOVEMENT_LINE, DOWNTIME_EVENT, MAINTENANCE_WORK_ORDER_COST_ENTRY`.
- `event_type_ck` (R2C, `20260904120000.../migration.sql:24-29`): `MATERIAL, LABOR, MACHINE, OVERHEAD, DOWNTIME, EXTERNAL_SERVICE`.
- `unit_ck` (R2B, `20260903120000.../migration.sql:35-40`): `PACK, UNIT, KG, TON, LITER, BATCH, HOUR, MINUTE, AMOUNT`.
- `rate_ck` (R2C, `20260904120000.../migration.sql:31-43`): `rate > 0`, or `rate = 0` only for (a) REVERSAL rows, (b) PRIMARY_COST ACTUAL MATERIAL, (c) MANUAL_ASSERTED_ACTUAL LABOR/EXTERNAL_SERVICE from `MAINTENANCE_WORK_ORDER_COST_ENTRY` with `unit=AMOUNT`. **There is no `rate = 0` carve-out for OVERHEAD.**
- `quantity_sign_ck` (R2C, `...:46-67`): PRIMARY_COST `quantity > 0`; REVERSAL `quantity < 0`.
- `amount_sign_ck`/`reversal_link_ck` (R1B repair, `20260903010000.../migration.sql:58-74`): PRIMARY_COST `amount > 0` & `reversalOfId IS NULL`; REVERSAL `amount < 0` & `reversalOfId IS NOT NULL`.

## A.5 Overhead allocation evidence models (B2, immutable FINAL)

- `OperationalOverheadPeriodAllocation`: `id NVARCHAR(200)`, `companyId/branchId NVARCHAR(1000)`, `currencyCode NVARCHAR(3)`, `status NVARCHAR(10)` (`DRAFT/.../FINAL`), `@@unique([periodId])`, `@@unique([companyKey, branchKey, clientRequestId])` — `schema.prisma:5848-5877`.
- `OperationalOverheadAllocationLine`: `id NVARCHAR(200)`, `allocationId NVARCHAR(200)`, `periodId`, `productionRunId NVARCHAR(1000)`, `destinationCostCenterId NVARCHAR(1000)`, `costPurpose NVARCHAR(30)`, `allocatedAmount DECIMAL(19,4)`, `currencyCode NVARCHAR(3)`, `@@unique([allocationId, productionRunKey, costPurpose])` — `schema.prisma:5879-5912`.
- `OperationalOverheadAllocationSource` (source→line attribution per entry) — `schema.prisma:5915-5928`.
- B2 engine, service, controller, DTOs, permissions under `apps/api/src/modules/factory/overhead-allocation/`.
- B2 migration `20260915010000_cost_r2d_b2_allocation_engine`.

## A.6 Concurrency boundary (already shared with B1 close + valuation-close)

- `overheadAllocationBoundary(ctx)` builds `ATSOFT:OVERHEAD:PERIODS:<sha256(companyId,branchId)>`; `acquireOverheadAllocationBoundary(tx, ctx)` runs `sp_getapplock` Exclusive/Transaction/5000ms and throws `overhead.concurrencyConflict` on contention — `apps/api/src/common/cost-purpose/overhead-allocation-boundary.ts:6-24`.

## A.7 Reconciliation authority and permission conventions

- Read-only reconciliation service: `apps/api/src/modules/factory/production-cost/operational-cost-reconciliation.service.ts` (R1C; GET `production/cost-transactions/reconciliation`). Already counts per-source buckets (e.g., EXTERNAL_SERVICE counts, missing/duplicate/value/currency mismatch, orphan/double reversal) — extend-based, single authority.
- Existing ledger permission keys: `production-cost-transaction:post/:read/:reverse` (production-cost module).
- Overhead-allocation permission naming anchor: `OVERHEAD_ALLOCATION_PERMISSION_KEYS = { read, create, update, calculate, finalize }` → `production-cost-overhead-allocation:<action>` — `apps/api/prisma/seed/seed-overhead-allocation-permission-keys.ts:1-7`.
- Controller convention: `@Controller({ path: 'production/overhead-allocations', version: '1' })`, `@Permissions(...)` per route — `apps/api/src/modules/factory/overhead-allocation/overhead-allocation.controller.ts:16-38`.

## A.8 Transaction isolation of the ledger

- Ledger writes run under `Serializable` isolation with the idempotent-resolve pattern in the production-cost module (`resolves/race-handling` at `production-cost.service.ts:1116-1141`); R1C reconciliation is read-only.

---

# PART B — OWNER-FROZEN CONTRACT (normative decisions)

## B.1 Canonical posting grain (frozen)

- **One** atomic PRIMARY ledger transaction (entryRole `PRIMARY_COST`) per eligible FINAL `OperationalOverheadAllocationLine`.
- Scope of an allocation post being one FINAL `OperationalOverheadPeriodAllocation` under the active company/branch, validated by tenant and branch on the backend; no client-supplied company/branch/identity is trusted.
- Posting cost-purpose is the allocation-line `costPurpose`; each line posts once per allocation.

## B.2 Provenance mapping (frozen)

| Ledger field | Value | Evidence/derivation |
|---|---|---|
| `sourceType` | `OVERHEAD_ALLOCATION_LINE` (NEW controlled value) | Requires single additive `source_type_ck` vocabulary extension (B.7). |
| `sourceId` | `OperationalOverheadPeriodAllocation.id` | Allocation identity (owner instruction). |
| `sourceLineId` | `OperationalOverheadAllocationLine.id` | Line identity (owner instruction); engages `canonical_line_key`. |
| `eventType` | `OVERHEAD` | Already allowed by `event_type_ck` (A.4). |
| `entryRole` | `PRIMARY_COST` (post), `REVERSAL` (reverse) | Canonical discriminator (A.2/A.3). |
| `costPurpose` | Allocation-line `costPurpose` | Reconciliation grain dimension (B.5). |
| `costNature` | `ACTUAL` | Frozen classification; no `rate=0` carve-out needed. |
| `currencyCode` | Allocation `currencyCode` (= company operational currency, no FX) | Monetary conservation. |
| `costCenterId` | `OperationalOverheadAllocationLine.destinationCostCenterId` | Frozen. |
| `productionRunId` | `OperationalOverheadAllocationLine.productionRunId` | Frozen. |
| `unit` | `AMOUNT` | `unit_ck` allows (A.4). |
| `quantity` | `1` | `quantity_sign_ck` PRIMARY_COST requires `> 0` (A.4). |
| `rate` | `allocatedAmount` | Must be `> 0`; enforced by `rate_ck` (A.4). **Lines with `allocatedAmount <= 0` are NOT posted** (frozen in B.4). |
| `amount` | `allocatedAmount` | PRIMARY_COST requires `> 0` (A.4). |
| `occurredAt` | Allocation `finalizedAt` (fallback `periodTo`) | Frozen; falls inside the overhead period by construction. |
| `postedAt` | Posting timestamp (`now`) | R1B canonical (A.1). |
| `sourceFingerprint` | `OVERHEAD_ALLOCATION_LINE:<allocationId>:<lineId>:OVERHEAD` | **Line-qualified** fingerprint (see B.3) — unique per allocation line. |
| `clientRequestId` | `overhead-allocation:<allocationId>:<lineId>:<generation>:<action>` | Single-use per tenant (A.2.1); NEW value per generation and per reversal. |
| `reversalOfId`, `reversalReason`, `reversedAt`, `reversedById` | Per reversal writer | A.3. |
| `standardCostSnapshotId`, `standardAmount`, `varianceAmount`, `calculationId` | `NULL` | No standard cost for allocation posting. |
| `departmentId`, `maintenanceWorkOrderId`, `maintenanceRequestId` | `NULL` | Out of B3 scope (B2 is factory overhead). |

## B.3 Exactly-once contract (frozen)

- Per eligibility check: only lines of a FINAL allocation may post, and only once, enforced by BOTH existing filtered unique indexes simultaneously:
  1. `sourceFingerprint` unique index (A.2.2), and
  2. `canonical_line_key` unique index (A.2.3).
- **Fingerprint composition is line-qualified**: the standard 3-part form `${sourceType}:${sourceId}:${eventType}` would collide across lines of the same allocation (same `sourceId`); the frozen 4-part form makes it unique per line. Still bounded well under `NVARCHAR(1000)`.
- Idempotent re-submission of the same request returns the existing row (A.2.5). Same `clientRequestId` with a different payload conflicts.
- Duplicate-posting enforcement exists at SQL level (unique filtered indexes) and in service (`productionCostTransaction.sourceAlreadyValued` precedent, `production-cost.service.ts:1279-1283`).

## B.4 Monetary conservation (frozen)

- **Line level**: posted B3 `amount` = `allocatedAmount` of the FINAL allocation line.
- **Zero lines**: FINAL allocation lines with `allocatedAmount <= 0` are not posted (degree-zero lines carry no economic value; `rate_ck`/`amount_sign_ck` in A.4 cannot represent them). Reconciliation accounts for this by value-parity, not naive row-count parity.
- **Aggregate level**: B1 source total = B2 pool total = active B3 posted PRIMARY total per (company, branch, overhead period). No ledger-duplicated facts: B1/B2 tables remain evidence only; the ledger holds the atomic posting (constraint 6 of the Constitution: record the atomic transaction once, aggregate in reports).
- **Currency**: `currencyCode` is always the allocation/branch operational currency; no FX conversion anywhere (B1/B2/R1B discipline).

## B.5 Reconciliation grain and semantics (frozen)

- Reconciliation scope: **(companyId, branchId, overhead period, costPurpose, allocation)** — allocation-catalog scope, read-only, single authority = the extended R1C service.
- For every FINAL allocation, the reconciler verifies, per eligible line:
  - exactly one live PRIMARY ledger row (no missing, no duplicate);
  - `amount` equality with `allocatedAmount` (no value mismatch);
  - `currencyCode` equality (no currency mismatch);
  - no orphan reversal and no double reversal (A.3 guarantees, reconciled independently).
- Zero-amount FINAL lines are verified as "not posted" and count as satisfied (no value impact).
- Reconciliation is `PARTIAL` reuse of R1C: extend R1C with an `OVERHEAD_ALLOCATION` source bucket following the existing EXTERNAL_SERVICE pattern (`operational-cost-reconciliation.service.ts` counts), keeping one reconciliation authority. **No second reconciliation implementation may be introduced.**

## B.6 Immutability, reversal, replacement (frozen)

- Ledger rows are append-only; posted PRIMARY rows are never mutated (A.2/A.3).
- **Reversal**: allowed on a live B3 PRIMARY posting via the existing canonical writer (A.3). Reversal does NOT mutate B2 allocation evidence (FINAL remains FINAL); it is a ledger correction.
- **Replacement**: allowed only AFTER a valid reversal of the original posting — reverse the original PRIMARY, then post a NEW PRIMARY for the corrected `allocatedAmount` with a NEW `clientRequestId` (`generation` increments) and identical `sourceFingerprint`/`sourceLineId`. This is already supported by the two live-only filtered indexes (A.2.2/A.2.3). No in-place correction of a posted amount.
- **No status mutation through generic edit endpoints.**

## B.7 Schema-change expectation (frozen — the ONLY expected migration)

- `B3_NEW_LEDGER_COLUMNS_REQUIRED = NO` — every canonical column needed already exists (A.1-A.3).
- `B3_NEW_TABLE_REQUIRED = NO`.
- `B3_MIGRATION_EXPECTED = YES` — exactly ONE additive, constraint-only vocabulary migration that DROPs and re-adds `operational_cost_transactions_source_type_ck` WITH CHECK (and re-enables/trusts it) to include `N'OVERHEAD_ALLOCATION_LINE'`, following the exact non-destructive pattern established by R2B (`20260903120000.../migration.sql:24-33`) and R2C. No data mutation, no new column/index/FK, no row changes, no `WITH NOCHECK` residue.
- **KEY_SAFETY_PRELIMINARY = PASS**: B3 introduces no new index/FK/column width surface. Proven payload widths: ledger `sourceId`/`sourceLineId` columns are `NVARCHAR(1000)`; B2 ids are `NVARCHAR(200)`; fingerprint ≈ ≤ `NVARCHAR(1000)`; `sourceType` value 23 chars. The implementation phase must still empirically reverify the deployed index byte-limits (R1B `canonical_line_key` and R1B `tenant_request_key` metadata) before merge, as required by MIG-PROV discipline.

## B.8 Concurrency (frozen)

- B3 posting, reversal, and the extended reconciliation MUST run under the **same exact shared boundary** as B1/B2: `acquireOverheadAllocationBoundary` (`apps/api/src/common/cost-purpose/overhead-allocation-boundary.ts:14-24`), `ATSOFT:OVERHEAD:PERIODS:<sha256>`, Exclusive, Transaction, 5000ms. This serializes B3 posting/reversal against B1 period close, valuation-close, and B2 finalize. Reuse only; no second lock identity.

## B.9 Security and permissions (frozen)

- Two NEW permission keys (seeded via the existing seed convention, mirrored in frontend):
  - `production-cost-overhead-allocation:post`
  - `production-cost-overhead-allocation:reconcile`
- Each B3 route enforces `JwtAuthGuard` + `PermissionsGuard` + active operational context, with backend tenant/branch validation (never frontend-only), DTO validation with unknown-field rejection, and stable localized error keys. No SUPER_ADMIN bypass for tenant scope.

## B.10 Audit (frozen)

- Sensitive actions audited with the existing audit/write pattern incl. user, employee where available, company, branch, entity type/id, action, timestamp, previous/new values, reason:
  - B3 post → `TRANSACTION_POST` (sourceType/sourceId/sourceLineId/costPurpose/amount/currency/fingerprint).
  - B3 reversal → `TRANSACTION_REVERSE` (reference + reason).
  - Reconciliation execution → read-audit (existing precedent).
- Source-change watermarks (`OperationalSourceChange`) emitted as the canonical writer already does (A.2.4).

## B.11 API (frozen routes)

| Method | Route (v1) | Permission | Behavior |
|---|---|---|---|
| `POST` | `production/overhead-allocations/:id/post-to-ledger` | `production-cost-overhead-allocation:post` | Atomic post of ALL eligible FINAL lines of the allocation; idempotent; Serializable; returns posting summary + ledger rows. |
| `GET` | `production/overhead-allocations/:id/reconciliation` | `production-cost-overhead-allocation:reconcile` | R1C read-only reconciliation scoped to this allocation. |
| `POST` | `production/overhead-allocations/:id/ledger-reversal` | `production-cost-overhead-allocation:post` | Reverses a live PRIMARY posting (blocks double reversal) via canonical writer. |

Rejected routes in this phase: no generic `PATCH`/`PUT` on posted ledger rows.

## B.12 UI scope (frozen)

- Extend the existing `/admin/production/cost/overhead-allocations` area (list/detail/finalize already exist) with:
  - "Post to ledger" action + confirmation;
  - allocation-scoped reconciliation summary panel;
  - "Reverse posting" action for posted lines.
- Real API, real permission gating, loading/empty/error/permission states, Arabic/English + RTL/LTR (Constitution i18n rules). No new competing UI pattern.

## B.13 Out-of-scope (frozen — rejected for B3)

General ledger entries, AP invoices, FX conversion, energy/depreciation import, finished-goods/inventory/FG capitalization, COGS, reopening B1 periods, B2 recalculation/mutation of FINAL, and any new ledger table or column.

---

# PART C — Readiness and Reuse Matrix (derived from Part A evidence)

## C.1 Key readiness values

| Value | Derived result |
|---|---|
| `CANONICAL_LEDGER_MODEL` | `OperationalCostTransaction` |
| `CANONICAL_LEDGER_TABLE` | `dbo.operational_cost_transactions` |
| `B3_SOURCE_TYPE_PROPOSED` | `OVERHEAD_ALLOCATION_LINE` |
| `SOURCE_ID_MAPPING` | allocation id |
| `SOURCE_LINE_ID_MAPPING` | allocation line id |
| `EXISTING_LEDGER_DEDUPE_REUSABLE` | `YES` (fingerprint + canonical_line_key, both live-only) |
| `EXISTING_REVERSAL_REUSABLE` | `YES` (`reverseLedgerEntry`, blocks double reversal) |
| `EXISTING_R1C_RECONCILIATION_REUSABLE` | `YES` (EXTEND R1C with `OVERHEAD_ALLOCATION` bucket; single authority) |
| `EXACT_SHARED_LOCK_HELPER` | `acquireOverheadAllocationBoundary` / `overheadAllocationBoundary` |
| `EXACT_LEDGER_TRANSACTION_ISOLATION` | `Serializable` + `resolveIdempotentPost` + canonical writer |
| `PERMISSION_POST_KEY` | `production-cost-overhead-allocation:post` |
| `PERMISSION_RECONCILE_KEY` | `production-cost-overhead-allocation:reconcile` |
| `PROPOSED_POST_ROUTE` | `POST /production/overhead-allocations/:id/post-to-ledger` |
| `PROPOSED_RECONCILIATION_ROUTE` | `GET /production/overhead-allocations/:id/reconciliation` |
| `PROPOSED_REVERSAL_ROUTE` | `POST /production/overhead-allocations/:id/ledger-reversal` |
| `B3_NEW_LEDGER_COLUMNS_REQUIRED` | `NO` |
| `B3_NEW_TABLE_REQUIRED` | `NO` |
| `B3_MIGRATION_EXPECTED` | `YES` — one additive `source_type_ck` vocabulary DDL (B.7) |
| `KEY_SAFETY_PRELIMINARY` | `PASS` (no new width surface; runtime reverify in implementation) |

## C.2 Reuse matrix

| Asset | Reuse | Notes |
|---|---|---|
| `postLedgerEntryWithinTransaction` | Direct | Single canonical writer, audit + watermark (A.2.4) |
| `reverseLedgerEntry` | Direct | Reversal/replacement lifecycle (A.3) |
| R1B filtered unique indexes | Direct | Per-line exactly-once without new columns |
| R1C reconciliation service | Extend | Add `OVERHEAD_ALLOCATION` bucket (B.5) |
| `acquireOverheadAllocationBoundary` | Direct | Shared B1/B2/B3 serialization (A.6) |
| Permission seed convention | Direct | New keys via existing seed files (A.7) |
| Ledger Serializable isolation | Direct | Same pattern (A.8) |

---

# PART D — Non-Contradiction Proof

1. **vs B1 (closed)**: B3 does not touch `operational_overhead_periods`/`operational_overhead_entries`; source evidence stays authoritative and immutable. Reuses the same exact applock identity. No conflict.
2. **vs B2 (closed)**: B2 closeout froze FINAL allocations and explicitly deferred ledger posting to LATER_PHASE. B3 consumes only FINAL allocation lines read-only, never mutates B2 evidence, never recalcs. Contradicts nothing; fulfils ¶19/B2-contract ¶7.
3. **vs R1B (canonical ledger foundation)**: B3 writes ONLY through the existing canonical writer into the existing table with existing columns and indexes; respects entryRole semantics; uses the existing live-only dedupe/replacement design. No ledger weakening.
4. **vs R1C**: B3 extends the single R1C reconciliation authority; no second reconciliation path.
5. **vs MIG-PROV / migration safety**: the sole expected migration is additive constraint-vocabulary (B.7), matching the already-accepted R2B/R2C pattern, inside a transaction, with CHECK re-enabled and trusted. No `db push`, no reset, no destructive DDL.
6. **vs tenancy/audit/permissions rules**: all B3 writes enforce backend tenant/branch scope, audit, and two new seeded permission keys (B.9-B.10).

---

# PART E — Implementation-Phase Mandatory Verifications (open items, to be closed during implementation)

1. CSS/UX baseline integrity re-run (`npm run ui-baseline:check`) after UI changes.
2. Empirical reverify of deployed ledger index byte-limits (MIG-PROV) before applying B.7.
3. Tenant-isolation specs for B3 (A-read/B-cannot-read/edit/reference/post) per Constitution §13.
4. Exactly-once, double-reversal, replacement-after-reversal, zero-line, and monetary-conservation specs.
5. Arabic/English key parity for all new message keys and permission labels.
6. No source change committed before a separate explicit approval to START B3 implementation (this freeze does not authorize implementation work).

---

# PART F — Decision Record

- **Baseline at freeze**: branch `main`, `HEAD=06649668bb226e28550ba37462e2bdbb8f12e800`, `origin/main=06649668bb226e28550ba37462e2bdbb8f12e800` (re-fetched and confirmed unchanged immediately before this commit), working tree clean.
- **This artifact**: created to freeze the B3 contract; no implementation, no database mutation, no production mutation in this phase.
- **Freeze commit** (created by this phase): the single docs-only commit carrying this file.
- **Owner policy decisions unresolved**: `0`.
- **Next phase**: `COST-R2D-B3-P1` (implementation) may begin ONLY after explicit owner approval; `CAN_START_COST_R2D_B3_IMPLEMENTATION=YES` contractually, `B3_IMPLEMENTATION_EXECUTED=NO`.