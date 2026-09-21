# COST-R2D-B2 parent-width recovery — 2026-09-17

## A. TRUE FINAL STATUS

`COST-R2D-B2=BLOCKED`; `CAN_START_COST_R2D_B3=NO`.

The owner authorized correction of the earlier SQL1753 defect. The exact parent/child native-width source repair is now implemented and Prisma validate/generate pass. However, the newly required **no generated ALTER TABLE against the parent** gate remains failed: the corrected full-schema diff still proposes three ALTER TABLE statements against `production_run_cost_snapshots`, plus ten object renames. These changes are inherited drift, not newly introduced by the width annotation; they were present before the correction. They cannot be silently accepted as a zero-parent-DDL gate, nor applied. Execution stopped before a new database/replay, catalog test, runtime proof or production mutation. No generated diff SQL was executed.

The prior failure report remains historical evidence: [SQL1753 stop](cost-r2d-b2-strict-stop-2026-09-16.md). This report supersedes its current status, not its historical facts.

## B. OWNER MONETARY DECISION APPLIED

No monetary code changed in this recovery. Frozen HALF_UP(4), largest-driver/lowest-stable-ID remainder and whole-allocation rejection of zero/negative lines remain intact.

## C. CONTRACT RECOVERY PRESERVED

A2/R1/R2/R3 recovery, the original monetary blocker, owner sign decision and failed replay evidence are preserved. No contract recovery was reopened. The 2026-09-16 approval permits only exact native-width source reconciliation with no parent physical DDL or historical migration changes.

## D. ZERO/NEGATIVE REPRESENTABILITY POLICY

Unchanged: every final line must be >0, exact conservation required; otherwise atomic whole-allocation rejection. Current real-DB acceptance remains NOT_PROVEN.

## E. MONETARY FEASIBILITY PRECHECK

Unchanged: pool >= targetCount * 0.0001 is necessary but not sufficient; validate after remainder.

## F. FINAL ROUNDING/REMAINDER ALGORITHM

Unchanged Decimal precision 80, proportional allocation, HALF_UP(4), entire remainder to largest driver, lowest stable target ID tie-break. No target removal, clamping or algorithm substitution.

## G. CONSERVATION PROOF

Previous engine tests passed; not rerun after the source repair because the parent-DDL stop was reached first. No fresh SQL conservation claim.

## H. DETERMINISM PROOF

Previous repeated/shuffled-input tests preserved. Current real-DB determinism NOT_PROVEN.

## I. ZERO/NEGATIVE REJECTION TESTS

All previous test files/assertions retained. Historical focused outcomes are not promoted to current proof. No tests removed/skipped. The old FK source-text test still contains its faulty generic external-parent assumption and must be strengthened after the current stop is resolved; it is not counted as successful current FK evidence.

## J. SOURCE AUTHORITY

B1 finalized entry amounts/currency/purpose/lifecycle untouched. Source membership remains provenance only; no editable second monetary authority.

## K. PURPOSE POOLS

Unchanged company/branch/period/costPurpose grain; category/sourceCostCenter provenance only.

## L. DRIVER AUTHORITY

Unchanged frozen `ProductionRunCostSnapshot.finalGoodQuantity > 0`. No manual override.

## M. TARGET AUTHORITY

Unchanged eligible ProductionRun, same company/branch, not deleted, valuation-closed inside [periodFrom, periodTo), valid destination cost center; no proration.

## N. B2 DOMAIN MODELS

The only application-source edits in this recovery are:

1. `apps/api/prisma/schema.prisma`: add `@db.NVarChar(191)` to `ProductionRunCostSnapshot.id`; change `OperationalOverheadAllocationLine.costSnapshotId` from 1000 to 191, plus an explanatory comment.
2. `apps/api/prisma/migrations/20260915010000_cost_r2d_b2_allocation_engine/migration.sql`: change only `[costSnapshotId] NVARCHAR(1000) NOT NULL` to `NVARCHAR(191) NOT NULL`.

No nullability, FK target, FK action, parent physical field, monetary field, historical migration, existing index or constraint was changed. Existing B2 work retained. New repository file in this recovery: this proof document. New local read-only verification/evidence files remain outside Git.

Existing candidate surface unchanged: three models / 50 columns, ten authenticated API handlers under `/api/v1/production/overhead-allocations`, frontend `/admin/production/cost/overhead-allocations` and five B2 permissions. None deployed.

## O. IDEMPOTENCY

Source request/period/target-purpose/source-membership uniqueness unchanged. Real duplicate-finalization DB proof NOT_PROVEN.

## P. LIFECYCLE

DRAFT -> FINAL unchanged, FINAL immutable; preview unpersisted. No B1 reopen/correction/reversal.

## Q. TENANT/BRANCH ISOLATION

Existing implementation/tests untouched. Current real JWT/guard/context/SQL acceptance NOT_PROVEN.

## R. PERMISSIONS

Existing five read/create/update/calculate/finalize definitions and narrow seed untouched. No new role/user or production seed. Actual DB-backed permission acceptance NOT_PROVEN.

## S. AUDIT

Existing same-transaction create/update/finalize audits untouched. Real SQL audit atomicity NOT_PROVEN.

## T. CONCURRENCY

Serializable/B1-identical branch lock and valuation-close coordination untouched. Real concurrency proof NOT_PROVEN.

## U. COMPLETE KEY-SAFETY MATRIX

Recalculated directly from current corrected migration text. NVARCHAR uses two bytes per declared character; DATETIME2(7) uses eight. No INCLUDE or extra FK-support indexes. `costSnapshotId` is not indexed, so its width repair does not change these totals.

| Table | Object | Ordered declared key columns | Bytes | Kind | Unique | Limit | Result |
|---|---|---|---:|---|---|---:|---|
| operational_overhead_period_allocations | ohoa_pk | id NVARCHAR(200) | 400 | clustered PK | yes | 900 | SAFE |
| operational_overhead_period_allocations | ohoa_period_uq | periodId NVARCHAR(200) | 400 | nonclustered | yes | 1700 | SAFE |
| operational_overhead_period_allocations | ohoa_request_uq | companyKey NVARCHAR(200), branchKey NVARCHAR(200), clientRequestId NVARCHAR(200) | 1200 | nonclustered | yes | 1700 | SAFE |
| operational_overhead_period_allocations | ohoa_scope_ix | companyKey NVARCHAR(200), branchKey NVARCHAR(200), status NVARCHAR(10), createdAt DATETIME2(7) | 828 | nonclustered | no | 1700 | SAFE |
| operational_overhead_allocation_lines | ohol_pk | id NVARCHAR(200) | 400 | clustered PK | yes | 900 | SAFE |
| operational_overhead_allocation_lines | ohol_target_purpose_uq | allocationId NVARCHAR(200), productionRunKey NVARCHAR(200), costPurpose NVARCHAR(30) | 860 | nonclustered | yes | 1700 | SAFE |
| operational_overhead_allocation_sources | ohos_pk | sourceEntryId NVARCHAR(200) | 400 | clustered PK | yes | 900 | SAFE |
| operational_overhead_allocation_sources | ohos_allocation_ix | allocationId NVARCHAR(200), sourceEntryId NVARCHAR(200) | 800 | nonclustered | no | 1700 | SAFE |

Authored unsafe-key count 0. Physical B2 catalog/key acceptance remains NOT_PROVEN; there is no successful corrected replay yet.

## V. FINAL PRISMA CONTRACT

### Independently re-proven parent authorities before editing

| Authority checked live/read-only on 2026-09-17 | Parent SQL type | Declared characters | max_length bytes |
|---|---|---:|---:|
| Production `ATsoftERP_DB` | nvarchar | 191 | 382 |
| Actual B1 backup-derived clone `ATsoftERP_B1_PRODCLONE_20260914T053435` | nvarchar | 191 | 382 |
| B1 full-history fresh replay `ATsoftERP_B1_FRESH_20260914T050033` | nvarchar | 191 | 382 |
| Prior B2 failed replay, whose committed history through B1 completed | nvarchar | 191 | 382 |
| Committed `20260902000001_production_run_cost_snapshot/migration.sql` | NVARCHAR | 191 | 382 |

All observed parent IDs have system_type_id 231, NOT NULL and Chinese_PRC_CI_AS collation. All four databases agree. `PARENT_WIDTH_PHYSICAL_CONTRACT_PROVEN=PASS`.

Before correction, both committed and working Prisma parent were `id String @id @default(cuid())`, without native width. Its generated diff proposed `ALTER COLUMN [id] NVARCHAR(1000)`; preserving that declaration would not meet zero-ID-drift. After adding `@db.NVarChar(191)`, that id ALTER and its PK drop/recreation disappear. The explicit annotation was therefore necessary for the requested exact ID contract.

Current parent: `id String @id @default(cuid()) @db.NVarChar(191)`.
Current child: `costSnapshotId String @db.NVarChar(191)`.

`PRISMA_VALIDATE=PASS`, `PRISMA_GENERATE=PASS`, version 7.8.0 fresh generation. No historical client copied. Width-specific source drift is reconciled, but the **whole-parent no-DDL gate remains FAIL** as Z explains; do not report unqualified parent reconciliation PASS.

### Complete FK width compatibility matrix

Every child below remains NOT NULL; every FK remains NoAction/NoAction. Existing external-parent widths were read from all four SQL catalogs above, not guessed. The two references to the new allocation header use its authored NVARCHAR(200) PK. `MATCH` below means the corrected candidate declaration matches its identified authority, **not** that the child/FK exists in SQL yet.

Aliases: H = operational_overhead_period_allocations; L = operational_overhead_allocation_lines; S = operational_overhead_allocation_sources.

| Child table | Column | Child type/characters/bytes | Exact parent table.column | Parent type/characters/bytes | Width design |
|---|---|---|---|---|---|
| H | companyId | NVARCHAR / 1000 / 2000 | companies.id | NVARCHAR / 1000 / 2000 | MATCH |
| H | branchId | NVARCHAR / 1000 / 2000 | branches.id | NVARCHAR / 1000 / 2000 | MATCH |
| H | periodId | NVARCHAR / 200 / 400 | operational_overhead_periods.id | NVARCHAR / 200 / 400 | MATCH |
| L | companyId | NVARCHAR / 1000 / 2000 | companies.id | NVARCHAR / 1000 / 2000 | MATCH |
| L | branchId | NVARCHAR / 1000 / 2000 | branches.id | NVARCHAR / 1000 / 2000 | MATCH |
| L | allocationId | NVARCHAR / 200 / 400 | operational_overhead_period_allocations.id | NVARCHAR / 200 / 400 (authored) | MATCH |
| L | periodId | NVARCHAR / 200 / 400 | operational_overhead_periods.id | NVARCHAR / 200 / 400 | MATCH |
| L | productionRunId | NVARCHAR / 1000 / 2000 | production_runs.id | NVARCHAR / 1000 / 2000 | MATCH |
| L | costSnapshotId | NVARCHAR / 191 / 382 | production_run_cost_snapshots.id | NVARCHAR / 191 / 382 | MATCH |
| L | destinationCostCenterId | NVARCHAR / 1000 / 2000 | cost_centers.id | NVARCHAR / 1000 / 2000 | MATCH |
| S | companyId | NVARCHAR / 1000 / 2000 | companies.id | NVARCHAR / 1000 / 2000 | MATCH |
| S | branchId | NVARCHAR / 1000 / 2000 | branches.id | NVARCHAR / 1000 / 2000 | MATCH |
| S | allocationId | NVARCHAR / 200 / 400 | operational_overhead_period_allocations.id | NVARCHAR / 200 / 400 (authored) | MATCH |
| S | sourceEntryId | NVARCHAR / 200 / 400 | operational_overhead_entries.id | NVARCHAR / 200 / 400 | MATCH |

Design mismatch count 0. Required executable post-migration catalog tests (type ID, resolved type, max_length, collation, FK identity, trust and enabled state, plus negative 191/1000 regression) were **not implemented/run before the new stop**. `B2_DATABASE_FK_CONTRACT_TEST=NOT_PROVEN`; actual physical `B2_FK_WIDTH_MISMATCH_COUNT` and `COST_SNAPSHOT_FK_WIDTH_MATCH` cannot yet receive final PASS.

## W. FINAL MIGRATION NAME + SHA256

Identity unchanged: `20260915010000_cost_r2d_b2_allocation_engine`.

Failed original bytes retained separately: `22178C720ED4E1E3CA3F195235AD9A1C966932EEBB204B52B4E0B9AF58AD3BD0`.

Corrected candidate SHA256: `DF038D5611B00D39D3EBFC46ABA72DF892BD1EDB50604A8AB13545429A2697D9`.

Candidate is not frozen/approved for production. Only new, never-successfully-applied B2 SQL changed; no historical migration was edited.

## X. FOCUSED TEST COUNTS

Historical 228 API + 13 additional + 9 Web tests remain historical only. No affected tests were rerun after correction because read-only parent-DDL comparison reached the new strict stop first. No tests removed or skipped; current focused acceptance NOT_PROVEN.

## Y. FRESH ZERO REPLAY

Prior failed DB is retained as failed evidence only, never used as successful B2 proof. Live `FAILED_REPLAY_B2_TABLE_COUNT=0`. No patch/resolve/reset/history editing was performed on it. No new corrected replay database was created before the current stop. New `FRESH_B2_REPLAY_EXIT=NOT_RUN`, `SQL_1753_COUNT=NOT_RUN` for corrected replay; the old replay still has SQL1753 count 1. There was no recurring SQL1753 attempt to relabel as a pass.

## Z. PRISMA/SQL DIFF

Read-only before/after comparisons used the successful historical B1 fresh database, not the failed B2 DB and not production. Both comparison commands exited 0; this means diff generation succeeded, not schema equality.

After correction, **zero generated id ALTERs**, but three generated parent ALTER TABLE statements remain:

```sql
ALTER TABLE [dbo].[production_run_cost_snapshots] ALTER COLUMN [currencyCode] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[production_run_cost_snapshots] ALTER COLUMN [costBasis] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[production_run_cost_snapshots] ADD CONSTRAINT [production_run_cost_snapshots_closedAt_df] DEFAULT CURRENT_TIMESTAMP FOR [closedAt], CONSTRAINT [production_run_cost_snapshots_costBasis_df] DEFAULT 'NET_ACTUAL_MATERIAL_VALUE_ONLY' FOR [costBasis], CONSTRAINT [production_run_cost_snapshots_createdAt_df] DEFAULT CURRENT_TIMESTAMP FOR [createdAt];
```

The parent also has ten proposed renames: PK, four FKs and five indexes. The child ADD FOREIGN KEY referencing the parent is separately excluded from the count of ALTERs **on the parent**.

Production currently has currencyCode NVARCHAR(10), costBasis NVARCHAR(100); named GETUTCDATE defaults for closedAt/createdAt; no SQL default on costBasis; established PK/FK/index names. These differences are **pre-existing**, as the before comparison independently demonstrates. The annotation caused no new parent SQL; it removed the id widening/PK drop-recreation. Nonetheless, the owner's stronger aggregate prohibition on any generated parent ALTER is not satisfied. This is the new stopping boundary, not another SQL1753.

`PARENT_ID_GENERATED_ALTER_COUNT=0`

`PARENT_TABLE_GENERATED_ALTER_COUNT=3`

`PARENT_OBJECT_GENERATED_RENAME_COUNT=10`

`PARENT_PHYSICAL_DDL_EXECUTED_COUNT=0`

`PARENT_TABLE_UNINTENDED_DDL_COUNT=0` **cannot be asserted as a clean generated-plan gate**. Physical execution count alone is not a substitute. No GETUTCDATE/CURRENT_TIMESTAMP semantic equivalence is assumed, and no default/width/constraint-name normalization was applied to the parent schema beyond authorized id annotation.

## AA. FRESH-CLIENT RUNTIME

Fresh client generated, but real HTTP/SQL lifecycle and `COST_SNAPSHOT_RUNTIME_RELATION` NOT_RUN/NOT_PROVEN. No workflow fixtures created.

## AB. B1 REGRESSION

No historical snapshot/B1/MIG-PROV migration diff. Production readback: B1 tables 2, columns 41, bounded mirrors 5, indexes 9, CHECKs 16 and FKs 6 all enabled/trusted; B1 unsafe keys 0. Protected MIG-PROV unsafe keys/bad CHECKs/bad FKs all 0; both migrations active. Source regression tests not rerun after correction.

## AC. PRE-PRODUCTION FULL REGRESSION

NOT_RUN. Earlier required gate failed. No old counts claimed as current acceptance.

## AD. IMPLEMENTATION COMMIT

None. Isolated branch `cost-r2d-b2-final-20260915` remains at base `74587e6936bee5fc2cf431713d2ddcfbce0f587c`, with preserved uncommitted B2 work plus the authorized width repair.

## AE. COPY_ONLY BACKUP

No new B2 backup. Not reached.

## AF. RESTORE VERIFYONLY

Not reached.

## AG. REAL BACKUP-DERIVED CLONE

No new B2 clone. The existing real B1 clone was read only to re-prove the parent; it is not substituted for the mandatory future new B2 backup-derived clone.

## AH. REAL CLONE MIGRATION/RUNTIME

Not run. Existing clone parent remains NVARCHAR(191); corrected child does not exist there.

## AI. MIGRATION ENGINE PROOF

No corrected deploy/resolve executed. Failed historical attempt retained untouched; no manual migration-history writes.

## AJ. PRODUCTION DDL

None. No parent or B2 DDL, no seed, no service stop, no artifact copy.

## AK. PRODUCTION DATABASE ACCEPTANCE

Preservation readback PASS, not B2 acceptance: B2 tables 0; B1 period/entry rows 0/0; active migrations 82, duplicate active names 0, unresolved failed rows 0. Parent remains NVARCHAR(191); B2 costSnapshotId is absent.

## AL. B2 PRODUCTION MIGRATION CHECKSUM

No B2 production migration; NOT_APPLICABLE. Candidate hashes are not deployed checksums.

## AM. DEPLOYED ARTIFACT

No B2 build/deployment. Fresh generation changed only isolated ignored client artifacts.

## AN. PRODUCTION RUNTIME/HEALTH

Current service RUNNING, `/api/v1/health` HTTP200 after the stop. Existing-system safety confirmed; B2 runtime NOT_PROVEN.

## AO. FINAL FULL TEST/BUILD COUNTS

Prisma validate/generate PASS (7.8.0), both read-only diffs exit 0 with blocker above, `git diff --check` PASS. No post-correction unit/full tests, API/Web builds, browser, i18n/raw-key/route/UI-baseline acceptance run. No hidden failed tests or waived gates.

## AP. PROOF DOCUMENTS

This new A–AU report adds all repaired-blocker evidence without overwriting previous reports. Local evidence root: `%LOCALAPPDATA%/Temp/ATsofterp-COST-R2D-B2-FINAL-20260915/recovery-20260917/`.

- `parent-authorities.sql` / `.log`: read-only seven-parent metadata across four databases, including old failed-table count 0.
- `production-parent-detail.log`: live production column/default/index metadata.
- `production-post-stop.log`: live B1/MIG-PROV preservation.
- `before-width-schema.prisma`: pre-correction source evidence.
- `failed-candidate-migration.sql`: exact failed bytes preserved, not a migration input directory.
- `parent-before.diff.sql`, `parent-after.diff.sql`, corresponding stderr logs: **unapplied** comparisons.
- `compare-parent.cjs`, `prisma-read.config.mjs`: read-only local diff runner/config; no embedded secrets.

## AQ. FINAL COMMITS/PUSH

No commit, staging, push, tag, reset, clean, stash, branch switch, parent DDL or historical migration edit.

## AR. HEAD==origin/main

Read-only remote check still returns `74587e6936bee5fc2cf431713d2ddcfbce0f587c`, equal to isolated HEAD. This is unchanged base equality, not B2 publication. Worktree remains dirty.

## AS. ORIGINAL DIRTY TREE PRESERVATION

Latest verifier PASS: 4209 preserved files, zero mismatches; original HEAD/status/index/stash/tags unchanged; branch main. Original source neither edited nor built.

## AT. B3/OUT-OF-SCOPE ABSENCE

`B3_EXECUTED=NO`. Monetary algorithm/source authority, B1 lifecycle and all excluded ledger/capitalization domains unchanged. No DB writes in this resumed recovery.

## AU. FINAL DECISION

`COST-R2D-B2=BLOCKED`; `CAN_START_COST_R2D_B3=NO`.

The 1753 **source-width defect is repaired**, but acceptance requires a decision on the newly exposed whole-parent no-DDL gate. Proposed next step, **not executed**: authorize a tightly bounded source-description reconciliation of the remaining snapshot columns/defaults/object mappings to their independently verified physical contracts, preserving current runtime defaults explicitly wherever necessary and producing zero actual parent DDL. Alternatively, the owner must explicitly narrow the gate to newly introduced/id drift and formally classify the pre-existing parent differences. The agent does not choose such a waiver or expand parent-source behavior changes without authorization. All remaining replay/catalog/runtime/regression/backup/clone/production/push gates remain mandatory after resolution.
