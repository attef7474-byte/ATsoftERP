# COST-R2D-B2 — strict-stop report, 2026-09-16

## A. TRUE FINAL STATUS

`COST-R2D-B2=BLOCKED`, **NOT CLOSED**. Phase 20 fresh replay failed with Prisma P3018 / SQL Server 1753. No source/DDL repair, retry, migration resolve, implementation commit, deployment or push followed the failure. Only read-only diagnosis, preservation checks and this report followed it.

## B. OWNER MONETARY DECISION APPLIED

The 2026-09-15 owner decision is recorded and implemented: `B2_ROUNDING_SIGN_POLICY=FROZEN`, zero/negative final line means reject the entire allocation; no algorithm change, target dropping, clamping or B3 posting.

## C. CONTRACT RECOVERY PRESERVED

The earlier A2/R1/R2/R3 recovery and historical monetary-blocker report remain unchanged under `%LOCALAPPDATA%/Temp/ATsofterp-COST-R2D-B2-CONTRACT-20260914/`. The new owner decision resolved that historical blocker; it did not waive SQL 1753 or failed-replay stops. Contract recovery was not reopened.

## D. ZERO/NEGATIVE REPRESENTABILITY POLICY

The pure engine rejects any final line <= 0 after rounding/remainder assignment, as well as line storage overflow or a conservation mismatch. Service calculation precedes successful-state writes. Unit proof passes; real SQL business-transaction proof was not reached. Therefore production acceptance counters for accepted zero/negative lines and surviving failed allocations remain **NOT_PROVEN**, not inferred from unit tests.

## E. MONETARY FEASIBILITY PRECHECK

Each purpose pool must be >= targetCount * 0.0001. The final post-remainder positivity check remains mandatory: the precheck is explicitly necessary, not sufficient.

## F. FINAL ROUNDING/REMAINDER ALGORITHM

Local Decimal constructor with precision 80; proportional pool * driver / totalDriver; HALF_UP(4); exact remainder entirely assigned to the largest driver; lowest stable target ID breaks ties. No global Decimal configuration change. No monetary Number/parseFloat conversion.

## G. CONSERVATION PROOF

Focused engine tests pass exact per-purpose and whole-allocation source equality on representable inputs. Real SQL finalization and production conservation are **NOT_PROVEN**.

## H. DETERMINISM PROOF

Focused tests pass repeated/shuffled inputs, stable tie-breaks and repeating ratios. Real-DB deterministic replay was not reached.

## I. ZERO/NEGATIVE REJECTION TESTS

Passed focused cases include 0.0003/five equal (reject), 0.0001/three equal (reject), 0.0005/five equal (five 0.0001), single target, 100/three equal, unequal positive weights, tiny driver, repeating ratios and input permutations. Additional cases pass the precheck but yield zero (0.0008/five equal) or negative (0.0011/seven equal) after the frozen remainder; both reject. These are engine/service-boundary tests, not actual SQL rollback/concurrency proof.

## J. SOURCE AUTHORITY

B1 finalized entries remain monetary authority. The service derives scoped sources without changing their amount, currency, purpose, category or lifecycle. Technical source membership stores provenance only, with no second editable source amount.

## K. PURPOSE POOLS

Pool grain is company + branch + period + canonical costPurpose. Category and sourceCostCenter do not partition the economic pool. Exact source sums are server-derived.

## L. DRIVER AUTHORITY

Only frozen `ProductionRunCostSnapshot.finalGoodQuantity > 0`. No manual driver override. The frozen run output unit is retained as evidence.

## M. TARGET AUTHORITY

Same company/branch, not-deleted valuation-closed ProductionRun, costClosedAt in [periodFrom, periodTo), positive frozen quantity, valid destination cost center. No time proration. Allocation requires the period window to have ended. A shared branch transaction lock is acquired before new run valuation closure assigns its timestamp; B1 lifecycle itself is unchanged.

## N. B2 DOMAIN MODELS

Three authored but **not successfully migrated** models: OperationalOverheadPeriodAllocation, OperationalOverheadAllocationLine, OperationalOverheadAllocationSource. Design: 50 columns, 8 keys, 14 FKs and 18 CHECKs. Source membership is technical provenance. Existing schema additions were inverse relations only; the existing snapshot ID's missing native-width annotation was preserved, which exposed the physical mismatch below.

API: ten real handlers under `/api/v1/production/overhead-allocations`: GET list, GET eligible-periods, POST create, GET :id, PATCH :id notes, POST :id/calculate, PATCH :id/finalize, GET :id/lines, GET :id/sources, GET :id/history.

Frontend: `/admin/production/cost/overhead-allocations`, real API calls, paginated lists/evidence, searchable closed-period lookup, draft notes, preview, immutable-final confirmation, permissions, context remount/cancelled obsolete reads, exact Decimal text display, Arabic/English. No browser/runtime acceptance is claimed.

## O. IDEMPOTENCY

Authored exact DB uniqueness: period; companyKey/branchKey/clientRequestId; allocationId/productionRunKey/costPurpose; sourceEntryId. No hash-only identity. Service FINAL replay is read-only/idempotent. Actual duplicate-finalization race and DB uniqueness execution are **NOT_PROVEN** because B2 migration rolled back.

## P. LIFECYCLE

DRAFT -> FINAL; only draft notes editable; final lines immutable; preview unpersisted. No reopen, generic final edit, correction/reversal or B1 status mutation. SQL lifecycle checks were authored but not accepted into a database.

## Q. TENANT/BRANCH ISOLATION

Focused service/guard tests cover explicit company/branch scope, missing/over-bound context, foreign allocation IDs and invalid targets/snapshots. Real JWT/context/SQL HTTP proof was not reached: `B2_TENANT_ISOLATION=NOT_PROVEN` for final acceptance.

## R. PERMISSIONS

Five keys: `production-cost-overhead-allocation:{read,create,update,calculate,finalize}`. Controller mappings and guard allow/deny unit tests pass. Narrow idempotent seed tests pass twice with/without an existing SUPER_ADMIN role; no role/user creation. No production seed ran. Actual DB-backed permission acceptance remains **NOT_PROVEN**.

## S. AUDIT

Create/update/finalize call existing AuditService with the same transaction client and tenant details. Stateless calculation creates no success audit. Focused tests cover audit invocation and failure propagation. Actual SQL rollback on audit failure is **NOT_PROVEN**.

## T. CONCURRENCY

Serializable transactions use the B1-identical `ATSOFT:OVERHEAD:PERIODS:` branch lock resource; only successful sp_getapplock results accepted. Source claims, final lines, header and audit are one transaction. Real concurrent-finalization proof was not reached: `B2_CONCURRENCY_PROOF=NOT_PROVEN`.

## U. COMPLETE KEY-SAFETY MATRIX

Design accounting (not successful catalog acceptance). NVARCHAR width is two bytes per declared character; DATETIME2(7) is eight bytes. No INCLUDE columns.

| Table | Object | Ordered columns/types | Bytes | Kind | Unique | Limit | Arithmetic |
|---|---|---|---:|---|---|---:|---|
| operational_overhead_period_allocations | ohoa_pk | id NVARCHAR(200) | 400 | clustered PK | yes | 900 | SAFE |
| operational_overhead_period_allocations | ohoa_period_uq | periodId NVARCHAR(200) | 400 | nonclustered | yes | 1700 | SAFE |
| operational_overhead_period_allocations | ohoa_request_uq | companyKey NVARCHAR(200), branchKey NVARCHAR(200), clientRequestId NVARCHAR(200) | 1200 | nonclustered | yes | 1700 | SAFE |
| operational_overhead_period_allocations | ohoa_scope_ix | companyKey NVARCHAR(200), branchKey NVARCHAR(200), status NVARCHAR(10), createdAt DATETIME2(7) | 828 | nonclustered | no | 1700 | SAFE |
| operational_overhead_allocation_lines | ohol_pk | id NVARCHAR(200) | 400 | clustered PK | yes | 900 | SAFE |
| operational_overhead_allocation_lines | ohol_target_purpose_uq | allocationId NVARCHAR(200), productionRunKey NVARCHAR(200), costPurpose NVARCHAR(30) | 860 | nonclustered | yes | 1700 | SAFE |
| operational_overhead_allocation_sources | ohos_pk | sourceEntryId NVARCHAR(200) | 400 | clustered PK | yes | 900 | SAFE |
| operational_overhead_allocation_sources | ohos_allocation_ix | allocationId NVARCHAR(200), sourceEntryId NVARCHAR(200) | 800 | nonclustered | no | 1700 | SAFE |

Zero unsafe authored keys does **not** mean valid FK lengths. The failed costSnapshotId FK is not an indexed key and is a separate mandatory failure. Trusted/enabled B2 catalog acceptance is **NOT_PROVEN**, because no B2 tables survived.

## V. FINAL PRISMA CONTRACT

Prisma 7.8.0 validate/generate succeeded on authored B2 source with a freshly generated client, not a copied historical client. That validates Prisma's model, not the physical parent schema.

Confirmed mismatch:

| Authority | Snapshot ID/foreign-key width |
|---|---|
| Historical migration `20260902000001_production_run_cost_snapshot` | parent id NVARCHAR(191) |
| Fresh physical SQL catalog | parent id max_length 382 bytes = NVARCHAR(191) |
| Production physical SQL catalog | parent id max_length 382 bytes = NVARCHAR(191) |
| Existing Prisma ProductionRunCostSnapshot.id | unannotated String |
| New B2 line.costSnapshotId | NVARCHAR(1000), 2000 bytes |

The agent incorrectly generalized legacy parent IDs to NVARCHAR(1000). The new text-only FK test repeats that assumption for external parents; its PASS is **not valid physical FK compatibility evidence**. This test needs strengthening after renewed authority. Do not widen the historical parent, edit its applied migration, suppress SQL1753, or claim that Prisma validate eliminated drift.

## W. FINAL MIGRATION NAME + SHA256

Failed candidate: `20260915010000_cost_r2d_b2_allocation_engine`.

SHA256: `22178C720ED4E1E3CA3F195235AD9A1C966932EEBB204B52B4E0B9AF58AD3BD0`.

This is a **failed-candidate evidence hash**, NOT an approved/frozen release artifact. Phase 26 freeze was not reached. File remained unchanged after SQL1753.

## X. FOCUSED TEST COUNTS

- API focused eight suites / 228 tests PASS before this resumed UI batch, including B1 and valuation-close regressions.
- Additional B2 SQL-text/seed suite: one suite / 13 tests PASS; physical-FK assertion limitation explicitly recorded in V.
- Web exact-display/final-action logic: one suite / 9 tests PASS.
- No removed tests or newly skipped tests.
- Earlier development corrections: two engine-test callbacks returned non-void; corrected braces without weakening assertions. An i18n checker rejected a dynamically constructed namespace prefix; explicit key mapping corrected it. These were pre-replay focused preparation, not a waived failed release gate.

## Y. FRESH ZERO REPLAY

New database `ATsoftERP_B2_FRESH_20260916T030000`, initially zero user tables. Existing SQL login was granted db_owner **only in this new disposable database**; no login was created and no production permission changed.

Supported Prisma deploy attempted all 83 exact migration directories. The first 82 completed, including unchanged B1 and MIG-PROV. B2 failed:

`FRESH_B2_REPLAY_EXIT=1`; Prisma `P3018`; `SQL_1753_COUNT=1`; captured index-width warning count 0. No global historical index-safety certification is inferred from the absence of emitted warnings.

FK `ohol_costSnapshot_fk`: parent `production_run_cost_snapshots.id` is NVARCHAR(191), child `operational_overhead_allocation_lines.costSnapshotId` NVARCHAR(1000).

**SCHEMA_REPLAY:** failed at B2. XACT_ABORT/TRY-CATCH rollback left **zero of three B2 tables**.

**HISTORY_REPLAY:** 84 active rows / 82 distinct names. Two historical migrations self-register and have two active rows each: `20260728180621_maintenance_sparepart_classification_cost_attribution` and `20260728200621_maintenance_part_condition_replacement_action`. B1 applied once. B2 has one unresolved failed attempt, `finished_at=null`, `rolled_back_at=null`, `applied_steps_count=0`, stored checksum equal to the failed candidate. No manual history mutation or supported resolve was attempted after failure. Database and failure evidence are retained, not deleted or reset.

## Z. PRISMA/SQL DIFF

Full post-B2 diff was not run because replay failed. Snapshot ID mismatch is proven, not cosmetic default rendering. `B2_UNEXPLAINED_PRISMA_SQL_DIFF_COUNT=0` cannot be asserted; accepted reconciliation remains **NOT_PROVEN**.

## AA. FRESH-CLIENT RUNTIME

**NOT_PROVEN / NOT RUN**. No fabricated service/DB/JWT/guard success is substituted for failed schema creation. No B2 workflow fixtures were created; SQL migration rollback is not relabelled business-transaction rollback proof.

## AB. B1 REGRESSION

18 protected file fingerprints unchanged. Six protected model bodies unchanged after removing only explicitly allowed B2 inverse declarations/comment. B1/MIG-PROV historical migrations unchanged byte-for-byte. Focused B1 source tests passed. Post-stop production read: B1 2 tables / 41 columns / 5 mirrors / 9 indexes / 16 trusted-enabled CHECKs / 6 trusted-enabled FKs; unsafe keys 0. Protected MIG-PROV unsafe keys/bad CHECKs/bad FKs all 0, both migrations active. B1 runtime-after-B2 acceptance was not reached.

## AC. PRE-PRODUCTION FULL REGRESSION

**NOT RUN**: preceding mandatory replay gate failed. API/Web typechecks passed at their recorded preparation points; no API/Web build or full test suite was run for this B2 candidate. Final-current-tree full validation remains **NOT_PROVEN**.

## AD. IMPLEMENTATION COMMIT

Not created. Work remains in branch `cost-r2d-b2-final-20260915`, based on `74587e6936bee5fc2cf431713d2ddcfbce0f587c`, under `%LOCALAPPDATA%/Temp/ATsofterp-COST-R2D-B2-FINAL-20260915/worktree`. Initial clean state recorded; current state intentionally contains uncommitted B2 work.

## AE. COPY_ONLY BACKUP

Not taken for B2; phase 27 not reached. Existing B1 backup is not relabelled a new B2 backup.

## AF. RESTORE VERIFYONLY

Not run for B2.

## AG. REAL BACKUP-DERIVED CLONE

Not created for B2. The failed fresh database is not a backup-derived clone.

## AH. REAL CLONE MIGRATION/RUNTIME

Not run.

## AI. MIGRATION ENGINE PROOF

Failed fresh deploy evidence retained. No successful B2 registration/resolve/status/rehearsal is claimed. Clone/production engine gates not reached.

## AJ. PRODUCTION DDL

None executed. No B2 migration SQL ran against production. No service stop/deployment occurred.

## AK. PRODUCTION DATABASE ACCEPTANCE

Read-only preservation PASS: production B2 tables 0, B2 history rows 0; B1 periods 0 / entries 0; active migrations 82, duplicate active names 0, unresolved failures 0; B1/MIG-PROV healthy as detailed in AB. This is existing-system safety proof, not B2 production acceptance.

## AL. B2 PRODUCTION MIGRATION CHECKSUM

Not applicable: no B2 production migration row. Candidate SHA is not a production checksum match.

## AM. DEPLOYED ARTIFACT

No B2 artifact built/deployed or compared. Existing service artifacts retained.

## AN. PRODUCTION RUNTIME/HEALTH

Read-only post-stop check: `ATsoftERP_API=RUNNING`; `/api/v1/health=HTTP 200`. B2 runtime is **NOT_PROVEN** and unavailable because B2 was not deployed. No synthetic production records, roles or users created.

## AO. FINAL FULL TEST/BUILD COUNTS

Full API/Web tests/builds, final Prisma/SQL reconciliation, raw-key, route-contract, UI baseline and browser proof not run. Standalone final focused i18n PASS: 6077 EN / 6077 AR keys, 22 namespaces, 9698 literal calls resolved; no empty translations. `git diff --check` passed. No full-regression acceptance is claimed.

## AP. PROOF DOCUMENTS

Repository documents created: implementation contract (2026-09-15), key-safety design matrix (2026-09-15), this strict-stop report (2026-09-16). The matrix receives an explicit later correction; historical contract-recovery blocker remains unchanged.

Local evidence under `%LOCALAPPDATA%/Temp/ATsofterp-COST-R2D-B2-FINAL-20260915/`:

- `b1-mig-prov-preservation.json` — before-edit protected contract fingerprints.
- `fresh-replay.stdout.log`, `fresh-replay.stderr.log` — complete captured Prisma replay output, failure retained.
- `fresh-failure-readback.sql`, `fresh-failure-readback.log` — bounded read-only catalog/history proof.
- `post-stop-production-readback.log` — live B1/MIG-PROV production preservation.
- `create-fresh.sql`, `fresh-prisma.config.mjs`, `fresh-prisma.cjs` — isolated replay configuration/runner; no embedded credentials, no production replay target. They are outside Git and must not be treated as production executables.

### File scope

11 existing files modified: API schema, master permission seed, AppModule, API messages, production-runs service lock; Web navigation, both locale indexes, i18n types, permission catalogue; i18n checker namespace list.

21 new files: one B2 migration; two permission seed files; one common lock helper; nine files in API overhead-allocation (controller, DTO, engine, service, module, four specs); one Web page; two locale namespaces; one Web exact-display/action helper; one Web test; three proof documents. No source repairs occurred after the strict stop. No generated client/build/cache/log/secret is staged or committed.

## AQ. FINAL COMMITS/PUSH

No B2 implementation/docs commit, push, tag, amend, force operation or manual history write. No staging was performed.

## AR. HEAD==origin/main

Read-only `git ls-remote origin refs/heads/main` confirmed remote remains `74587e6936bee5fc2cf431713d2ddcfbce0f587c`, equal to isolated HEAD/cached origin/main; divergence 0/0. This equality is the unchanged base, **not a released B2 chain**. Isolated tree is dirty: 11 modified tracked files and 21 new files after this report.

## AS. ORIGINAL DIRTY TREE PRESERVATION

PASS. Original checkout `C:/Users/attef/PycharmProjects/Trae/ATsofterp` remains main at `20c5e1ec53b8a873e56018c5374254d3dfb75e67`. Latest check: 4209 files, 0 byte mismatches, HEAD/status/index/stash/tags unchanged. Original source was not built, reset, cleaned, switched or overwritten.

## AT. B3/OUT-OF-SCOPE ABSENCE

`B3_EXECUTED=NO`. No OperationalCostTransaction posting/reconciliation/reversal, GL/AP/FX, inventory/FG capitalization, material monetary snapshot modification, energy/depreciation/import engine, period reopening or B1 lifecycle changes. One disposable SQL database and its local database user remain as failure evidence; no production data was mutated.

## AU. FINAL DECISION

`COST-R2D-B2=BLOCKED`

`CAN_START_COST_R2D_B3=NO`

Renewed owner authority is required to continue after the explicit SQL1753/fresh-replay strict stop. Proposed **not executed** narrow recovery: reconcile the existing Prisma snapshot ID native-width annotation to the proven NVARCHAR(191) physical parent; match the new B2 FK to that same width without altering the parent table or historical migration; replace assumed-width tests with actual historical/catalog-backed checks; regenerate/validate and repeat every mandatory gate on a different brand-new disposable DB. Preserve this failed migration attempt and report; no reset, deletion, history editing or altered production retry. The frozen monetary algorithm remains unchanged.
