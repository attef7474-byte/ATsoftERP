# R2-J — Production rollout: final closeout (CLOSED)

Date: 2026-09-29. Program: MAINTENANCE-WORKFLOW-R2.

**Status: CLOSED. R2-J readiness was confirmed at R2-I close
(`master_logic_ref`: R2-I final certificate, `R2_J_READY=YES`). This document
closes the R2 program by recording the certified release-candidate rollout to
production, the rehearsal/cutover/stability evidence, the regression/build gate
results, the production zero-mutation readback, and the final disposition.**

## 1. Baseline and authority

- Release candidate (certified): repository commit
  `ac95f1a862227a1c941772564ba8b436be488431` (the R2-I final closeout commit),
  branch `maintenance-workflow-r2`. R2 program slices R2-A .. R2-J all reach
  CLOSED with this record.
- Production target: SQL Server instance `DELL\WINCC`
  (`@@SERVERNAME = DESKTOP-HJALRR4\WINCC`), database `ATsoftERP_DB`, services
  `ATsoftERP_API` (HTTP 4000), `ATsoftERP_Web` (HTTP 3000),
  `ATsoftERP_Caddy` (HTTPS `DELL/login`).
- Authority read at session start: Engineering Constitution, Development
  Contract (including section-17 execution template), AGENTS.md, UI baseline
  governance, relevant agent-rule files, R2-A..R2-I proofs and blocker
  documents, and the R2-I final certificate.
- R2-J scope note: the R2-A program contract listed R2-J as "T10 cost authority
  derivation; request-cost/usage legacy deprecation". Legacy cost-table
  inventory, cost-summary authority and tenant isolation fixes were delivered
  inside R2-H (`22bedb60`, `a1f19018`, `8eb8a2f6`) and the R2-I blockers; the
  remaining R2-J programming, as executed, is the **safe production rollout of
  the fully certified candidate** plus program close. Nothing in this document
  claims functionality beyond the certified R2-A..R2-I scope.
- Execution context: the original R2-J session was interrupted after cutover by
  an agent artifact tool limit. Production had already been deployed and verified
  healthy. Closeout therefore re-verified the deployed state (no redeploy
  performed) using the persisted evidence run
  `C:\Users\attef\AppData\Local\Temp\ATsofterp-R2J-20260929_020212` and
  read-only production probes.

## 2. Deployed state re-verification (no redeploy)

The deployed artifact was byte-verified, not replaced. `node artifact-hash.cjs
verify <repo> artifact-manifest.json` at closeout returned
`files=5871, mismatches=[]`, exit 0.

| Evidence | Value |
|---|---|
| `cutover-result.json` | `DEPLOYED_PARITY_HEALTH_PASS` @ 2026-09-28T23:13:16Z, `artifactParity=PASS`, `rollbackTriggered=false` |
| `artifact-manifest.json` | createdUtc 2026-09-28T23:08:11Z, **files=5871** (certified artifact = `apps/api/dist` + `apps/web/.next` + support) |
| `rollback-manifest.json` | createdUtc 2026-09-28T23:11:40Z, **files=5870** (pre-cutover live tree = monkey-verified against repo before move) |
| Deployed parity (closeout) | 5871 files, 0 mismatches, exit 0 |
| Rollback artifact | retained at `retired-live\api-dist` + `retired-live\web-next` in the run dir |
| Config integrity | repo root `.env` SHA256 `E005C293E33D5C541EC72654A1E57EBB46E70698FEDFB86B5FCACA7B6CD64E62` == `config-integrity.json` baseline; `C:\ATsoftERP\Config\Caddyfile` SHA256 `C0FC215B143A1B1F246EA253C0B2BE8FA1B0252A86FA871EF12FB78FBCC1D389` == baseline. Both re-verified at closeout: match. |
| Services | `ATsoftERP_API`, `ATsoftERP_Web`, `ATsoftERP_Caddy` all `Running`, start type `Automatic` |

## 3. Backup and rehearsal evidence

### 3.1 Backup chain (safe, verified, retained)

| Backup | Path | Bytes | SHA256 | VERIFYONLY | Logical files |
|---|---|---|---|---|---|
| A (rehearsal safety) | `C:\ATsoftERP\Backups\ATsoftERP_R2J_REHEARSAL_20260929_020212.bak` | 76,398,592 | `ABBABFE6A4B7EAF32C9C0252AA5CD2A5D38FDA7F5A411AF20BC8F7397E1D90F5` | PASS | `ATsoftERP_DB` (data/D/PRIMARY, size 142,606,336) + `ATsoftERP_DB_log` |
| B (pre-deploy safety) | `C:\ATsoftERP\Backups\ATsoftERP_R2J_PREDEPLOY_20260929_021219.bak` | 76,398,592 | `77DDD1AEAC6BC7C0AE545CCACD67C50E7A5C95FAF9B874F88451FBB06D2F5AE2` | PASS | `ATsoftERP_DB` (data/D/PRIMARY) + `ATsoftERP_DB_log` |

Backup `FILELISTONLY` shows `BackupSizeInBytes 76,283,904` for Backup A (logical
size excludes checksum overhead). Backup A had no `.meta.json`; a `backup-a.json`
evidence record (bytes, SHA256, VerifyOnly/CopyOnly/Checksum flags, logical
file list) was created in the run dir at closeout from the live read-only
`VERIFYONLY`/`FILELISTONLY` run. Both backups retained; neither decompressed,
restored, or written to after creation.

### 3.2 Rehearsal (exact artifact against a disposable clone)

- Clone DB `ATsoftERP_R2J_REHEARSAL_20260929_020212` restored from Backup A
  with explicit `MOVE` targets. Closeout read-only verification:
  `SELECT DB_NAME()` identity confirmed; data parity with production
  pre-cutover (maintenance_requests 12, maintenance_work_orders 4, canonical
  ledger 0); `DBCC CHECKDB WITH NO_INFOMSGS` exit code 0 (run read-only under
  the Windows-integrated sysadmin login `DELL\attef` — the SQL service login
  `atsofterp_dev` lacks DBCC privilege; evidence `rehearsal-dbcc.log`).
- Exact-artifact rehearsal harness `start-rehearsal-api.cjs` asserts the
  production `.env` identity (`database=ATsoftERP_DB`) before redirecting
  `DATABASE_URL` to the clone; it loads
  `artifact\apps\api\dist\src\main.js` on PORT 4032 (proving the exact deployed
  artifact code ran). Artifact web served on 3031; `Caddyfile.rehearsal`
  mapped `http://localhost:3032` → `/api/*`→4032, else→3031.
- `rehearsal-smoke.json` (stage=rehearsal, base `http://localhost:3032`):
  all 18 page checks 200 (9 pages x EN/AR) with correct `dir`/`lang` and zero
  raw translation keys/enum values; 11 API reads 200; login 201; logout PASS;
  overall PASS. 14 rehearsal screenshots retained outside the repository
  (repo convention) in the run dir.
- `rehearsal-api.err.log`/`rehearsal-web.err.log`: warnings only (Swagger
  disabled, CORS disabled because `CORS_ORIGINS` unset in rehearsal exactly as
  in production, `next start` standalone notice). Orchestrated processes
  recorded in `rehearsal-pids.json` (api 26484, web 21776, caddy 428).

### 3.3 Cutover execution (recovered `cutover.ps1`)

Preflight asserted repo HEAD == `ac95f1a8`, clean worktree, `artifact-manifest`
verify vs artifact tree, and `rollback-manifest` verify vs repo live tree; moved
live `apps/api/dist` + `apps/web/.next` into `retired-live\`; copied the
artifact tree into place; re-verified deployed parity; restarted services; and
asserted health. `cutover-result.json` records PASS with no rollback. The
rollback path (`rollback-after-smoke.ps1`) restores `retired-live` and
re-verifies with `artifact-hash.cjs` + health; it was not needed.

## 4. Production post-deploy readback and stability

### 4.1 Zero-mutation readback (counts identical pre/post and at closeout)

| Table | Pre | Post | Closeout |
|---|---|---|---|
| maintenance_requests | 12 | 12 | 12 |
| maintenance_work_orders | 4 | 4 | 4 |
| maintenance_request_required_parts | 0 | 0 | 0 |
| machine_installed_parts | 0 | 0 | 0 |
| spare_part_replacement_histories | 0 | 0 | 0 |
| spare_part_repair_orders | 0 | 0 | 0 |
| operational_cost_transactions (canonical ledger) | 0 | 0 | 0 |
| R2J synthetic request/WO/ledger markers | 0/0/0 | 0/0/0 | 0/0/0 |
| Historical-labor canonical postings | 0 | 0 | 0 |

Historical-labor note: exactly one legacy raw LABOR entry
`cmsc789hd0003dw95onnlfjiq | LABOR | 120.50` exists in
`maintenance_work_order_cost_entries` (1 row) with **zero** canonical-ledger
postings. This is the documented pre-existing gap; it was preserved and **not**
backfilled (by design and per the close-policy instruction). Fresh closeout
readback was byte-identical to `production-postdeploy-readback.txt`.

### 4.2 Stability

- Health: API `http://localhost:4000/api/v1/health` 200, Web
  `http://localhost:3000/login` 200, Caddy `https://DELL/login` 200.
- `production-log-review.json` deltas since pre-cutover offsets: API stdout
  newBytes 296,868 (0 error lines), API stderr newBytes 352 (0 error lines;
  warnings "Swagger doc disabled" + "CORS disabled, no CORS_ORIGINS"), Web
  stdout newBytes 147 (0 error lines), Web stderr newBytes 120 (0 error lines;
  `next start` standalone notice). No restart loops, no 500s, no stack traces.

### 4.3 Production smoke

`production-smoke.json` (stage=production): all 18 page checks 200 with correct
`dir`/`lang` and zero rawKeys/rawEnums; 11 API reads 200 (visible request list
count 7 of 12 raw rows — soft-delete/visibility filtering; consistent pre/post;
work orders 4, request detail, required-parts 0, request cost-summary net 0 /
posted 0, WO cost-summary net 0 / posted 0, installed-parts 0,
replacement-history 0, repair-orders 0, queue 0); `pageErrors`,
`consoleErrors`, `networkFailures`, `unexpected5xx`, `blockedWrites` all empty;
login 201; logout PASS; overall PASS. 14 production screenshots retained outside
the repository in the run dir. Production smoke ran against the real production
state (canonical ledger empty), so all cost nets are 0 — consistent with the
readback, not an artifact.

### 4.4 Cost-summary isolation channel

`production-cost-security.json`: wrong-tenant GET of
`/maintenance-cost/requests/{id}/cost-summary` → **404**; wrong-tenant
`/maintenance-cost/work-orders/{id}/cost-summary` → **404**; unauthenticated
reads of both → **401**. PASS.

## 5. Regression and build gates (fresh source-clone runs)

Logs recorded in the run dir (`api-tests.log`, `web-tests.log`,
`route-contract-check.log`, `i18n-check.log`, `raw-keys-check.log`,
`credentials-check.log`, `ui-baseline-check.log`, `web-build.log`,
`api-build.log`, `api-typecheck.log`, `prisma-validate.log`,
`prisma-generate.log`, `prisma-status.log`).

| Gate | Result |
|---|---|
| API jest (`npm run test:api`) | 173 suites / 3449 tests PASS, 0 fail |
| Web-logic jest | 45 suites / 1165 tests PASS |
| API typecheck (`tsc --noEmit`) | PASS |
| API build (`tsc`) | PASS |
| Web `next build` (Next 15.5.20) | PASS — "Compiled successfully in 39.7s", 190 static pages; the build's type-validation step is the web type gate (no standalone web `typecheck` script exists; root `--if-present` skips it, so `web-typecheck.log` is intentionally empty) |
| `npx prisma validate` | schema valid |
| `npx prisma generate` | Client v7.8.0 generated |
| `prisma migrate status` | 85 migrations applied, up to date, no pending |
| i18n consistency | PASS — 6313 EN == 6313 AR, 22 namespaces, no empty values, 9926 literal `t()` keys resolve |
| Raw-key safety | PASS — 36 dynamic `t()` sites confirmed fallback-safe; 0 raw-key render sites |
| Credentials check | PASS — no hardcoded credentials/connection strings |
| UI baseline (`ui-baseline:check`) | PASS — 133 check lines + `UI VERIFICATION PASSED` |
| Route contract | `AUDITEDRUNTIMEROUTES=1120 MATCHED=1120 MALFORMED=0 UNRESOLVED=0 MISMATCHES=0` |
| Application source freeze | HEAD == `ac95f1a8`; this closeout adds docs only (`git diff ac95f1a8..<closeout> -- apps packages` = empty); schema unchanged; 0 new migrations |

## 6. Publication

`origin/main` (was `f14fbe13`, an ancestor of the release candidate) was
fast-forwarded to the R2-J closeout HEAD without force, rebase, or merge
commits. Final remote verify: `origin/main` == local `main`, `ahead 0 behind 0`,
worktree clean, `stash@{0}` untouched, no tags created
(`R2_J_TAG_CREATED=NO` consistency with the R2 program instruction).

## 7. Final disposition

```text
R2_J_STATUS=CLOSED
PRODUCTION_ROLLOUT=PASS
PRODUCTION_DB_MUTATED=NO
PRODUCTION_READBACK_PRE=12_4_0_0_0_0_0
PRODUCTION_READBACK_POST=12_4_0_0_0_0_0
PRODUCTION_READBACK_CLOSEOUT=12_4_0_0_0_0_0
R2J_SYNTHETIC_MARKERS=0_0_0
HISTORICAL_LABOR_GAP_PRESERVED=YES_NO_BACKFILL
REHEARSAL_CLONE=ATsoftERP_R2J_REHEARSAL_20260929_020212
REHEARSAL_DBCC=PASS
REHEARSAL_SMOKE=PASS
BACKUP_A_SHA256=ABBABFE6A4B7EAF32C9C0252AA5CD2A5D38FDA7F5A411AF20BC8F7397E1D90F5
BACKUP_B_SHA256=77DDD1AEAC6BC7C0AE545CCACD67C50E7A5C95FAF9B874F88451FBB06D2F5AE2
BACKUP_VERIFY=VERIFYONLY_PASS_BOTH
CUTOVER=DEPLOYED_PARITY_HEALTH_PASS
ROLLBACK_TRIGGERED=NO
DEPLOYED_ARTIFACT_STILL_CERTIFIED=PASS_5871_FILES_0_MISMATCH
ROLLBACK_ARTIFACT_RETAINED=YES_RETIRED-LIVE
CONFIG_INTEGRITY=PASS_ENV_AND_CADDYFILE
PRODUCTION_HEALTH=API_200_WEB_200_CADDY_200
SERVICES=RUNNING_3_OF_3
API_LOG_ERROR_LINES=0
WEB_LOG_ERROR_LINES=0
COST_SUMMARY_ISOLATION=PASS_404_401
API_JEST=173_SUITES_3449_TESTS_PASS
WEB_LOGIC_JEST=45_SUITES_1165_TESTS_PASS
API_TYPECHECK=PASS
API_BUILD=PASS
WEB_BUILD=PASS_190_STATIC_PAGES
WEB_TYPECHECK=COVERED_BY_NEXT_BUILD
I18N=PASS_6313_EQUALS_6313
RAW_KEYS=PASS
CREDENTIALS=PASS
UI_BASELINE=PASS_133_CHECKLINES
ROUTE_CONTRACT=1120_MATCHED_0_MISMATCH
PRISMA_VALIDATE=PASS
PRISMA_STATUS=85_MIGRATIONS_UP_TO_DATE
SCHEMA_CHANGED=NO
MIGRATIONS_CREATED=0
APPLICATION_SOURCE_CHANGED=NO
MAIN_PUBLICATION=PASS_FAST_FORWARD
R2_A_TO_R2_J=CLOSED
MAINTENANCE_WORKFLOW_R2=CLOSED
R2_J_TAG_CREATED=NO
```

Runtime proof classification per program reporting rules: the Frontend → API →
Permission → Service → Database → Audit → Result chain was proven against the
exact artifact on a disposable production clone (rehearsal), the production
candidate was deployed with parity health PASS and rollback available but
unneeded, and production stability, isolation channel, log cleanliness, and
zero-mutation readback were verified post-deploy and again at closeout.
Reported honestly: **COMPLETE** for the rollout certificate (automated
evidence); the owner may additionally inspect the retained screenshots as with
previous phases, which does not change the rollout verdict.

## 8. Known limitations

- The SQL service login lacks DBCC privilege; the read-only closeout `DBCC
  CHECKDB` was executed under the Windows-integrated sysadmin (`DELL\attef`),
  exit 0.
- `web-typecheck.log` is empty by design (no standalone web typecheck script;
  `next build`'s integrated type validation is the web type gate and it PASSED).
- Lint tooling is unavailable locally (pre-existing platform limitation, not in
  the `qa:all` gate).
- Production and rehearsal `CORS_ORIGINS` are unset, so global CORS is disabled,
  and Swagger docs are disabled — both expected production configuration (health
  unaffected).
- Rehearsal and production screenshots are retained outside the repository per
  repo convention.
- The single legacy raw LABOR entry (`cmsc789hd...|LABOR|120.50`) still has no
  canonical-ledger posting; preserved, not backfilled (documented pre-existing
  gap).

## 9. Evidence map (run dir `ATsofterp-R2J-20260929_020212`)

`cutover-result.json`, `artifact-manifest.json` / `rollback-manifest.json`,
`config-integrity.json`, `start-rehearsal-api.cjs`, `Caddyfile.rehearsal`,
`rehearsal-pids.json`, `rehearsal-context-discovery.json`, `rehearsal-smoke.json`,
`production-smoke.json`, `production-cost-security.json`,
`production-predeploy-readback.txt`, `production-postdeploy-readback.txt`,
`production-log-review.json`, `precutover-log-offsets.json`,
`final-close-verification.json` (closeout re-verification record),
`backup-a.json` / `backup-b.json` (backup evidence records), `rehearsal-*.log`
(clone DBCC + identity), `api-tests.log`, `web-tests.log`, `route-contract-check.log`,
`i18n-check.log`, `raw-keys-check.log`, `credentials-check.log`,
`ui-baseline-check.log`, `web-build.log`, `api-build.log`, `api-typecheck.log`,
`prisma-validate.log`, `prisma-generate.log`, `prisma-status.log`,
`retired-live\api-dist` + `retired-live\web-next` (rollback artifact),
`release-artifact.zip`, `candidate.zip`, plus retained rehearsal/production
screenshots.