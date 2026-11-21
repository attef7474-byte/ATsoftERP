# Cross-Prompt Inspection Pitfalls Register
Status: ACTIVE — permanent, applies to every prompt/session  
Last updated: 2026-11-20  
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
