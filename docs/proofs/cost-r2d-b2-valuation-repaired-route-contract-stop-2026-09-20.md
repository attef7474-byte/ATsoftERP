# COST-R2D-B2 — valuation repair proven; route-contract strict stop — 2026-09-20

## A. TRUE FINAL STATUS

`COST-R2D-B2=BLOCKED`; `CAN_START_COST_R2D_B3=NO`.

The owner-approved measurement-point propagation repair passes unit and real database/API proof. The full current runtime receipt is **160 PASS / 0 FAIL**. The mandatory full pre-production gate nevertheless fails at route-contract: **UNRESOLVED=2, MISMATCHES=0**, exit 1. The latest owner's section 24 explicitly makes full-regression failure a strict stop. No subsequent implementation commit, backup, clone, production deployment or push occurred. The checker was not weakened and the page was not patched beyond the approval.

This is a static route-resolution failure, not evidence that two runtime endpoints are broken. The checker cannot resolve the generic GET parameter at `apps/web/src/app/admin/production/cost/overhead-allocations/page.tsx:33` or the conditional PATCH route at line 158. Both belong to the existing uncommitted B2 page and were unchanged by this valuation repair.

## B. OWNER MONETARY DECISION APPLIED

Strictly positive persisted lines, HALF_UP(4), full remainder to the largest driver and lowest stable-ID tie-break remain unchanged. No clamp, dropped target or substitute allocation algorithm.

## C. CONTRACT RECOVERY PRESERVED

The [previous parent-reconciled runtime stop](cost-r2d-b2-parent-reconciled-runtime-stop-2026-09-20.md) remains historical evidence of 135 passing checks and one failing close. The latest owner approval authorizes only the caller's missing authority projection, not changing final-output eligibility. The base defect remains documented in `replay-20260920/valuation-close-root-cause.json`.

`BASE_SERVICE_QUERY_LOADS_MEASUREMENT_POINT=NO`; `BASE_SERVICE_PASSES_MEASUREMENT_POINT_NULL=YES`; `DERIVE_TOTALS_REQUIRES_AUTHORITATIVE_FINAL=YES`; `BASE_AUTH_FINAL_EVENT_CLOSE_RESULT=ZERO_OUTPUT`; `VALUATION_CLOSE_ROOT_CAUSE_PROVEN=PASS`.

## D. ZERO/NEGATIVE REPRESENTABILITY POLICY

Rerun real API/SQL proof rejects all four too-small/tiny-driver/negative-remainder/zero-remainder cases atomically. Header stays DRAFT; no lines, source memberships or FINAL audit persist.

## E. MONETARY FEASIBILITY PRECHECK

`pool >= targetCount * 0.0001` remains necessary but insufficient; post-rounding positive-line validation remains mandatory and exercised.

## F. FINAL ROUNDING/REMAINDER ALGORITHM

Local Decimal precision 80, proportional allocation, HALF_UP four decimals, one complete remainder recipient. No global Decimal change.

## G. CONSERVATION PROOF

Real rerun: PRODUCTION 100 + ADMIN 11, six positive lines, exact sum 111.0000. Repaired-snapshot allocation separately conserves 27.0000. Snapshots remain byte-value equivalent before/after allocation.

## H. DETERMINISM PROOF

Equal drivers produce 33.3334 / 33.3333 / 33.3333 in stable target order. Unequal 1:2:3 produces 16.6667 / 33.3333 / 50.0000. Repeated/shuffled-input unit coverage remains passing.

## I. ZERO/NEGATIVE REJECTION TESTS

Real rejected pools/drivers: 0.0003/five equal; 100/(1,10000000); 0.0011/seven equal; 0.0008/five equal. Valid minimum 0.0005/five and single-target 0.0001 pass. Localized AR/EN errors pass. `REMOVED_TESTS=0`; `NEWLY_SKIPPED_TESTS=0`.

## J. SOURCE AUTHORITY

Actual authenticated B1 source and period lifecycle rerun successfully. B1 amount, canonical purpose and company currency remain authoritative. B2 memberships contain provenance, not duplicated source monetary truth.

## K. PURPOSE POOLS

Company + branch + period + canonical costPurpose. Source category/cost center do not split a purpose pool. This real runtime coverage was rerun, not merely inherited.

## L. DRIVER AUTHORITY

`ProductionRunCostSnapshot.finalGoodQuantity` remains the sole B2 driver. The repaired real close produces snapshot quantity 5 despite 100 intermediate and 200 non-authoritative output. B2 uses that exact snapshot ID and quantity 5, not raw quantity 305. `B2_DRIVER_FROM_REPAIRED_SNAPSHOT=PASS`; `COST_SNAPSHOT_RUNTIME_RELATION=PASS`.

## M. TARGET AUTHORITY

Same company/branch, nondeleted cost-closed run, valid destination cost center, close timestamp in `[periodFrom, periodTo)`. Exact upper-bound exclusion remains proven. The concurrent newly closed run falls outside the selected closed period and is excluded.

## N. B2 DOMAIN MODELS / EXACT REPAIR FILE SCOPE

Existing candidate still has three B2 models/tables, ten API handlers under `/api/v1/production/overhead-allocations`, Web route `/admin/production/cost/overhead-allocations`, and five permission actions. This repair adds no model, migration, endpoint, frontend route or permission.

Additional repository files attributable to this approval:

- Modified `apps/api/src/modules/factory/production-runs/production-run-cost-aggregation.service.ts`: minimal `measurementPoint.isAuthoritativeFinal` relation projection and actual relation propagation; exactly two logical changes.
- Created `apps/api/src/modules/factory/production-runs/production-run-cost-aggregation.authority.spec.ts`: eight direct regression tests, using the actual service and totals utility.
- Created this report. External proof runners/receipts remain outside the worktree and are not commit artifacts.

`VALUATION_REPAIR_UNRELATED_FILE_COUNT=0`. Earlier uncommitted B2/reconciliation files are preserved, not attributed to this repair.

## O. IDEMPOTENCY

Existing B2 duplicate create/finalize and concurrent FINAL proof rerun successfully. First real valuation close creates exactly one snapshot and sets costClosedAt. A second close returns 409 via the existing already-closed contract; no second snapshot. `VALUATION_CLOSE_RECLOSE_REJECTED=PASS`; `VALUATION_CLOSE_DUPLICATE_SNAPSHOT_COUNT=0`.

## P. LIFECYCLE

DRAFT edit retains identity; FINAL is immutable and cannot be recalculated/edited. Valuation close preserves existing status, timestamp and duplicate protection semantics. No new lifecycle state, B1 reopen or reversal.

## Q. TENANT/BRANCH ISOLATION

Real non-SUPER_ADMIN custom-role users exercise cross-company read/edit/reference denial, branch denial, search isolation, unauthorized context and missing-context rejection. All pass in the fresh database. Production users/data were not mutated.

## R. PERMISSIONS

Actual password login/JWT/DB guards/context interceptor. Allowed custom roles succeed; denied role receives rejection for all five B2 actions. Permission keys unchanged. Temporary users/roles/links were removed by fixture ownership/exact identity.

## S. AUDIT

CREATE, UPDATE, FINALIZE contain actor and tenant context. Concurrent/repeated FINAL produces one successful FINAL audit. Failed monetary cases produce none. Fixture audit rows were cleaned, not production audit history.

## T. CONCURRENCY

Real duplicate FINAL remains idempotent. Additional real valuation-close/B2 FINAL race uses the shared branch boundary: both requests wait while an external transaction holds the same application lock; neither line nor new snapshot persists while held. After release both succeed. The newly closed out-of-period run is excluded; allocation uses only the previously frozen exact snapshot. `VALUATION_CLOSE_ALLOCATION_CONCURRENCY=PASS`.

## U. COMPLETE KEY-SAFETY MATRIX

Unchanged and `PROVEN_AND_REUSABLE`; see [full key matrix](cost-r2d-b2-key-safety-2026-09-15.md) and prior report section U. Eight physical keys: ohoa_pk 400/900; ohoa_period_uq 400/1700; ohoa_request_uq 1200/1700; ohoa_scope_ix 828/1700; ohol_pk 400/900; ohol_target_purpose_uq 860/1700; ohos_pk 400/900; ohos_allocation_ix 800/1700. Unsafe=0. All 14 FKs physically compatible, trusted/enabled; all 18 CHECKs trusted/enabled. Snapshot FK parent/child both NVARCHAR(191), 382 bytes.

## V. FINAL PRISMA CONTRACT

No schema or database-contract change in this repair. Existing reconciled parent remains 13 columns, six indexes, four outgoing FKs; id191/currency10/costBasis100, named UTC timestamp defaults and exact object mappings. Runtime preserves explicit costBasis, currency, material value, precision, uniqueness and timestamps.

`PARENT_SCHEMA_CHANGE_COUNT=0`; `PARENT_RUNTIME_CONTRACT_CHANGE_COUNT=0`; `FINAL_OUTPUT_AUTHORITY_RULE_CHANGED=NO`; `DERIVE_RUN_TOTALS_SOURCE_CHANGED=NO`.

Before/after repair SHA256 equality:

| Artifact | SHA256 |
|---|---|
| schema.prisma | 0F1F8481AE6E7563672419FE2EE02E7EA9573C26CBDA5F2E53CF57DBDE41BD52 |
| production-runs.util.ts | C4B17B3F6939DCA028F16341162007318C55ED0845E2EF37ED69B592802CAD56 |
| overhead-allocation-catalog-proof.cjs | 3E0890E1DC22889529CCB712548E813402125F63320709D4DDF8D4EA5EC63B0D |

## W. FINAL MIGRATION NAME + SHA256

`20260915010000_cost_r2d_b2_allocation_engine`

`DF038D5611B00D39D3EBFC46ABA72DF892BD1EDB50604A8AB13545429A2697D9`

Recomputed exact equality with the rehearsed artifact. `B2_MIGRATION_BYTES_CHANGED=NO`. No historical migration edits. Post-implementation-commit freeze gate remains pending because no commit is authorized before all pre-production gates pass.

## X. FOCUSED TEST COUNTS

**API 13 suites / 354 tests PASS** = prior 268 + eight new authority cases + 78 existing production-runs service/util cases added to the focused selection. **Web one suite / nine tests PASS**. New cases cover A-F, separate null/undefined relation rejection and fully corrected zero output. Correction netting and mixed-event filtering use real deriveRunTotals. `B2_FOCUSED_TESTS=PASS`; `VALUATION_CLOSE_MEASUREMENT_POINT_TESTS=PASS`; `B1_PROTECTED_TESTS=PASS`.

## Y. FRESH ZERO REPLAY

Existing successful `ATsoftERP_B2_FRESH_20260920T030000` replay is `PROVEN_AND_REUSABLE` under the owner's explicit unchanged-artifact rule. 82 byte-identical committed migrations plus exact B2, SQL1753=0, width warnings=0, unsafe keys=0. Parent fingerprint unchanged: `ec567d455d8b91039370b38cdd393098cce83839fde2499e9b00a4934ebdb65a`. No unnecessary replay/recreation; previously failed database remains untouched.

## Z. PRISMA/SQL DIFF

Prior read-only zero-parent/zero-B2 generated DDL proof is `PROVEN_AND_REUSABLE` because schema/migration/catalog-contract hashes are unchanged. Unrelated legacy drift is not fixed or executed. Parent metadata-visibility diagnosis and no-grant-change evidence remain preserved.

## AA. FRESH-CLIENT RUNTIME

Prisma validate and fresh generation 7.8.0 PASS; current repaired API compiled before runtime. Real Nest AppModule, SQL Server, credentials-based fixture login, JWT, guards, context, validation, localization, audit and transactions exercised. **160 PASS / 0 FAIL**, stage complete. All prior 136 checks rerun; two follow-up checks previously unreachable after the failure plus new regression checks expand the receipt to 160.

`VALUATION_CLOSE_REAL_RELATION_PROOF=PASS`; `VALUATION_CLOSE_SNAPSHOT_CREATE=PASS`; `NON_AUTHORITATIVE_FINAL_OUTPUT_ACCEPTED_COUNT=0`; `FRESH_CLIENT_B2_RUNTIME=PASS`; `RUNTIME_FAILED_CHECK_COUNT=0`.

Non-authoritative-only/no-output closes reject zeroOutput; invalid measurement-point FK rejects persistence. No mocked totals substituted for service/API proof. Cleanup receipt records zero surviving lines, sources, headers, entries, periods, snapshots, transitions, outputs, audit rows and tracked fixture records. Proof application closed. No production synthetic valuation rows created.

## AB. B1 / VALUATION REGRESSION

Focused B1, production-runs/output totals, R1G-A, valuation and B2 suites pass; full API suite also passes. Existing B1 lifecycle rerun through real API. Prior protected B1/MIG-PROV source/catalog evidence remains preserved; no new protected-source/database-contract changes. No observed valuation/B1/MIG-PROV regression; no production regression waiver. The route-contract failure is separately blocking.

## AC. PRE-PRODUCTION FULL REGRESSION

**FAIL / NOT COMPLETE**, not READY_FOR_PRODUCTION.

| Gate | Current repaired-source result |
|---|---|
| Full API | 160 suites / 2872 tests PASS; zero failed/skipped |
| Full Web | 35 suites / 973 tests PASS; zero failed/skipped |
| API / Web typecheck | PASS / PASS |
| API build / Web production build | PASS / PASS; Web generated 189 pages |
| Prisma validate / generate | PASS / PASS |
| i18n | PASS; 6077 EN = 6077 AR, 22 namespaces, 9698 literal-key references |
| Raw-key | PASS; 33 existing dynamic-key safe-fallback warnings |
| Route-contract | FAIL, exit 1; 1104 audited, 1102 matched, two unresolved, zero malformed/mismatches |
| UI baseline / permission UI check | NOT RUN after route-contract strict stop |
| Focused browser proof | NOT RUN |
| git diff --check | PASS |

Exact unresolved expressions: GET `path` inside generic useRead at page.tsx:33; PATCH `action === 'save' ? \`${ROOT}/${id}\` : \`${ROOT}/${id}/finalize\`` at page.tsx:158. No suppression/allowlist/checker bypass. Next reports no ESLint configuration; build nevertheless exits 0. This warning is not a substitute for lint proof.

## AD. IMPLEMENTATION COMMIT

Not created. Branch `cost-r2d-b2-final-20260915`, HEAD `74587e6936bee5fc2cf431713d2ddcfbce0f587c`. Candidate remains unstaged/uncommitted. Cached diff empty.

## AE. COPY_ONLY BACKUP

New B2 production COPY_ONLY/CHECKSUM backup NOT RUN because pre-production gate failed.

## AF. RESTORE VERIFYONLY

New B2 VERIFYONLY NOT RUN.

## AG. REAL BACKUP-DERIVED CLONE

New B2 backup-derived clone NOT CREATED. Fresh replay is not represented as backup-derived proof.

## AH. REAL CLONE MIGRATION/RUNTIME

NOT RUN; mandatory after all pre-production gates pass and backup/restore succeed.

## AI. MIGRATION ENGINE PROOF

Fresh replay's exact B2 applied row and supported resolve/status proof remain reusable. Fresh history: 85 active rows/83 distinct names due to two documented legacy self-registering migrations; no history edits. New real-clone/production engine proof NOT RUN.

## AJ. PRODUCTION DDL

None in this repair. No parent ALTER, seed, grants, synthetic output/run/snapshot or B2 deployment. Service not stopped/restarted. `PRODUCTION_SYNTHETIC_VALUATION_ROW_COUNT=0`.

## AK. PRODUCTION DATABASE ACCEPTANCE

Prior production read-only preservation evidence remains in the preceding report: B2 tables/history 0, B1/MIG-PROV protected, 82 active migrations, zero duplicate/unresolved names. No intervening production write by this task. B2 production acceptance remains NOT_PROVEN, not inferred from fresh DB.

## AL. B2 PRODUCTION MIGRATION CHECKSUM

NOT_PROVEN; no B2 production migration applied/registered.

## AM. DEPLOYED ARTIFACT

No B2 artifact deployed. Current generated client and API/Web builds are isolated worktree artifacts only.

## AN. PRODUCTION RUNTIME/HEALTH

Final read-only check: `ATsoftERP_API` RUNNING; `http://localhost:4000/api/v1/health` returns **200**. This is existing production health, not proof of B2 deployment.

## AO. FINAL FULL TEST/BUILD COUNTS

Current full API2872 and Web973 PASS, focused API354/Web9 PASS, runtime160 PASS, API/Web builds/typechecks PASS. API count history: previous broad 2837 +27 catalog tests +eight authority tests =2872; previous 158 suites +two new spec suites =160. No earlier accidental/incomplete run used as final proof. Overall full-regression acceptance FAIL due to routes and remaining unrun gates.

## AP. PROOF DOCUMENTS / MACHINE EVIDENCE

This report supplements, without rewriting, the [implementation contract](cost-r2d-b2-implementation-contract-2026-09-15.md), [key matrix](cost-r2d-b2-key-safety-2026-09-15.md), [SQL1753 stop](cost-r2d-b2-strict-stop-2026-09-16.md), [parent-description stop](cost-r2d-b2-parent-reconciliation-stop-2026-09-17.md), and [parent-reconciled runtime stop](cost-r2d-b2-parent-reconciled-runtime-stop-2026-09-20.md).

External evidence root: `C:\Users\attef\AppData\Local\Temp\ATsofterp-COST-R2D-B2-FINAL-20260915`.

- `valuation-repair-20260920/runtime-receipt.json`: complete 160 checks and all-zero cleanup.
- `valuation-repair-20260920/full-api-tests.json`, `full-web-tests.json`, `focused-web.json`.
- `reconciliation-20260917/20260920-repaired-focused-api.json`.
- `valuation-repair-20260920/*.receipt.json` and corresponding stdout/stderr for current validation commands.
- `valuation-repair-20260920/route-contract.stderr.log`: exact two unresolved source locations.
- Previous `replay-20260920` catalog/replay/diff/root-cause receipts retained intact.

An initial external Web runner used the wrong Next executable location; corrected runner resolves the Web-local installed Next. Its error is retained separately as `web-build-runner-path-error.log`; the real subsequent production build receipt is exit 0. No application behavior or assertions changed to correct runner invocation. Interrupted/incomplete command attempts are not counted as PASS.

## AQ. FINAL COMMITS/PUSH

No new commit/tag/push/merge/rebase/force operation. No generated, secret or external scratch artifact staged.

## AR. HEAD == origin/main

HEAD and stored origin/main both `74587e6936bee5fc2cf431713d2ddcfbce0f587c`. No remote refresh at this strict stop; this is not evidence of completed B2 publication because candidate work is uncommitted.

## AS. ORIGINAL DIRTY TREE PRESERVATION

Final verifier: **4209 files, zero mismatches**; original HEAD/status/index/stash/tags unchanged; original branch main. All application edits/builds isolated. No environment file modification or credential disclosure.

## AT. B3 / OUT-OF-SCOPE ABSENCE

B3 not executed. No GL/AP, FX, ledger posting/reversal, energy/depreciation automation, FG capitalization, B1 reopen, deriveRunTotals rule change, snapshot schema change or unrelated normalization. FinalOutput authority still requires FINAL_OUTPUT AND an explicitly authoritative measurement point.

## AU. FINAL DECISION

`COST-R2D-B2=BLOCKED`; `CAN_START_COST_R2D_B3=NO`.

Bounded next owner decision required by the strict-stop contract: authorize making the existing B2 page's GET/PATCH calls statically analyzable, preserving request URLs/methods/payloads, cancellation/stale-response protection, permissions, tenant context and UI behavior; add appropriate regression coverage and rerun unchanged route-contract/full gates. Do not waive or weaken the checker. After that gate passes, resume the already-authorized production/Git closeout; do not execute B3.
