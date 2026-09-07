# MIG-PROV-R1 — Final Provenance & Finalization Proof

- Task: `MIG-PROV-R1` (execution of the frozen ID-KEY-SAFE-R1 forward migrations + consumer deploy + closeout)
- Status: `MIG-PROV-R1 = CLOSED`
- Date: 2026-09-07
- Environment: Windows local SQL Server (DELL\WINCC, localhost:50079).

This document is the FINAL record. It explicitly separates **DESIGN-TIME evidence** from **PRE-PRODUCTION FINALIZATION** and from **REAL PRODUCTION EXECUTION / FINAL ACCEPTANCE**. Statements that were accurate during design/pre-production are preserved under their labeled phase and are superseded by the execution record where applicable.

- Machine-readable evidence: `docs/proofs/id-key-safety-r1-finalization-proof-evidence.json`.
- Design authority (historical design-time evidence): `docs/proofs/id-key-safety-r1-design-proof.md` (+ `.json`).

---

## PHASE-0. DESIGN-TIME EVIDENCE (historical, superseded)

The following design/pre-production facts remain accurate **as of design time** and were validated in the earlier design and rehearsal work. They are superseded by the real production execution documented below for final-state claims only (e.g. "production untouched", "no git writes", "write-only plan").

- `ID-KEY-SAFE-R1 = DESIGN_PROVEN` — bounded mirror key columns proven on canonical fresh replay (`ATsoftERP_KEYSAFE_PROBE`) and production-divergent replay (`ATsoftERP_KEYSAFE_DIVERGENT`).
- Pre-production rehearsal (historical): fresh replay on `ATsoftERP_MIG_PROV_FRESH_FINAL` (81 migrations, exit 0, `SQL_1753_COUNT=0`, `INDEX_WIDTH_WARNING_COUNT=0`, `FINAL_UNSAFE_KEY_COUNT=0`) and production-shape rehearsal on `ATsoftERP_MIG_PROV_PRODCLONE_FINAL` via canonical replay + shape transform (production divergence mirrored: SCB unique as 4100B nonclustered index, no SCB FKs, auto SLA PK names). These clones remain ONLINE as historical proofs.
- The earlier production-shape rehearsal used **replay + shape-transform** only because, at that time, a direct `BACKUP DATABASE` on `ATsoftERP_DB` was denied for the dev login (permission 262/3013). This is a design-time limitation and is superseded by the REAL backup-derived rehearsal below.

---

## PHASE-1. Mutable-start boundary (before execution, historical record)

- HEAD = `c964965a6af36d0731deeaf924eb070c3b4fe641` (first MIG-PROV commit)
- origin/main = `e03773924b5c3b3b43b0ccc73ec96aba73066253`
- `git rev-list --left-right --count origin/main...HEAD` = `0 1` (one commit ahead, unpushed).
- `stash@{0}` exists (Docker experiment wip) — preserved throughout.
- API service `ATsoftERP_API` RUNNING; port 4000 LISTENING; `/api/v1/health` = 200 (pre-execution health verified).

---

## PHASE-2. Final forward-migration package (frozen) — unchanged by execution

Because SQL Server compiles a Prisma migration batch as a single unit (error 207 when a statement references a column added earlier in the same batch; `GO` is not honored — error 102), the proven architecture ships as **two** forward migrations. They sort strictly AFTER `20260904125000_fix_sla_contract_and_width_drift` and BEFORE the frozen B1 migration (`20260904130000_cost_r2d_b1_overhead_source_period_foundation`).

| # | Migration identity | Content | SHA256 (frozen) |
|---|---|---|---|
| A | `20260904125100_mig_prov_r1_key_safety_hardening_a_add_bounded_mirror_columns` | pure nullable `ADD COLUMN` (mirrors only; no references) | `65AF411D606810CD696811C4F917A87AAEA1EF9F3E1406465EB68877BC4E0B68` |
| B | `20260904125200_mig_prov_r1_key_safety_hardening_b_apply_bounded_mirror_keys` | backfill, NOT NULL, trusted CHECKs, drop/recreate 8 unsafe keys, narrow 4 non-FK key columns, canonical FKs `IF NOT EXISTS` | `2EDE9D7A7BDEE19134CE210D6A9B7D943AFE2E70EBBA78430A66DC2DA7E53F81` |

- Fresh identities verified collision-free against production `_prisma_migrations` and the MIG-PROV migrations directory.
- The superseded proof identities (`20260904125600_id_key_safety_*`, `20260904125700_id_key_safety_*`) and failed scratch identities were moved out of the migrations directory (keysafe-trash) and are **not** part of the frozen package.
- Phase-B drops SLA PKs and the SCB PK by **dynamic clustered-PK-name detection** (`sys.indexes`); SCB `UQ_spare_part_condition_balances` handled for both the unique-constraint shape (canonical) and the unique-**index** 4100B shape (production).

---

## PHASE-3. REAL PRODUCTION EXECUTION (authorized, complete)

### 3.1 Real production backup

- `BACKUP DATABASE ATsoftERP_DB TO DISK = N'...MIGPROV_R1_20260907\ATsoftERP_DB_copyonly_20260907_020122.bak' WITH CHECKSUM, COPY_ONLY`.
- `BACKUP_EXIT = 0`; `RESTORE VERIFYONLY WITH CHECKSUM` → **"The backup set on file 1 is valid."** (`RESTORE_VERIFYONLY_EXIT = 0`).
- Size = `74,629,120` bytes; SHA256 = `677F18F118616678AA998260D7E2BAE70388C07188C7179387B799C991FD72BF`.
- (SQL Express does not support `COMPRESSION` — Msg 1844 on first attempt; retried without compression; recorded, not an error.)

### 3.2 Real backup-derived rehearsal clones

Two disposable clones were restored from the real backup above (never from shape-transform):

- `ATsoftERP_MIGPROV_R1_PRODCLONE2` — FULL rehearsal: preconditions + 8-key matrix identical to production (Compare-Object empty); frozen A+B applied (`CLONE_125100_EXIT=0`, `CLONE_125200_EXIT=0`); postconditions: 8/8 keys ≤900B, 6 CHECKs + 3 FKs trusted, mirrors==sources, `BUSINESS_DATA_MUTATION_COUNT=0`; Prisma runtime proof 19/19 gates PASS (`PRISMA_RUNTIME_PROOF_RESULT=PASS`, P2002 dup proofs); `prisma migrate resolve --applied` rehearsal + `migrate status` up-to-date; key matrix IDENTICAL to post-execution production.
- `ATsoftERP_MIGPROV_R1_RECOVERYCLONE` — recovery/determinism proof: same backup restored, A+B applied, `prisma migrate status` shows DDL-without-resolve not registered (no partial acceptance), final key matrix IDENTICAL to PRODCLONE2. `RECOVERY_PLAN_PROVEN=PASS`.

> Final acceptance authority = the **real backup-derived** rehearsal (PRODCLONE2/RECOVERYCLONE). The earlier replay+shape-transform rehearsal (§PHASE-0) is historical pre-production proof only.

### 3.3 Execution window

- `sc.exe stop ATsoftERP_API` → STOPPED; port 4000 NOT LISTENING; boundary re-verified clean (B1 tables/migrations absent, package rows absent).

### 3.4 Production migration execution

- Migration A `20260904125100` executed via `sqlcmd -E -b` → `PROD_125100_EXIT=0`, no errors/warnings in log.
- Migration B `20260904125200` executed → `PROD_125200_EXIT=0`, `WARNING_ERROR_MATCHES=0` (log tail: "(2 rows affected) (0 rows affected)").
- SQL used exactly the SHA256-frozen bytes (verified before application).

### 3.5 Post-execution acceptance (read-only)

- Final 8-key matrix IDENTICAL to clone: `UNSAFE_INDEX_AFTER_REPAIR_COUNT=0`, `UNSAFE_PRIMARY_KEY_COUNT=0`, `UNSAFE_UNIQUE_KEY_COUNT=0`.
- 6 CHECK constraints + 3 FKs: trusted (`is_not_trusted=0`, `is_disabled=0`).
- Data integrity: SCB mirror mismatch=0, SLA mirror mismatch=0, orphans=0, over-bound=0, duplicates=0, `BUSINESS_DATA_MUTATION_COUNT=0`; row counts preserved (SCB=2, SLA states=0, SLA rules=0, maintenance requests=12, warehouses=21).
- Rejection tests on clone: over-200 insert rejected 8152; mirror mismatch 547; orphan 547; SLA over-200 8152; no test-row leaks.

### 3.6 Prisma provenance

- `prisma migrate resolve --applied` on production for both package migrations (exit 0); stored checksums match frozen package (`65af411d…`, `2ede9d7a…`) — `MIGRATION_125100_PROD_CHECKSUM_MATCH=PASS`, `MIGRATION_125200_PROD_CHECKSUM_MATCH=PASS`.
- `prisma migrate status` on production → "Database schema is up to date!".
- Final production migration history (read-only): TOTAL=95, DISTINCT=81, ACTIVE=81, ROLLED_BACK=14, UNFINISHED=13, `UNRESOLVED_FAILED=0`, `ACTIVE_DUPLICATES=0`, `ACTIVE_EMPTY_CHECKSUMS=2` (unchanged legacy self-registered migrations). Package rows = 1/1.

### 3.7 Checksum reconciliation (read-only, measured — not hardcoded)

For every ACTIVE migration whose stored checksum differs from current repository bytes, a classifier recomputed SHA-256 of the current file and its recoverable byte-equivalent variants (LF, CRLF, BOM, UTF-16) and searched all historical git blobs:

- `ACTIVE_CHECKSUM_DIFFERENCE_COUNT = 15`
- `RECOVERED_EQUIVALENT_VARIANT_COUNT = 8` (all eight = current content under CRLF line-ending variant)
- `UNRECOVERABLE_HISTORICAL_HASH_COUNT = 7`
- `ACTIVE_EMPTY_CHECKSUM_COUNT = 2`

**Therefore the earlier report label "UNRECOVERABLE_HISTORICAL_HASHES = 15" is corrected: the true decomposition is 15 = 8 recovered equivalent variants + 7 unrecoverable historical divergences.** The 7 unrecoverable migrations are: `20260720231201_add_number_sequence_fields`, `20260725160000_add_operational_person_unique_user_link`, `20260726073000_add_downtime_rca_reliability_fields`, `20260726090000_add_maintenance_request_part_workflow_fields`, `20260727120000_add_stock_issue_fields_to_part_lines`, `20260728180621_maintenance_sparepart_classification_cost_attribution`, `20260806120000_add_production_material_and_fg_receipt`. All are pre-existing historical content drift (on-disk files identical between MIG-PROV tree and main tree), untouched by the package; no stored checksum was modified.

---

## PHASE-4. Consumer deployment + runtime acceptance

- Deployed artifact = exact MIG-PROV build: worktree `apps/api/dist` built from committed final schema; 4,150 files copied into main repo `apps/api/dist` and verified hash-identical (`ALL_DIST_FILES_IDENTICAL`); shared `@prisma/client` regenerated via `prisma generate` from the committed MIG-PROV schema.
- Service `sc.exe start ATsoftERP_API` → RUNNING; port 4000 LISTENING; `/api/v1/health` = **200** (`PRODUCTION_HEALTH_HTTP_200=YES`).
- Real production read-only runtime probe via deployed generated client: SLA fields read, SLA rule `isActive` read, SLA state read, overdue query, SLA stats, SCB mirror read (2 rows) — 6/6 PASS; `PRODUCTION_SQL_207_COUNT=0`; `SLA_RUNTIME_CONTRACT_AFTER=PASS`.
- Final full regression on exact committed source:
  - API: **150 suites / 2621 tests — ALL PASS** (0 skipped, 0 removed).
  - Web: **34 suites / 964 tests — ALL PASS** (baseline; zero MIG-PROV web changes).
  - API typecheck exit 0; API build exit 0; web build exit 0.
  - i18n PASS (6023 en = 6023 ar); raw-keys PASS; ui-baseline PASS.
  - `git diff --check` exit 0 (main + MIG-PROV tree).

### Test-count reconciliation (measured inventory)

- Final committed API test inventory = **150 / 2621** (`FINAL_API_SUITE_COUNT`, `FINAL_API_TEST_COUNT`).
- The earlier finalization evidence value 150/**2618** predates the SLA runtime error-isolation fix; commit `82df769` added exactly **3** `it()` cases to `maintenance-requests.service.spec.ts` (create→createSlaState normal path; still-calls-when-notification-fails; tolerates-createSlaState-failure-surfaced-as-logged-error). Hence **2618 → 2621**.
- Dirty main tree run 153/**2694** = 150 committed suites + **3 B1-only untracked** operational-overhead spec suites (52 + 4 + 20 = **76 tests**); 2618 + 76 = 2694 (exact). With the SLA fix, current committed baseline = 2621; B1 overhead suites remain untracked/preserved in the main tree only.
- `FILTERED_OUT_REQUIRED_TESTS=0`, `NEWLY_SKIPPED_TESTS=0`, `REMOVED_TESTS=0`, `TEST_COUNT_HISTORY_EXPLAINED=PASS`.

---

## PHASE-5. Git closeout — stable non-recursive evidence model

Git-state facts are recorded in three distinct, deliberately non-recursive layers. **The committed document never embeds the SHA of the commit that would contain this very document** (that would create a recursive/fixed-point requirement):

1. **Production closeout Git head before final evidence reconciliation:** `0afd3f0a25be29273eaa6c61097c691f34dfb023` — the pushed head of the three-commit production implementation chain `c964965a6af36d0731deeaf924eb070c3b4fe641` → `82df76909e3c95a6c59b1540356700ee843f1f9c` → `0afd3f0a25be29273eaa6c61097c691f34dfb023` that delivered the production repair, SLA runtime contract fix, provenance repair, key-safety repair and their regression proof.
2. **Final evidence reconciliation:** the documentation-only commit containing this document (this file and its evidence JSON corrected to this stable model; no code, Prisma schema, migration, or B1 changes are part of it). Its SHA is intentionally **not** written into these files.
3. **Post-push current HEAD / origin synchronization:** verified **externally after push** by git commands (`git rev-parse HEAD`, `git rev-parse origin/main`, `git rev-list --left-right --count origin/main...HEAD`), and reported in the post-push execution report. A specific `HEAD == origin/main == <SHA>` assertion accordingly belongs in that report, never as a committed current-state claim.

- Every push in MIG-PROV-R1 (production chain + evidence reconciliation) was a normal fast-forward; `force_push_used=false`.
- `stash@{0}` unchanged; historical tags unchanged; Canary01 untouched; Docker unused.
- B1 (COST-R2D-B1) preserved uncommitted in the main working tree and **not executed**.

---

## PHASE-6. B1 final boundary

- Production: `dbo.operational_overhead_periods` = ABSENT; `dbo.operational_overhead_entries` = ABSENT; migration `20260904130000_cost_r2d_b1_overhead_source_period_foundation` = ABSENT from `_prisma_migrations`.
- B1 source remains uncommitted and preserved in the main working tree only.
- `B1_TRACKED_FILES_IN_PUSHED_HEAD=0`.

---

## Verdict

`MIG-PROV-R1 = CLOSED` · `FINAL_EVIDENCE_CONSISTENCY = PASS` · `CAN_RESUME_B1 = YES`