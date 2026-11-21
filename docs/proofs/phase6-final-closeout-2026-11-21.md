# STRICT Phase 6 Final Closeout — 2026-11-21

## 1. Final decision

| Area | Status |
| --- | --- |
| Phase 6 implementation | COMPLETE |
| Deployment | COMPLETE |
| Runtime permission seed | COMPLETE |
| Excel eligibility gate | COMPLETE |
| Canonical report/export gate | COMPLETE |
| RBAC allow/deny proof | COMPLETE |
| Tenant-spoof rejection proof | COMPLETE |
| Arabic RTL / English LTR browser proof | COMPLETE |
| Audit persistence proof | COMPLETE |
| Runtime reconciliation | COMPLETE |
| Deferred canonical-fact consolidation | DEFERRED — outside Phase 6 |
| Parallel Personnel/Maintenance scope | UNTOUCHED |
| Phase 7 implementation | NOT STARTED |

## 2. Authority and reference order

This closeout follows `docs/architecture/atsoft-erp-engineering-constitution-v1.0.md`, the relevant domain rule files, `docs/architecture/atsoft-erp-development-contract-v1.0.md`, the UI/i18n baseline protection documents, `AGENTS.md`, and `docs/governance/inspection-pitfalls-register.md`. Previous discovery reports were treated as aids only; current code and runtime evidence are authoritative.

## 3. Approved scope

Phase 6 completed real eligible Excel coverage, canonical report XLSX wiring, actor-aware audit events, stable seeded governance permissions, production deployment, live permission seeding, and real browser proof. One Excel infrastructure was extended; no competing importer/exporter framework was introduced.

## 4. Scope exclusions

The parallel Personnel/Maintenance scope was not modified. Excel coverage rows 104–105 remain explicitly deferred to that parallel owner and are excluded from the eligible GAP count. Finance, Sales, Purchasing, HR payroll, AI, IoT, BI, forecasting, and other unapproved domains were not started. Phase 7 was not started.

## 5. Starting Git baseline

Before the final proof batch, the worktree was on `feat/governance-excel-reports-phase-6` at `8c62740f3c95890a9daa99c93bf32aa5efe80026`. `HEAD`, `main`, `origin/main`, and the feature branch remote were all at that exact SHA. The only untracked files were the six Phase 6 throwaway helpers, which were later deleted before staging.

## 6. Logical commit sequence

1. `86625174` — `fix(auth): seed governance permission keys`
2. `7d4c7e31` — `feat(audit): record actor-aware business audit events`
3. `9c3a5723` — `feat(reports): wire canonical audited XLSX exports`
4. `c1dd185f` — `feat(excel): add governed export-only domain adapters`
5. `8c62740f` — `docs(governance): record Phase 6 closure gates`

## 7. Final source identity

All feature work, merge, and post-merge validation converged on commit `8c62740f3c95890a9daa99c93bf32aa5efe80026`. No commit was rewritten, amended, force-pushed, reset, or cleaned.

## 8. Post-merge gates

Before deployment, post-merge gates passed: focused 7 suites / 83 tests, API 258 suites / 5,251 tests, Web 133 suites / 2,496 tests, API and Web typechecks, API and Web builds, i18n key consistency, UI baseline, credentials check, and `git diff --check`.

## 9. Publication state

`main`, `origin/main`, and `origin/feat/governance-excel-reports-phase-6` were verified at `8c62740f3c95890a9daa99c93bf32aa5efe80026`. No merge occurred before the required gates passed. No tag was created or requested.

## 10. Release artifact

Release staged at `C:\ATsoftERP\Releases\phase6-8c62740f`; package at `C:\ATsoftERP\Releases\atsoft-erp-phase6-8c62740f.zip`; size 133.28 MB; authoritative SHA256 `784b1ab8afa41050157562c413e74aefaf0d97fcfe9c39e566f2f8f7e62dcf32`.

## 11. Artifact hash correction

The initial hash `6e2773a2d7ff5e611e2002b125a1a755c127c9bb74ee500b4b80874085446938` was superseded after the compiled-seed correction. The corrected manifest is `C:\ATsoftERP\Releases\atsoft-erp-phase6-8c62740f.zip.manifest.json`. The corrected hash is the only authoritative release hash.

## 12. Rollback point

The pre-deploy backup is `C:\ATsoftERP\App\_rollback\phase6-predeploy-20261121-225919`. The previous live release `C:\ATsoftERP\App\phase5-c812021a` was retained. No database reset, truncation, deletion, or destructive migration was performed.

## 13. Deployment method

Deployment used the reviewed Phase 5-style artifact swap/rename procedure. The generic `deploy-local-windows.ps1` was not used because it stages outside the workspace globs and flattens compiled API output incorrectly.

## 14. Deployed services scope

Only `ATsoftERP_API` and `ATsoftERP_Web` were stopped for the swap. `ATsoftERP_Caddy` stayed Running. No unrelated service or process was killed.

## 15. Deployed identity readback

Runtime readback confirmed commit `8c62740f3c95890a9daa99c93bf32aa5efe80026` and Web `BUILD_ID=NQISavjyFU9fpF-SCxeHz`. Runtime `.env` and native dependencies were intact; credential values were not printed.

## 16. Seed-module correction

The first API startup failed because staged `api/prisma/seed` held TypeScript sources while runtime imports require JS. The release and live directories were corrected to compiled `apps/api/dist/prisma/seed` JS output (75 JS files). API startup then succeeded.

## 17. Service state

Final states were `ATsoftERP_API=Running`, `ATsoftERP_Web=Running`, and `ATsoftERP_Caddy=Running`. Listener and service checks were performed after restart.

## 18. Health proof

`http://localhost:4000/api/v1/health` returned 200, `http://localhost:3000` returned 200, and `https://dell/api/v1/health` returned 200. Caddy was checked separately; browser proof used the Next-origin same-origin `/api/v1` path.

## 19. Migration status

Read-only `prisma migrate status` reported `100 migrations found` and `Database schema is up to date!`. Only `DATABASE_URL` was injected from the deployed env; no credentials were printed and no migration was changed.

## 20. Database models and migrations changed in proof batch

No Prisma model, schema, migration, seed declaration, or database structure was changed in this final proof batch. The Phase 6 feature commits used the existing `AuditLog.details` JSON for tenant/actor metadata rather than adding tenant columns.

## 21. Runtime permission declaration

The 61 governance permissions are declared in `apps/api/prisma/seed/seed-phase6-governance-permission-keys.ts` and wired into `apps/api/prisma/seed/seed.ts`. Existing permission keys were searched first; no synonym-only duplicate was introduced.

## 22. Runtime seed execution

The first runtime seed created 61 permissions and 61 SUPER_ADMIN grants. The idempotency re-run created `permissionsCreated: 0` and `grantsCreatedNow: 0`, with `grantsTotalForPhase6Keys: 61`.

## 23. Runtime permission totals

Admin-visible permissions rose from 767 to 828, exactly matching the 61 added keys. Runtime parity is `expected=61`, `present=61`, `grants=61`, with an empty R4R allowlist and zero unexpected enforced-but-unseeded keys.

## 24. Focused permission regression

After runtime seeding, `npx jest --testMatch="**/*.spec.ts" --runInBand --silent --testPathPattern=r4r-permission-seed-contract` from `apps/api` passed: 1 suite, 8 tests.

## 25. Excel deterministic gate

`docs/governance/EXCEL_COVERAGE_REGISTER.md` reports `TOTAL ROWS: 105`, `BY CLASS: {"D":22,"M":38,"P":43,"X":2}`, `BY STATUS: {"EXPORT_ONLY_COMPLETE":78,"COVERED":25,"DEFERRED_TO_PARALLEL_PERSONNEL_MAINTENANCE_AGENT":2}`, and `UNRESOLVED ELIGIBLE (GAP): 0`. The row-level total 78 is authoritative; the earlier prose value 65 was an arithmetic error.

## 26. Excel GAP breakdown

Eligible gaps were 34 M, 22 D, 18 P operational/audit/notification, and 4 unwired report rows. They were closed by 74 read-only governance export adapters plus canonical report wiring. Twenty-five pre-existing real XLSX pages were preserved.

## 27. Excel implementation shape

One existing Excel infrastructure was extended with many domain adapters. Generic export adapters are backed by real Prisma models for `EXPORT_ONLY_COMPLETE`; import adapters remain domain-specific. No second competing framework was created.

## 28. Import safety

No fake importer, button, or endpoint was added. No Excel path can create POSTED records, approve, post inventory or production, bypass maintenance workflow, or set `companyId`, `branchId`, approval/posting actor, or status above DRAFT. Numbering remains in canonical `NumberingService`. Relationship resolution uses business keys with 0 or more-than-1 matches treated as errors.

## 29. API endpoints added or changed

No new controller route was created for the 74 governance adapters; they are served through the existing governed export infrastructure. Four previously unwired report pages were connected to the canonical audited XLSX endpoint: `maintenance/overview`, `maintenance/kpi-overview`, `inventory/overview`, and `operations/overview`. The production analytics export page was preserved.

## 30. Frontend routes added or changed

No new frontend route was added. Existing report pages and the shared Excel governance export action were wired to real backend XLSX endpoints. The canonical permissions page was used for governance export proof in both locales.

## 31. Report coverage

`docs/governance/REPORT_COVERAGE_REGISTER.md` distinguishes 41 core canonical report GETs, 99 extended report/report-like data endpoints, 101 total including exports, and 26 web report pages. All 41 core reports have real backend export; exports are bounded to 5,000 rows, formula-safe, tenant-scoped, and audited.

## 32. Canonical report gate

The report gate is `RESOLVED_EXPORT_GATE`. Report data-authority defects D8–D11, D16–D21, and D31 remain documented deferrals; they are not silently hidden or represented as Phase 6 completions.

## 33. Route contract baseline

Route contract baseline remained unchanged: `BACKENDROUTES=1250`, `FRONTENDCALLSITES=1103`, `MATCHED=1204`, `MALFORMED=3`, `UNRESOLVED=3`, `MISMATCHES=0`, exit `1`. This is a documented pre-existing condition, not a new failure.

## 34. Audit architecture

Audit remained a single unit: `AuditLog` / `AuditService`. Actor-aware business audit writes include company, branch, entity, action, timestamp, and reason in serialized `details`; sensitive values are redacted; transactional paths are preserved.

## 35. Audit persistence proof

Four export-like audit rows were created after deployment: two `EXPORT` and two `EXCEL_EXPORT`. All four have a user actor and active company/branch details. Live totals include `EXPORT: 10`, `EXCEL_EXPORT: 2`, `EXCEL_IMPORT: 6`; actorless export-like count is 0.

## 36. Audit visibility limitation

`AuditLog` has no direct tenant columns. `/reports/audit` filters by actor home company/branch through the user relation, so a SUPER_ADMIN export made under a different active context can be persisted in DB but not shown in that context-filtered report. Database persistence is the authoritative proof here.

## 37. Runtime reconciliation window

The reconciliation window started at `2026-11-21T19:50:00.000Z` and covered deployment, runtime seed, browser proof, and export audit activity. The DB connection used an injected `DATABASE_URL`; credentials were not printed.

## 38. Movement integrity sentinel

Since the window: inventory movements created `0`, duplicate movement numbers `0`, duplicate request scopes `0`, and Excel-source movements `0`. No inventory, production, or workflow posting occurred during proof.

## 39. Excel bypass sentinel

Since the window: `EXCEL_IMPORT` audits `0` and Excel-source inventory movements `0`. The browser proof exercised exports only; it did not create DRAFT or any higher-status operational records through Excel.

## 40. Actorless mutation sentinel

Since the window: actorless critical audit rows `0` and actorless audit rows of any action `0`. Checked critical actions included create, update, delete, approval, posting, issue, return, export, import, and status transition families.

## 41. Export scope sentinel

Four export audit rows were found in the window. All had an actor and an authorized active scope; missing scope `0`, outside-authorized scope `0`, and without-actor `0`.

## 42. Permission parity sentinel

Runtime reconciliation independently confirmed 61 expected Phase 6 keys, 61 present keys, and 61 SUPER_ADMIN grants. This matches the runtime seed proof and the focused contract test.

## 43. Browser proof origin

Browser proof used `http://localhost:3000` with same-origin `/api/v1/:path*` rewrites to the API. No permissive CORS change was made. Temporary env-only token servers were stopped and ports `4599`, `4600`, and `4601` were verified closed.

## 44. English LTR report proof

On `/admin/reports/inventory`, `dir=ltr`, the `Export XLSX` action called `GET /api/v1/reports/export/excel/inventory/overview` and returned 200. Download: `Inventory Overview_2026-11-21.xlsx`, 7,416 bytes, XLSX magic `50 4B 03 04`, no raw-key candidates, no console errors, no HTTP failures.

## 45. Arabic RTL report proof

On `/admin/reports/inventory`, `dir=rtl`, the `تصدير XLSX` action called the same canonical endpoint and returned 200. Download: `نظرة عامة على المخزون_2026-11-21.xlsx`, 7,416 bytes, XLSX magic `50 4B 03 04`, no raw-key candidates or failures.

## 46. English LTR governance Excel proof

On `/admin/access/permissions`, `dir=ltr`, `Export search results` called `GET /api/v1/master-data-excel/permissions/export?locale=en` and returned 200. Download: `permissions-export.xlsx`, 33,595 bytes. Visible permissions total was 828.

## 47. Arabic RTL governance Excel proof

On `/admin/access/permissions`, `dir=rtl`, `تصدير نتائج البحث` called `GET /api/v1/master-data-excel/permissions/export?locale=ar` and returned 200. Download: `permissions-export.xlsx`, 33,800 bytes. No raw-key candidates or failures.

## 48. RBAC allow and deny proof

SUPER_ADMIN saw and successfully used both export surfaces. Restricted user `cmrvc41md0000ys95gy4pegey` (`E2E_ROLE`, `CAPACITY_APPROVER`) saw no governance export button; both export APIs returned 403 with `messageKey: auth.insufficientPermissions` even with correct active-context headers.

## 49. Tenant-spoof proof

The restricted user with foreign active-company/branch headers received 403 `operationalContext.notAllowed` on Excel export and 403 `auth.insufficientPermissions` on report export. The authorized SUPER_ADMIN context returned 200 with real XLSX bytes for the same report. Frontend hiding was not treated as enforcement.

## 50. Browser proof hygiene

`browser.network.list` parse errors were retried and corroborated with same-origin fetch results plus downloaded bytes. `browser.evaluate` used IIFEs. Downloads were rechecked after actions settled. Element refs were not reused across tabs. No token, password, or JWT value was recorded.

## 51. Focused test results

Pre-deployment focused batch: 7 suites / 83 tests passed. Post-runtime-seed permission parity: 1 suite / 8 tests passed. Focused Excel/report evidence is retained in the committed registers and specs; no test was skipped, deleted, or weakened.

## 52. Full regression results

After merge: API 258 suites / 5,251 tests passed. Web 133 suites / 2,496 tests passed. Full results were reported separately from pre-existing route-contract and seed-history findings.

## 53. Typecheck and build results

API typecheck passed, API build passed, Web typecheck passed, and Web build passed. The deployed Web build ID was read back as `NQISavjyFU9fpF-SCxeHz`.

## 54. i18n and UI baseline

i18n consistency passed with 7,640 English keys and 7,640 Arabic keys. `npm run ui-baseline:check` passed. Arabic RTL and English LTR were proven in the browser on both export surfaces. No raw translation key appeared in user-facing proof pages.

## 55. Credentials and diff checks

No secret, connection string, JWT, API key, SMTP password, or token was printed or committed; all such references are `REDACTED`. `git diff --check` passed for tracked changes and `git diff --cached --check` was run on the documentation commit before push.

## 56. Throwaway cleanup

Six in-repo throwaway helpers were deleted explicitly: audit probe, three browser token helpers, RBAC probe, and runtime reconciliation probe. Final `git status --short --branch` showed no untracked throwaway helper before the documentation commit.

## 57. Known limitations

The audit report view can omit persisted export rows when the active export context differs from the actor home context. Two inert `seed.ts-source-phase6` directories remain outside the workspace because recursive external cleanup was rejected. Report data-authority deferrals D8–D11, D16–D21, and D31 remain outside Phase 6. Rows 104–105 remain parallel-owner deferrals.

## 58. Pre-existing issues encountered

Pre-existing route-contract baseline findings (`MALFORMED=3`, `UNRESOLVED=3`, exit `1`) remain. Standalone seed history previously left the production DB behind the static catalogue before the approved Phase 6 seed. Those items were reported separately and were not fixed by unrelated refactoring.

## 59. Runtime proof status by required category

Create/read/edit same operational record: NOT_APPLICABLE — Phase 6 runtime proof intentionally performed exports only and no operational record mutation. Status transition: NOT_APPLICABLE — no workflow transition was executed. Inventory/cost effect: NOT_APPLICABLE — zero movements and zero postings were proven. Permission denial: COMPLETE. Tenant denial: COMPLETE. Audit event: COMPLETE. Arabic/English: COMPLETE. Error handling: COMPLETE. Duplicate submission: NOT_APPLICABLE — no submit endpoint was exercised; export duplicate protection is enforced by disabled buttons and backend read-only behavior.

## 60. Definition-of-done reconciliation

Existing implementation was inspected; no duplicate domain was created; no data-destructive schema action occurred; tenant and branch scope are enforced in backend exports; permissions are defined, seeded, granted, enforced, used in UI, translated, and tested; audits persist with actor and active scope; frontend uses real APIs; both locales and directions work; tests and builds pass; browser and runtime proof are recorded; unrelated modules were not changed.

## 61. Final closeout and Phase 7 gate

All Phase 6 gates are closed with evidence in this proof package and the committed governance registers. The documentation proof commit was created and pushed under controlled staging; no tag was created. Phase 7 was not started and requires its own explicit approval and task contract.

PHASE 6 CLOSED — COMPLETE
PHASE_7_READY=YES
