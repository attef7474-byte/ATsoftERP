# Runtime SQL Server Authentication Hotfix Proof

**Date:** 2026-08-19
**Branch:** checkpoint/backend-lan-responsive-shell
**Pre-hotfix baseline:** `60000adca42782eafbbd326858b6ade3a78f4643`

---

## Symptom

```
ConnectionError: Login failed for user ''
```

Call path: `PrismaMssql → mssql → tedious → ELOGIN`

The Prisma runtime connection failed because `DATABASE_URL` used `integratedSecurity=true` (Windows Integrated Authentication). The `mssql`/`tedious` driver used by `PrismaMssql` does not support Windows Integrated Authentication through the `sqlserver://` URL protocol.

## Root Cause

`apps/api/.env` contained:

```
DATABASE_URL="sqlserver://localhost:50079;database=ATsoftERP_DB;integratedSecurity=true;trustServerCertificate=true"
```

This worked for Batch F (raw `msnodesqlv8`) but NOT for Prisma's `PrismaMssql` adapter (which uses `mssql`/`tedious`).

## Working Diagnostics

| Path | Result |
|------|--------|
| `sqlcmd -E` (Windows admin) | PASS |
| Raw `msnodesqlv8` with `Trusted_Connection=yes` | PASS |
| PrismaMssql with `integratedSecurity=true` | FAIL (ELOGIN) |
| sqlcmd with `-U atsofterp_app -P <secret>` | PASS |

## SQL Server Properties

| Property | Value |
|----------|-------|
| SQL_SERVER | DELL\WINCC |
| SQL_INSTANCE | WINCC |
| SQL_VERSION | 13.0.5108.50 (SQL Server 2016 SP2-GDR Express) |
| IS_INTEGRATED_SECURITY_ONLY | **0** (MIXED MODE — SQL auth available) |
| WINDOWS_ADMIN_LOGIN | DELL\attef |

## Solution

| Action | Result |
|--------|--------|
| SQL_SERVER_AUTH_MODE_CHANGED | **NO** (already MIXED MODE) |
| SQL_SERVER_RESTARTED | **NO** |
| APPLICATION_PRISMA_ARCHITECTURE_CHANGED | **NO** (PrismaService unchanged) |
| RAW_MSNODESQLV8_USED_FOR_NORMAL_RUNTIME | **NO** (Batch F tooling only) |
| BUSINESS_DATA_CHANGED | **NO** (delta = 0) |

### What Changed

1. **SQL Login**: Reset `ATsoftERP_App` password to a new 32-character cryptographically random value
2. **Database Permissions**: Granted `db_datareader` + `db_datawriter` roles to `atsofterp_app` user in `ATsoftERP_DB`
3. **Environment Configuration**: Updated `DATABASE_URL` in `apps/api/.env` from `integratedSecurity=true` to `user=ATsoftERP_App;password=<secret>`

### What Did NOT Change

- `PrismaService` (unchanged)
- `PrismaModule` (unchanged)
- `prisma.config.ts` (unchanged)
- `schema.prisma` (unchanged)
- Any application source code (unchanged)
- Any database business data (unchanged)

## Permission Report

| Check | Result |
|-------|--------|
| APP_LOGIN_SYSADMIN | NO |
| APP_DB_OWNER | NO |
| APP_DDL_ADMIN | NO |
| CAN_SELECT | YES (db_datareader) |
| CAN_INSERT | YES (db_datawriter) |
| CAN_UPDATE | YES (db_datawriter) |
| CAN_DELETE | YES (db_datawriter) |
| CAN_ALTER_DATABASE | NO |
| CAN_CREATE_TABLE | NO |
| Migration privileges | Separate (not granted to runtime login) |

## Verification Results

| Check | Result |
|-------|--------|
| PRISMA_RUNTIME_CONNECTION_PROBE | PASS (14 companies, 156 depts, 56 people) |
| RUNTIME_SQL_IDENTITY | PASS (atsofterp_app → ATsoftERP_DB) |
| API_STARTUP | PASS (all modules initialized) |
| API_HEALTH | PASS (`{"status":"ok"}`) |
| REAL_DB_API_READBACK | PASS (401 = correct JWT required) |
| BUSINESS_DATA_DELTA | 0 (all 13 tables match baseline) |
| JOUBAH_DATA_CHANGED | NO |
| PRISMA_VALIDATE | PASS |
| PRISMA_GENERATE | PASS |
| API_TYPESCRIPT | PASS |
| WEB_TYPESCRIPT | PASS |
| TESTS | 115 suites / 1736 tests / 0 failures |
| REAL_DB_SMOKE | PASS (`npm run smoke:db`) |
| SECRET_SCAN | PASS |

## New Smoke Check Script

`apps/api/scripts/runtime-auth-probe.js` — added as `npm run smoke:db`

- Uses actual Prisma runtime configuration
- Connects to actual configured DB
- Reads company/dept/people counts
- Reports SQL identity
- Disconnects cleanly
- Opt-in via `npm run smoke:db --workspace apps/api`

## Secret Storage

- Password stored ONLY in `apps/api/.env` (gitignored)
- `.env` verified NOT staged: `git check-ignore apps/api/.env` → PASS
- No password in source code, commits, or proof documents

## Data Integrity

All 13 business tables verified unchanged:

```
companies                            = 14
branches                             = 10
administrations                      = 43
departments                          = 156
job_titles                           = 29
operational_people                   = 56
operational_person_assignments       = 23
supervisor_assignments               = 0
maintenance_personnel                = 39
machine_responsibility_assignments   = 70
organizational_units                 = 1
machines                             = 8
production_lines                     = 5
```
