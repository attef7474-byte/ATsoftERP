# PHASE 2 — FINAL PRODUCTION DEPLOYMENT & COMPLETE CLOSEOUT REPORT

Client date: **2026-11-17 — Asia/Aden**. Deployment 2026-11-17T02:17:31.8165943+03:00.

## 1. Final Decision

**LEGACY_RECOVERED_WORK_PRODUCTION_DEPLOYED_WITH_MANUAL_GATES_NOT_VERIFIED**. The authorized recovered source is deployed and technically verified. Authenticated Employee validation/save, real-device login and native print gates are honestly NOT_VERIFIED. No new development or source repair was required.

## 2. Starting Git State

Client date 2026-11-17, Asia/Aden. main clean; HEAD = origin/main = `b42ce7e15ee637b4c7691a30f10eb5acc64fbb52`; ahead/behind 0/0. Fetch repeated immediately before deployment confirmed no advancement. Two retained worktrees and one Docker WIP stash.

## 3. Release SHA

`b42ce7e15ee637b4c7691a30f10eb5acc64fbb52`. Clean detached temporary worktree built/tested this exact commit. Artifact provenance is not inferred from the final documentation commit.

## 4. Source Included

Existing Unified Print release c4bc7484, recovered Employee repair 01db7006, Mobile repair 1a65a651, historical Production proof and reconciliation documentation. Documentation commits add no runtime feature.

## 5. Source Excluded

Docker stash, real local environment files, uncommitted/ignored source, old build artifacts and historical .tmp contents excluded from clean source checkout. Only existing dependency junctions were attached for validation/build; no npm installation or dependency change. No new endpoint, route, permission, schema, workflow or print feature.

## 6. Docker Stash State

UNCHANGED: stash@{0} = `7af3a0e7d9d088063aefad72740f203f448c1595`. Count 1. No apply/pop/drop/commit/deploy.

## 7. Schema / Migration

PRISMA_SCHEMA_CHANGE = NONE; MIGRATION = NONE; PRODUCTION_MIGRATION = NONE. Compared apps/api/prisma between previously deployed c4bc7484 and release SHA. No migrate, db push, SQL/seed or Prisma-generation command was executed.

## 8. Permissions

PERMISSION_DELTA = 0. No role, user, grant, tenant or branch assignment changes. Controller/permission configuration was not changed by this deployment. Existing guards remain in place.

## 9. Fresh API Tests

219 suites / 4735 tests PASS; zero failed/pending tests. Executed from clean committed release source, not historical evidence.

## 10. Fresh Web Tests

123 suites / 2322 tests PASS; zero failed/pending tests. Exact release source.

## 11. Employee Focused Tests

API: 2 suites / 59 tests PASS. Web: 2 suites / 77 tests PASS. Combined 4 suites / 136 tests. DTO/name/email/date validation, nested visible errors, duplicate-login feedback, branch defaults/enforcement, preserved input and duplicate-submit protection covered. Initial API harness found no tests because Jest 29 produced a malformed Windows rootDir glob under .tmp; normalized only the CLI spec glob while preserving API src roots and all assertions. Final focused/full gates ran all expected suites. No application config/test weakening.

## 12. Mobile Focused Tests

1 suites / 16 tests PASS. Same-origin HTTP/LAN/HTTPS base, actual fixed rewrite, bearer transport, session restore, Login/AuthProvider navigation and network/application errors.

## 13. Print Regression

36 suites / 352 tests PASS: 35 print-named suites (336) plus Ledger filter-contract suite (16). Includes shared runtime, Ledger REGISTER, Movements REGISTER, inventory/maintenance DOCUMENT and REPORT adapters. No print source change.

## 14. Typecheck

Fresh API and Web tsc --noEmit --incremental false PASS from clean release source.

## 15. Production Build

API established build (tsc): PASS, 4552 artifact files. Web established next build: PASS; 304 app routes, 194/194 static pages. No real .env copied to build checkout. Non-blocking existing warnings: workspace-root inference with nested lockfiles, webpack cache snapshot, absent ESLint config, Windows EPERM copying standalone traced dependency. The isolated standalone package is not certified as a standalone deployment; Production retains the established next-start runtime and its normal installed dependencies, verified by live health and exact artifact hashes. No new fatal build warning ignored.

## 16. Build ID

New `zhi2M_t92U9wYNXsYhdj4`; previous `pq83D9HcJWQzLNXiKbKhe`.

## 17. i18n / UI / Route / Credentials

Fresh gates PASS: 7069 EN / 7069 AR synchronized; raw-key, UI-baseline and permission-UI checks PASS; route contract 1185 backend routes / 1167 matched, 0 malformed/unresolved/mismatched; tracked-text credentials guard PASS; git diff --check PASS.

## 18. Secret Scan

RELEASE_SECRET_SCAN = PASS within recorded scope: fresh tracked-text credential guard, clean committed checkout, no local real env/session copied, and built-artifact forbidden env/token/session/private-certificate filename scan (0 findings). Existing dependency directories were linked, not treated as fresh source. No credentials/passwords/private certificates submitted or published. This is not a claim of exhaustive binary entropy scanning.

## 19. Previous Production Version

Clean print release c4bc74841f2abc6c4da8fee65c6187a1eebdf597, Web BUILD_ID `pq83D9HcJWQzLNXiKbKhe`. NSSM API/Web/Caddy identities, process IDs, ports and log offsets captured before swap. Employee/Mobile repairs were absent from that clean prior artifact, despite their historical 2026-11-10 deployment.

## 20. Rollback Point

ROLLBACK_POINT_AVAILABLE = PASS. Verified byte/hash copies at .tmp/final-production-deployment-20261117/rollback/{api-dist,web-next}; web-next: 4462 entries / 867524241 bytes; api-dist: 4549 entries / 18848014 bytes. Original live artifacts also retained by directory move at previous-api-dist / previous-web-next in the same evidence directory. Manifests match. All older rollback/backup points preserved. Restore uses the reviewed deploy.ps1 -Rollback artifact swap and service restart, without any DB operation; failed new artifacts are moved aside, not deleted.

## 21. Deployment Method

Established Windows NSSM mechanism: elevated stop of ATsoftERP_API and ATsoftERP_Web, validated absolute paths under approved workspace, directory swap of API dist and Web .next, then service restart. No Docker, architecture change, environment edit or Caddy change. Script has automatic artifact rollback on swap/start failure.

## 22. API Deployment

PASS. New clean API dist installed; service Running; port 4000 listening; fresh Nest startup and listening markers; health 200.

## 23. Web Deployment

PASS. New .next installed; service Running; port 3000 listening; fresh readiness marker; Web/static assets 200; served BUILD_ID `zhi2M_t92U9wYNXsYhdj4`.

## 24. Caddy / Proxy

PASS. Existing Caddy config SHA256 and service process unchanged. https://dell/login returns 200 with new build; protected HTTPS API returns 401. Windows default certificate validation used; no TLS bypass.

## 25. Production Health

| Service | Service-wrapper PID | State | Listening child PID / port |
| --- | --- | --- | --- |
| ATsoftERP_API | 44512 | Running | 16884 / 4000 |
| ATsoftERP_Caddy | 6140 | Running | Existing proxy service; not restarted |
| ATsoftERP_Web | 17096 | Running | 2940 / 3000 |

Anonymous GET route shells, API health, static asset and proper 400/401 security responses verified. Health/build check repeated after removing the temporary build worktree.

## 26. Production Logs

PRODUCTION_LOG_GATE = PASS. Byte offsets captured immediately before swap distinguish fresh startup from historical noise. No new fatal, unexpected ERROR, 5xx, DB connection or Prisma startup failure. Expected non-blocking warnings: production CORS disabled because CORS_ORIGINS unset; Swagger disabled; existing next-start/standalone advisory. Same-origin proxy and denial checks pass. Fresh sanitized log extracts retained locally.

## 27. Employee Production Smoke

Technical PASS: /admin/core/persons server route shell 200 and all deployed Employee API/Web artifacts match release manifests. Authenticated form/context rendering and validation UI NOT_VERIFIED: exact-URL browser recovery returned The browser access host is unavailable before any UI action. Server shell success is not a claim that an authenticated form was visually exercised.

## 28. Employee Live Save

NOT_VERIFIED. No Employee create/update or real Save request performed. Fresh tests and historical clone evidence remain separate from live Production Save.

## 29. Mobile Production Smoke

PASS for deployed transport: same-origin /api/v1 proxy returns health 200, protected read 401, malformed login {} returns 400; fixed loopback rewrite present in deployed manifest. Arbitrary-origin preflight receives no Access-Control-Allow-Origin. Server-to-own-LAN-interface health 200 confirms deployed LAN path, not actual-device login. HTTPS proxy preserved.

## 30. Mobile Real Device Login

NOT_VERIFIED. No real device/credential session available through current tooling; no credentials invented or requested. Historical owner acceptance was not reused as a new live proof.

## 31. Desktop Login Regression

Technical PASS: HTTPS login shell/static assets, same-origin auth request routing and protected API rejection. Fresh automated Login/AuthProvider session-restoration/navigation tests PASS. Authenticated desktop login/session restore NOT_VERIFIED live because browser host/session unavailable.

## 32. Unified Print Preservation

PRINT_PRODUCTION_PRESERVED = PASS for technical preservation: exact deployed artifacts, representative route manifests, server route shells and complete 36-suite regression. Authenticated/native print behavior is NOT_VERIFIED in this deployment; not inferred from HTTP 200.

## 33. Inventory Ledger Smoke

/admin/inventory/ledger server shell 200; route manifest and REGISTER/filter-contract regressions PASS. Apply/Reset, no mixed-UOM header quantity, readable identifiers and authenticated rendering covered by fresh tests; not claimed visually observed in live authenticated browser.

## 34. Native Print Status

NATIVE_BROWSER_PREVIEW = NOT_VERIFIED; NATIVE_SAVE_AS_PDF = NOT_VERIFIED; CANCELLATION_BEHAVIOR = NOT_VERIFIED; PHYSICAL_PAPER = NOT_VERIFIED. Earlier status is unchanged. These manual gates do not block deployment under this task.

## 35. Tenant / Permission Safety

TENANT_PERMISSION_DELTA = 0. No startup/guard regression observed; unauthenticated protected endpoints return 401. Full API suite includes existing tenant/permission regressions. No permission or tenant setup mutated to manufacture a test session.

## 36. Business Writes

BUSINESS_WRITE = 0 for actions performed by this phase: EMPLOYEE_CREATE/UPDATE = 0; INVENTORY_WRITE = 0; MAINTENANCE_WRITE = 0; PRODUCTION_WRITE = 0; PERMISSION_WRITE = 0; DATABASE_MANUAL_WRITE = 0. Only read-only GET/OPTIONS smoke and two intentionally malformed login POSTs rejected at validation. No successful login/account creation, seed, migration, SQL repair or business posting. This is an action audit, not a claim that the whole database was globally quiescent.

## 37. Deployed Build Verification

DEPLOYED_BUILD_MATCH = PASS. New build ID appears in served HTTP and HTTPS HTML, matches live BUILD_ID and built artifact. Static JS returns 200. Code hashes verified for 4452 Web files (mutable cache/trace excluded) and 4552 API files.

## 38. Production SHA Provenance

`b42ce7e15ee637b4c7691a30f10eb5acc64fbb52` → clean detached source and fresh tests/build → release manifests → BUILD_ID `zhi2M_t92U9wYNXsYhdj4` → deployed file hashes/served HTTP+HTTPS build. No new version endpoint. Final documentation-only commit is not the runtime build source.

## 39. Closeout Proof

This file: docs/proofs/final-production-deployment-complete-closeout-2026-11-17.md. Detailed credential-free evidence/logs/manifests under ignored .tmp/final-production-deployment-20261117. Rollback material remains local and preserved.

## 40. Closeout Commit

Separate exact-path documentation commit containing this file: docs(production): close final recovered-work deployment. Its parent is release b42ce7e1. Final SHA is recorded non-recursively in final response and local final-git.json after push.

## 41. Push Result

Normal push of this documentation-only commit to origin/main. Post-push remote readback must equal local HEAD before final closure. No force push or source rewrite.

## 42. Final HEAD

The documentation-only commit containing this proof. Runtime source remains b42ce7e15ee637b4c7691a30f10eb5acc64fbb52. Exact final Git SHA is reported after commit/push.

## 43. Final origin/main

Equal to final HEAD, verified with remote readback after documentation push.

## 44. Ahead / Behind

0 / 0 required and verified after final documentation push. Source checkpoint was clean and synchronized before writing this proof.

## 45. Working Tree

Clean after exact-path commit of this proof. Deployment changed no tracked source. No application source files or tests were edited.

## 46. Remaining Stash

Exactly one unchanged Docker WIP stash, object `7af3a0e7d9d088063aefad72740f203f448c1595`; archived only.

## 47. Remaining Worktrees

Main and clean Kilo worktrees preserved. This phase-only clean detached build worktree removed after verified deployment; its three dependency junctions were unlinked first without traversing targets. Artifacts had already moved to live paths; rollback is outside the removed worktree. Post-cleanup health passed.

## 48. Remaining Local-Only Source

UNKNOWN_UNPUBLISHED_SOURCE = 0 among reconciled/release work. The previously classified Docker stash is the sole intentional archived source WIP; private env/backup/log/proof/cache classes remain intentionally local.

## 49. Known Limitations

Browser access host unavailable; no live authenticated Employee validation/save, desktop login restore, real mobile login, native print preview/PDF/cancellation or physical paper observed. No claim that anonymous route shells prove full UI behavior. Windows standalone-tracing package warning is explicitly non-blocking only for the established Next runtime actually deployed and verified. Full actual runtime workflow tests remain the earlier historical/clone evidence plus fresh automated tests.

## 50. Final Repository State

Employee/Mobile and historical proofs committed/pushed; no source changes in this phase. Final closeout proof committed/pushed separately; main synchronized and clean; intentional Docker stash retained. No new tag, branch rewrite or unrelated cleanup.

## 51. Final Production State

Employee DEPLOYED; Mobile DEPLOYED; Unified Print DEPLOYED/PRESERVED technically. API/Web/Caddy healthy; served new build `zhi2M_t92U9wYNXsYhdj4`; rollback ready; schema/migration NONE; permission/business-write delta 0. Manual live gates remain honestly NOT_VERIFIED.

## 52. Next Authorized Phase

**NEXT_AUTHORIZED_PHASE = NONE.** Final authorized deployment phase ends here. No new development or further deployment is inferred.

Evidence: [preflight](../../.tmp/final-production-deployment-20261117/preflight.json), [pre-deploy gates](../../.tmp/final-production-deployment-20261117/pre-deploy-gate.json), [artifacts](../../.tmp/final-production-deployment-20261117/artifacts.json), [deployment](../../.tmp/final-production-deployment-20261117/deployment-state.json), [rollback](../../.tmp/final-production-deployment-20261117/rollback-snapshot.json), [HTTP/artifact smoke](../../.tmp/final-production-deployment-20261117/post-smoke.json), [HTTPS](../../.tmp/final-production-deployment-20261117/https-proxy.json), [fresh logs/services](../../.tmp/final-production-deployment-20261117/log-gate.json), [manual limits](../../.tmp/final-production-deployment-20261117/manual-gates.json).
