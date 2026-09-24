# Production Phase 1 — Final Recloseout (Production Release Verification)

**Date:** 2026-09-24
**Status:** `PRODUCTION_PHASE_1=CLOSED`
**Applies to:** Production `ATsoftERP_DB` on SQL Server instance `DESKTOP-HJALRR4\WINCC` (port 50079), services `ATsoftERP_API` (:4000), `ATsoftERP_Web` (:3000), `ATsoftERP_Caddy` (reverse proxy `/api/*` → :4000, rest → :3000), all running under NSSM (LocalSystem) from the main repository `C:\Users\attef\PycharmProjects\Trae\ATsofterp\apps\api` and `apps\web`.

---

## 1. Executive Summary

The Production Phase 1 defect-repair release was executed end-to-end against the live Production system:

1. Verified git and Production identity, and recorded read-only prechecks.
2. Took a **fresh** Production backup (`COPY_ONLY` + `CHECKSUM`) and verified it with independent `RESTORE VERIFYONLY WITH CHECKSUM`.
3. Restored the fresh backup into a **new** disposable release-clone database (`ATsoftERP_RELEASE_20260924` — deliberately not reusing `ATsoftERP_P1CLOSE_20260923`).
4. Rehearsed the exact committed migration on the clone via **Windows Integrated Authentication**, physically verified, and registered it (`prisma migrate resolve --applied`); clone reported *schema up to date*.
5. Proved the repaired runtime slice on the clone: `PATCH /production/orders/:id` produced an `audit_logs.details` payload of **1116 characters** (previous hard limit was 1000) and persisted successfully — the exact scenario that 500'd in Production before the fix.
6. Applied the identical DDL to Production via Win-Auth, physically accepted it, and registered it; Production reported *schema up to date*.
7. Built the exact release artifact from `be4116ca` (API `tsc` + Web `next build`), preserved the previous artifacts for rollback, deployed into the live app directories, and restarted the services via the native service mechanism.
8. Proved deployed-artifact byte-parity vs the release build (API dist 4250/4250; Web `.next` 2522/2522 file-hash matches; standalone non-node_modules 929/929).
9. Safe Production acceptance passed (login, `/auth/me`, orders list total=4, performance-targets list 200, audit-logs 200, health 200, no 500s).
10. Full post-deploy regression passed: API `2914/2914`, Web `1011/1011`, typecheck, builds, `prisma validate/generate`, `prisma migrate status` (0 pending), i18n `6110=6110`, raw-keys, route contract `1112 matched / 0 malformed / 0 unresolved / 0 mismatches`, permission-UI, credentials, UI baseline `99 checks`, `git diff --check` clean.
11. Final Production data-safety check: no synthetic fixtures (`cmue%` pollution = 0), no business DML from the release, all business row counts preserved.
12. Published to `origin/main` by fast-forward and verified `HEAD==origin/main`, `0/0` ahead/behind, worktree clean.

---

## 2. Git Provenance

| Item | Value |
|---|---|
| Baseline `origin/main` (unchanged through deploy) | `fb82a455387d1e6ae9ca2eb7a060606a40902e79` |
| Original repair commit (app code + tests) | `64eb80c32814830002ef551cc17aa6547f77f1a3` |
| Code commit (PT edit payload fix; MR traceability fields) | `f2f2c55771efd7957f9922883f214f52338e5ce1` |
| **Release source commit** (proof docs on top) | `be4116ca4e65a6373569c098a3330bec5b86874b` |
| Recloseout commit (this document) | `RECLOSEOUT_COMMIT` (full SHA recorded in git) |
| Published `origin/main` HEAD | `HEAD` = recloseout commit, `AHEAD_BEHIND=0/0` |
| Pre-release worktree | clean (`git status --porcelain` empty) |
| Post-release worktree | clean |

Ancestry was verified before deploy: `fb82a455` → `64eb80c3` → `f2f2c557` → `be4116ca` (linear, fast-forwardable). Publication was a **fast-forward** — no `--force`, no rebase, no history rewrite, no merge commit.

---

## 3. Production Identity and Read-Only Precheck

Production identity was re-established from multiple independent anchors before any write:

- NSSM service configuration: `ATsoftERP_API` → `node dist\src\main.js` (AppDirectory `apps\api`), `ATsoftERP_Web` → `node node_modules\next\dist\bin\next start -p 3000` (AppDirectory `apps\web`), `ATsoftERP_Caddy` running. All `LocalSystem`.
- The services run from the **main repository** (`C:\Users\attef\PycharmProjects\Trae\ATsofterp`), whose `.env` points at `sqlserver://localhost:50079` database `ATsoftERP_DB` (SQL login `atsofterp_dev`, read-only for the app during gating).
- SQL Server instance resolved: `SERVERNAME=DESKTOP-HJALRR4\WINCC`, `InstanceName=WINCC`, `Machine=DELL`, Express Edition.

Read-only precheck results (before any change):

| Check | Result |
|---|---|
| `DB_NAME()` | `ATsoftERP_DB` |
| `audit_logs.details` | `nvarchar` max length **1000** (the defect) |
| Repair migration `20260923000000_repair_widen_audit_details` | **NOT applied** (`_prisma_migrations` record count = 0) |
| CLI `prisma migrate status` | 85 migrations found; only repair migration pending |
| `production_orders` | 4 (reference orders `PO-000001` DRAFT, `PO-000002` IN_PROGRESS, `PO-000003` PLANNED, `PO-000004` PLANNED) |
| `audit_logs` | 1624 |
| `companies` / `users` | 47 / 11 |
| Base tables | 160 |
| Pollution (`cmue%` orders/PT/MR/transitions) | 0 / 0 / 0 / 0 |
| API health (:4000) | `ok` |
| Web /login (via Caddy) | 200 |
| Windows Integrated Auth connectivity | OK as `DELL\attef` (`sqlcmd -S "DELL\WINCC,50079" -E -b`) |

**`PRODUCTION_PRECHECK=PASS`**

---

## 4. Migration Byte Verification

The migration in scope is `apps/api/prisma/migrations/20260923000000_repair_widen_audit_details/migration.sql`.

- Git blob (`cad78aedbdb569c0c67106b3801ece4a410d8452`) exists in **all three** commits (`64eb80c3`, `f2f2c557`, `be4116ca`) with byte-identical content.
- **`MIGRATION_SHA256=2E2F4831538288D4967F8757516ABE6653B6879B48E8984A378BCD988D5FB7AF`** (verified by extracting the blob byte-exact from `be4116ca`).
- Content scope: single `ALTER TABLE [dbo].[audit_logs] ALTER COLUMN [details] NVARCHAR(MAX) NULL;` inside `BEGIN TRAN`/`TRY-CATCH`. **No business-row DML**; no other statements.

**`MIGRATION_SCOPE=PASS`**

---

## 5. Backup / Restore Verification

| Step | Result |
|---|---|
| Backup method | Native SQL Server `BACKUP DATABASE` with `COPY_ONLY` and `CHECKSUM` via established `tools/backup/backup-sqlserver.ps1` (Windows auth) |
| Backup file | `C:\ATsoftERP\Backups\ATsoftERP_DB_20260924_065103.bak` |
| Start / finish | 2026-09-24T03:51:02Z / 03:51:04Z |
| Size | 72.23 MB (75,743,232 bytes) |
| `BACKUP_CHECKSUM` | PASS (in-tool) |
| Independent `RESTORE VERIFYONLY FROM DISK ... WITH CHECKSUM` | PASS — "The backup set on file 1 is valid." |
| Backup file SHA256 | `DA9BFFF38E12F340036553CFAF7C24AC24B614F08BDE53596A30DB223FFC9D35` |
| Evidence copy | `evidence\release-backup\` (fresh backup + meta JSON) |

**`PRODUCTION_BACKUP=PASS`, `BACKUP_CHECKSUM=PASS`, `RESTORE_VERIFYONLY=PASS`**

---

## 6. Release Clone (Rehearsal Sandbox)

| Item | Value |
|---|---|
| Release-clone database | `ATsoftERP_RELEASE_20260924` (created fresh from the backup; **not** `ATsoftERP_P1CLOSE_20260923`) |
| Restore result | `RESTORE DATABASE` succeeded (9234 pages), files moved under `C:\ATsoftERP\Temp` |
| Pre-migration state | `details`=nvarchar(1000); repair migration absent; orders=4; audits=1624; companies=47; users=11; refs intact |
| Rehearsal DDL | Canonical file (`SHA256 2E2F4831...`) applied via **Windows Integrated Auth** (`sqlcmd -E -b`), exit 0 |
| Post-rehearsal physical | `details`=nvarchar(**MAX**); audits=1624; orders=4 (preserved) |
| Registration | `prisma migrate resolve --applied 20260923000000_repair_widen_audit_details` → "marked as applied"; `_prisma_migrations` checksum prefix `2e2f48315382` matches canonical SHA |
| CLI status | "Database schema is up to date!" (0 pending) |

**`RELEASE_CLONE_DATABASE=ATsoftERP_RELEASE_20260924`, `RELEASE_CLONE_RESTORE/MIGRATION=PASS`, `RELEASE_CLONE_SCHEMA_UP_TO_DATE=YES`**

### Repaired-slice smoke (the crux of the fix)

The release-clone API was started from the build at `be4116ca` on port 4011 against `ATsoftERP_RELEASE_20260924`. A real login (`admin@atsofterp.com`) succeeded, and a valid `PATCH /api/v1/production/orders/cmtj2z1id00017w9512046dnl` (payload `{"lockVersion":0,"priority":"HIGH","sourceReference":"SMOKE-SRC-REF"}`) returned **HTTP 200** (priority became HIGH, lockVersion 1).

The resulting `audit_logs` row (`entity=ProductionOrder`, `action=UPDATE`, `2026-09-24 04:09:46`) had:

- `details` length = **1116 characters** (> the previous 1000 hard limit)
- `details` bytes = 2232 (UTF-16)

This is precisely the payload class that previously failed with *"String or binary data would be truncated."* → Production PATCH 500 (wrong-DB diagnostic, D2). On the widened column the transaction committed with no truncation error.

**`RELEASE_CLONE_SMOKE=PASS`**

---

## 7. GO/NO-GO

All release-clone gates green (backup verified, clone restored, migration rehearse+register OK, schema clean, repaired slice smoke PASS). **GO** to Production DDL.

---

## 8. Production DDL, Acceptance, Registration

| Step | Method / Result |
|---|---|
| Prerequisite re-verified | `details`=nvarchar(1000), repair migration absent (pre-DDL) |
| DDL execution | Canonical file via **Windows Integrated Auth** (`sqlcmd -S "DELL\WINCC,50079" -d ATsoftERP_DB -E -b`), exit 0. No application credentials used for privileged DDL; no `db_owner`/`db_ddladmin` granted to the app login. |
| Physical acceptance (pre-resolve) | `DB_NAME()=ATsoftERP_DB`; `details`=nvarchar(**MAX**); counts preserved: audits=1624, orders=4, companies=47, users=11; max live `LEN(details)`=434 (nothing long existed yet → no data migrated/truncated); repair record still 0 (pending registration); tables=160 |
| Registration | `prisma migrate resolve --applied 20260923000000_repair_widen_audit_details` → "marked as applied"; `_prisma_migrations` checksum prefix `2e2f48315382` matches canonical; `finished_at` recorded |
| CLI status | "Database schema is up to date!" (0 pending) |

**`PRODUCTION_DDL=PASS`, `PRODUCTION_PHYSICAL_ACCEPTANCE=PASS`, `PRISMA_MIGRATE_STATUS=0 PENDING`**

---

## 9. Build and Deploy

| Item | Value |
|---|---|
| Source | worktree at `be4116ca4e65...` (release source; pristine, clean) |
| API build | `npm run build` (`tsc`) → exit 0 |
| Web build | `npm run build` (`next build`) → exit 0; `BUILD_ID=qBGz9snvjwHElzssi7s4X` |
| Previous artifact preserved (rollback) | `evidence\rollback-20260924_071302\` (API dist 4240 files; Web `.next` 4381 files) |
| Deployed API | `apps\api\dist` (main repo) — deployed `main.js` SHA256 `CC818DF04266781AD2BF65F7C31F667F29579AA1F05B864A8493F08A92F119EB` |
| Deployed Web | `apps\web\.next` `BUILD_ID=qBGz9snvjwHElzssi7s4X` |
| Service restart | `Stop-Service` / `Start-Service` `ATsoftERP_API`, `ATsoftERP_Web` (NSSM, LocalSystem); Caddy untouched |
| Post-restart ports | API :4000 (PID 36112), Web :3000 (PID 16688) |

### Artifact parity proof

| Artifact | Files (release) | Files (deployed) | Byte-identical | Mismatches | Missing |
|---|---|---|---|---|---|
| API `dist` | 4250 | 4250 | 4250 | 0 | 0 |
| Web `.next` (all, excl. `node_modules`) | 2522 | 2522 | 2522 | 0 | 0 |
| Web `.next\standalone` non-`node_modules` | 929 | 929 | 929 | 0 | 0 |
| `standalone\apps\web\server.js` | — | — | match | 0 | — |

Note: the deployed `.next\standalone\node_modules` file count (100,109) exceeds the release build (38,933) purely because `Copy-Item` expanded NTFS junctions during transfer; this directory is not used by the NSSM web process (`next start` uses `.next\server`), and the standalone `apps\web` server plus all non-node_modules content is byte-identical. Full web `.next` (static/server/cache/types/diagnostics + standalone app code) is byte-identical to the release build.

**`DEPLOYED_ARTIFACT_PARITY=PASS`**

---

## 10. Safe Production Acceptance (read-only)

Real API at `http://localhost:4000/api/v1`, real JWT login (`admin@atsofterp.com`), Production company/branch headers:

| Probe | Result |
|---|---|
| `POST /auth/login` | 201 |
| `GET /auth/me` | 200 (email=admin@atsofterp.com) |
| `GET /production/orders?page=1&limit=50` | 200, total=**4** |
| `GET /production/performance-targets?page=1&limit=50` | 200, total=0 |
| `GET /audit-logs?page=1&limit=5` | 200 |
| `GET /health` | 200 |
| Any 5xx | none |

**`PRODUCTION_HEALTH/PASS`, `PRODUCTION_WEB/PASS`, `SAFE_ACCEPTANCE=PASS`**

(During acceptance a first probe used `GET /audit/logs` which does not exist; the controller path is `/audit-logs`. This was a probe-path correction, not a server error. Corrected; no code change.)

---

## 11. Post-Deploy Regression

| Gate | Result |
|---|---|
| FULL API tests | 165 suites, **2914/2914 pass** |
| FULL Web tests (jest logic) | 36 suites, **1011/1011 pass** |
| Typecheck (all workspaces) | PASS (`tsc --noEmit`) |
| API build | PASS (this release's build) |
| Web build | PASS (this release's build) |
| `prisma validate` | PASS |
| `prisma generate` | PASS |
| `prisma migrate status` (Production) | "Database schema is up to date!" (0 pending) |
| i18n check | `6110 EN = 6110 AR`, fully synchronized |
| Raw-keys check | PASS |
| Route contract | `MATCHED=1112, MALFORMED=0, UNRESOLVED=0, MISMATCHES=0` |
| Permission-UI verification | PASS |
| Credentials check | PASS (no hardcoded credentials in tracked files) |
| UI baseline integrity | 99 checks PASS |
| `git diff --check` (worktree + main repo) | clean |

**`FULL_API_TESTS=2914`, `FULL_WEB_TESTS=1011`, `FAILED_TESTS=0`**

---

## 12. Final Production Data Safety

| Check | Result |
|---|---|
| `production_orders` | 4 (unchanged; `PO-000001` still DRAFT, others unchanged) |
| `audit_logs` | 1626 (baseline 1624 + **2** `LOGIN` authentication-session rows from the safe-acceptance logins at 04:24:32 and 04:24:55 — normal auth auditing, not business DML) |
| `companies` / `users` | 47 / 11 (unchanged) |
| Pollution `cmue%` (orders/PT/MR/transitions) | 0 / 0 / 0 / 0 |
| `repair_migration_recorded` | 1 (registered) |
| `audit_logs.details` type | `nvarchar(MAX)` |
| Max live `LEN(details)` | 434 |
| Synthetic fixtures created by release | **0** |
| Business DML performed by release | **0** (migration DDL only; plus the 2 acceptance login audit rows above) |

**`PRODUCTION_SYNTHETIC_FIXTURES=0`, `PRODUCTION_BUSINESS_DML_FROM_RELEASE=0`, `FINAL_DATA_SAFETY=PASS`**

---

## 13. Server Resource Notes

- The release clone `ATsoftERP_RELEASE_20260924` remains present on the instance for post-gate inspection and can be dropped by an administrator when confirmed against the recorded evidence. Its `.mdf/.ldf` live under `C:\ATsoftERP\Temp\`. It was used only for rehearsal/smoke; no Production data was disturbed beyond the gated DDL on `ATsoftERP_DB`.
- The backup evidence copy is retained in `evidence\release-backup\`.

---

## 14. Conclusion

All gates of the STRICT production release checklist passed in order. The Production database schema now matches the declared Prisma model (`audit_logs.details` = `NVARCHAR(MAX)`), the migration is registered with the canonical checksum, the built artifact deployed is byte-identical to the release source at `be4116ca`, all regression gates pass, and no business data was mutated or fabricated.

**`PRODUCTION_PHASE_1=CLOSED`**

Governance record: this document committed at the recloseout commit; `origin/main` fast-forwarded; `HEAD==origin/main`, `0/0` ahead/behind, worktree clean.