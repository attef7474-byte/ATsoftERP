# Cross-Prompt Inspection Pitfalls Register
Status: ACTIVE — permanent, applies to every prompt/session  
Last updated: 2026-11-21
Provenance: Phase 2 unified receipt voucher discovery, implementation, validation, deployment, and browser proof.

## 0. العربية — قاعدة دائمة

من الآن فصاعداً، في كل برومبت، تقرأ هذا الملف قبل أي فحص أو تعديل أو تحقق. تُطبّق كل فحوصات الـ `ACTIVE CHECK` المذكورة هنا، وتُسجّل أي مشكلة جديدة تظهر أثناء الفحص في هذا الملف، ثم يُذكر في التقرير النهائي أي فحوصات تم تطبيقها. الهدف هو عدم إعادة اكتشاف نفس المشاكل أو تأخير العمل بسببها في كل مرة.

## 1. Purpose

This is the permanent, append-only register of problems already encountered during inspection, testing, migration, deployment, and browser proof. It exists so future prompts/sessions do not rediscover the same failures, reapply ad-hoc fixes from memory, or lose time to the same environment/build/test traps.

This file is an operational governance companion to `AGENTS.md`. It is not a design authority. On conflict, the Engineering Constitution, relevant domain rules, and the Permanent Development Contract remain authoritative.

## 2. Mandatory workflow — every prompt

1. **Read this register first**, before opening code, running tests, or changing files.
2. Treat every `ACTIVE CHECK` row as a pre-flight check for the relevant area.
3. If the task touches an area with a recorded problem, apply its preventive check before implementing and include the result in validation.
4. If a problem recurs, stop and reuse the recorded resolution; do not restart investigation from scratch.
5. During the task, append newly discovered problems using the template in section 6. Never write credentials, connection strings, tokens, or passwords — use `REDACTED`.
6. In the final response, state which register checks were applied and whether any new entries were added.

Entries are append-only. A status may change to `RESOLVED` only with evidence. A preventive check is never deleted merely because it passed once.

## 3. Problem ledger

| ID | Problem / symptom | Preventive check | Status |
| --- | --- | --- | --- |
| P01 | A web assertion counted every `select` option on the page instead of the intended first field, producing a misleading test result. | Scope selectors to the dialog/form and the first field (`data-testid`, role within dialog, or labeled control). Assert the exact first-field label, not a global option count. | ACTIVE CHECK |
| P02 | React `act(...)` warnings appeared during focused web tests. | Wrap state-updating interactions in `act(...)`; use fake timers for debounce/async UI; unmount in cleanup so pending timers cannot leak into later tests. | ACTIVE CHECK |
| P03 | Unified receipt pagination applied `skip` twice when merging authority result sets. | Assert `skip: 0` for each authority on page 1 and that the union receives `skip` exactly once. Keep the regression assertion for combined pagination. | ACTIVE CHECK — fixed by runtime commit `402d29c` |
| P04 | Prisma failed with `Unknown field _sum` because `_sum` was placed in `findMany` `select`. | Never use `_sum` in `findMany` `select`. Use `aggregate`, `groupBy`, or explicit count paths, and add a list-endpoint regression test. | ACTIVE CHECK |
| P05 | Route-contract checker reported dynamic template-literal route findings. | Keep route-contract-visible endpoint references as literal native paths. Expected baseline is `MALFORMED=3`, `UNRESOLVED=3`, `MISMATCHES=0`, exit `1`; do not report this baseline as a new failure. | ACTIVE CHECK / EXPECTED BASELINE |
| P06 | Stale `apps/web/.next` produced `global-not-found.js` errors after a build. | If a stale-cache error appears, clear only the build cache with `node -e "require('fs').rmSync('apps/web/.next',{recursive:true,force:true})"`, then rebuild. Never delete source files to fix this. | ACTIVE CHECK |
| P07 | Migration failed with `P3018` / SQL Server error `1088` because runtime user had `ALTER_PERM=0`. | For a reviewed schema migration, use Windows sysadmin `sqlcmd -E`, then `prisma migrate resolve --applied`. Never use `prisma migrate reset`, `db push`, destructive reset, or edit an applied migration. | ACTIVE CHECK |
| P08 | `EADDRINUSE` appeared while NSSM services auto-restarted. | Identify the actual listener with `Get-NetTCPConnection`; recycle only `ATsoftERP_API` / `ATsoftERP_Web` with `Restart-Service`; verify health after restart. Do not kill arbitrary processes. | ACTIVE CHECK |
| P09 | Production CORS blocked cross-origin browser-proof fetches. | Browser proof must use same-origin `/api/v1`. Do not add permissive CORS rules to make a proof pass. | ACTIVE CHECK |
| P10 | A browser selector matched a same-labeled background filter instead of the dialog control. | Scope selectors to the dialog, `data-testid`, or row container. Never rely on a label string alone when the same label exists in the background UI. | ACTIVE CHECK |
| P11 | Login rate limiting interrupted repeated browser-proof runs. | Restart the API service to clear the attempt counter before rerunning proof. If still blocked, report honestly; do not weaken authentication or lockout rules. | ACTIVE CHECK |
| P12 | A diagnostic `[Uri]` parse emitted `DATABASE_URL` once and had to be treated as `REDACTED`. | Never pass `DATABASE_URL` to `[Uri]`. Parse only host/database name with a regex and redact all other content. Load env-only credentials without printing them. | ACTIVE CHECK / SECURITY |
| P13 | Swagger was unavailable in production. | Absence is expected when `SWAGGER_ENABLED` is unset. Do not enable Swagger in production merely to prove routes; use authenticated route probes instead. | EXPECTED BEHAVIOR |
| P14 | 18 legacy receipts have `branchId = NULL` and are excluded under a branch context. | Mirror the native service behavior. Do not invent a branch for legacy rows; state the exclusion explicitly in proof reports. | DOMAIN NOTE |
| P15 | Runtime row-level deep-link proof was not exercised for native receipt deep links. | Unit tests assert both native deep links. If browser proof is required, create an authorized fixture first; otherwise report `NOT_VERIFIED` instead of claiming runtime proof. | KNOWN LIMITATION |
| P16 | Pre-existing non-blockers recur: global F9 `cost-snapshots` 500, Jest worker teardown warning, dynamic `t()` warnings. | Classify these as pre-existing and report them separately from new failures. Do not delete tests or weaken assertions to make them disappear. | PRE-EXISTING / WATCH |
| P17 | `sqlcmd -E -S` failed with named-pipes error `[53]` when given the Prisma URL server `localhost:50079`. | For SQL Server `sqlcmd`, normalize Prisma `host:port` to `host,port` (or `tcp:host,port`). Parse only server/database from `DATABASE_URL`; never print credentials. | ACTIVE CHECK |
| P18 | A migration verification script asserted a rigid padded `sqlcmd -h -1 -W` output shape and failed although the migration had applied correctly. | Assert semantic values (for example `1 1 1` for three verified columns) and make guarded re-runs idempotent when a prior attempt already applied DDL but did not record migration history. | ACTIVE CHECK |
| P19 | `POST /installed-parts/:id/readings` returned 500 because `MachineInstalledPartReading.createdAt` was mapped to `created_at` while the dated migration and production table use `createdAt`. | Before any runtime proof that writes readings, assert the Prisma `@map` matches the dated migration/DB column, then run `prisma validate`, `prisma generate`, and a read-only `createdAt` probe against the target DB. Keep a static regression test that locks schema/migration alignment. | ACTIVE CHECK — fixed by Phase 3 schema mapping correction |
| P20 | Browser-proof password credentials were unavailable, which made a normal login proof impossible without inventing credentials. | When explicitly authorized by the task, derive an env-only HS256 JWT from root `.env` `JWT_SECRET` plus DB-queried `id`, `email`, `authVersion`; load the operational context from `/auth/contexts`, keep API calls same-origin, and print only `REDACTED`. Never hard-code or print secrets. | ACTIVE CHECK / SECURITY |
| P21 | A deterministic provenance token placed in `MaintenanceRequest.description` became the user-visible request title because canonical creation derives `title` from `description`. | Keep machine tokens in `notes` / `usageNote`; keep `description` human-readable. Add a test asserting the created description contains no `source=` token. | ACTIVE CHECK / PHASE 4 CORRECTION |
| P22 | Linked-record queries can rely only on an ID derived from a scoped aggregate, leaving no explicit tenant predicate at the query itself. | Add the machine relation scope (`companyId` + branch/null) to every linked `MaintenanceRequest`, `MaintenanceSchedule`, `SparePartReplacementHistory`, and component-criticality query, even when the ID came from a scoped parent. | ACTIVE CHECK / TENANCY |
| P23 | A tenant-isolation unit test mocked the canonical scoped row builder to return `[]`, proving only not-found rejection. | Assert that the scoped builder received the active context, and assert the Prisma relation filters on linked queries; retain real runtime tenant-denial proof. | ACTIVE CHECK / TEST QUALITY |
| P24 | Failure-history evidence can show the population catalog default instead of the failed instance's own applied expected life. | Derive displayed life fields from the failed `MachineInstalledPart` row (`expectedLifeValue` / `expectedLifeUnit`) gated by that instance's configured state; never substitute the current population default. | ACTIVE CHECK / EVIDENCE HONESTY |
| P25 | Canonical maintenance-request creation defaults `machineStopped` to `true`, so an alert-to-request bridge that omits it opens a real downtime log from a proactive signal. | Pass `machineStopped: false` from derived-alert bridges; assert it in the bridge test; prove zero new downtime logs during runtime. | ACTIVE CHECK / SIDE-EFFECT SAFETY |
| P26 | An all-types issue-warehouse F9 either required a preselected issue type or risked an unscoped union of every domain's warehouses, letting a user with one issue permission see unrelated issue-family stock locations. | Build the all-types warehouse predicate as a UNION of only the exact issue types the user is authorized to create, always intersected with active company/branch warehouse scope; assert the eligibility union and a no-authority denial. | ACTIVE CHECK / PHASE 5 TENANCY |
| P27 | A retry regression test constructed a plain `Error` with `code = 'P2034'`, so `instanceof Prisma.PrismaClientKnownRequestError` did not exercise the intended transient-conflict retry. | Construct real Prisma known-request errors (`new Prisma.PrismaClientKnownRequestError('...', { code: 'P2034', clientVersion: 'test' })`) in retry tests; keep the two-attempt assertion. | ACTIVE CHECK / TEST QUALITY |
| P28 | General-issue reversals in an ACTIVE valuation warehouse were treated as generic inbound movements and blocked by `inventoryValuation.costRequired`, despite having immutable original OUT cost evidence. | Use a dedicated trusted reversal posting entrypoint that proves tenant/warehouse/document/movement/line identity and re-enters at original immutable OUT cost; keep generic inbound `costRequired` protection intact and test both paths. | ACTIVE CHECK / VALUATION |
| P29 | A backend-generated English reversal note was hard-coded, bypassing Arabic/English localization and the UI's user-supplied reason. | The UI supplies a localized `inventory.issueVoucher.reverseNote`; direct API callers may omit notes. Add matching EN/AR keys and assert the posted payload contains the localized value. | ACTIVE CHECK / I18N |
| P30 | Removing a hard-coded backend note left unused API i18n keys, creating a misleading catalogue of reachable error/message contracts. | Grep each added API message key for at least one service/controller use before final validation; remove dead keys and keep API/web message sets intentional. | ACTIVE CHECK / API CONTRACT |
| P31 | A PowerShell `Set-Content` edit wrote CRLF into a new TypeScript file while the repository uses LF; `git diff --check` did not see the untracked file, but `git diff --cached --check` reported every added line as trailing whitespace. | After staging new files, run `git diff --cached --check` and `git ls-files --eol`; normalize accidental CRLF to LF with UTF-8 no BOM and restage before commit. | ACTIVE CHECK / DIFF HYGIENE |
| P32 | `sqlcmd -E` applied a guarded migration with `QUOTED_IDENTIFIER OFF` by default, so a filtered unique index failed with SQL Server error 1934 and the migration transaction rolled back. | For migrations containing filtered indexes, run `sqlcmd -E -I` (or explicitly `SET QUOTED_IDENTIFIER ON` outside the reviewed file); verify rollback state before reapplying and keep DDL verification semantic. | ACTIVE CHECK / MIGRATION |
| P33 | The generic deploy script stages `api/` and `web/` outside the monorepo `apps/*` workspace glob and flattens compiled API output to `api/src`, so root `npm install --production` installs no app dependencies and `dist/src/main.js` does not exist. | Install dependencies inside each staged app directory, copy `prisma/schema.prisma` + `prisma.config.ts` into `api/`, run `prisma generate` there, verify native modules, and set API `AppParameters=src/main.js`. | ACTIVE CHECK / DEPLOYMENT |
| P34 | Runtime API code imports `bcryptjs`, but it is declared only as a devDependency, so a production-only install starts with `MODULE_NOT_FOUND`. | Install the API's full dependency set in the staged app directory (or move the dependency in a separate reviewed task) and prove `/api/v1/health` before declaring deployment complete. | ACTIVE CHECK / DEPLOYMENT |
| P35 | A failed NSSM start left `ATsoftERP_API` in SERVICE_PAUSED; `Resume-Service`, `nssm stop`, and `nssm start` could not clear it because the service was still paused. | Use `sc.exe stop`, wait for `STATE ... STOPPED`, then `sc.exe start`; only restart the named ATSoft services and verify listener PIDs afterward. | ACTIVE CHECK / SERVICE CONTROL |
| P36 | PowerShell here-string patching of a JS proof script mangled a `\u0628\u062d\u062b` placeholder into literal `???` and made a later `locator.fill` time out. | Patch temp scripts with a quote-safe Node here-string, assert every anchor before replacement, and print the patched lines before rerunning. Never patch localized selectors through PowerShell string interpolation. | ACTIVE CHECK / PROOF SCRIPT HYGIENE |
| P37 | A raw-enum assertion read the whole Arabic page body while a dialog was open; background proof rows containing `GENERAL`/`CONSUMABLE` produced a false failure. The Arabic list search placeholder also differs from English. | Scope dialog assertions to `[role="dialog"]`. Use the locale's real placeholder (`Search` in EN, `بحث` in AR) or a data-testid; never assume one placeholder across locales. | ACTIVE CHECK / BROWSER SELECTORS |
| P38 | A general-issue "warehouse mismatch" proof used a same-tenant finished-goods warehouse; the native service correctly accepted it because general OUT allows any authorized same-tenant warehouse. | Prove warehouse rejection with a foreign-tenant warehouse id such as `cmrlaznjh0000uo951ro4q5e8`; assert `404 generalInventoryIssue.warehouseNotFound`. Do not treat same-tenant cross-type warehouses as a defect. | ACTIVE CHECK / TENANCY PROOF |
| P39 | `/inventory/issues/stock` rejected `sparePartId` as an unknown field and RAW_MATERIAL stock queries without the production order/run context. | Use the DTO contract: RAW_MATERIAL requires `productionOrderId` + `productionRunId`; do not send `sparePartId` to the unified stock endpoint. Read the DTO before writing runtime proof queries. | ACTIVE CHECK / API CONTRACT |
| P40 | A runtime proof POSTed a reversal with the literal translation key `inventory.issueVoucher.reverseNote` as its note, persisting a raw key even though the UI supplies localized text. | Direct API proof callers must send the localized value (EN: `Reversal of a posted issue voucher`; AR: `عكس إذن صرف مرحّل`) or omit notes. Assert the stored reversal note contains no raw key. | ACTIVE CHECK / I18N PROOF |
| P41 | Aborted runtime-proof runs left stale DRAFT/SUBMITTED/APPROVED issue documents and a temporary SUPER_ADMIN grant active after the passing run. | Before closeout, list `P5RUNTIME-` rows, cancel every non-POSTED document through its native endpoint (with `cancel-approval` first for APPROVED general issues), revoke the exact temporary `user_roles` row, and verify zero stale rows plus zero remaining grants. | ACTIVE CHECK / PROOF CLEANUP |
| P42 | Jest 29 with the checked-in `apps/api/jest.config.js` discovered 0 tests in a `.tmp` worktree path: `testMatch: C:/.../ATsofterp\.tmp/.../src/**/*.spec.ts - 0 matches`. | Before trusting a Jest run, execute `npx jest --listTests`; when the worktree path contains a dot that Jest escapes in `<rootDir>`, use explicit `npx jest --testMatch="**/*.spec.ts" --runInBand --testPathPattern=...` from `apps/api`. Do not change the repository Jest config for a worktree-only path quirk. | ACTIVE CHECK / TEST DISCOVERY |
| P43 | A fresh `.tmp` Phase 6 worktree had no local `node_modules`; Node resolved API deps from the parent repo, but `next` was absent from the parent install, so web typecheck and 37 web suites failed with `Cannot find module 'next/navigation'`. `npm install --offline` failed with `ENOTCACHED` for an unrelated transitive package and left no tracked changes. | For web validation in a fresh worktree, extract the cached `next@<locked version>` tarball directly into `<worktree>/node_modules/next` (`npm pack next@<version> --offline` + `tar -xzf --strip-components=1`), verify root-level `index.d.ts`/`navigation.d.ts`, then rerun web typecheck/tests. Treat missing-dependency failures as environment issues, not code regressions; never commit or stage `node_modules`. | ACTIVE CHECK / ENVIRONMENT |
| P44 | Writing a Phase 6 helper script to `C:\Users\attef\AppData\Local\Temp\opencode\transform-register.js` failed with `permission.rejected` / `external_directory`. | The approved external temp directory is not writable by this workspace tool sandbox. Write throwaway helper scripts inside the repository (for example `scripts/.tmp-transform-register.cjs`), run them, verify their output, then delete them before staging; never rely on the external temp path. | ACTIVE CHECK / TOOLING |
| P45 | A literal-only permission-seed scan reported `reports.operations:export` and `operational-cost-center:read` as unseeded even though real seed entry points import them from `*constants*` modules. | Seed keys are declared in three forms: literals in `prisma/seed/*.ts`, imported constants/permission modules, and the `MODULES x ACTIONS` generator. Reconstruct the seeded key set from all seed files plus every transitively imported `*constants*`/`*permission*` module and the matrix; keep the R4R allowlist empty and pin imported-constants keys with a regression test. | ACTIVE CHECK / PERMISSIONS |
| P46 | Running `npx jest --testMatch=...` from the repository root discovered specs but parsed them with Babel (`Missing semicolon` / `Missing initializer in const declaration`). | The root config has no ts-jest transform; `apps/api/jest.config.js` does. Run API Jest from `apps/api` with the explicit `--testMatch="**/*.spec.ts"` pattern; use the root only for test discovery when needed. | ACTIVE CHECK / TEST DISCOVERY |

| P47 | The deployed API failed at startup with `Cannot find module '../../../../prisma/seed/seed-overhead-allocation-permission-keys'` because the staged `api/prisma/seed` directory contained TypeScript sources while runtime imports require compiled JS. | Deploy the compiled seed modules from `apps/api/dist/prisma/seed` as `api/prisma/seed` (or guarantee a JS-resolvable equivalent), verify the expected JS file count, and prove API health plus a real authenticated permission read before declaring deployment complete. | ACTIVE CHECK / DEPLOYMENT |
| P48 | An audit-persistence probe failed with `Unknown field companyId for select statement on model AuditLog`; `AuditLog` has no direct tenant columns. | Inspect the Prisma model before querying. Read active company/branch from the JSON `details` payload and actor home scope from `user`; document that `/reports/audit` filters by actor home company/branch, so a SUPER_ADMIN export made under another active context may be persisted but not shown in that context-filtered report. | ACTIVE CHECK / AUDIT PROOF |
| P49 | Shell policy rejected recursive `Remove-Item` outside the workspace, so TypeScript seed sources could not be deleted from release/app directories after the compiled-JS swap. | Do not claim external cleanup. Rename retired source dirs to explicit `seed.ts-source-phase6` markers, document their locations, and use only explicit in-workspace `Remove-Item -LiteralPath` calls for in-repo throwaway helpers. | ACTIVE CHECK / DEPLOYMENT CLEANUP |
| P50 | `browser.network.list` intermittently returned `Expected JSON value` during same-origin proof runs. | Retry the network read once before treating it as a failure; corroborate request status with `fetch` from the page and with downloaded-file bytes/name. Never infer success from a missing network log alone. | ACTIVE CHECK / BROWSER PROOF |
| P51 | `browser.evaluate` with a top-level `return` threw `SyntaxError: Illegal return statement`; a download also appeared one call after the click event. | Wrap evaluate bodies in an IIFE (`(() => {...})()` / `(async () => {...})()`) and query downloads again after the action settles. Keep explicit tab IDs and never reuse element refs across tabs. | ACTIVE CHECK / BROWSER PROOF |

## 4. Related standing guards from Phase 2

These are not new scope; they prevent repeated scope confusion:

* Phase 2 covered only the unified **Receipt Voucher** UI (`إذن استلام` / `Receipt Voucher`). No Phase 3, unified Issue Voucher, global Excel program, `Product.quantity`, `Product.stock`, `SparePart.quantity`, or second receipt authority is implied.
* Stock posting authority remains `InventoryOperationalReceipt` for non-FG types and `ProductionFinishedGoodsReceipt` for `FINISHED_GOOD`.
* Canonical route is `/admin/inventory/receipts`; native deep links must still work.
* Frontend must not send company/branch. Backend derives and validates tenant/branch context.
* Page visibility is the union of native read permissions via `getUserPermissionSnapshot` OR semantics; no new umbrella permission.

## 5. Quick pre-flight checklist

Copy mentally at the start of every prompt:

- [ ] Read this register before inspecting or changing anything.
- [ ] Dialog/first-field scoped selectors, not global option counts.
- [ ] React fake timers + `act` + unmount in web tests.
- [ ] Pagination: `skip: 0` per authority, union `skip` once.
- [ ] No `_sum` in `findMany` `select`.
- [ ] Literal native endpoints; route-contract baseline known and unchanged.
- [ ] Clear `apps/web/.next` only on stale-cache error.
- [ ] Reviewed migration + sysadmin `sqlcmd -E` + `migrate resolve --applied` when `ALTER_PERM=0`.
- [ ] `Get-NetTCPConnection` + `Restart-Service` for listener conflicts.
- [ ] Same-origin `/api/v1` for browser proof.
- [ ] Scoped browser selectors; no same-label collisions.
- [ ] Restart API before repeating login proof.
- [ ] Regex env parsing; credentials `REDACTED`; never `[Uri]` on `DATABASE_URL`.
- [ ] Normalize Prisma `host:port` to `host,port` for `sqlcmd`; assert semantic `sqlcmd` output.
- [ ] Separate pre-existing failures from new failures.
- [ ] Before writing readings, verify Prisma `@map` matches the dated migration/DB column.
- [ ] Append new findings here and mention applied checks in the final report.
- [ ] All-types issue F9: union only authorized issue families inside active tenant/branch scope.
- [ ] Retry tests use real Prisma known-request errors with the intended Prisma error code.
- [ ] REVERSE postings in ACTIVE valuation warehouses use trusted original-cost evidence, not generic inbound valuation.
- [ ] User-visible reversal notes are localized in EN/AR; no hard-coded backend note.
- [ ] Added API message keys are referenced by real service/controller code.
- [ ] Staged new files pass `git diff --cached --check` and use repository LF line endings.
- [ ] Filtered-index migrations use `sqlcmd -I` (QUOTED_IDENTIFIER ON) and rollback state is verified before retry.
- [ ] Staged app dependencies, Prisma schema/config, generated client, native modules, and actual `AppParameters` path are verified before health checks.
- [ ] Full API dependency set is installed; runtime-only use of a devDependency is caught at startup.
- [ ] Paused NSSM services are cleared with `sc.exe stop` → STOPPED → `sc.exe start`.
- [ ] Temp script patches are quote-safe, anchor-asserted, and line-verified before rerun.
- [ ] Dialog assertions are scoped to `[role="dialog"]`; localized placeholders are used per locale.
- [ ] Warehouse-denial proofs use a foreign-tenant warehouse, not a same-tenant cross-type warehouse.
- [ ] Unified stock queries follow the DTO; RAW_MATERIAL includes order/run and `sparePartId` is never sent.
- [ ] Reversal proof notes are localized text, never a raw translation key.
- [ ] Stale proof documents and temporary privilege grants are removed and verified before closeout.

## 6. Append template for new problems

```md
| PXX | YYYY-MM-DD | Symptom observed | Root cause | Preventive check / exact command | Evidence / status |
```

Use `ACTIVE CHECK` until the preventive step is verified in a later task. Use `RESOLVED` only with a commit, test output, or runtime evidence reference.

## 7. Application log

| Date | Task | Checks applied | New entries |
| --- | --- | --- | --- |
| 2026-11-20 | Created this register and added `AGENTS.md` pointer | Documentation-only task; no code/build/runtime checks invoked | P01–P16 seeded from Phase 2 closeout |
| 2026-11-20 | Phase 3 browser-proof remediation | P01, P05, P06, P09, P10, P11, P12, P13, P16, P17, P18 applied; schema/migration alignment, `prisma validate`, `prisma generate`, focused Jest, API typecheck/build, same-origin API, env-only auth, guarded cleanup applied | P19 added for the pre-existing reading `createdAt` mapping drift; P20 added for env-derived JWT browser auth |
| 2026-11-20 | Phase 4 independent diff review remediation | P01, P02, P10, P16, P19 applied by reviewer; P21–P24 added and fixed with focused API tests and scoped Prisma assertions | P21 provenance-token title leak; P22 explicit linked-query tenant scope; P23 tenant-test quality; P24 instance-correct failure evidence |
| 2026-11-20 | Phase 4 browser-proof design inspection | P20, P21, P22, P24, P25 applied; canonical `create()` defaults `machineStopped=true`, so the derived-alert bridge now passes `machineStopped=false` and a test locks it | P25 added for implicit-downtime side-effect safety |
| 2026-11-20 | Phase 5 unified issue-voucher remediation | P01, P02, P05, P10, P16, P20, P22, P24 applied where relevant; scoped all-types warehouse eligibility, real Prisma P2034 error class, trusted ACTIVE-valuation reversal cost, localized reversal note, dead API keys removed, CRLF normalized. Focused API: 5 suites / 213 tests passed. Focused web: 3 suites / 78 tests passed. Full API: 238 suites / 5143 tests passed. Full web: 132 suites / 2486 tests passed. | P26–P31 added |
| 2026-11-20 | Phase 5 runtime migration deployment | P07, P12, P17, P18 applied; runtime user DDL denial confirmed, Windows-auth `sqlcmd` used with normalized `localhost,50079`, first attempt failed on filtered index because QUOTED_IDENTIFIER was OFF and rolled back; retry with `-I` verified 2 tables/2 checks/10 FKs/16+ indexes, `migrate resolve` and `migrate status` clean. | P32 added |
| 2026-11-20 | Phase 5 clean staged release deployment | P08, P33, P34, P35 applied; release `phase5-c812021a` built from isolated worktree, package SHA256 `d62f955f...`, deployed under `C:\ATsoftERP\App\phase5-c812021a`, API/web deps installed per app, Prisma client regenerated, native modules verified, NSSM repointed only to staged dirs, API/web health 200. | P33–P35 added |
| 2026-11-20 | Phase 5 final browser/runtime proof and closeout | P01, P02, P05, P07, P08, P09, P10, P12, P16, P17, P20, P26, P28, P29, P30, P32–P35 applied where relevant; quote-safe patching, scoped dialog selectors, locale-specific placeholder, foreign-tenant warehouse denial, correct stock DTO, localized reversal note, native stale-document cancellation, and exact-role privilege revocation applied. Final run `P5RUNTIME-20261120035032DD12` passed: 6 lookups, 6 native documents, stock 100→99→100, 10 expected denials, 8 console errors all tied to expected 4xx, 96 `net::ERR_ABORTED` RSC aborts, native UI approval, localized reversal, zero stale non-POSTED rows after cleanup, zero temporary SUPER_ADMIN grants. | P36–P41 added |
| 2026-11-21 | Phase 6 actor-aware audit coverage closeout (10 services) | P05 (routes unchanged), P12 (no secrets), P16 (pre-existing discovery quirk separated from test failures), P22/P23 (authoritative company/branch in audit details and tenant assertions), P30 (no new API message keys), P31 (`git diff --check`, `git ls-files --eol`, byte-level LF scan of new files), and P42 (explicit Jest `--testMatch` after 0-test discovery) applied. Focused Jest 16 suites/121 tests passed; audit sweep 21 suites/112 tests passed; API typecheck/build passed. | P42 added |
| 2026-11-21 | Phase 6 Excel/reports runtime closeout | P05 (route baseline unchanged: `MALFORMED=3`, `UNRESOLVED=3`, `MISMATCHES=0`), P12/P16 (no secrets; pre-existing baseline separated), P31 (LF/trailing-whitespace scan of new files), P42/P46 (explicit Jest from `apps/api` after root-config parse failure), P43 (web `next` dependency available), P44 (in-repo throwaway script), and P45 (full seed-key reconstruction with imported constants) applied. Focused Excel/report 6 suites/75 tests passed; full API 258 suites/5251 tests passed; full web 133 suites/2496 tests passed; API/web typechecks and builds, i18n (7640 EN/AR keys), UI baseline, and credentials checks passed. | P44–P46 added |
| 2026-11-21 | Phase 6 deployment, permission seed, browser/RBAC/audit proof, and final closeout | P05/P12/P16 (route baseline unchanged, credentials redacted, pre-existing findings separated), P08/P35 (only named ATSoft services restarted and listeners/health verified), P09 (same-origin `/api/v1` browser fetches), P10/P37 (scoped locale-aware selectors), P20 (env-only token helpers, no printed secrets), P31 (LF/trailing-whitespace checks), P33/P34 (per-app staged dependencies verified), P42/P46 (explicit Jest from `apps/api`), P44 (in-repo throwaway helpers then explicit deletion), P45 (61/61/61 runtime permission parity), P47 (compiled seed JS swap), P48 (`AuditLog.details` scope and actor-home visibility caveat), P49 (external cleanup rejection documented), P50/P51 (browser network retry and IIFE evaluate) applied. Focused permission parity 1 suite/8 tests passed. Deployment at `8c62740f` verified with corrected artifact SHA256 `784b1ab8...`; EN/AR report and governance XLSX downloads, allow/deny/tenant-spoof probes, 4 actor-scoped export audits, zero Excel bypass/movement/actorless rows, and 61/61/61 permission parity recorded. | P47–P51 added |

## Personnel Phase 1 preventive checks — 2026-11-20

| ID | Problem / symptom | Preventive check | Status |
| --- | --- | --- | --- |
| PERSONNEL-P1-01 | Local sqlcmd 11/17 reported an encryption/SSPI handshake failure inside the restricted shell although Prisma connected. | Use the installed ODBC 17 sqlcmd with Windows authentication and -C in the authorized elevated shell; verify sysadmin and backup metadata before clone operations. Do not change server encryption or expose credentials. | ACTIVE CHECK |
| PERSONNEL-P1-02 | Class-transformed transfer DTOs contain explicit undefined optional fields, so spreading the DTO over the current assignment removed branchId and rejected a valid transfer. | Resolve branchId explicitly from dto.branchId, current.branchId, then active context before reference validation; regression test must include branchId: undefined and a branch-owned target department. | ACTIVE CHECK |
| PERSONNEL-P1-03 | Changing a shared assignment list to current rows also truncated a person history consumer and could hide non-primary assignments from F9 supervision selection. | Keep all current types available to generic consumers; main placement table explicitly requests PRIMARY. Person history must call the dedicated person-history endpoint, and browser proof must verify all historical rows. | ACTIVE CHECK |
| PERSONNEL-P1-04 | Clone reconciliation using thousands of IDs exceeded SQL Server's parameter limit. | Read baseline IDs in bounded pages and reconcile in batches of 500; never replace preservation checks with an unbounded IN list. | ACTIVE CHECK |
| PERSONNEL-P1-05 | Browser native favicon requests produce a console 404 without appearing in Playwright page response events. | Record console message.location() and classify the exact pre-existing /favicon.ico separately; continue to fail unexpected JavaScript errors or failed required API calls. Do not claim zero console errors when the favicon is missing. | ACTIVE CHECK |

Applied: P01, P02, P05, P09, P10, P12, P16, P17, P20, P22, P23, P31, P36, P37, P41 and the five personnel checks above. No production writes, migrations, service restart or deployment in Phase 1. Proof and fixtures use a verified COPY_ONLY backup restored as a distinct clone.

Additional Phase 1 proof findings (2026-11-21):

| ID | Problem / symptom | Preventive check | Status |
| --- | --- | --- | --- |
| PERSONNEL-P1-06 | Loading development NODE_ENV into an isolated Next production build produced the /404 Html prerender error; a relative default upload root escaped the temporary worktree during API initialization. | Set NODE_ENV=production for the build process and UPLOAD_ROOT to an explicit test-results directory for isolated API proof. Keep Nest startup errors visible and do not edit environment files or application paths. | ACTIVE CHECK |
| PERSONNEL-P1-07 | The unified registration form referenced validation.requiredField, but that key belongs to the complexForms namespace; live validation showed a generic missing-text fallback. | Use the existing validation.required key. Browser proof must reject the missing-text fallback in both EN/LTR and AR/RTL rather than relying only on dictionary parity. | ACTIVE CHECK |

Additional permission finding (2026-11-21):

| ID | Problem / symptom | Preventive check | Status |
| --- | --- | --- | --- |
| PERSONNEL-P1-08 | A legacy create alias delegated to a canonical service whose person-create permission was assumed to have been enforced by its original controller. | Every delegating create route must declare all required identity, placement and maintenance permissions; hide its registration action unless all are granted. Verify a normal actor with maintenance+placement permissions but without person-create receives 403 and creates no person. | ACTIVE CHECK |

Additional proof-run integrity finding (2026-11-21):

| ID | Problem / symptom | Preventive check | Status |
| --- | --- | --- | --- |
| PERSONNEL-P1-09 | The disposable same-origin proof proxy attempted writeHead after a downstream response had already sent headers during shutdown; the process exited before recording cleanup and left the previous PASS report on disk. | Guard destroyed/ended/headersSent responses, record transport errors, persist RUNNING at start with run ID and script SHA256, always persist cleanup outcome, and verify fresh PASS against the current script hash. Revoke only exact fixture grants in the explicitly named proof clone after any interrupted run. | ACTIVE CHECK |

## Personnel Phase 2 preventive check — 2026-11-22

| ID | Problem / symptom | Preventive check | Status |
| --- | --- | --- | --- |
| PERSONNEL-P2-01 | A browser assertion sampled the original row background immediately after hover while transition-colors was still running. | Wait for the expected computed background color to settle before asserting hover, selection or theme changes. Keep real transitions enabled; do not weaken the expected color or substitute a class-name assertion for rendered CSS. | ACTIVE CHECK |

Applied: P01, P02, P05, P09, P10, P12, P16, P20, P22, P23, P31, P36, P37, P41–P46, P48 and PERSONNEL-P1-01, 04, 05, 06, 08, 09. Preserved P01–P51 and all Phase 1 findings. Phase 2 has no schema migration, production data writes, deployment or service restart. Browser proof runs against an independent verified SQL Server clone.

## Personnel Phases 3–4 preventive checks — 2026-11-22

| ID | Problem / symptom | Preventive check | Status |
| --- | --- | --- | --- |
| PERSONNEL-P34-01 | An interrupted script write left no browser-proof file, so a later session could mistake a prior PASS report for current evidence. | Verify the proof script exists with `-LiteralPath`, persist RUNNING state with run ID and script SHA256 before execution, and accept only a fresh PASS whose hash matches the executed file. | ACTIVE CHECK |
| PERSONNEL-P34-02 | Per-locale browser helpers that each start and stop their own proxy/web/browser closed the infrastructure before the legacy check and overwrote earlier locale evidence. | Start one same-origin proxy/web/browser lifecycle per proof phase, keep locale reports in an append-only array, and stop infrastructure in an outer `finally`. | ACTIVE CHECK |
| PERSONNEL-P34-03 | The F9 modal and parent form share `div.fixed.inset-0.z-50`; waiting for the last matching modal to hide never succeeds because the parent remains visible. | Wait for the F9 search input to detach after row selection, not for a generic overlay class to disappear. Keep selectors scoped to the field container and modal. | ACTIVE CHECK |
| PERSONNEL-P34-04 | `AuditLog.details` stores JSON as a string; `JSON.stringify(details)` double-escapes keys and falsely fails field assertions. | Parse string audit details before asserting concrete fields such as `companyId`, `branchId` and `partsCount`; never assert against a double-stringified blob. | ACTIVE CHECK |
| PERSONNEL-P34-05 | Work-order update derives `title` from a submitted `description`; editing only `title` through the UI is overwritten and looks like a failed save. | Browser edit proof must mutate the authoritative description field, assert the PATCH response, reload the same record, and verify the derived title plus database state. | ACTIVE CHECK |
| PERSONNEL-P34-06 | A tenant-spoof body is rejected as 403 context mismatch, not 400 validation, and aborted GET lookups are normal UI navigation noise. | Expect the stable 403 denial contract and classify only `net::ERR_ABORTED` GET lookups as non-operational; still fail unexpected console errors and failed API responses. | ACTIVE CHECK |

Applied: P01, P02, P05, P09, P10, P12, P16, P20, P22, P23, P24, P31, P36, P37, P44, P48, PERSONNEL-P1-05, 06, 09, PERSONNEL-P2-01 and PERSONNEL-P34-01–06. Phase 3/4 proof used a distinct disposable clone, zero source writes, exact temporary-grant revocation, actor deactivation, preserved baseline rows, fresh PASS report, and ten screenshots.

## Personnel Phases 7–8 preventive checks — 2026-11-22

| ID | Problem / symptom | Preventive check | Status |
| --- | --- | --- | --- |
| PERSONNEL-P78-01 | The checklist editor retire handler filtered persisted rows out and kept unsaved rows, so the retired-items section never appeared although the backend soft-retired correctly. | Retain persisted rows with `retired: true` and drop only unsaved rows (`row.key !== key || !!row.id`); add a static regression guard and prove the retired section in the browser for both locales. | ACTIVE CHECK |
| PERSONNEL-P78-02 | Phase 8 execution proof assumed one item payload shape, queried item audit rows by execution id, and treated app-shell 403s as application failures. | Build item payloads from `resultTypeSnapshot` (NUMBER/READING need `resultValue`), query audit by execution AND item entity ids, and grant only disposable-clone fixture permissions for notifications/appearance before demanding zero 4xx. | ACTIVE CHECK |
| PERSONNEL-P78-03 | Prisma CLI in the external integration worktree needs an explicit DATABASE_URL while the main .env points at a different database. | Export the authorized disposable-clone URL in the command environment and print no credentials; run format/validate/generate from the worktree with that env. | ACTIVE CHECK |

Applied: P01, P02, P05, P09, P10, P12, P16, P17, P20, P22, P23, P26, PERSONNEL-P1-04, 05 and PERSONNEL-P34-01, 04, 06, plus the three new P78 checks. Phase 7/8 proof used a distinct disposable clone, two additive reviewed migrations, no production migration, fresh PASS evidence for browser/API/reconciliation, and zero historical-row loss.
