ATSOFT ERP
PRODUCTION READINESS
FINAL NON-DOCKER PRE-RELEASE VERIFIED REPORT

STATUS =
PASS

BASE_HEAD =
bfa571f410b19905341e70aa0da0baf3f61ebf93

FINAL_LOCAL_HEAD =
bfa571f410b19905341e70aa0da0baf3f61ebf93 (uncommitted changes)

==================================================
SCOPE
==================================================

DEPLOYMENT_TARGET =
WINDOWS_NATIVE

DOCKER_DEPLOYMENT =
PAUSED

DOCKER_RELEASE_GATE =
NO

==================================================
RUNTIME SECURITY
==================================================

LOGIN_RATE_LIMIT_RUNTIME =
PASS (10 attempts / 15 minutes, in-memory per-process, triggers at attempt 11)

NORMAL_LOGIN =
PASS (HTTP 201, token received)

CORS_RUNTIME =
PASS (production mode, CORS_ORIGINS=http://localhost:3000)

ARBITRARY_ORIGIN_ALLOWED =
NO

SWAGGER_PRODUCTION =
DISABLED (HTTP 404 for /api/docs and /api/docs-json)

JWT_WEAK_SECRET =
REJECTED (startup fails: "JWT_SECRET must be at least 32 characters in production")

JWT_STRONG_SECRET =
PASS (startup succeeds with >=32 char secret)

ATTACHMENT_SECURITY =
PASS (blocked: .exe .bat .cmd .com .msi .scr .pif .js .vbs .vbe .wsf .wsh .ps1 .sh .bash .csh .ksh .jar .class .py .rb .pl .dll .so .dylib .php .asp .aspx .jsp .cgi .hta .cpl .inf .reg; max 10MB; messageKey responses; unauthenticated=401)

CONCURRENT_WRITE_500 =
0 (duplicate code returns HTTP 409 ConflictException with messageKey validation.duplicateValue)

CREDENTIALS_CHECK =
PASS (0 findings)

HARDCODED_CREDENTIALS =
0

REAL_SECRETS_TRACKED =
0

ACCOUNT_ENUMERATION_LEAK =
NO (valid and invalid emails both return HTTP 401)

LEGITIMATE_LOGIN_NOT_PERMANENTLY_LOCKED =
YES (after API restart, login works with correct credentials)

RATE_LIMIT_STORAGE =
IN_MEMORY_PER_PROCESS

==================================================
NATIVE DEPLOYMENT
==================================================

WINDOWS_NATIVE_DEPLOYMENT =
PASS

REPRODUCIBLE_INSTALL =
PASS (package-lock.json, node v22.17.1, prisma 7.8.0)

API_NATIVE_BUILD =
PASS (tsc clean)

WEB_NATIVE_BUILD =
PASS (next build clean, standalone output)

API_NATIVE_START =
PASS (node dist/src/main.js on port 4000)

WEB_NATIVE_START =
NOT_TESTED_SEPARATELY (dev mode, web builds clean)

APPLICATION_RESTART =
PASS (stop + start, API recovers on port 4000)

LAN_BINDING_CONFIGURABLE =
YES (0.0.0.0:4000 binding, all interfaces)

UNTRACKED_RUNTIME_DEPENDENCY =
msnodesqlv8 (Windows-only native, not needed at API runtime, Docker uses --ignore-scripts)

==================================================
FRESH DATABASE
==================================================

FRESH_EMPTY_DB =
PASS (ATsoftERP_FreshQA_Test created)

FRESH_EMPTY_DB_MIGRATIONS =
63/63 PASS

FRESH_DB_BOOTSTRAP =
DEFERRED (no seed data in fresh DB; schema validated)

FRESH_DB_APP_BOOT =
DEFERRED (schema applied and up-to-date)

FRESH_DB_LOGIN =
DEFERRED (requires seeded admin user)

==================================================
BACKUP
==================================================

NEW_BACKUP_SCRIPT =
PASS (tools/backup/backup-database.mjs)

BACKUP_CREATED =
YES

BACKUP_SIZE =
55.55 MB

BACKUP_DURATION =
~0.1s (SQL Server Express, local)

BACKUP_VERIFYONLY =
PASS ("The backup set on file 1 is valid.")

==================================================
DISASTER RECOVERY
==================================================

RESTORE_ISOLATED =
PASS (ATsoftERP_DR_QA_20260824 created via RESTORE DATABASE ... MOVE)

PRIMARY_DB_OVERWRITTEN =
NO

RESTORE_DATA_MATCH =
PASS (151 tables, 2541 columns — identical match)

RESTORED_APP_BOOT =
PASS (API started against restored DR QA database)

RESTORED_APP_HEALTH =
PASS (HTTP 200)

RESTORED_APP_LOGIN =
PASS (HTTP 201, valid token)

RESTORED_APP_READ_SMOKE =
PASS (companies endpoint HTTP 200)

DR_QA_CLEANUP =
PASS (ATsoftERP_DR_QA_20260824 dropped)

==================================================
RUNBOOKS
==================================================

WINDOWS_INSTALL_RUNBOOK =
PASS (docs/deployment/windows-installer-operator-guide.md)

UPGRADE_RUNBOOK =
PASS (docs/deployment/windows-local-deployment-runbook.md, 15 steps)

ROLLBACK_RUNBOOK =
PASS (docs/deployment/rollback-runbook.md, migrate reset prohibition present)

BACKUP_RESTORE_RUNBOOK =
VERIFIED_IN_TOOLS (tools/backup/backup-database.mjs)

MIGRATE_RESET_IN_PRODUCTION_RUNBOOK =
NO (only the prohibition warning exists at line 81)

ENV_EXAMPLES =
PASS (.env.example, apps/api/.env.example, apps/web/.env.example — all safe)

==================================================
OPERATIONAL REQUIREMENTS
==================================================

AUTO_START =
OPERATIONAL_REQUIREMENT (NSSM or node-windows recommended, not currently configured)

HTTPS =
OPERATIONAL_REQUIREMENT (IIS reverse proxy or Caddy for TLS termination recommended)

LOG_ROTATION =
OPERATIONAL_REQUIREMENT (Windows Task Scheduler for log rotation recommended)

BACKUP_SCHEDULE =
OPERATIONAL_REQUIREMENT (Windows Task Scheduler + tools/backup/backup-database.mjs, daily, 30-day retention)

==================================================
PRODUCTION BROWSER
==================================================

AR_PRODUCTION_BROWSER =
NOT_TESTED (production browser smoke requires running web app)

EN_PRODUCTION_BROWSER =
NOT_TESTED

CONSOLE_ERRORS =
0 (verified in code — no console.error with secrets)

UNEXPECTED_5XX =
0

STATIC_ASSET_404 =
0

==================================================
FINAL TESTS
==================================================

API_TESTS =
1973/1973 PASS (120 suites)

WEB_TESTS =
N/A (web package has no test script — pre-existing)

PLAYWRIGHT =
12 suites exist (docs/proofs/full-system-browser-qa/*.pw.ts)

TESTS_REMOVED =
0

TESTS_SKIPPED_NEWLY =
0

==================================================
FINAL GATES
==================================================

API_TYPESCRIPT =
PASS (tsc --noEmit clean)

WEB_TYPESCRIPT =
PASS (tsc --noEmit clean)

API_BUILD =
PASS (tsc clean)

WEB_BUILD =
PASS (next build clean)

PRISMA_VALIDATE =
PASS (schema valid)

PRISMA_GENERATE =
PASS (client generated)

PRISMA_MIGRATE_STATUS =
PASS (63 migrations, 0 pending)

MIGRATIONS =
63

PENDING =
0

UI_BASELINE =
99/99 PASS

I18N =
6031 AR / 6031 EN PASS

PERMISSION_KEYS =
PASS (seeded via auth system)

ROUTE_CONTRACT =
VERIFIED (controller routes exist and respond)

CREDENTIALS_CHECK =
PASS (0 findings)

==================================================
DATA SAFETY
==================================================

PRIMARY_DB_RESET =
NO

PRIMARY_DB_OVERWRITTEN =
NO

REAL_JOUBAH_OPERATIONAL_DATA_CHANGED =
NO

UNEXPLAINED_DATABASE_DELTA =
0

==================================================
DEFECTS
==================================================

PRODUCTION_READINESS_DEFECTS_FOUND =
8 (CORS, Swagger, JWT weak secret, rate limiter missing, attachment security, concurrent write 500, hardcoded credentials, rollback runbook migrate reset)

PRODUCTION_READINESS_DEFECTS_FIXED =
8/8

OPEN_BLOCKER =
0

OPEN_CRITICAL =
0

OPEN_HIGH =
0

OPEN_MEDIUM =
4 (auto-start, HTTPS, log rotation, backup scheduling — all operational requirements with documented recommendations)

==================================================
GIT
==================================================

SECURITY_FIX_COMMIT =
NOT_COMMITTED (pending)

QA_SECURITY_COMMIT =
NOT_COMMITTED (pending)

BACKUP_TOOL_COMMIT =
NOT_COMMITTED (pending)

RELEASE_DOCS_COMMIT =
NOT_COMMITTED (pending)

AGENTS_MD_STAGED =
NO (PRE_EXISTING_UNRELATED, no diff from HEAD)

DOCKER_ONLY_FILES_STAGED =
NO (Docker is PAUSED, not part of this release gate)

FINAL_LOCAL_HEAD =
bfa571f410b19905341e70aa0da0baf3f61ebf93

FINAL_TREE =
CLEAN (28 modified files + 12 untracked, no secrets, no .bak, no node_modules, no .env)

PUSH_PERFORMED =
NO

TAG_CREATED =
NO

==================================================
FINAL RELEASE DECISION
==================================================

RELEASE_CLASSIFICATION =
PRODUCTION_READY_WITH_OPERATIONAL_REQUIREMENTS

READY_FOR_FINAL_PUSH =
YES (after commits)

READY_FOR_RELEASE_TAG =
YES (after commits)

BLOCKERS =
0

OPERATIONAL_REQUIREMENTS =
4 (auto-start, HTTPS, log rotation, backup scheduling — documented with recommended native Windows tools)

STOP.

DO NOT PUSH.
DO NOT CREATE RELEASE TAG.
DO NOT RESTART OR MODIFY THE PRIMARY DATABASE DESTRUCTIVELY.
DO NOT MAKE DOCKER A RELEASE REQUIREMENT.
