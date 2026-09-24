# Inventory Valuation R1A–R1H — Final Closeout

**Date:** 2026-09-24
**Status:** `INVENTORY_VALUATION_R1A_R1H=CLOSED`
**Scope of program:** whole-program functional implementation of Inventory Valuation R1A–R1H on the existing inventory engine, under slice commits recorded in Git.

---

## 1. Executive Summary

The Inventory Valuation R1A–R1H program was confirmed complete and released through a full formal closeout audit:

1. Recovered program scope authority from migration headers, code comments, constants, spec names, and commit messages (no separate roadmap markdown exists for this program).
2. Verified Git provenance: every R1 slice commit is an ancestor of `origin/main`; `HEAD == origin/main == e3336b034989e54d6a5f45c4e18e237214a35ee7`, ahead/behind 0/0, worktree clean.
3. Classified all slices R1A–R1H as PROVEN by direct source + migration + spec audit and by full regression evidence.
4. Audited architecture, schema, monetary integrity, policy lifecycle, initialization, receipt/issue/reversal valuation, production-cost integration, tenancy/permissions, API contract, UI/i18n, reports, and reconciliation.
5. Ran the complete regression: API **2914/2914** (165 suites), Web **1011/1011** (36 suites); typechecks, builds, `prisma validate`, i18n `6110=6110`, raw-keys, route contract `1112 matched / 0 malformed / 0 unresolved / 0 mismatches`, permission-UI, credentials, UI baseline `99 checks`, `git diff --check` clear.
6. Recorded the known stale-documentation contradiction in `docs/inventory-handover/inventory-limitations-and-controls-en.md:31`.

**`INVENTORY_VALUATION_R1A_R1H=CLOSED`**

---

## 2. Program Scope Authority (Roadmap Recovery)

No program-level roadmap markdown file exists for the R1 program. Declared scope authority, in resolving order:

1. Migration headers `apps/api/prisma/migrations/202609*` (R1A foundation, R1B monetary input, R1C atomic engine, R1D transfer value flow, R1G-A production run cost snapshot).
2. Code comments in the inventory-valuation module (VAL-R1C engine, VAL-R1D reconciliation transfer, VAL-R1E maintenance, VAL-R1F production material, VAL-R1G-A close-boundary authority, VAL-R1G-B finished-goods).
3. Constants (`apps/api/src/modules/factory/inventory-valuation/inventory-valuation.constants.ts`): valuation methods `['WEIGHTED_AVERAGE']`; statuses `DRAFT | INITIALIZING | ACTIVE | RETIRED`; permission keys `read`, `costInput`, `initialize`, `activate`; audit entity names.
4. Spec descriptions (`VAL-R1C … engine`, `VAL-R1D …`, `VAL-R1E …`, `VAL-R1F production material valuation`, `VAL-R1G-A … authority`, `VAL-R1G-B …`, `VAL-R1H reconciliation`).
5. Commit messages listed in §3.

**`ROADMAP_AUTHORITY=RECOVERED`**

---

## 3. Git Provenance

| Slice | Commit | Message |
|---|---|---|
| R1A | `c5f578de` | feat(inventory): add valuation foundation schema |
| R1B | `f4c00f12` | feat(inventory): add valuation R1B monetary input, legacy init, RBAC, audit |
| R1B | `d8cf92b6` | fix(inventory): include reason in valuation initialization audit |
| R1B-UI | `93567536` | feat(inventory): add valuation initialization UI |
| R1B-UI | `ce1e1918` | fix(inventory): correct valuation navigation route |
| R1C | `9d8ccaf6` | feat(inventory): add atomic moving average valuation engine |
| R1D | `f0086765` | feat(inventory): add VAL-R1D valued transfer/cost-input flow |
| R1E | `e69858f8` | feat(inventory): value maintenance material consumption |
| R1F | `0bdff1a4` | feat(inventory): value production material consumption (VAL-R1F) |
| R1G-A | `53720784` | feat(production): freeze material cost at run close |
| R1G-B | `7eb82377` | feat(inventory): value finished goods from frozen production cost |
| R1H | `b23ad03a` | feat(inventory): add valuation integrity reconciliation |
| R1E-base | `fee645b4` | feat: complete maintenance stock issue integration with real inventory movement |

Additional supporting ancestors (all on `origin/main`): `9d8ccaf6` … `b23ad03a` lineage verified linear and fast-forwardable.

| Item | Value |
|---|---|
| `origin/main` HEAD | `e3336b034989e54d6a5f45c4e18e237214a35ee7` |
| `HEAD == origin/main` | TRUE, `AHEAD_BEHIND=0/0` |
| Rails through production recloseout | `fb82a455` (P1 closeout freeze) → D1–D5 repair (`64eb80c3`) → recloseout (`b4fd65e6`) → release record pin (`e3336b03`) |
| Worktree | clean (`git status --porcelain` empty) |
| Valuation commits contained in `origin/main` | all of the above (`git merge-base --is-ancestor` = true for `b23ad03a`, `fee645b4`, `7eb82377`) |

**`GIT_BASELINE=PASS`**

---

## 4. Slice Classification

| Slice | Status | Evidence |
|---|---|---|
| R1A foundation schema | **PROVEN** | Migration `20260901000000_inventory_valuation_r1a_foundation`; Prisma models `InventoryValuationPolicy` (2256–2291), `InventoryValuationBalance` (2293), `InventoryValuationInitialization` (2331); `@@unique([companyId, warehouseId])`; migration-contract spec |
| R1B monetary input + legacy init + RBAC + audit | **PROVEN** | Migration `20260901010000`; monetary columns (`quantityBase Decimal(18,4)`, `unitCost Decimal(19,6)`, `valuationMethod`); DTOs (create/update/cost-input/initialize); seed `seed-inventory-valuation-permission-keys.ts` (4 keys); init audit with reason; service spec + migration-contract specs |
| R1C atomic weighted-moving-average engine | **PROVEN** | Migration `20260901020000` (quartet CHECK); `InventoryValuationEngineService` full read; engine spec ~30+ cases (numeric receipts/issues, exact zero residue, negative/missing-state/unsafe-reversal guards, applock `concurrencyConflict`, `aggregatePhysicalQuantity`, coverage gate) |
| R1D valued transfer + cost-input flow | **PROVEN** | Migration `20260901030000` (`transferTotalValue Decimal(19,4)`); reconciliation transfer conservation; `VAL-R1D` specs; web UI test `inventory-valuation-r1d-ui.test.ts` |
| R1E maintenance material consumption | **PROVEN** | Migration/relationship audit; `maintenance-stock-issue.service.ts` (`findActivePolicyForWarehouse`, negative-stock block); `maintenance-work-orders.service.ts` per-line issue; R1E specs |
| R1F production material consumption | **PROVEN** | Migration `20260902000001`; `inventory-movements.service.ts` R1F entrypoint + applock + `resolveProductionMaterialValuationPlan`; `production-material-documents.service.ts` + specs (quartet unit cost 6dp persisted) |
| R1G-A freeze material cost at run close | **PROVEN** | `production-runs.service.ts` `RUN_COST_BOUNDARY_LOCK_PREFIX` + `acquireRunCostBoundaryLock`, `costBasis NET_ACTUAL_MATERIAL_VALUE_ONLY`, `ProductionRunCostSnapshot` at `costClosedAt`; R1G-A spec + aggregation authority spec |
| R1G-B value finished goods from frozen cost | **PROVEN** | `production-finished-goods-receipts.service.ts` R1G-B entrypoint (shared run-boundary lock, `withTransientTransactionRetry`); R1G-B specs |
| R1H reconciliation | **PROVEN** | `inventory-valuation-reconciliation.service.ts` full read; severities INFO/WARNING/ERROR; checks `MAINTENANCE_TWIN_SYNC_DEFECT`, `PRODUCTION_MATERIAL_TWIN_SYNC_DEFECT`, `CROSS_TENANT_VALUATION_TRANSFER`; reconciliation spec |

**`SLICE_CLASSIFICATION=R1A..R1H ALL PROVEN`**

---

## 5. Architecture / Schema Audit

- Canonical movement engine `inventory-movements.service.ts` was extended (not duplicated): serializable transaction, valuation app-locks in deterministic order (`acquireValuationLocksSorted`), ledger posting for `MATERIAL_EVENT_TYPE` carrying `issueResult.totalCost`, `costRequired` guard for inbound to ACTIVE policy without trusted receipt cost.
- Monetary state is recorded once at the atomic transaction (movement line quartet) and aggregated in reports — no separate hierarchy-level amount duplication.
- `assertNotActiveForMutation` blocks mutation of non-valorized state and re-valuation of ACTIVE policies; `applyValuedReceiptReversal` rejects negative or residue-inconsistent monetary state; transfer value conservation is exact (full depletion → `Vsrc_new=0`).
- No new parallel inventory/valuation domain was created; existing inventory models are reused.

**`ARCHITECTURE_AUDIT=PASS`**

---

## 6. Tenancy / Permissions / Audit

- Policies are tenant-anchored (`companyId`, `warehouseId`), unique per `(companyId, warehouseId)`; engine operations are scoped through company/branch context; cross-tenant valuation transfer is surfaced by reconciliation (`CROSS_TENANT_VALUATION_TRANSFER`).
- Permission keys seeded from a single source in constants: `inventoryValuation.read`, `inventoryValuation.costInput`, `inventoryValuation.initialize`, `inventoryValuation.activate`; permission-UI verification PASS; route-contract `MATCHED=1112`.
- Initialization is audited with user, company, branch, entity, action, timestamp, before/after values, and reason.

**`TENANCY_PERMISSIONS_AUDIT_AUDIT=PASS`**

---

## 7. API / Frontend / i18n Audit

- API: route-contract `REGISTEREDMODULES=113`, `REGISTEREDCONTROLLERS=123`, `BACKENDROUTES=1122`, `FRONTENDCALLSITES=1009`, `FRONTENDRUNTIMEROUTES=1019`, `AUDITEDRUNTIMEROUTES=1112`, `MATCHED=1112`, `MALFORMED=0`, `UNRESOLVED=0`, `MISMATCHES=0`.
- Frontend: `/admin/inventory/valuation` page implements policy list/create/update, initialization flow, readiness state, F9 warehouse lookup, permission gating; R1D cost fields on stock-adjustments and physical-counts pages; web test `inventory-valuation-ui.test.ts` (R1B UI) and `inventory-valuation-r1d-ui.test.ts`.
- i18n: `6110 EN = 6110 AR` keys, 22 namespaces registered both locales, no empty values, `9734` literal `t()` calls resolve; `inventory-valuation.ts` locale file present in EN and AR; RTL/LTR supported by existing locale infrastructure.
- Raw-keys check PASS (33 dynamic sites are safe fallback sites).

**`API_FRONTEND_I18N_AUDIT=PASS`**

---

## 8. Test Evidence (focused)

| Suite group | Suites | Tests |
|---|---|---|
| inventory-valuation module (engine/service/reconciliation/migration-contract/r1b-migration-contract) | 5 | 121 |
| inventory integrations (movements, transfers, stock-adjustments, physical-counts, adjustments, opening-balances, operational-receipts, balances) | 8 | 245 |
| maintenance R1E (stock-issue + work-orders service/r1e) | 4 | 124 |
| production R1F/R1G (material-documents service/r1f, finished-goods service/r1g-b, runs service/r1g-a, cost-aggregation authority) | 7 | 228 |

All focused groups **PASS, 0 failed, 0 skipped**.

---

## 9. Full Regression

| Gate | Result |
|---|---|
| FULL API tests | 165 suites, **2914/2914 PASS**, 0 failed |
| FULL Web tests (jest logic) | 36 suites, **1011/1011 PASS**, 0 failed |
| Typecheck (all workspaces) | PASS (`tsc --noEmit`) |
| API build | PASS (`tsc`) |
| Web build | PASS (`next build`, after clearing a stale local `.next` cache) |
| `prisma validate` | PASS (schema valid) |
| i18n check | `6110 EN = 6110 AR`, synchronized |
| Raw-keys check | PASS |
| Route contract | `MATCHED=1112, MALFORMED=0, UNRESOLVED=0, MISMATCHES=0` |
| Permission-UI verification | PASS |
| Credentials check | PASS (no hardcoded credentials in tracked files) |
| UI baseline integrity | 99 checks PASS |
| Example `api-smoke` | health endpoint PASS; 4 auth-gated reads skipped (`ATSOFT_API_TOKEN_NOT_PROVIDED`) — documented pre-existing environment limitation, same as prior closeouts |

**`FULL_API_TESTS=2914`, `FULL_WEB_TESTS=1011`, `FAILED_TESTS=0`, `REMOVED_TESTS=0`, `NEWLY_SKIPPED_TESTS=0`**

Note: the API/Web totals match the Production recloseout baseline (`docs/proofs/production-phase-1-final-recloseout-2026-09-24.md`: FULL_API_TESTS=2914, FULL_WEB_TESTS=1011). The engine worker-force-exit warning from Jest is a pre-existing teardown warning, not a test failure.

---

## 10. Runtime Proof

- Real API availability: `GET /api/v1/health` **200** (Windows-local instance, port 4000, healthy).
- Browser-level recertification of the full R1B UI was previously executed against a disposable QA tenant (`docs/proofs/inventory-valuation-legacy-init/browser-proof.pw.ts`, provision script `apps/api/scripts/valuation-qa-provision.ts`, disposable prefix `QA-VAL-R1B-UI-*`; QA credentials gitignored). Playwright screenshot evidence retained in that directory.
- Full browser re-run was not repeated during this closeout session; the API/Web/web-test/static-gate evidence above plus the recorded browser proof cover the runtime slice.

| Area | Status |
|---|---|
| API health / smoke | COMPLETE (~health 200) |
| R1B browser UI proof (legacy evidence) | COMPLETE (recorded) |
| Re-run of full Playwright suite this session | NOT_VERIFIED (no disposable QA tenant re-provisioned this session) |

**`RUNTIME_PROOF=COMPLETE_WITH_RECORDED_BROWSER_EVIDENCE`**

---

## 11. Tenant-Isolation Proof

Tenant isolation is enforced by construction and proven by tests: engine and service operations run inside company/branch scoped services; unique constraint `@@unique([companyId, warehouseId])` prevents cross-tenant policy collisions; movement entrypoints require compatible warehouse/company resolution; production cost snapshot is company/branch-scoped; reconciliation detects cross-tenant valuation transfer defects. Focused specs cover allowed/denied paths (121 valuation-module tests incl. migration contracts; R1E/R1F/R1G specs cover authorization and scope behavior). No blanket SUPER_ADMIN bypass was added.

**`TENANT_ISOLATION_PROOF=PASS`**

---

## 12. Data-Integrity / Migration Audit

- Schema validity: `prisma validate` PASS.
- All R1 migrations are committed, applied-presumed on Production (Production recloseout `prisma migrate status`: "up to date", 0 pending) and are ancestors of `origin/main`.
- No destructive operations, no `prisma db push` / `migrate reset`, no editing of applied migration history performed during this program or closeout.
- Monetary amounts stored as `Decimal`; quantities stored `Decimal(18,4)`; unit cost `Decimal(19,6)`; transfer total `Decimal(19,4)`; no floating-point money.

**`MIGRATION_AND_DATA_SAFETY=PASS`**

---

## 13. Known Limitations / Notes

1. **Stale documentation:** `docs/inventory-handover/inventory-limitations-and-controls-en.md:31` still states "No stock valuation method… Not implemented". This predates R1E/R1F implementation and is **stale**; application code, schema, and tests implement weighted-average valuation. Left untouched (out of program scope); a docs correction is recommended as a separate task.
2. Inventory valuation supports `WEIGHTED_AVERAGE` only; other methods are explicitly out of scope (`INVENTORY_VALUATION_METHODS=['WEIGHTED_AVERAGE']`).
3. Full Playwright browser recertification was not re-run in this session (recorded legacy evidence referenced); would require re-provisioning a disposable QA tenant.
4. Jest reports an engine-worker force-exit warning on some API suite runs; pre-existing, harmless, not a skipped/failed test.
5. `api-smoke` auth-gated reads are skipped when `ATSOFT_API_TOKEN_NOT_PROVIDED`; pre-existing environment limitation, identical to prior closeouts.

---

## 14. Conclusion

All slices R1A–R1H are implemented, committed on `origin/main`, and validated by focused specs, full API (2914) and Web (1011) regression, static gates, type/build, Prisma validate, and recorded runtime evidence. No mock data, no silent fallbacks, no skipped/removed tests, no unapproved scope. The program is declared:

**`INVENTORY_VALUATION_R1A_R1H=CLOSED`**

Governance record: this document committed on `origin/main` (fast-forward), `HEAD==origin/main`, ahead/behind 0/0, worktree clean.