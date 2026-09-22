# COST-R2D-B3-P1 implementation and pre-production proof

Evidence date: 2026-09-22. Baseline: `main` = `origin/main` = `57952886ca690109ce7b79be909755ed0fc4d519` (unchanged), working tree clean at start.

Implementing phase: `COST-R2D-B3-P1` on worktree branch `cost-r2d-b3-p1-20260922`, per the frozen owner contract `docs/proofs/cost-r2d-b3-owner-contract-freeze-2026-09-22.md`. This document follows the non-recursive Git evidence model: it does not claim its own future commit hash. The single implementation commit carrying this file is recorded in the Git log and the §40 closeout report.

---

## 1. Frozen contract position

- Contract: `cost-r2d-b3-owner-contract-freeze-2026-09-22.md` (P0, `FROZEN`).
- Allowed schema change (B.7, the ONLY authorized migration): one additive `source_type_ck` vocabulary value `N'OVERHEAD_ALLOCATION_LINE'` plus `N'OVERHEAD'` reuse — no table, no column, no index, no FK change.
- Rejected out of scope (B.13): GL entries, AP, FX, energy/depreciation import, FG/inventory capitalization, COGS, period reopening, ledger table/column additions.

## 2. Implemented surface (all connected)

| Area | Delivered |
|---|---|
| Ledger adapter | `overhead-allocation.ledger.ts`: canonical posting of every eligible FINAL positive line through `postLedgerEntryWithinTransaction`, reversal via `reverseLedgerEntry`, per-line generation identity, fingerprint `OVERHEAD_ALLOCATION_LINE:<allocationId>:<lineId>:OVERHEAD`, clientRequestId `overhead-allocation:<allocationId>:<lineId>:<generation>:<action>`, replay normalization (`'transaction' in witness ? witness.transaction : witness`), reverse fingerprint `[original.id, reason, notes].join('|')`. |
| Orchestration | `overhead-allocation.service.ts`: FOUR actions (post, reversal, reconciliation, status) each inside `this.boundary` (Serializable + applock `ATSOFT:OVERHEAD:PERIODS:` + sha256([companyId, branchId])); currency validation vs operational currency; zero-line `SKIPPED_ZERO`; negative line fail-closed `overheadAllocation.invalidInputs`; reconciliation delegates to the single R1C authority `reconcileOverheadAllocation(allocationId, ctx, tx)`; audit `OVERHEAD_ALLOCATION_LEDGER_POST/_REVERSE/_RECONCILE` with `aggregateEqual = decision?.reconciled ?? false` (latent `aggregate.fullReconciled` removed). |
| API | `POST /production/overhead-allocations/:id/post-to-ledger` (`production-cost-overhead-allocation:post`), `GET /production/overhead-allocations/:id/reconciliation` (`:reconcile`), `POST /production/overhead-allocations/:id/ledger-reversal` (`:post`). Global ValidationPipe whitelist + forbidNonWhitelisted (all three bodies verified). |
| Web | `page.tsx`: Post-to-ledger action + confirmation, ledger tab (summary aggregate + AdminDataGrid lines with status/action column), Reverse posting modal, loading/empty/error/permission states, real permission gating (`canPostAllocationToLedger` on post, reconcile-tab gated), audit labels. Clients in `apps/web/src/lib/overhead-allocation.ts`: `postAllocationToLedger`, `getAllocationReconciliation`, `reverseAllocationLedgerLine`. |
| i18n | en/ar `overhead-allocation.ts` + `api-messages.ts` key parity; literal `t('overheadAllocation.<key>')` usage; no raw keys returned. |

## 3. The ONLY migration — byte proof

Migration folder: `apps/api/prisma/migrations/20260922010000_cost_r2d_b3_overhead_allocation_ledger_source_type/`

- `migration.sql` SHA256 (computed at closeout): `ad856bd342497e021ee85686b640d3a988c6d4938379837fb59b3b05e6077220`
- Byte size: `1806`
- The B3 row in `dbo._prisma_migrations` stored checksum `ad856bd342497e021ee85686b640d3a988c6d4938379837fb59b3b05e6077220` — **exact byte match** (case-normalized identical), `rolled_back_at null`.

Migration semantics (reviewed, additive, transactional):

- Preserves all existing `source_type_ck` vocabulary; appends the single new value `N'OVERHEAD_ALLOCATION_LINE'`.
- `WITH CHECK ADD CONSTRAINT` + `CHECK CONSTRAINT` re-enabled; created inside one transaction; any failure rolls the whole migration back.

## 4. Disposable-DB migration replay proof (production DB untouched)

Production database `ATsoftERP_DB` on `sqlserver://localhost:50079` was **never mutated**. A fresh disposable DB was created (`ATsoftB3Disposable_20260922`, SQL Server 13.0.5108.50 / 2016 SP2 Express, integrated auth) and `prisma migrate deploy` from `apps/api` applied the full history:

- `All migrations have been successfully applied.` — all `84` migrations in order, including the B3 migration.
- Replay evidence (post-apply, queried on the disposable DB):

| Check | Result |
|---|---|
| `operational_cost_transactions_source_type_ck` present | PASS |
| Constraint enabled (`is_disabled = 0`) | PASS |
| Constraint trusted (`is_not_trusted = 0`) | PASS |
| Definition contains `N'OVERHEAD_ALLOCATION_LINE'` | PASS |
| All 12 CHECK constraints on the table enabled + trusted | PASS |

Disposable-DB enforcement probe (inside a transaction, rolled back):

- `INSERT` with `sourceType = N'OVERHEAD_ALLOCATION_LINE'` → `inserted_rows = 1` (accepted by the constraint).
- `UPDATE` to `N'NOT_A_VALID_TYPE'` → SQL error 547 (constraint rejected it).
- `ROLLBACK` → 0 rows remain (no side effects).

`MIGRATION_REPLAY=PASS`, `ENFORCEMENT_PROBE=PASS`, `PRODUCTION_DB_UNTOUCHED=PASS`. The disposable DB was dropped after evidence capture.

## 5. MIG-PROV: empirical index byte-limit reverify (contract PART E item 2)

Deployed R1B filtered unique indexes on `dbo.operational_cost_transactions` (replayed schema, 2016 SP2):

| Index | Key columns (declared, all `nvarchar(1000)`) | Declared key sum |
|---|---|---|
| `operational_cost_transactions_canonical_line_key` (filtered, `sourceLineId IS NOT NULL AND entryRole='PRIMARY_COST' AND status='POSTED' AND reversedAt IS NULL`) | companyId, branchId, sourceType, sourceId, sourceLineId, entryRole | 12000 bytes |
| `operational_cost_transactions_tenant_request_key` | companyId, branchId, clientRequestId | 6000 bytes |

SQL Server 2016 allows creation of over-1700-byte-declared nonclustered indexes with a warning and enforces 1700 bytes per key at write time (error 1946). Empirical boundary probes on the disposable DB (rolled back):

- Max-realistic B2 payload: companyId/branchId 100 chars, sourceId/sourceLineId 200 chars (B2 ids are `nvarchar(200)` → 400 bytes each), `sourceType=OVERHEAD_ALLOCATION_LINE` (46 bytes), `entryRole=PRIMARY_COST` (24 bytes) → index key ≈ 1242 bytes → **insert `rows=1`**.
- Overlong payload: 1000-char `sourceId`/`sourceLineId` near column max → **SQL error 1946: "index entry of length 2076 bytes exceeds the maximum length of 1700 bytes"** (enforcement active).
- `tenant_request_key` with max-realistic `clientRequestId` (856 bytes: `overhead-allocation:` + 200-char id + `:` + 200-char line + `:1:post`) → **insert `rows=1`**.

`KEY_SAFETY_RUNTIME=PASS`: real B3 payloads fit well inside the 1700-byte nonclustered key limit; the registry still rejects overlong keys (1946). No new index, FK, or column surface is introduced by the B3 migration.

## 6. Tests

### API (`apps/api`)

- B3 matrix spec `overhead-allocation.b3.spec.ts` — 16 tests PASS covering PART E items 3–4: lock identity + Serializable for every op; non-FINAL rejection (post/reverse); currency drift rejection; full provenance on eligible positive lines; zero-line `SKIPPED_ZERO` with no writer call; negative line fail-closed; exactly-once (already-posted idempotent, no double write); replacement after reversal under new generation + fresh fingerprint; reversal of unposted line; unknown line NotFound; double-reversal rejection propagated; reconciliation returns R1C report + audit; **tenant isolation: foreign allocation IDs → NotFound without leaking existence** across post/reverse/reconcile (A-read OK, B cannot read/edit/reference/post); lock conflict → `overheadAllocation.concurrencyConflict` with no writer call.
- Ledger spec `overhead-allocation.ledger.spec.ts` — unit mapping of canonical writer payload/reversal.
- i18n spec — every overhead-allocation/B3 message key defined non-empty in ar+en and never returned raw.
- Security spec — `it.each(handlers)` protects every actual controller handler (incl. the three B3 routes) with its own permission via the real `PermissionsGuard`, allowing/denying for ACTIVE vs INACTIVE.
- Database spec — narrow idempotent permission seed: 7 B2/B3 keys upserted, idempotent on repeat, `rolePermission` only when a role exists.
- Reconciliation service spec + existing suites extended for `reconcileOverheadAllocation` read-only scope.
- **Full API run: 163 suites / 2898 tests PASS.**

### Web (`apps/web`)

- `overhead-allocation.test.ts` — `canPostAllocationToLedger` / `canReverseLedgerLine` permission matrices.
- `overhead-allocation-requests.test.ts` — POST-TO-LEDGER endpoint + double-submit lock released after failure; ledger tab reads R1C report when FINAL+authorized; denied/non-FINAL exposes neither; real-API serialization of the three clients incl. Arabic reason.
- **Full web run: 36 suites / 1011 tests PASS** (focused subset 47 PASS).

## 7. Static gates

| Gate | Result |
|---|---|
| `route-contract:check` | PASS — BACKENDROUTES=1122, FRONTENDCALLSITES=1009, MATCHED=1112, MISMATCHES=0 |
| `qa:build` (build:api + build:web) | PASS |
| `ui-baseline:check` | PASS (raw-key/parity/error-dialog/loading/error/empty checks) |
| `credentials:check` | PASS (no hard-coded credentials) |
| `api-smoke-test.js --optional` | PARTIAL — health endpoint PASSED=1; 4 auth-gated reads skipped (`ATSOFT_API_TOKEN_NOT_PROVIDED`). Pre-existing environment limitation, unrelated to B3. |

## 8. Permissions and audit

- Two seeded B3 permission keys: `production-cost-overhead-allocation:post`, `production-cost-overhead-allocation:reconcile` (narrow idempotent seed, 7 total overhead-allocation keys).
- Audit actions: `OVERHEAD_ALLOCATION_LEDGER_POST`, `OVERHEAD_ALLOCATION_LEDGER_REVERSE`, `OVERHEAD_ALLOCATION_LEDGER_RECONCILE` — company/branch/entity/action/timestamp/previous-new values; reversal audits the reason; the canonical writer emits its own `TRANSACTION_POST` / `TRANSACTION_REVERSE` audit.

## 9. Tenant isolation proof (Constitution §13)

- Backend scope: every B3 operation reads the allocation with `where { id, companyId, branchId, companyKey, branchKey }` derived from the authenticated context; a missing/wrong tenant resolves to NotFound (no existence leak).
- Foreign-id spec: posting, reversal, and reconciliation of another company's allocation all reject with NotFound, and the scoped findFirst arguments are asserted.
- Reconciliation is scoped to the allocation's tenant; search/export of posted ledger rows stays behind the ledger's own tenant filters.
- Currency consistency between the allocation and the company's operational currency is enforced before any write.

## 10. Runtime proof status

- Backend behavior proven by 16-test B3 matrix + full 2898-test API suite + 1011-test web suite + static gates above: `Frontend → API → Permission → Service → Database → Audit → Result` path covered by unit/integration tests, i18n/route/UI baseline checks.
- Live-authenticated browser/smoke run is limited by the pre-existing `ATSOFT_API_TOKEN_NOT_PROVIDED` environment (PARTIAL under `--optional`); no B3-specific blocker exists.

## 11. Files in the implementation commit (intended set)

Modified: API service/controller/DTO/module, `operational-cost-reconciliation.service.ts`, `production-cost.constants.ts`, reconciliation + database-contract specs, i18n `api-messages.ts`, permission seed, web `page.tsx`, web lib + locales (en/ar), web tests (2), plus the four new B3 spec files and the migration folder as untracked additions. Staged explicitly; no `git add .`, no artifacts/secrets.

## 12. Owner acceptance mapping

| Contract item | Status |
|---|---|
| B.7 singularity (only expected migration) | PASS |
| Part E 1 — ui-baseline re-run after UI changes | PASS |
| Part E 2 — empirical index byte-limit reverify before B.7 | PASS |
| Part E 3 — tenant-isolation specs (A-read / B-cannot read/edit/reference/post) | PASS |
| Part E 4 — exactly-once, double-reversal, replacement-after-reversal, zero-line, monetary-conservation specs | PASS |
| Part E 5 — Arabic/English key parity + permission labels | PASS |
| Part E 6 — no source committed before explicit implementation approval | PASS (approval given for P1) |

`COST-R2D-B3-P1=COMPLETE`.

## 13. Known limitations and pre-existing issues

- API smoke `--optional` PARTIAL only due to `ATSOFT_API_TOKEN_NOT_PROVIDED` (environmental, pre-existing).
- Live production DB intentionally not mutated during pre-production proof; production deployment is the next explicit phase and must follow the reviewed migration + registration + regression procedure used by B2.
- The disposable replay DB was dropped after evidence capture; no fixture rows persist anywhere.