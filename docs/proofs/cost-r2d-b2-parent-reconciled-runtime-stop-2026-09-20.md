# COST-R2D-B2 — parent reconciliation and fresh runtime strict stop — 2026-09-20

## A. TRUE FINAL STATUS

`COST-R2D-B2=BLOCKED`; `CAN_START_COST_R2D_B3=NO`.

The parent metadata/SQL1753 blockers are resolved and the corrected B2 migration now passes a brand-new full replay and real catalog acceptance. The mandatory parent valuation-close runtime regression fails: a persisted positive final-output fixture linked to an authoritative final measurement point returns HTTP 400 `productionRunCostAggregation.zeroOutput`, instead of creating its snapshot. The runtime run records **135 passing checks and one failed check**. This is a genuine strict stop, not a waived pre-existing defect. No production deployment or Git closeout followed.

Read-only diagnosis proves the cause existed at the B2 base commit. `ProductionRunCostAggregationService.validateClosePreconditions` reads events without their measurement-point relation and explicitly supplies `measurementPoint: null` to `deriveRunTotals`. That utility includes final output only when `measurementPoint.isAuthoritativeFinal` is true. A compiled-function diagnostic yields **5 with the authority present, 0 with the current close projection**. Neither file was changed. Repairing this valuation behavior requires a bounded owner decision; the metadata-only approval does not authorize silently changing valuation eligibility.

## B. OWNER MONETARY DECISION APPLIED

Frozen positive-line policy, HALF_UP(4), one largest-driver remainder recipient and lowest stable-ID tie-break remain unchanged. No monetary algorithm substitution, clamping or target removal.

## C. CONTRACT RECOVERY PRESERVED

The original B2 contract, sign decision, SQL1753 failure and prior parent-DDL stop remain historical evidence. The latest approval authorized source-description reconciliation of `ProductionRunCostSnapshot`, not parent DDL. This report supersedes the prior current status without rewriting that history.

## D. ZERO/NEGATIVE REPRESENTABILITY POLICY

Every final allocation line must be strictly positive and conserve the complete source amount. Real HTTP/SQL tests rejected too-small pools, a tiny driver rounding to zero, a negative remainder recipient and a zero remainder recipient. Each remained DRAFT with zero lines, zero source memberships and zero FINAL audit events.

## E. MONETARY FEASIBILITY PRECHECK

`pool >= targetCount * 0.0001` remains necessary, not sufficient. Real runtime exercised post-rounding failures even when that precheck passed.

## F. FINAL ROUNDING/REMAINDER ALGORITHM

Local Decimal precision 80; proportional allocation; HALF_UP to four decimals; complete remainder assigned to the largest driver, stable lowest target ID on ties. No global Decimal settings changed.

## G. CONSERVATION PROOF

Real persisted normal allocation: two purpose pools, six lines, source total **111.0000**, exact persisted total **111.0000**. Every line positive. Source inputs 60 and 40 combine into PRODUCTION=100; ADMIN=11 remains separate. Snapshot monetary rows compared equal before/after B2.

## H. DETERMINISM PROOF

Real equal-driver PRODUCTION allocation returned **33.3334 / 33.3333 / 33.3333** in ascending stable target-ID order. Unequal 1:2:3 returned **16.6667 / 33.3333 / 50.0000**. Existing repeated/shuffled-input unit tests pass. Broader end-to-end closeout remains blocked.

## I. ZERO/NEGATIVE REJECTION TESTS

Real runtime rejected 0.0003 across five equal drivers, 100 across 1 and 10000000, 0.0011 across seven equal drivers, and 0.0008 across five equal drivers. Both AR and EN returned the canonical precision key with localized messages. Valid minimum 0.0005 across five drivers and single-target 0.0001 finalized successfully. No tests removed or newly skipped.

## J. SOURCE AUTHORITY

B1 source create/finalize and period create/open/close ran through real authenticated APIs. Amounts, canonical purpose and company currency remain source authority. B2 source memberships store provenance, not a second amount.

## K. PURPOSE POOLS

Company + branch + period + canonical costPurpose. Real proof combined different categories and source cost centers within the same purpose pool. They do not partition pools.

## L. DRIVER AUTHORITY

`ProductionRunCostSnapshot.finalGoodQuantity`, positive and frozen. Real B2 lines resolved their exact snapshot FK and matched snapshot driver quantities. B2 did not mutate material value, currency or any snapshot fields.

## M. TARGET AUTHORITY

Same company/branch, nondeleted cost-closed ProductionRun, valid destination cost center, membership by `costClosedAt` in `[periodFrom, periodTo)`. A target exactly at periodTo was excluded; those at periodFrom were included. No proration. The separate mandatory path that creates a snapshot through valuation close is the current failure.

## N. B2 DOMAIN MODELS

Existing candidate retained: `OperationalOverheadPeriodAllocation`, `OperationalOverheadAllocationLine`, `OperationalOverheadAllocationSource`; three additive tables and 50 columns. Ten handlers remain under `/api/v1/production/overhead-allocations`; Web route remains `/admin/production/cost/overhead-allocations`; five read/create/update/calculate/finalize permission keys. No additional endpoints, pages or permissions added in this reconciliation.

Reconciliation-session source changes:

- Modified `apps/api/prisma/schema.prisma`: exact parent widths, default expressions and object-name mappings; corrected child width retained.
- Modified `apps/api/src/modules/factory/production-runs/production-runs.r1g-a.spec.ts`: explicit costBasis, money, currency, timestamp and omitted-id/createdAt assertions.
- Modified `apps/api/src/modules/factory/overhead-allocation/overhead-allocation.database.spec.ts`: explicit verified external FK widths, replacing the faulty generic fallback.
- Created `apps/api/src/modules/factory/overhead-allocation/overhead-allocation.catalog.spec.ts`: 27 tests for catalog-verifier rejection, parent mapping, drift classification and snapshot writer coverage.
- Created `scripts/overhead-allocation-catalog-proof.cjs`: executable read-only SQL Server acceptance, used against real catalogs.
- Created this proof document. Scratch replay/runtime runners and machine-readable receipts remain outside Git.

Existing B2 application/UI/translation changes from the earlier implementation remain uncommitted and preserved. The valuation aggregation service and totals utility were not modified.

## O. IDEMPOTENCY

Real duplicate create returned the same allocation ID. Another request for the same period returned 409. Concurrent FINAL requests returned the same immutable FINAL header with six lines; no second FINAL audit. Repeat FINAL returned the same header.

## P. LIFECYCLE

Real DRAFT notes PATCH retained identity. DRAFT->FINAL succeeded; subsequent edit/recalculate returned 409. No B1 reopen, reversal, ledger posting or correction authority introduced.

## Q. TENANT/BRANCH ISOLATION

Real custom-role users: Company B could not read header/lines/sources/history, edit A's allocation or reference A's period. B's search returned no A records. A's other authorized branch could not read A1's record. An unauthorized company header and missing context returned 403. No SUPER_ADMIN bypass was used.

## R. PERMISSIONS

Real password login, JWT strategy, DB-backed guards and active-context interceptor were used. A no-permission user was denied all five B2 actions. Allowed custom-role actions succeeded. No production permissions, users or roles were mutated. Temporary fixture users/roles/permission rows were removed by exact ownership/identity.

## S. AUDIT

Real normal allocation had exactly CREATE, UPDATE and FINALIZE audit actions with actor and company/branch. Concurrent/repeated FINAL did not duplicate successful FINAL audit. Failed representability cases created no FINAL audit.

## T. CONCURRENCY

Two simultaneous FINAL HTTP requests succeeded idempotently with one persisted allocation result and one FINAL audit. This is real fresh-DB evidence, not full closeout of every required concurrency scenario. Concurrent valuation-close membership proof remains uncompleted because the parent close path fails.

## U. COMPLETE KEY-SAFETY MATRIX

Actual post-replay catalog matches the existing [key-safety matrix](cost-r2d-b2-key-safety-2026-09-15.md):

| Key | Ordered columns | Bytes | Limit |
|---|---|---:|---:|
| ohoa_pk | id | 400 | 900 |
| ohoa_period_uq | periodId | 400 | 1700 |
| ohoa_request_uq | companyKey, branchKey, clientRequestId | 1200 | 1700 |
| ohoa_scope_ix | companyKey, branchKey, status, createdAt | 828 | 1700 |
| ohol_pk | id | 400 | 900 |
| ohol_target_purpose_uq | allocationId, productionRunKey, costPurpose | 860 | 1700 |
| ohos_pk | sourceEntryId | 400 | 900 |
| ohos_allocation_ix | allocationId, sourceEntryId | 800 | 1700 |

Eight keys; unsafe count 0. All 14 B2 FKs have the expected identities, endpoints, system type, byte length and collation, NoAction actions, enabled and trusted flags. Snapshot child and parent are NVARCHAR(191), 382 bytes. All 18 expected CHECKs are enabled/trusted with visible definitions.

## V. FINAL PRISMA CONTRACT

Independent production, B1 backup-clone, old B1 fresh and new B2 replay catalogs agree. Parent: 13 columns, six indexes (including the PK and distinct unique constraint/index), four outgoing FKs. Parent id191, currency10, costBasis100 without SQL default; closedAt/createdAt DATETIME2(7) retain named GETUTCDATE defaults. All historical PK/FK/unique/index names are mapped exactly. `cuid()` unchanged. The sole production runtime writer already supplies `NET_ACTUAL_MATERIAL_VALUE_ONLY` explicitly; coverage test asserts this.

Parent physical fingerprint before/after replay and production readback:
`ec567d455d8b91039370b38cdd393098cce83839fde2499e9b00a4934ebdb65a`.

Mandatory reconciliation gates:

| Gate | Result |
|---|---|
| PARENT_PHYSICAL_CONTRACT_REPROVEN | PASS |
| SOURCE_DESCRIPTION_ONLY | YES |
| PARENT_PHYSICAL_DDL_REQUIRED / PARENT_DATA_MUTATION_REQUIRED | NO / NO |
| HISTORICAL_MIGRATION_EDIT_COUNT | 0 |
| PARENT_ID_GENERATED_ALTER_COUNT | 0 |
| GENERATED_CURRENCY_CODE_ALTER_COUNT / GENERATED_COST_BASIS_ALTER_COUNT | 0 / 0 |
| COST_BASIS_CREATE_PATH_COVERAGE | 100_PERCENT current runtime source writers |
| PARENT_COST_BASIS_DB_DEFAULT_ADDED | NO |
| GENERATED_CLOSED_AT_DEFAULT_DDL_COUNT / GENERATED_CREATED_AT_DEFAULT_DDL_COUNT | 0 / 0 |
| PARENT_OBJECT_GENERATED_RENAME_COUNT / PARENT_OBJECT_DROP_RECREATE_COUNT | 0 / 0 |
| PARENT_GENERATED_DDL_COUNT | 0 |
| UNRELATED_SCHEMA_RECONCILIATION_COUNT | 0 |
| B2_DATABASE_FK_CONTRACT_TEST / COST_SNAPSHOT_FK_WIDTH_MATCH | PASS / PASS |
| B2_FK_WIDTH_MISMATCH_COUNT | 0 |
| PRODUCTION_PARENT_SCHEMA_CHANGE_COUNT | 0 |
| COST_BASIS_RUNTIME_VALUE_UNCHANGED | Unit create payload and real direct Prisma create PASS; end-to-end valuation close blocked |
| PARENT_RUNTIME_BEHAVIOR_REGRESSION_COUNT | No source change in failing logic; mandatory runtime acceptance FAIL, not waived |

Real direct Prisma tests passed generated cuid, exact costBasis/material value, both omitted server UTC timestamps and SQL unique rejection of a second snapshot. Repeated valuation-close HTTP behavior could not be reached after the first close failed.

## W. FINAL MIGRATION NAME + SHA256

`20260915010000_cost_r2d_b2_allocation_engine`

Successfully rehearsed candidate SHA256:
`DF038D5611B00D39D3EBFC46ABA72DF892BD1EDB50604A8AB13545429A2697D9`.

No bytes changed during this reconciliation. Preserve this rehearsed artifact; no final implementation-commit/artifact-freeze gate is claimed yet. Historical snapshot/B1/MIG-PROV migrations unchanged.

## X. FOCUSED TEST COUNTS

Current API focused: **10 suites, 268 passed, 0 failed, 0 skipped** = prior 228 + 13 + 27 new catalog/reconciliation cases. Current Web: **1 suite, 9 passed**. Initial new-spec import-path error was corrected without removing assertions. The prior 241 cases passed on that initial attempt as well. No newly skipped or removed tests.

## Y. FRESH ZERO REPLAY

Brand-new `ATsoftERP_B2_FRESH_20260920T030000`, initially zero user tables. All 82 committed migrations through B1 copied byte-for-byte from `74587e6936bee5fc2cf431713d2ddcfbce0f587c`; every working historical file matched. Supported Prisma deploy exit 0. Parent catalog and zero-parent-DDL verified before B2. Exact corrected B2 SQLCMD application exit 0, empty output log, SQL1753=0, index-width warnings=0, safety warnings=0. Actual B2 catalog acceptance PASS and parent fingerprint unchanged.

Previous failed `ATsoftERP_B2_FRESH_20260916T030000` remains untouched as failed evidence; B2 table count independently rechecked as 0. No B2 resolve was performed there.

## Z. PRISMA/SQL DIFF

Full read-only comparisons against a verified B1 database and the new replay produced zero parent DDL. Post-B2 comparison also contains zero B2-table statements. Unrelated legacy drift remains outside scope and was not executed or normalized. New child FK was correctly classified separately before application.

The misleading duplicate-default ADD from the first comparison was a metadata-visibility issue: the runtime SQL login had db_owner=0 and VIEW DEFINITION=0; named defaults were visible but their definitions returned NULL. Windows-authenticated read-only Prisma comparison saw the actual definitions and emitted no parent DDL using the same reconciled schema. No grants or physical defaults were changed.

Initial catalog-tool construction encountered old SQLCMD incompatible output switches, unavailable STRING_AGG and required QUOTED_IDENTIFIER; only read-only query formatting was corrected. None was a database mutation/replay failure or a concealed acceptance result.

## AA. FRESH-CLIENT RUNTIME

Prisma 7.8.0 freshly generated; API freshly compiled from this worktree. Real Nest AppModule, password login, JWT, permissions, active context, validation, exception localization, transactions, audit and SQL Server were exercised. Final receipt: **135 PASS, 1 FAIL**, failure at parent valuation-close regression. Therefore `FRESH_CLIENT_B2_RUNTIME` overall is **FAIL**, despite passing B2 allocation cases.

An earlier fixture setup attempt wrongly used multiple RUNNING runs on the same order/line; the existing filtered unique index correctly rejected it with P2002 before B2 allocation creation. Its receipt is retained. Fixtures were corrected to completed runs, without changing application logic or constraints. Both attempts cleaned all their fixtures. Final independent SQL readback: fixture companies=0, B2 headers/lines/sources=0. The temporary proof application was closed. No user production records were deleted.

## AB. B1 REGRESSION

18 protected B1/MIG-PROV/canonical-purpose files match original hashes. Four B1 focused suites remain passing. Real fixture B1 lifecycle passed across eight scenarios. Production readback: B1 two tables, 41 columns, five mirrors, nine indexes, 16 trusted/enabled CHECKs, six trusted/enabled FKs; unsafe counts 0. MIG-PROV targeted unsafe keys/bad constraints 0. B1 periods/entries remain 0/0.

The current failure is an independently proven pre-existing valuation-close defect, not a B1 source/period change. Its mandatory regression gate still blocks B2.

## AC. PRE-PRODUCTION FULL REGRESSION

NOT COMPLETE. Before the 27 new cases were added, an npm argument-forwarding issue ran the full API suite: 158 suites/2837 tests PASS, with a worker teardown warning. This is retained as evidence, not a final all-gates pass. Current focused rerun includes all 27 new cases. API compilation and Web typecheck pass. Full Web tests/build, current i18n/raw-key/routes/UI baseline and browser proof were not completed before the mandatory runtime stop.

## AD. IMPLEMENTATION COMMIT

Not created. Isolated branch remains `cost-r2d-b2-final-20260915`, HEAD `74587e6936bee5fc2cf431713d2ddcfbce0f587c`. Work remains unstaged/uncommitted; no branch switch/reset/clean.

## AE. COPY_ONLY BACKUP

New B2 production backup NOT RUN; pre-production gates did not pass.

## AF. RESTORE VERIFYONLY

New B2 VERIFYONLY NOT RUN.

## AG. REAL BACKUP-DERIVED CLONE

New B2 production backup clone NOT CREATED. Existing B1 clone was read only to verify the parent authority; it is not represented as a new B2 clone.

## AH. REAL CLONE MIGRATION/RUNTIME

NOT RUN. Fresh zero-replay runtime is not substituted for backup-derived clone proof.

## AI. MIGRATION ENGINE PROOF

New fresh database: exact verified B2 DDL followed by supported `prisma migrate resolve --applied`; migration status reports up to date. B2 has one finished row with the exact candidate checksum. Fresh history has 85 active rows/83 distinct names: the same two legacy self-registering migrations each produce a duplicate only on full zero replay. No historical SQL/history rows were edited. Required future real-clone/production engine proofs NOT RUN.

## AJ. PRODUCTION DDL

None. Production B2 tables=0; no parent ALTER, grants, default changes, seed or deployment. Original service was not stopped/restarted.

## AK. PRODUCTION DATABASE ACCEPTANCE

Preservation checks PASS; B2 acceptance NOT APPLICABLE until deployed. Production parent fingerprint unchanged; B1/MIG-PROV catalog preserved. Production active migrations=82, duplicate active names=0, unresolved failures=0.

## AL. B2 PRODUCTION MIGRATION CHECKSUM

No production B2 migration row; NOT_PROVEN. Fresh checksum equality is not production acceptance.

## AM. DEPLOYED ARTIFACT

No B2 artifact deployed. Builds and generated client remain in the isolated worktree.

## AN. PRODUCTION RUNTIME/HEALTH

Post-stop `ATsoftERP_API` RUNNING; `http://localhost:4000/api/v1/health` HTTP **200**. This proves existing service health, not B2 runtime deployment. No production synthetic transactions or impersonated JWTs.

## AO. FINAL FULL TEST/BUILD COUNTS

Prisma validate/generate PASS; current focused API268/Web9 PASS; API compile PASS; Web `tsc --noEmit` PASS; `git diff --check` PASS. Earlier broad API2837 PASS with worker warning, before 27 new tests. Final complete regression NOT_PROVEN. Runtime135 PASS/1 FAIL is reported separately and is not hidden by source tests.

## AP. PROOF DOCUMENTS

This report plus the preserved [implementation contract](cost-r2d-b2-implementation-contract-2026-09-15.md), [key matrix](cost-r2d-b2-key-safety-2026-09-15.md), [SQL1753 stop](cost-r2d-b2-strict-stop-2026-09-16.md), and [earlier parent stop](cost-r2d-b2-parent-reconciliation-stop-2026-09-17.md).

Machine evidence root: `C:\Users\attef\AppData\Local\Temp\ATsofterp-COST-R2D-B2-FINAL-20260915`.

- `reconciliation-20260917/20260920-*-parent-proof.json`: independently matching authorities.
- `reconciliation-20260917/20260919-runtime-login-defaults.json`: metadata visibility diagnosis.
- `reconciliation-20260917/20260920-focused-api-final.json` and `20260920-focused-web.json`.
- `replay-20260920/committed-history-receipt.json`, `history.stdout.log`, `history.stderr.log`, `b2-ddl.stdout.log`.
- `replay-20260920/parent-before-b2.json`, `catalog-after-b2.json`, `zero-parent-ddl.json`, `diff.stdout.log` (never executed).
- `replay-20260920/resolve.stdout.log`, `status.stdout.log`.
- `replay-20260920/runtime-fixture-preflight-failure.json`, `runtime-receipt.json`, `valuation-close-root-cause.json`.
- `replay-20260920/production-post-stop.log`, `production-parent-post-stop.json`.

## AQ. FINAL COMMITS/PUSH

No new commit, tag, push, merge, rebase or force operation. Candidate retained for owner decision; no secrets/build output/scratch evidence staged.

## AR. HEAD==origin/main

HEAD and the currently stored `origin/main` ref both equal `74587e6936bee5fc2cf431713d2ddcfbce0f587c`; remote not refreshed at this strict stop. This does not establish B2 closeout, because all B2 work remains uncommitted and unpushed.

## AS. ORIGINAL DIRTY TREE PRESERVATION

Latest verifier: 4209 original files, mismatches=0; original HEAD/status/index unchanged, stash unchanged, tags unchanged, branch main. Original source tree not used for builds or edits. Only its required configuration was loaded quietly for isolated DB connections; no environment files modified or secret values reported.

## AT. B3/OUT-OF-SCOPE ABSENCE

B3 not executed. No ledger posting, GL/AP, FX, energy/depreciation automation, allocation reversal, B1 reopen, FG capitalization, parent monetary rewrite or unrelated legacy normalization. Failing valuation files remain byte-identical to base; no unapproved repair attempted.

## AU. FINAL DECISION

`COST-R2D-B2=BLOCKED`

`CAN_START_COST_R2D_B3=NO`

Required next owner decision: authorize a narrowly scoped repair of authoritative measurement-point propagation in valuation-close validation, with regression/real-runtime proof and no parent DDL, monetary formula change, historical migration edit or B3 work. Then rerun the mandatory gates and continue the already-authorized complete B2 closeout. Until then, preserve the rehearsed migration and do not deploy.
