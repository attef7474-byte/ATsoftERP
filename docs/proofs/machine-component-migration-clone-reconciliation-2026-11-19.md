# MachineComponent shared multi-machine migration — clone proof and reconciliation

**Date:** 2026-11-19
**Branch:** `fix/machine-components-shared-multi-machine`
**Migration:** `apps/api/prisma/migrations/20261119000000_shared_machine_component_multi_machine/migration.sql`
**Status:** `COMPLETE` for clone proof. Production migration and deployment are a later, separately gated step.

## 1. Source-of-truth and backup

| Item | Value |
|---|---|
| Baseline branch | `main` |
| Baseline HEAD | `029f5e6f8cad220116df30cd67056faf49e00ad0` |
| Ahead / behind at start | `0 / 0` |
| Work branch | `fix/machine-components-shared-multi-machine` |
| Verified backup | `C:\Users\attef\AppData\Local\Temp\ATsofterp_pre_MCM_20261119_030636.bak` |
| Backup options | `COPY_ONLY, CHECKSUM` |
| Restore verification | `RESTORE VERIFYONLY` — passed |
| Proof clone | `ATsoftERP_DB_MCM_PROOF2` on `tcp:localhost,50079` |
| Restore statement | `RESTORE DATABASE ... WITH REPLACE, CHECKSUM, MOVE ATsoftERP_DB ..., MOVE ATsoftERP_DB_log ...` |
| Restore result | `RESTORE DATABASE successfully processed 11618 pages in 0.291 seconds` |

No destructive operation was run against the live database. No applied migration was edited. No migration history was deleted.

## 2. Migration correction proved in this run

The migration's `#merge_map` had a defect found during the prior proof cycle: it partitioned duplicate evidence by `batchCorrelationId` alone. It now partitions by **(`batchCorrelationId`, `code`)**, so two different component codes created in the same batch can never be merged. Name is never used as merge evidence.

This fresh clone was restored from the original verified backup **after** that correction and used for the definitive proof. The earlier clone (`ATsoftERP_DB_MCM_PROOF`) is retained but is not the authoritative evidence for the corrected migration.

## 3. Deployment and schema status

Command (from `apps/api`, because the Prisma config requires `DATABASE_URL` there):

```powershell
$env:DATABASE_URL='sqlserver://localhost:50079;database=ATsoftERP_DB_MCM_PROOF2;integratedSecurity=true;trustServerCertificate=true'
npx prisma migrate deploy --schema prisma/schema.prisma
```

Result:

```text
96 migrations found in prisma/migrations
Applying migration `20261119000000_shared_machine_component_multi_machine`
All migrations have been successfully applied.
```

```text
npx prisma migrate status --schema prisma/schema.prisma
Database schema is up to date!
```

The previous SQL Server compile failures were resolved in the migration itself:

| Prior error | Cause | Resolution |
|---|---|---|
| `Invalid column name 'companyId'/'branchId'` (207) | SQL Server compiled the whole batch before new DDL existed | DDL/data statements that reference new columns run in later `EXEC sp_executesql` batches |
| `ORDER BY list of RANGE window frame has total size of 2008 bytes` (8729) | Wide NVARCHAR columns in a window frame | Tie-break is `CAST(c.[id] AS NVARCHAR(100))` |

## 4. Reconciliation — before vs after

| Metric | Live (pre-migration) | Clone (post-migration) | Result |
|---|---:|---:|---|
| `machine_components` total | 13 | 13 | preserved |
| `machine_components` active | 4 | 4 | preserved |
| `machine_components` soft-deleted | 9 | 9 | preserved |
| `machine_component_machines` total | 0 | 14 | created |
| `machine_component_machines` active | 0 | 14 | created |
| Active duplicate-code groups `(companyId, branchId, code)` | 0 | 0 | preserved |
| Orphan links | — | 0 | clean |
| Rows with null ownership (legacy, hidden from non-`SUPER_ADMIN`) | 3 | 3 | preserved unchanged |

Downstream foreign-key row counts are unchanged. (Tables without a `deletedAt` column were compared by total count; tables with it were compared by total and active count.)

| Downstream table | Live total / active | Clone total / active |
|---|---:|---:|
| `maintenance_requests` | 21 / 15 | 21 / 15 |
| `maintenance_work_orders` | 7 / 6 | 7 / 6 |
| `maintenance_request_required_parts` | 5 | 5 |
| `maintenance_tasks` | 15 | 15 |
| `machine_installed_parts` | 3 | 3 |
| `maintenance_boms` | 0 / 0 | 0 / 0 |
| `component_spare_parts` | 0 | 0 |
| `production_measurement_points` | 0 / 0 | 0 / 0 |

## 5. Proven duplicate — `U-000005`

Batch audit evidence (two `CREATE` audit rows, both with `batch=true`, `batchCorrelationId = mcbatch:cmrl31v0g0004ok95wxhdi9lm:1795045062983`, and `code = U-000005`):

| Legacy row | Created | Canonical? | Links after migration |
|---|---|---|---|
| `cmwmrhf0p00012095az0mn5hu` | 2026-11-18 23:37:42.985 | **yes** (oldest) | `cmv5wg90j0010cc9599dre9ac`, plus merged `cmupglw1i01lulc953bab25md` |
| `cmwmrhf1d000320953szhrgpp` | 2026-11-18 23:37:43.009 | no (merged) | its own legacy link to `cmupglw1i01lulc953bab25md` retained for history |

Shareable attributes (`name`, `componentType`, `manufacturer`, `model`, `criticality`, `description`) agreed, and downstream references to the merged row were `0`, so the guarded merge was allowed. Exactly one `mcmmerged_*` association was created; there were no ambiguous groups.

**`AMBIGUOUS_GROUPS_AUTO_MERGED = 0`.** Ambiguity is not auto-resolved: a group with disagreeing shared attributes raises error 50001; a group with downstream FKs raises 50002; any remaining active duplicate code raises 50003 before the filtered unique index is created. All three guards passed on the clone.

## 6. Safety properties verified

- Additive only: no existing column dropped, no business row physically deleted, no migration history edited.
- Direct tenant ownership backfilled from the then-authoritative `Machine` for all 13 legacy rows.
- One association per legacy row; one additional association for the proven merged machine.
- Unique filtered index `(companyId, branchId, code) WHERE deletedAt IS NULL` created successfully.
- Transactional: `BEGIN TRY / BEGIN TRAN / COMMIT / CATCH ROLLBACK / THROW`.
- No production database, backup, or live data was modified by this proof.

## 7. Known limitation carried forward

Nine legacy rows were already soft-deleted before this migration. Their backfilled association rows retain `status = 'ACTIVE'`. This does not leak data: every application read path (`findAll`, `findOne`, `componentAccess`, the active-membership guard, search, and Excel export) filters `deletedAt IS NULL`, and the guard additionally rejects deleted or inactive components. Normal edit/removal behaviour deactivates links rather than hard-deleting them. Cleaning those historical link statuses is left to a separate, explicitly approved data-hygiene task.
