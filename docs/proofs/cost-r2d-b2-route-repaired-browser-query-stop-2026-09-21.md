# COST-R2D-B2 — routes repaired; browser query-contract strict stop

Source repair and validation: 2026-09-20. Interrupted-session cleanup and final preservation verification: 2026-09-21.

## A. TRUE FINAL STATUS

`COST-R2D-B2=BLOCKED`; `CAN_START_COST_R2D_B3=NO`.

The approved static-route refactor succeeds without changing the checker: **1108 audited / 1108 matched / UNRESOLVED=0 / MISMATCHES=0**. Actual browser proof then fails on initial list loading: the existing `status=` empty query value is rejected by the unchanged API DTO, HTTP 400. The page visibly shows “Failed to load data. Please try again.” and a shared error dialog with “Validation failed” / “status: Invalid enum value”. This triggers the owner's explicit browser-proof strict stop. No production/Git closeout followed.

## B. OWNER MONETARY DECISION APPLIED

Positive-line policy, HALF_UP(4), complete remainder to largest driver and stable-ID tie-break unchanged. No monetary source modified by this route repair.

## C. CONTRACT RECOVERY PRESERVED

The [previous valuation-repaired route stop](cost-r2d-b2-valuation-repaired-route-contract-stop-2026-09-20.md) remains historical evidence, not rewritten. Latest approval permits static request refactoring while preserving exact runtime URLs/query semantics. It does not authorize silently omitting or normalizing a previously transmitted query parameter.

Static-analysis causes: generic GET `api.get<T>(path, ...)` cannot be resolved because `path` is a function parameter rather than a statically resolvable constant. PATCH's first argument is a conditional expression, unsupported by the current grammar. The complete existing checker was read. Supported selected form: literal/template route arguments, including a statically resolved ROOT constant, directly at real API call sites. `ROUTE_STATIC_ANALYSIS_CAUSE_PROVEN=PASS`.

## D. ZERO/NEGATIVE REPRESENTABILITY POLICY

Unchanged; prior real-runtime rejection and atomicity proof `PROVEN_AND_REUSABLE` under the unchanged-backend rule. No zero/negative allocation-line acceptance introduced.

## E. MONETARY FEASIBILITY PRECHECK

Unchanged necessary-but-insufficient `pool >= targetCount * 0.0001`; post-rounding validation remains intact.

## F. FINAL ROUNDING/REMAINDER ALGORITHM

Decimal precision 80 and HALF_UP four decimals unchanged. Engine hash matches pre-refactor baseline.

## G. CONSERVATION PROOF

Prior authenticated runtime conservation 111.0000 across purpose pools and 27.0000 from the repaired valuation snapshot remains reusable. No claim that browser FINALIZE was reached in this run.

## H. DETERMINISM PROOF

Previous equal-driver 33.3334/33.3333/33.3333 and unequal-driver 16.6667/33.3333/50.0000 proof preserved. Current full API tests pass unchanged.

## I. ZERO/NEGATIVE REJECTION TESTS

Protected API tests retained. `REMOVED_TESTS=0`; `NEWLY_SKIPPED_TESTS=0`. Browser mutation coverage remains uncompleted after initial GET failure.

## J. SOURCE AUTHORITY

B1 remains authoritative. Browser setup successfully used authenticated B1 source/period APIs in the fresh database; no production fixtures. No source-authority change.

## K. PURPOSE POOLS

Company + branch + period + canonical purpose unchanged. No category/cost-center repartitioning.

## L. DRIVER AUTHORITY

Frozen `ProductionRunCostSnapshot.finalGoodQuantity` unchanged. Prior repaired-close/snapshot-driver integration remains reusable; browser setup does not substitute for its proof.

## M. TARGET AUTHORITY

Same tenant/branch, valid cost center, nondeleted cost-closed run, half-open period membership unchanged. No backend or target eligibility change.

## N. EXACT FILE / API / UI SCOPE

Additional files attributable to this approval:

- Modified `apps/web/src/app/admin/production/cost/overhead-allocations/page.tsx`: useRead accepts an execution callback held in a ref; four existing read usages now expose template-static API calls; SAVE and FINALIZE have explicit PATCH branches with shared success/error handling.
- Created `apps/web/tests/overhead-allocation-requests.test.ts`: 14 focused request/async regression tests.
- Created this report.

Existing `useDrawerSectionData` fetcher/ref pattern informed the bounded hook change. No checker-only metadata, alias, suppression or alternative request transport. Same shared `api` abstraction, URLs, headers, locale/context handling, payloads and mutation callbacks.

No model, migration, backend endpoint, frontend route, permission key or translation added/changed by this repair. Earlier uncommitted B2 and approved parent/valuation changes remain preserved. `ROUTE_REPAIR_UNRELATED_FILE_COUNT=0`.

## O. IDEMPOTENCY / ASYNC SAFETY

Tests execute actual page functions/callbacks using deterministic hook scheduling, not a duplicate implementation. Coverage includes abort signals; path switch/unmount; stale success/error suppression; latest callback on revision refresh; no same-key refetch; null-path disablement; save/finalize duplicate-submit lock; busy disabled state; shared success refresh/toast and failure preservation of entered notes. These are unit-level assertions, not a substitute for React/browser proof.

`CANCELLATION_BEHAVIOR_CHANGED=NO`; `STALE_RESPONSE_PROTECTION_CHANGED=NO`; `DOUBLE_SUBMIT_PROTECTION_CHANGED=NO`.

## P. LIFECYCLE / PAYLOADS

SAVE stays PATCH `${ROOT}/${id}` with `{ notes }`; FINALIZE stays PATCH `${ROOT}/${id}/finalize` with `{}`. Shared success/error/toast/refresh/dialog/selected-record logic unchanged. `SAVE_PAYLOAD_CHANGED=NO`; `FINALIZE_PAYLOAD_CHANGED=NO`. Existing FINAL immutability rules untouched.

## Q. TENANT/BRANCH ISOLATION

Shared API auth/context headers and backend scope unchanged, protected by hashes. Unit tests prove missing context causes no page request. Existing 160-check authenticated tenant/branch proof remains reusable. The browser loaded the real custom-role user's company/branch context; successful list/mutation tenant proof through this page was not reached.

## R. PERMISSIONS

`B2_PERMISSION_KEY_CHANGE_COUNT=0`; `B2_TENANT_CONTEXT_BEHAVIOR_CHANGED=NO`. Existing permission UI checker PASS. New tests cover denied page/no GET and hidden update action. Browser denied-user flow remains NOT_PROVEN after the initial allowed-user list failure. No production users or permissions changed.

## S. AUDIT

Backend audit source unchanged and prior authenticated proof reusable. Browser fixture setup generated eight audit rows; all were inventoried and removed with the exact temporary users. No browser SAVE/FINALIZE audit acceptance claimed.

## T. CONCURRENCY

Prior real shared-boundary valuation-close/B2 FINAL race remains reusable. New frontend tests prove duplicate callbacks issue one PATCH while pending. No new browser concurrency acceptance claimed.

## U. COMPLETE KEY-SAFETY MATRIX

Unchanged; [full key matrix](cost-r2d-b2-key-safety-2026-09-15.md) and prior replay acceptance remain `PROVEN_AND_REUSABLE`: eight safe keys, 14 compatible trusted/enabled FKs, 18 trusted/enabled CHECKs, SQL1753=0, width warnings=0. No DDL in this repair.

## V. FINAL PRISMA / PROTECTED CONTRACT

All **17 protected artifacts** match pre-refactor SHA256: schema, migration, valuation aggregation, totals utility, route checker, catalog proof, shared Web API and ten B2 backend/spec files. `SCHEMA_CHANGED_BY_ROUTE_REPAIR=NO`; `B2_BACKEND_BEHAVIOR_CHANGED_BY_ROUTE_REPAIR=NO`.

Checker SHA256 before/after: `FAF0D11A9053AC1E0492DA8486AA6C385AFF8D1BA37A9D58291BDC78D15775D1`.

`ROUTE_CHECKER_SOURCE_CHANGED=NO`; `ROUTE_CHECKER_ALLOWLIST_ADDITION_COUNT=0`; `ROUTE_CHECKER_SUPPRESSION_COUNT=0`.

## W. FINAL MIGRATION NAME + SHA256

`20260915010000_cost_r2d_b2_allocation_engine`

`DF038D5611B00D39D3EBFC46ABA72DF892BD1EDB50604A8AB13545429A2697D9`

Exact equality verified. `B2_MIGRATION_BYTES_CHANGED=NO`; `B2_MIGRATION_CHANGED_BY_ROUTE_REPAIR=NO`. No historical migration edit; post-commit freeze still pending because implementation commit is blocked.

## X. FOCUSED WEB TESTS / URL EQUIVALENCE

**Two suites / 23 tests PASS** = all nine previous tests +14 new tests. API-focused 13 suites/354 from prior approval is preserved, not rerun as a distinct focused selection; current full API2872 includes it.

New tests cover initial/search list query, encoded search text, eligible periods, detail and three evidence tabs, existing `%2F` ID handling, SAVE/FINALIZE URLs and payloads, refresh/error/locks/permissions/context/async safety, and real shared API prefix/body serialization. Existing ID interpolation remains unchanged rather than double-encoded; no segment/query loss.

`GET_ROUTE_STATICALLY_RESOLVED=PASS`; `PATCH_SAVE_ROUTE_STATICALLY_RESOLVED=PASS`; `PATCH_FINALIZE_ROUTE_STATICALLY_RESOLVED=PASS`; `FRONTEND_ROUTE_URL_EQUIVALENCE=PASS`; `B2_FRONTEND_RUNTIME_REQUEST_BEHAVIOR_CHANGED=NO`; `PREVIOUS_B2_WEB_TEST_INTENT_PRESERVED=PASS`.

Importantly, URL equivalence preserves the existing empty status query bug. Passing equivalence tests does not establish API acceptance of that URL.

## Y. FRESH ZERO REPLAY

`ATsoftERP_B2_FRESH_20260920T030000` successful replay remains reusable because protected artifacts are unchanged. No reset/recreation/new replay performed. Earlier failed database remains untouched.

## Z. PRISMA/SQL DIFF

Existing zero-parent/zero-B2 generated DDL proof reusable. No new parent reconciliation or unrelated legacy drift execution. Prisma validate and fresh client generation 7.8.0 were rerun successfully.

## AA. REAL RUNTIME / NEW BROWSER FAILURE

Prior full authenticated **160 PASS / 0 FAIL** runtime receipt remains `PROVEN_AND_REUSABLE`, not described as rerun. New browser proof used the repaired Next page on localhost3105 and actual Nest/API on localhost4105, connected only to the named fresh SQL database. Temporary custom-role sessions came from real password login; no forged JWT or mock API response. Credentials were not printed/stored in report artifacts.

Observed real request:

`GET /api/v1/production/overhead-allocations?page=1&limit=20&search=&status=` → **400**.

Source cause: Workspace initializes status to empty string and always includes `&status=${status}`. The pre-refactor page contains the same expression. `AllocationQueryDto.status` has `@IsOptional() @IsIn(['DRAFT', 'FINAL'])`; empty string is supplied, not absent, so it is rejected. Read-only execution of the actual compiled DTO proves: absent/DRAFT/FINAL pass; empty/INVALID fail. No endpoint mismatch, permission denial or tenant mismatch explains this result.

`FOCUSED_BROWSER_PROOF=FAIL`. SAVE, FINALIZE, denied-user browser state and Arabic/RTL proof were not reached; no waiver. English page/error rendering was observed, not full English workflow acceptance.

## AB. B1 / VALUATION / MIG-PROV REGRESSION

Current full API160 suites/2872 tests PASS. B1/valuation/backend sources protected. No observed backend regression; the new blocker is pre-existing B2 page query-to-DTO incompatibility, not the approved valuation repair.

## AC. FULL PRE-PRODUCTION REGRESSION

**FAIL overall** because mandatory browser acceptance fails.

| Gate | Result |
|---|---|
| Full API tests | 160 suites / 2872 PASS; zero failed/skipped |
| Full Web tests | 36 suites / 987 PASS; zero failed/skipped |
| API and Web typecheck | PASS / PASS |
| API and Web production build | PASS / PASS; 189 Web pages generated |
| Prisma validate / generate | PASS / PASS, client 7.8.0 |
| i18n | PASS; 6077 EN = 6077 AR, 22 namespaces, 9698 literal references |
| Raw-key | PASS; 33 existing safe-fallback warnings |
| Route-contract | PASS; audited1108, matched1108, unresolved0, mismatches0 |
| UI baseline | PASS; 99 checks |
| Permission UI | PASS |
| Focused browser | FAIL; initial GET400 on empty status |
| git diff --check | PASS |

An early Web typecheck overlapped Next regeneration and saw missing `.next/types` files (TS6053). Its exit2/logs are retained. After build completed, unchanged-source typecheck passed; no tsconfig/validation weakening. Initial new-test ES2020 incompatibility (`Array.at`) was fixed only in the new test by ordinary indexing; all assertions retained. Next production build warned that ESLint configuration is absent. The temporary custom dev server warned about Tailwind content configuration; visual layout acceptance is not claimed. It does not explain the independently proven API400 query failure.

## AD. IMPLEMENTATION COMMIT

Not created. Branch `cost-r2d-b2-final-20260915`, HEAD `74587e6936bee5fc2cf431713d2ddcfbce0f587c`. Candidate remains unstaged/uncommitted; no broad staging or branch operation.

## AE. COPY_ONLY BACKUP

New B2 production backup NOT RUN; full pre-production gate failed.

## AF. RESTORE VERIFYONLY

New B2 VERIFYONLY NOT RUN.

## AG. REAL BACKUP-DERIVED CLONE

New B2 clone NOT CREATED. Existing fresh test database is not represented as a production-backup clone.

## AH. REAL CLONE MIGRATION/RUNTIME

NOT RUN. Required once pre-production/browser gates pass.

## AI. MIGRATION ENGINE PROOF

Prior fresh supported deploy/resolve/status proof reusable. New backup-clone and production engine proof NOT RUN; no migration-history manipulation.

## AJ. PRODUCTION DDL

None. No production schema/seed/permission/output/run/snapshot/allocation mutation. `PRODUCTION_SYNTHETIC_B2_ROW_COUNT=0`.

## AK. DATABASE PRESERVATION / FIXTURE CLEANUP

The usage-limit interruption prevented normal proof-server cleanup. On resumption the server session and localhost3105 endpoint were no longer running. Exact fresh-DB fixture inventory was recovered using recorded company/allocation/period identity and unique prefix `B2PROOF-1749ad77`.

Transactional cleanup removed only the inventoried fixture graph: allocation draft, source/period, snapshot/run and reference graph, eight audit rows, three users, one role and links, two companies/three branches, and 16 fixture-created permission rows. Permission ownership was rechecked using exact IDs/keys/creation timestamps, same creation-session IDs and absence of other role references. Unrelated permission rows preserved. Counts rechecked **zero across all 29 targeted model groups**; no production deletion. These disposable test records were physically removed, not placed in trash; their reproducible setup and non-secret receipts remain available.

Browser tab closure could not be verified: the browser tool was first usage-limited and the old browser ID was unavailable after resumption. No attempt was made to control another user tab. The test services are stopped and fixture users/permissions are removed.

## AL. B2 PRODUCTION MIGRATION CHECKSUM

NOT_PROVEN: no B2 production migration applied/registered. Rehearsed checksum equality is not production acceptance.

## AM. DEPLOYED ARTIFACT

No B2 deployment. Production build passed before browser proof; temporary Next dev compilation subsequently used the isolated `.next` directory. Rebuild exact committed release artifacts before future deployment; do not deploy the dev-proof output or its localhost4105 API configuration.

## AN. PRODUCTION RUNTIME/HEALTH

2026-09-21 read-only check: `ATsoftERP_API` RUNNING and localhost4000 `/api/v1/health` **200**. No production service restart by this task. Existing health is not B2 acceptance.

## AO. FINAL COUNTS

API unchanged at2872/160 suites. Web973+14=987 across35+1=36 suites. Focused Web9+14=23 across two suites. Route audited1104+four net call sites=1108, no coverage decrease. API/client/catalog runtime160 prior checks reusable, not double-counted as browser checks. `TEST_COUNT_HISTORY_EXPLAINED=PASS`; overall closeout remains blocked.

## AP. PROOF DOCUMENTS / RECEIPTS

This report and prior [route stop](cost-r2d-b2-valuation-repaired-route-contract-stop-2026-09-20.md), [valuation stop](cost-r2d-b2-parent-reconciled-runtime-stop-2026-09-20.md), [parent stop](cost-r2d-b2-parent-reconciliation-stop-2026-09-17.md), [SQL1753 stop](cost-r2d-b2-strict-stop-2026-09-16.md), [implementation contract](cost-r2d-b2-implementation-contract-2026-09-15.md), and [key matrix](cost-r2d-b2-key-safety-2026-09-15.md) remain preserved.

External root: `C:\Users\attef\AppData\Local\Temp\ATsofterp-COST-R2D-B2-FINAL-20260915\route-repair-20260920`.

- `protected-before.json`, `page-before.tsx`: exact repair baseline.
- `full-api-tests.json`, `full-web-tests.json`, validation logs/receipts.
- `web-typecheck-build-race.*`: retained failed overlapping attempt; later `web-typecheck.receipt.json` exit0.
- `browser-fixture-public.json`, `browser-network.json`: fixture identity and actual initial GET400.
- `browser-recovery-inventory.json`, `browser-cleanup.json`: scoped recovery and all-zero cleanup.
- `route-repair-stop-receipt.json`: 17 unchanged hashes, actual DTO diagnosis, tests/gates/network/cleanup.

Scratch runners and receipts remain outside Git. No secret values in these proof receipts.

## AQ. COMMITS / PUSH

None. No new tag, commit, push, merge, rebase, reset, clean or force operation.

## AR. HEAD == origin/main

HEAD and stored origin/main equal `74587e6936bee5fc2cf431713d2ddcfbce0f587c`. Remote not fetched at this stop; equality does not publish the uncommitted B2 work.

## AS. ORIGINAL DIRTY TREE PRESERVATION

Final verifier: **4209 files, zero mismatches**. Original HEAD/status/index/stash/tags unchanged, branch main. Original checkout was not used for source edits/builds. Environment files unchanged; authorized isolated SQL configuration loaded quietly.

## AT. B3 / OUT-OF-SCOPE ABSENCE

B3 not executed. No valuation authority broadening, monetary rewrite, parent schema edit, ledger posting/reversal, GL/AP, FX, FG capitalization, B1 reopen or unrelated page/checker refactor.

## AU. FINAL DECISION / BOUNDED NEXT AUTHORITY

`COST-R2D-B2=BLOCKED`; `CAN_START_COST_R2D_B3=NO`.

Required bounded owner approval: omit the optional `status` query parameter only when the UI selects “All states”, preserving explicit DRAFT/FINAL filters and all other request/query/async/tenant behavior; add real query-to-DTO regression and browser proof; leave strict backend enum validation and route checker unchanged. This is a intentional change to the prior empty-status request contract and cannot be silently included in the exact-URL-preservation approval. Then resume all remaining authorized B2 gates; do not execute B3.
