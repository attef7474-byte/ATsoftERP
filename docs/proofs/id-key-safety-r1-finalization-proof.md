# ID-KEY-SAFE-R1-FINALIZE — Forward Migration Package Finalization Proof

- Task: `ID-KEY-SAFE-R1-FINALIZE`
- Status: `ID-KEY-SAFE-R1-FINALIZE = READY_FOR_PRODUCTION_REPAIR` (production execution NOT performed; plan is write-only)
- Date: 2026-09-07
- Environment: Windows local SQL Server (DELL\WINCC, localhost:50079). Production database `ATsoftERP_DB` **untouched**. No `git` write operations. No push of `c964965`. COST-R2D-B1 untouched and not executed.
- Machine-readable evidence: `docs/proofs/id-key-safety-r1-finalization-proof-evidence.json`.
- Design authority: `docs/proofs/id-key-safety-r1-design-proof.md` (`ID-KEY-SAFE-R1 = DESIGN_PROVEN`, 2026-09-07).

---

## 1. Mutable-start boundary (verified)

- HEAD = `c964965a6af36d0731deeaf924eb070c3b4fe641`
- origin/main = `e03773924b5c3b3b43b0ccc73ec96aba73066253`
- `git rev-list --left-right --count origin/main...HEAD` = `0 1` (HEAD one commit ahead, **unpushed**).
- No staged changes (`git diff --cached` empty). `stash@{0}` exists (Docker experiment wip) — untouched.
- Port 4000 API listening (PID 42100); `/api/v1/health` = 200.

## 2. Final forward-migration package (frozen)

Because SQL Server compiles a Prisma migration batch as a single unit (error 207 when a statement references a column added earlier in the same batch; `GO` is not honored — error 102), the proven architecture ships as **two** forward migrations. They sort strictly AFTER `20260904125000_fix_sla_contract_and_width_drift` and BEFORE the frozen B1 migration (`20260904130000_cost_r2d_b1_overhead_source_period_foundation`).

| # | Migration folder | Content | SHA256 (frozen) |
|---|---|---|---|
| A | `20260904125100_mig_prov_r1_key_safety_hardening_a_add_bounded_mirror_columns` | pure nullable `ADD COLUMN` (mirrors only; no references) | `65AF411D606810CD696811C4F917A87AAEA1EF9F3E1406465EB68877BC4E0B68` |
| B | `20260904125200_mig_prov_r1_key_safety_hardening_b_apply_bounded_mirror_keys` | backfill, NOT NULL, trusted CHECKs, drop/recreate 8 unsafe keys, narrow 4 non-FK key columns, canonical FKs `IF NOT EXISTS` | `2EDE9D7A7BDEE19134CE210D6A9B7D943AFE2E70EBBA78430A66DC2DA7E53F81` |

- Fresh identities verified collision-free against production `_prisma_migrations` and the MIG-PROV migrations directory.
- The two superseded proof identities (`20260904125600_id_key_safety_*`, `20260904125700_id_key_safety_*`) and the failed scratch identities (`20260904125000_zz_gotest`, stale draft) were moved out of the migrations directory (keysafe-trash) and are **not** part of the frozen package.
- The phase-B SQL drops SLA PKs and the SCB PK by **dynamic clustered-PK-name detection** (`sys.indexes`), so production's auto-generated PK names (`PK__maintena__3213E83FE0BF4E2C`, `PK__maintena__3213E83F6888E1F0`) are handled. SCB `UQ_spare_part_condition_balances` is handled for both the unique-constraint shape (canonical replay) and the unique-**index** 4100B shape (production).

## 3. Source-tree isolation (B1 contamination = 0)

MIG-PROV source tree = disposable worktree `atsofterp-keysafe-wt` (junctioned node_modules to main repo).

- `git status --short` = 7 modified files + 2 untracked migration package folders; **no** operational-overhead / `externalDocumentReference` / B1 models present. `B1_HUNK_CONTAMINATION_COUNT = 0`.
- The 79 baseline migration folders in the MIG-PROV tree match exactly the 79 unique migration names recorded in production `_prisma_migrations` (no gaps, no extras).
- Main repo dirty tree (COST-R2D-B1) carries the B1 hunks (incl. `externalDocumentReference String? @db.NVarChar(200)`); they are isolated and do not enter the MIG-PROV package.

## 4. Fresh PRE-B1 replay (disposable database `ATsoftERP_MIG_PROV_FRESH_FINAL`)

- All 81 migrations replayed from zero via `prisma migrate deploy` (79 baseline + `125000` + package A + package B).
- `FRESH_REPLAY_EXIT = 0` — all migrations applied successfully.
- `SQL_1753_COUNT = 0` (no column-width/index-limit errors during replay).
- `INDEX_WIDTH_WARNING_COUNT = 0` (no key object > 1700 bytes).
- `FINAL_UNSAFE_KEY_COUNT = 0` (8 plainly safe).
- SCHEMA_REPLAY and HISTORY_REPLAY both clean. Legacy self-registration: migrations `20260728180621_...` and `20260728200621_...` insert their own row into `_prisma_migrations` (identical duplicate-row behavior to production; pre-existing, ratified, unchanged).

## 5. Production-shape rehearsal (disposable clone of CURRENT production)

A direct `BACKUP DATABASE` on `ATsoftERP_DB` is denied for the dev login (permission 262/3013), so the production plan remains **write-only**. Clone was built with the already-ratified canonical replay + shape transform to production's exact measured metadata:

- 79 baseline migrations replayed, then transformed to production shape: SCB `UQ_spare_part_condition_balances` as **unique nonclustered index** at 4100B (not a constraint), both SCB FKs removed, SLA PKs left auto-named (`PK__maintena__...`, 2000B) — matching production's measured metadata exactly.
- Applied ONLY the two final migrations via `prisma migrate deploy` (the other 79 names already recorded → apply = 2 migrations).
- `PRODUCTION_CLONE_REPAIR = PASS`:
  - maintenance_sla_rules PK → `PK_maintenance_sla_rules` 400B
  - maintenance_sla_states PK → `PK_maintenance_sla_states` 400B; unique `idx_maintenance_sla_states_request_key` 400B
  - spare_part_condition_balances PK → `PK_spare_part_condition_balances` 400B; `UQ_spare_part_condition_balances` 900B on mirrors; `IX_scb_sparePartKey`/`IX_scb_warehouseKey`/`IX_scb_productId` 400B each
  - `UNSAFE_KEY_COUNT_AFTER_CLONE_REPAIR = 0`; all 6 CHECKs trusted (`is_not_trusted=0`); SCB FKs `FK_scb_sparePart`/`FK_scb_warehouse` added; `BUSINESS_DATA_MUTATION_COUNT = 0`; orphan count 0; row counts unchanged.

## 6. Enforcement + fail-closed proof (production-shaped clone)

| Check | Result |
|---|---|
| Prisma creates SCB row with mirrors equal to source | `CREATE_MIRROR_OK true` |
| Duplicate mirror insert (Prisma) | `DUP_PASS P2002` |
| Read-back via mirror-defined unique | `READBACK_OK true`, `BY_MIRROR_UNIQUE_OK true` |
| Orphan `sparePartId` (FK) | error 547 — rejected |
| `spare_part_key <> sparePartId` (CHECK equality) | error 547 — rejected |
| source value > 200 chars (CHECK length) | error 8152 — rejected |
| Pre-existing >200-char data without mirrors + trusted CHECK add | error 547 — **fail closed** |
| Re-run `prisma migrate deploy` | "No pending migrations to apply" |
| Phase-A re-run SQL | pure no-op (all guards `IF NOT EXISTS`) |

## 7. Schema/DB contract alignment

`prisma migrate diff --from-config-datasource --to-schema` on the fresh final DB: for the four corrected tables the only entries are index/PK/FK **name renames** to Prisma default names plus identical-value default re-writes — **zero `ALTER COLUMN`**, zero width changes, no new unsafe object. This is the repo-wide pre-existing naming drift pattern (ratified). `prisma validate` valid; `prisma generate` clean.

## 8. Full regression (PHASE 11)

| Gate | Result |
|---|---|
| API unit/integration tests | 150 suites / 2618 tests — ALL PASS, 0 skipped, 0 removed |
| API `tsc` build | PASS |
| Web `next build` | PASS |
| i18n consistency | PASS (6023 keys en = 6023 keys ar, all namespaces, no empty) |
| ui-baseline check (incl. i18n + raw-keys + permission-ui) | PASS |
| `git diff --check` (main repo and MIG-PROV tree) | PASS (exit 0) |

`NEWLY_SKIPPED_TESTS = 0`, `REMOVED_TESTS = 0`, `FULL_REGRESSION = PASS`.

## 9. Constraint and isolation status

- Production `ATsoftERP_DB` untouched; no writes, no `prisma db push`, no `migrate reset`.
- No `git` write operations: no commit, no push of `c964965`, no `git add .`; `stash@{0}` / tags / Canary01 / Docker untouched.
- COST-R2D-B1 unchanged and not executed (separate frozen scope).
- Shared junctioned `@prisma/client` currently reflects the MIG-PROV worktree schema (side effect of MIG-PROV `prisma generate`); regeneration from main repo schema is required to restore the B1 main-repo typecheck baseline before B1 resumes (documented — not a MIG-PROV defect).

## 10. Production execution plan (WRITE-ONLY — requires separate authorization)

1. `RESTORE VERIFYONLY`-safe `COPY_ONLY` + `CHECKSUM` backup of `ATsoftERP_DB` (operator/sysadmin; dev login lacks BACKUP permission).
2. Record pre-run object matrix (8 keys), `_prisma_migrations` count, SCB/TenantSLA row counts.
3. Stop API; run `sqlcmd -S "tcp:localhost,50079" -E -b` (or `-U/-P` per site policy) applying package A then B exactly as frozen (files SHA256-verified from this doc).
4. Verify: exit 0; 1753=0; 8-key matrix safe; CHECKs trusted; FKs present; duplicate/orphan attempts rejected; row counts unchanged.
5. `prisma migrate resolve --applied` only if the deploy flow needs bookkeeping reconciliation.
6. Build + start API; health + smoke; runtime proof (create SCB, duplicate rejected, read-back).
7. Audit + provenance; then the separately approved consumer-code deployment and git closeout + push.

Rollback strategy: full schema reversal is NOT required — the migration preserves all business data; mirrors are derived from sources (equality Checked), so sources remain authoritative and consumers still read/write them. Any rollback would:
- revert package A+B by `prisma migrate resolve --rolled-back` only for bookkeeping on a DB restored from the pre-run backup, or
- drop the mirrors/CHECks in a reverse corrective migration if ever needed (never delete sources).
No `migrate reset`/destructive restore is ever permitted.

## 11. Verdict

`ID-KEY-SAFE-R1-FINALIZE = READY_FOR_PRODUCTION_REPAIR`