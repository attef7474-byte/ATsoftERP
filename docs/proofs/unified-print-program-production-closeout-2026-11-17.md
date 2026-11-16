# Unified Print Program — Production Release Closeout (2026-11-17)

Status: `UNIFIED_PRINT_PROGRAM_PRODUCTION_DEPLOYED_NATIVE_PRINT_NOT_VERIFIED`

The Unified Print Program is committed, pushed to `main`, deployed to the production runtime on this machine, and verified read-only in production. Native browser print preview, native Save-as-PDF, print-cancellation behavior and physical paper output were **not** exercised in this session and are reported as `NOT_VERIFIED`.

## 1. Release identity

| Item | Value |
| --- | --- |
| Branch | `main` |
| Release base | `54e3706f98c8ff7aa7f48febe12611015c3e29fe` |
| Release commit | `c4bc74841f2abc6c4da8fee65c6187a1eebdf597` |
| Commit subject | `feat(print): release unified print program` |
| Commit author timestamp | 2026-11-17 01:26:24 +0300 |
| Push | `54e3706f..c4bc7484  main -> main` (normal fast-forward push, no force) |
| Remote sync after push | `HEAD == origin/main == c4bc7484`, ahead/behind `0 0` |
| Remote advanced independently? | No (fetched before committing and after pushing) |

No release tag was created. Tag creation was not explicitly authorized for this task, and repository instructions forbid tag operations unless requested.

## 2. Scope released

The release commit contains 1,003 files: 310 text files and 693 binary print-evidence artifacts.

| Area | Content |
| --- | --- |
| Shared foundation | `apps/web/src/lib/print.ts`, `apps/web/src/components/print/{PrintDocument.tsx,print-runtime.tsx,use-print-document.ts,use-report-print-snapshot.ts}`, print entry hook, print policy docs (`docs/print/*`) |
| Report rollout | Maintenance and inventory report print models, report adapters, report print tests |
| Operational documents | Maintenance work order, repair order, request; inventory adjustment, count, movement, opening balance, stock adjustment documents |
| Movements register | Inventory movements report print model and tests |
| Ledger | `/admin/inventory/ledger` register print, `filter-contract.ts`, six-column register, applied-filter collection |
| Test/tooling | `apps/web/package.json` + `package-lock.json` (`react-test-renderer`), `apps/web/tests/jest.config.js`, `apps/web/tests/tsconfig.json` (print-test path mapping / `react-jsx`) |
| Governance/evidence | `docs/print/*`, `docs/print/proofs/*`, print proofs under `docs/proofs/`, `.gitattributes` binary marker for print PDF/PNG evidence |

### Excluded and preserved (unrelated dirty work)

`EMPLOYEE_UNRELATED` (person-registration API/web/tests/locales, `F9Lookup.tsx`), `MOBILE_LOGIN_UNRELATED` (`mobile-lan-login` test/proof, `next.config.mjs`, `apps/web/.env.example`, `src/lib/api.ts`), `PRODUCTION_UNRELATED` (production closeout proof), plus scratch artifacts. `STAGED_UNRELATED_FILE_COUNT = 0`. All 21 unrelated dirty entries (14 modified + 7 untracked) remain untouched in the working tree.

## 3. Build and test evidence (release gates, fresh runs)

| Gate | Result |
| --- | --- |
| API tests | 219 suites / 4,735 tests PASS |
| Web tests | 123 suites / 2,322 tests PASS |
| Print regression | 36 suites / 352 tests PASS |
| Ledger/Movements focused gate | 3 suites / 49 tests PASS |
| Typecheck (API + Web) | PASS |
| `npm run build` | PASS (304 app routes, 194/194 static pages) |
| i18n consistency | PASS (7,069 EN / 7,069 AR keys) |
| Raw-key guard / UI baseline / permission-UI guard | PASS |
| Route contract | 1,185 backend routes, 1,167 matched, 0 unresolved, 0 mismatched |
| Credentials guard / secret scan (staged diff) | PASS |
| `git diff --cached --check` | PASS |

## 4. Artifact build and deployment

Production artifacts were built from a clean detached worktree at the release commit (`c4bc7484`) so that unrelated dirty working-tree changes could not enter the deployment.

| Item | Value |
| --- | --- |
| Clean build worktree | `.tmp/release-build` at `c4bc7484` (dependency junctions to the live `node_modules`) |
| Web build | `Compiled successfully`; 304 app routes; BUILD_ID `pq83D9HcJWQzLNXiKbKhe` |
| API build | `tsc` exit 0; 4,549 files |
| Pre-deploy web BUILD_ID | `LmD8PG0EskgFuceC1hhfl` |
| Deploy mechanism | Stop `ATsoftERP_Web` + `ATsoftERP_API`, directory swap of `apps/web/.next` and `apps/api/dist`, restart services |
| Deploy log | `.tmp/release-deploy-elevated-20261117_013341.log` |
| Deploy result | `DEPLOY_RESULT=SUCCESS` (elevated) |
| Services after deploy | `ATsoftERP_API` Running (PID 16528), `ATsoftERP_Web` Running (PID 36184), `ATsoftERP_Caddy` Running |
| Listening ports | 3000 → PID 36184, 4000 → PID 16528 |

No Prisma schema change, no migration, no database write, and no environment-file change was part of the deployment.

## 5. Rollback position

Rollback is artifact-based and does not touch the database or Git history.

| Artifact | Location |
| --- | --- |
| Pre-deploy snapshot (API 4,553 files / web 4,532 files) | `.tmp/release-rollback-20261117_012849` |
| Pre-deploy API `dist` (moved aside) | `.tmp/rollback-api-dist-20261117_013341` |
| Pre-deploy web `.next` (moved aside, BUILD_ID `LmD8PG0EskgFuceC1hhfl`) | `.tmp/rollback-web-next-20261117_013341` |
| Elevated deploy/rollback script | `.tmp/release-elevated-deploy.ps1` |

Rollback procedure: stop both services, delete the deployed `apps/web/.next` and `apps/api/dist`, restore the two `.tmp/rollback-*` directories, restart services. `.tmp` is git-excluded, so rollback artifacts never become repository content.

## 6. Production verification (read-only)

| Check | Result |
| --- | --- |
| Web root `http://localhost:3000` | HTTP 200, served build ID matches `pq83D9HcJWQzLNXiKbKhe` |
| `/login` | 200 |
| `/admin/inventory/ledger` | 200 |
| `/admin/inventory/opening-balances` | 200 |
| `/admin/inventory/stock-adjustments` | 200 |
| `/admin/maintenance/requests` | 200 |
| Static `/_next/static/*` asset | 200 |
| Deployed route manifest | 304 routes; ledger, opening-balance `[id]`, stock-adjustment `[id]`, request `[id]/print`, movements report routes present |
| API `GET /api/v1/auth/contexts` (unauthenticated) | 401 (reachable, auth enforced) |
| API `POST /api/v1/auth/login` with malformed body | 400 (validation enforced) |
| API stdout | `Nest application successfully started`, `Server running on http://localhost:4000` |
| API stderr tail | 0 errors |
| Caddy HTTPS proxy (`Host: dell`) web | 200, served build ID matches |
| Caddy HTTPS proxy (`Host: dell`) API | 401 (reachable, auth enforced) |

Read-only means: only GET page/asset requests, one unauthenticated contexts GET, and one intentionally malformed login POST that was rejected by validation. `BUSINESS_WRITES = 0`.

## 7. Native print gates

An authenticated production browser session was not available in this session (no production credentials in scope), so the print UI could not be driven against live canonical data.

| Gate | Status |
| --- | --- |
| `NATIVE_BROWSER_PREVIEW` | `NOT_VERIFIED` |
| `NATIVE_SAVE_AS_PDF` | `NOT_VERIFIED` |
| `CANCELLATION_BEHAVIOR` | `NOT_VERIFIED` |
| `PHYSICAL_PAPER` | `NOT_VERIFIED` (owner-manual) |

This matches the established print-release convention: automated render/PDF/text evidence is committed under `docs/print/proofs/**`, while native preview, native Save-as-PDF, cancellation and physical paper remain owner-manual gates.

## 8. Invariant sentinels

| Sentinel | Value |
| --- | --- |
| `PRISMA_SCHEMA_CHANGE` | `NONE` |
| `MIGRATION` | `NONE` |
| `PRODUCTION_MIGRATION` | `NONE` |
| `BUSINESS_WRITES` | `0` |
| `PERMISSION_DELTA` | `0` (no new permission keys; only a test asserting `inventory-ledger:read`, which already exists in `HEAD`) |
| `STAGED_UNRELATED_FILE_COUNT` | `0` |
| `UNRELATED_DIRTY_ENTRIES_PRESERVED` | `21` (14 modified + 7 untracked) |
| `FORCE_PUSH_USED` | `NO` |
| `GIT_RESET_OR_CLEAN_USED` | `NO` |

Print contract invariants retained: one canonical `InventoryMovement` REGISTER model; ledger permission `inventory-ledger:read` kept distinct from `reports.inventory:read`; six register columns; applied-filter collection with 100 per page and 500 maximum; deterministic `movementDate desc, id desc` ordering; inclusive date-only `dateTo`; no balances, no valuation, no raw IDs.

## 9. Known limitations

- Native browser print preview, native Save-as-PDF, print cancellation and physical paper output are `NOT_VERIFIED` (see section 7).
- Human visual review of rendered output was not repeated in this session; committed PNG/PDF evidence from the release gates is the visual artifact of record.
- Production was verified anonymously (unauthenticated). Authenticated ledger/register print against live tenant data was not exercised.
- Historical Web stderr lines about `"next start"` with `output: standalone` and missing builds are pre-existing log noise; the current Web process serves the new build on port 3000 with HTTP 200 and BUILD_ID match.
- No release tag was created (not explicitly authorized).

## 10. Decision

`UNIFIED_PRINT_PROGRAM_PRODUCTION_DEPLOYED_NATIVE_PRINT_NOT_VERIFIED`

The print program is deployed and production-verified read-only; the four native print gates remain unverified pending an owner-driven, authenticated browser/paper check.

`NEXT_AUTHORIZED_PHASE = NONE`

## 11. Documentation closure

This proof was added to `main` in a documentation-only commit after production had already been deployed and verified. No source, build, schema, migration, permission or data change accompanies it; production continues to run the artifacts built from `c4bc7484`.

Follow-up authorization: `PHASE 2 — LEGACY LOCAL WORK RECONCILIATION & REPOSITORY HYGIENE` covers the legacy stash, the local-only tag, stale worktree registrations and ignored local artifacts. Native print gates remain `NOT_VERIFIED`.
