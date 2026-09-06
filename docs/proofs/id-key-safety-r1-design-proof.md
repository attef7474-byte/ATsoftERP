# ID-KEY-SAFE-R1 Design Proof — Bounded Mirror Key Columns

- Status: `ID-KEY-SAFE-R1 = DESIGN_PROVEN`
- Date: 2026-09-07
- Environment: Windows local SQL Server (DELL\WINCC, localhost:50079). Production database `ATsoftERP` **untouched**. Main repo **untouched**. All verification on disposable clones.
- Machine-readable evidence: `docs/proofs/id-key-safety-r1-design-proof-evidence.json`.

---

## 1. Task

Prove the "bounded mirror key columns" (Option B) design for the three tables whose wide key columns and redundant indexes exceed SQL Server safe key sizes:

- `spare_part_condition_balances`
- `maintenance_sla_rules`
- `maintenance_sla_states`

The proof had to run against two physical clone shapes and return `DESIGN_PROVEN` or `BLOCKED`.

## 2. Design (Option B, locked)

Keep the wide FK columns as-is (`sparePartId`, `warehouseId`, `maintenance_request_id`, all `NVARCHAR(1000)`). Add **stored mirror key columns**:

- `spare_part_condition_balances.spare_part_key`, `warehouse_key` — `NVARCHAR(200)` NOT NULL
- `maintenance_sla_states.maintenance_request_key` — `NVARCHAR(200)` NOT NULL

Each mirror is bound by **trusted CHECK constraints**:

- `mirror = source` (exact equality)
- `LEN(source) <= 200`

Uniqueness and performance indexes move onto the bounded mirrors. The three unsafe non-FK key columns (`scb.id`, `scb.productId`, `sla_rules.id`, `sla_states.id`) are locally narrowed to `NVARCHAR(200)`. The canonical production-missing FKs (`FK_scb_sparePart`, `FK_scb_warehouse`, `FK_maintenance_sla_states_request`) are added idempotently.

## 3. Why the corrective is split into two migrations

Empirically confirmed on SQL Server 2022 via old-style `prisma migrate deploy`:

- `GO` is **not** honored; a test migration (`20260904125700_zz_gotest`) failed with error 102 "Incorrect syntax near 'GO'".
- A migration batch compiles as one unit; a statement referencing a column added earlier in the **same** batch fails with error 207 "Invalid column name".

Resolution: two forward migrations.

- `20260904125600_id_key_safety_add_bounded_mirror_columns` — pure `ADD COLUMN` (nullable mirrors only; no references to the new columns).
- `20260904125700_id_key_safety_apply_bounded_mirror_keys` — everything that references the mirrors (backfill, NOT NULL, CHECKs, drop/recreate indexes, narrow columns, PK recreations, FK adds).

## 4. Clone A — canonical fresh replay (`ATsoftERP_KEYSAFE_PROBE`)

Full history replayed (81 migrations including correctives) onto a fresh database. Result object matrix (key bytes = summed stored column size of all key columns):

| Object | Bytes | Unique | Safe |
|---|---|---|---|
| maintenance_sla_rules.PK_maintenance_sla_rules | 400 | PK | yes |
| maintenance_sla_rules.idx_is_active / priority / type | 1 / 100 / 100 | – | yes |
| maintenance_sla_states.PK_maintenance_sla_states | 400 | PK | yes |
| maintenance_sla_states.idx_request_key | 400 | unique | yes |
| maintenance_sla_states.idx_sla_status / escalation_level | 100 / 100 | – | yes |
| spare_part_condition_balances.PK_spare_part_condition_balances | 400 | PK | yes |
| spare_part_condition_balances.UQ_spare_part_condition_balances | 900 | unique | yes |
| spare_part_condition_balances.IX_sparePartKey / warehouseKey / productId | 400 | – | yes |
| spare_part_condition_balances.IX_condition | 100 | – | yes |
| spare_part_condition_balances.IX_lastMovementAt | 8 | – | yes |

- All 6 CHECK constraints present and **trusted** (`is_not_trusted = 0`, `is_disabled = 0`).
- 3 FKs: `FK_scb_sparePart`, `FK_scb_warehouse`, `FK_maintenance_sla_states_request`.
- Column widths as designed (see evidence JSON).
- Runtime enforcement (rolled-back transaction): valid insert passes; duplicate mirror → error 2601; source > 200 chars → error 8152 (mirror truncation); mirror ≠ source → error 547 (CHECK violation).

## 5. Clone B — production-divergent replay (`ATsoftERP_KEYSAFE_DIVERGENT`)

Mirrored the real production divergence: replayed all 79 pre-corrective baseline migrations, then transformed SCB to production shape (dropped both FKs, converted the unique **constraint** into a unique nonclustered **index** on `(sparePartId, warehouseId, condition)` at 4100 bytes, with the >1700B over-limit warning), then applied the correctives.

Result: identical safe matrix to Clone A. FKs added 0 → 3, UQ moved to 900B on mirrors, CHECKs trusted. Both production shape variants are handled idempotently (`IF is_unique_constraint=1 DROP CONSTRAINT ELSE DROP INDEX`; FK adds `IF NOT EXISTS`).

## 6. Prisma-level runtime proof

`keysafe-runtime-proof.cjs` (worktree `apps/api`, run with PrismaMssql adapter, Prisma 7.8.0):

- `PARENTS_OK` — parent entities (spare part, warehouse, maintenance request) referenceable.
- `CREATE_MIRROR_OK true` — SCB row written with `sparePartKey`/`warehouseKey` equal to source.
- `DUP_PASS P2002` — inserting the same mirror pair raises the unique violation.
- `READBACK_OK true`, `BY_MIRROR_UNIQUE_OK true`.

## 7. Schema/DB contract alignment (part of A–O)

The `migrate diff --from-config-datasource --to-schema` against Clone A showed, for the corrected tables, widening `ALTER COLUMN` back to `nvarchar(1000)` for `productId` and `condition` (and `priority/type/slaStatus/escalationLevel` from earlier baseline DDL). A future `prisma migrate dev` would have re-bloated `IX_scb_productId` (~2000B) and broken the 900B UQ-key contract. Fix: declare the real widths in the worktree schema:

- `SparePartConditionBalance.productId @db.NVarChar(200)`, `condition @db.NVarChar(50)`
- `MaintenanceSlaRule.priority/type @db.NVarChar(50)`
- `MaintenanceSlaState.slaStatus/escalationLevel @db.NVarChar(50)`

After the fix the diff for the four tables contains **zero** column-type or width changes — only index/PK/FK/default-constraint renames to Prisma default names, which is the repo-wide pre-existing naming pattern and is cosmetic.

`prisma validate` clean. `prisma generate` clean (client exposes `sparePartKey`, `warehouseKey`, `maintenanceRequestKey` as required fields).

## 8. Consumer migration (worktree only)

All mirrors written equal to source at creation; lookups switched to mirror keys.

- `spare-part-conditions.service.ts` — SCB create + balance filter predicates use `sparePartKey`/`warehouseKey`.
- `repair-orders.service.ts` — SCB create + condition-movement predicates use mirror keys.
- `maintenance-stock-issue.service.ts` — SCB create uses mirror keys.
- `maintenance-sla.service.ts` — upsert/findUnique/update switched to `maintenanceRequestKey`.
- `search.service.ts` — SCB search predicate uses `warehouseKey`.
- `repair-orders.service.spec.ts` — expectation updated `sparePartId` → `sparePartKey`.

Results: `tsc --noEmit` clean; **49 tests passed / 49** across 5 suites (repair-orders, spare-part-conditions, maintenance-stock-issue, tenant-sla, maintenance-stock-issue.r1e).

## 9. Pre-existing findings (out of scope, not hidden)

- Repo-wide index/FK/PK/default-constraint **name drift** vs Prisma default naming on all tables; pre-existing pattern.
- Default-value literal quoting drift (`N'MEDIUM'` vs `'MEDIUM'`) on many tables; pre-existing.
- No `shadowDatabaseUrl` configured, so `--from-migrations` diff is unavailable; structural contract verified directly against SQL Server metadata instead.
- `spare_part_condition_movements` and other wide-key tables exist elsewhere; this R1 scope covers only the three tables above.

## 10. Constraints respected

- Production DB untouched; no writes on `ATsoftERP`.
- No Git write operations; no push of `c964965`; main repo otherwise untouched.
- No emulation of production behavior; divergence proven on a dedicated clone.
- Failed `zz_gotest` migration moved out of the migrations directory and its probe record resolved as rolled back.

## 11. Verdict

`ID-KEY-SAFE-R1 = DESIGN_PROVEN`

Both clone shapes are safe and converge; the mandatory runtime invariants (unique mirror, length bound, equality) are enforced by SQL Server with trusted constraints; Prisma and TypeScript consumers are migrated in the worktree and fully passing. Rollout to production requires the separately approved deploy step (apply the two migrations, then deploy the consumer changes).

## 12. FINALIZE (forward package) — cross-reference

The frozen, forward-only production package and its full rehearsal, regression, SHA256s, write-only production plan and rollback strategy are recorded separately in:

- `docs/proofs/id-key-safety-r1-finalization-proof.md`
- `docs/proofs/id-key-safety-r1-finalization-proof-evidence.json`

Status: `ID-KEY-SAFE-R1-FINALIZE = READY_FOR_PRODUCTION_REPAIR`. Frozen package = fresh identities `20260904125100_mig_prov_r1_key_safety_hardening_a_add_bounded_mirror_columns` + `20260904125200_mig_prov_r1_key_safety_hardening_b_apply_bounded_mirror_keys`. See the finalization proof for the verification matrix (fresh PRE-B1 replay on `ATsoftERP_MIG_PROV_FRESH_FINAL`, production-shape rehearsal on `ATsoftERP_MIG_PROV_PRODCLONE_FINAL`, enforcement + fail-closed, full 2618-test regression, and the write-only production/rollback plan).