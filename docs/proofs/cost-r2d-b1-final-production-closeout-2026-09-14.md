# COST-R2D-B1 final production closeout

Evidence date: 2026-09-14. Technical production gates: PASS.

Implementation commit: `708a8c0ce0a6cb3d8c9f6fff5bb7aaddd529f009`.
Base origin/main: `20c5e1ec53b8a873e56018c5374254d3dfb75e67`.

This document records completed source, database, deployment, and validation work. Release closure additionally requires the normal fast-forward push and post-push equality receipt in the final handoff. Following the non-recursive Git evidence model, this document does not claim its own future commit hash or a push that had not happened when it was written. The implementation commit is not amended; this document and its companion form a separate docs-only commit.

## Continuation boundary and root cause

The user authorized autonomous completion of the existing B1 effort, including isolation, tests, backup/restore rehearsal, production DDL/registration, artifact deployment, narrowly required seed, commits and normal push. No B2 execution, tags, force push, Docker change, Canary01 change, or destructive data correction was authorized or performed.

The original dirty main tree was preservation-only. The old B1 worktree contained stripped source inconsistent with its accepted evidence: required mirrors had disappeared while an earlier generated Prisma Client could still expose those fields. Compilation with that stale generated client was therefore a false-positive, not proof of the source contract. Historical accepted catalogs/fingerprints and current files independently confirmed the contradiction. Earlier failed or incomplete proof was not relabelled successful. The declined `finalize-source-contract.cjs` proposal was not executed.

A new isolated worktree was based on the verified origin/main commit:

`%LOCALAPPDATA%/Temp/ATsofterp-COST-R2D-B1-FINAL-20260914/worktree`

Branch: `cost-r2d-b1-final-20260914`. Only confirmed B1 source was transplanted and reconciled with the accepted frozen contract. Current source, fresh generation, new replay, real backup clone and deployed production were each verified. The [complete field/constraint/key matrix](cost-r2d-b1-frozen-contract-and-key-safety-2026-09-14.md) documents the recovered contract.

## Exact source scope and files

Implementation: 23 files, 2583 insertions and three deletions. No unrelated maintenance/search/MIG-PROV changes were imported.

Eight existing files modified:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed/seed.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/common/i18n/api-messages.ts`
- `apps/web/src/lib/i18n/locales/ar/index.ts`
- `apps/web/src/lib/i18n/locales/en/index.ts`
- `apps/web/src/lib/i18n/types.ts`
- `scripts/check-i18n.mjs`

Fifteen implementation files created:

- `apps/api/prisma/migrations/20260904130000_cost_r2d_b1_overhead_source_period_foundation/migration.sql`
- `apps/api/prisma/seed/seed-overhead-permission-keys.ts`
- In `apps/api/src/modules/factory/operational-overhead/`: `operational-overhead.constants.ts`, `operational-overhead.controller.ts`, `operational-overhead.module.ts`, `operational-overhead.service.ts`, `operational-overhead.service.spec.ts`, `overhead-hardening.spec.ts`, `overhead-negative-scope.spec.ts`, `overhead.database-contract.spec.ts`, `dto/overhead-amount.validator.ts`, `dto/overhead-entry.dto.ts`, `dto/overhead-period.dto.ts`.
- `apps/web/src/lib/i18n/locales/ar/operational-overhead.ts`
- `apps/web/src/lib/i18n/locales/en/operational-overhead.ts`

Two proof documents are created in the separate docs commit: this file and `cost-r2d-b1-frozen-contract-and-key-safety-2026-09-14.md`. No scratch runner, log, environment file, backup, generated client, build output, or dependency directory is committed.

### API and permission surface

All routes are authenticated, permission-guarded and active-context-scoped under `/api/v1/production`.

| Resource | Handlers |
|---|---|
| overhead-periods | POST, GET list, GET :id, PATCH :id, PATCH :id/open, PATCH :id/close, DELETE :id (cancel) |
| overhead-entries | POST, GET list, GET :id, PATCH :id, PATCH :id/finalize, DELETE :id (soft delete) |

Thirteen handlers. No frontend route was added or changed; this is the explicitly approved API-only B1 foundation with Arabic/English messages and namespace registration, not a claim of a new interactive UI.

Ten seeded permission keys:

- `production-cost-overhead-period:` read, create, update, close, delete.
- `production-cost-overhead:` read, create, update, finalize, delete.

Production initially contained zero B1 permissions. A narrow transaction reused the committed seed definitions, inserted exactly ten ACTIVE permissions and ten links to the existing SUPER_ADMIN role. Permission totals changed 683 -> 693; role-permission totals 229 -> 239. Existing permissions were not rewritten, no role/user was created, and the broad seed was not run. Non-admin assignments remain administrator-managed. Guard allow/deny and normal authenticated operator/read-only/foreign-company behavior were proven on isolated databases.

## Fresh-client and focused proof

Prisma Client was regenerated from corrected isolated source, then regenerated again from the exact committed source. Final Prisma version: 7.8.0. Required mirror fields appear in both models (companyKey/branchKey) and entry provenance (sourceCostCenterKey). Fresh runtime loaded that generated client, not the stale historical one. Production's deployed client was compared byte-for-byte with the regenerated isolated client.

Focused tests: four suites / 123 tests PASS. Count history: 76 preserved B1 tests plus 47 added tests; no removed or newly skipped tests. Tests cover service rules, mirror/schema contracts, negative scope, permissions, money/unknown-field validation, and locking/concurrency hardening. Full base-to-B1 API count: 150 suites / 2621 tests -> 154 suites / 2744 tests.

## New zero replay

Database: `ATsoftERP_B1_FRESH_20260914T050033`, newly created for this run, not renamed or represented as a production backup clone.

The 81 pre-B1 migration directories were compared byte-for-byte against the verified base; mismatch count = 0. Supported Prisma deploy of those 81 migrations succeeded. The exact D4CE B1 SQL then succeeded with SQLCMD exit 0, B1 SQL 1753 count 0 and B1 index-width warning count 0. Supported `prisma migrate resolve --applied` registered B1; `migrate status` reported 82 migrations, up to date.

The fresh full-history replay has 84 active history rows for 82 distinct names because two pre-existing migrations self-register as well as being registered by the engine:

- `20260728180621_maintenance_sparepart_classification_cost_attribution`
- `20260728200621_maintenance_part_condition_replacement_action`

Each has two active rows only on zero replay. B1 is registered exactly once. No historical migration or history row was edited to hide this artifact. Production and its backup-derived clone each have 82 active rows, zero duplicate active names and zero unresolved failures. This pre-existing full-history behavior is not a B1 duplicate or a production migration-engine failure.

Fresh B1 diff: only two equivalent named status-default replacements, four SQL statements total. No B1 ALTER COLUMN or unexplained schema drift. The complete interpretation and field matrix are in the companion document; no diff SQL was applied.

### Fresh authenticated runtime

53 HTTP/real-DB cases PASS; zero failed cases, zero user-visible HTTP 500. This includes the full lifecycle and tenant/permission proof below, plus unknown cost-purpose rejection, client currency rejection, cross-branch provenance rejection and direct DB NULL/mismatch/over-bound mirror rejection. Fixture cleanup reported zero periods, entries, audit rows, companies and branches. The isolated proof API was stopped and port 4010 released.

## Backup and real backup-derived clone

Production database: `ATsoftERP_DB`, local SQL Server TCP port 50079. Before backup/deployment: no B1 tables or B1 migration row, both MIG-PROV migrations active, zero active duplicates and unresolved failures. Origin/main was re-fetched and remained the expected base.

COPY_ONLY backup with CHECKSUM:

`C:\Program Files\Microsoft SQL Server\MSSQL13.WINCC\MSSQL\Backup\ATsoftERP_DB_COST_R2D_B1_COPYONLY_20260914T053435.bak`

Size: 74,694,656 bytes. File UTC timestamp: `2026-09-14T02:35:16.1125975Z`.

SHA256: `8DB24B5B29981C4892AD920EA6B60EFC339771B7E61BD80FE273CA854E61DF17`.

Backup exit 0, 9106 pages processed. `RESTORE VERIFYONLY ... WITH CHECKSUM` exit 0: backup set valid. The actual SQL Server default backup directory was resolved; no assumed path or empty backup placeholder was used.

The exact backup was restored with CHECKSUM, MOVE and RECOVERY into `ATsoftERP_B1_PRODCLONE_20260914T053435`, with distinct MDF/LDF files in the SQL Server data directory. Restore exit 0 and database ONLINE. Clone preconditions independently confirmed no B1 objects/history, both MIG-PROV migrations active, and no duplicate/unresolved migration entries.

The exact D4CE migration ran on this clone once, exit 0, no B1 width warnings or SQL 1753. Its B1 catalog passed all 41-column / nine-index / 16-CHECK / six-FK checks. Required mirrors = 5; mismatches = 0; unsafe keys = 0; disabled/untrusted constraints = 0; FK-width mismatches = 0. Supported Prisma resolve and migration status passed with the exact checksum and one B1 registration.

Clone authenticated mutation runtime: 47 HTTP/real-DB cases PASS, zero failures and zero HTTP 500. It used the rebuilt API and freshly generated client. It proved create/read/edit-same-record/open/finalize/close/cancel/soft-delete, duplicate conflicts and serialized concurrent writes, permission denial, tenant denial, persisted Decimal/currency/provenance, and audit events. No production mutation workflow was fabricated.

Fixture cleanup reported zero surviving periods, entries, audit rows, companies and branches. Existing SUPER_ADMIN was preserved during cleanup. Clone proof API was stopped; port 4010 released.

The sorted non-B1 row-count hash before/after clone B1 DDL was `3498BFBA35307EE294CBFDC84FD16917543E037989FC2AD2E5E33B4A3BB04C28` (including migration bookkeeping before resolve). After clone runtime cleanup, the business-table row-count hash excluding B1 and `_prisma_migrations` matched production: `50B365ACBE4471A899CC65E0075C09AEDE8BBD116FEA6B3FFE2F78ADBF06FB32`. These hashes certify row-count invariance, not every business field's content. Production's subsequent authorized permission seed has the explicitly recorded expected count changes above.

## Production migration and artifact deployment

Immediately before DDL, service health was 200 and no concurrent migration request or unexpected B1 state was found. `ATsoftERP_API` was stopped and port 4000 released. Preconditions were repeated after stopping.

The frozen D4CE SQL was applied once to production, SQLCMD exit 0, no B1 width warnings or SQL 1753. No interactive production SQL patch, destructive correction, db push, reset, history edit, or migration amendment occurred. Catalog acceptance preceded supported Prisma registration.

`prisma migrate resolve --applied 20260904130000_cost_r2d_b1_overhead_source_period_foundation` succeeded, followed by `prisma migrate status`: 82 migrations, up to date. Stored production checksum exactly matches D4CE. B1 active/finished rows = 1; rolled-back B1 rows = 0. Registration timestamp: `2026-09-14T02:54:22.1112293Z`. Active migration rows = 82; duplicate active names = 0; unresolved failures = 0; MIG-PROV active rows = 2.

The reviewed additive migration creates only the two empty B1 tables and constraints/indexes. Existing-data backfill is unnecessary. Recovery assets are the verified predeployment database backup and retained pre-B1 API/client artifact backup. Recovery is not an authorization to drop tables or restore production over newer data automatically; any future recovery must account for subsequent writes.

### Exact deployed artifact

NSSM service: `ATsoftERP_API`; application `C:\Program Files\nodejs\node.exe`; working directory `C:\Users\attef\PycharmProjects\Trae\ATsofterp\apps\api`; parameters `dist\src\main.js`.

The API was built from the isolated implementation commit, not the original dirty source. Only generated `apps/api/dist` and `node_modules/.prisma/client` artifacts were deployed to the actual service tree. Pre-B1 artifacts were retained under:

`%LOCALAPPDATA%/Temp/ATsofterp-COST-R2D-B1-FINAL-20260914/prod-artifact-pre-b1-20260914T055500/`

| Artifact | Built/deployed files | Path/hash mismatches | Manifest SHA256 |
|---|---:|---:|---|
| apps/api/dist | 4186 / 4186 | 0 | D7C9C29B6B9D1050830834FBCAA834B6066976F8B0F6A47E5A9496628DDADAA0 |
| node_modules/.prisma/client | 16 / 16 | 0 | 9B6219D5DD82AA8C46981F91C1E3B0E5F4F360A1B6A3B822C9F87AA604072153 |

Manifest hashes are SHA256 of the JSON of sorted relative-path/file-SHA256 pairs. The installed @prisma/client package also matched between source/deployment (76 files; package.json SHA256 `A64669EC1B457F2651B3DE564DB6B9604E89460CB349641AFFFA73B0BBF3939A`). Final regeneration and rebuild were followed by another full artifact comparison: zero mismatches.

### Production runtime acceptance

On the final resumed turn, the service was observed STOPPED, then explicitly started and observed RUNNING. Correct health URL `/api/v1/health` returned HTTP 200. Initial probes of `/health` and `/api/health` returned 404 because those are not the versioned health route; they are not represented as successful probes. Successful health was confirmed at `2026-09-14T17:12:06Z` and again during the read proof.

Read proof used the deployed service, deployed Prisma Client and production DB with an existing active company/branch. Both paginated B1 lists succeeded; required mirrors were queried from the real catalog. Missing context was rejected in both lists (400); nonexistent period/entry detail reads returned 404. Both HTTP B1 list routes rejected unauthenticated requests with 401. No JWT impersonation, temporary user or synthetic operational record was introduced into production.

This is a production service/DB scoped-read proof plus HTTP health/authentication-denial proof; it is not claimed to be an authenticated production-user browser session. Authenticated mutations and permission/tenant HTTP proof ran on the actual backup clone as required. Production periods = 0 and entries = 0 before and after; synthetic rows created/surviving = 0.

Final production catalog: two B1 tables, 41 columns, five required bounded mirrors, nine indexes, 16 trusted/enabled CHECKs, six trusted/enabled FKs. All ordered B1 catalog values equal the fresh and clone exports. B1 unsafe keys = 0; targeted MIG-PROV unsafe keys = 0; targeted MIG-PROV disabled/untrusted CHECKs/FKs = 0; B1 out-of-scope allocation/ledger/B2 tables = 0.

## Tenant, permission and audit evidence

Authenticated isolated proofs verified Company A can create/read its period; Company B cannot read or reference it and its list does not leak Company A records; a disallowed company header is rejected; foreign-company cost centers fail with 404. The fresh proof additionally verified cross-branch cost-center denial. Unit suites cover scoped reads/updates and invalid references. Missing context fails closed; SUPER_ADMIN behavior is explicit.

Read-only role can list; missing entry:create and period:update permissions return 403. Invalid bearer tokens fail. Every controller handler maps to the established permission keys, and normal roles are tested, not only SUPER_ADMIN.

Real audit rows contained tenant-scoped period CREATE/OPEN/CLOSE/CANCEL and source CREATE/UPDATE/FINALIZE/DELETE actions. DB persistence checks verified amount, company currency, tenant/provenance and actor fields; closing/finalization metadata and soft-delete timestamps were persisted. Service writes audit through the same transaction client; focused tests pin atomicity and shared locking. Clone/fresh fixture audit rows were cleaned with the fixtures, not production history.

## Pre-production and final full regression

Pre-production full checks passed before the production boundary. All required checks were rerun after deployment from the exact committed isolated source:

| Check | Pre-production | Final |
|---|---|---|
| Focused B1 Jest | 4 suites / 123 tests PASS | 4 / 123 PASS |
| Full API Jest | 154 suites / 2744 tests PASS | 154 / 2744 PASS |
| Full Web logic Jest | 34 suites / 964 tests PASS | 34 / 964 PASS |
| API typecheck | PASS | PASS |
| Web typecheck | PASS | PASS |
| API build | PASS | PASS |
| Web production build | PASS, 188 static pages | PASS, 188 static pages |
| Prisma validate / generate | PASS | PASS |
| Prisma production migration status | Checked at deployment | PASS, 82 migrations up to date |
| UI baseline | 99 checks PASS | 99 checks PASS |
| i18n | PASS | 6023 EN / 6023 AR keys; 21 namespaces; 9630 literal uses resolved |
| Raw-key / permission UI | PASS | PASS |
| Route contract | PASS | 1100 audited routes matched; malformed/unresolved/mismatched = 0 |
| git diff --check | PASS | PASS before docs commit |

Final API tests took 164.998s; focused tests 31.039s; Web tests 11.136s. New skips = 0; removed tests = 0. Final logs are retained outside Git in the local evidence directory.

### Warnings and boundaries, not hidden failures

- Pre-production API workers emitted a forced-exit/cleanup warning despite all tests passing; final serial API run completed without that warning.
- Web tests include missing-translation warning fixtures and some baseline auth/common warnings. i18n and raw-key gates pass; raw-key checker identifies 33 existing dynamic sites with fallback contracts.
- Next build warns that no ESLint configuration is detected. The earlier build also emitted webpack cache snapshot warnings; final build compiled successfully and generated 188 pages.
- Dependency installation reported 25 existing audit findings (7 moderate, 17 high, 1 critical). No unrelated dependency upgrade or automated audit fix was included.
- Zero-replay historical self-registration and the two equivalent B1 status-default renderings are explained above rather than suppressed.
- No B1 frontend page exists in this API-only scope. No new interactive Arabic/RTL or English/LTR browser flow is claimed; synchronized translations and the accepted UI baseline were validated.
- Key safety is scoped to B1 and the protected MIG-PROV targets, not a certification that every unrelated legacy index in this database has been remediated.

## Git preservation and release receipt boundary

Original tree: `C:\Users\attef\PycharmProjects\Trae\ATsofterp`, branch main at the unchanged base commit. Its pre-existing staged/unstaged B1 and MIG-PROV reversion residue were not committed. The prior B1 worktree was not reused for deployment.

The original inventory was rechecked: 4209 files, zero byte-hash mismatches; original short status identical; original index inventory hash identical; original HEAD unchanged; stash@{0} unchanged; tag-set hash unchanged. Authorized ignored generated deployment artifacts are separately identified above; they do not make the original dirty source tree clean. No original cleanup, reset, stash operation, branch switch, or tag operation occurred.

Before push, fetch must still show the expected base origin/main and the isolated commits must be its descendants. Push is `HEAD:main` without force. The final response records the actual docs commit, push result, isolated HEAD == fetched origin/main, ahead/behind 0/0, and a second preservation check. Original local main intentionally remains at its earlier commit with its user changes; it must not be reset to make its HEAD match the remote.

`MIG_PROV_REVERSION_IN_PUSHED_B1_COUNT=0` is supported by the isolated base-relative scope: no pre-existing migration was changed; no maintenance/search source was changed; only five inverse relations were added to existing Prisma models. Both protected migrations remain active and their target constraint/key checks pass.

`B2_EXECUTED=NO`. No allocation model, driver, rate, distribution/allocation line, overhead ledger posting, production-run allocation, FG/inventory capitalization, energy-metering work, B2 migration, or unapproved domain was added. Existing general costing/ledger modules elsewhere in the baseline were not removed or relabelled as B1 additions.

## Local evidence index

Local evidence root: `%LOCALAPPDATA%/Temp/ATsofterp-COST-R2D-B1-FINAL-20260914/`.

- `original-inventory.json`, `transplant.json`: original preservation and B1-only reconstruction.
- `fresh-runtime-proof.stdout.log`, `clone-runtime-proof.stdout.log`: 53-case and 47-case authenticated isolated proofs and cleanup counters.
- `fresh-prisma-diff.sql`: unapplied diff, including explained status-default churn.
- `fresh-catalog.json`, `clone-catalog.json`, `production-catalog.json`: read-only ordered SQL catalog exports.
- `final-focused-tests.log`, `final-api-tests.log`, `final-web-tests.log`: final actual test results.
- `final-api-typecheck.log`, `final-web-typecheck.log`, `final-api-build.log`, `final-web-build.log`: final compiler/build results.
- `final-prisma-checks.log`, `final-ui-baseline.log`, `final-route-contract.log`: final schema/client/migration and UI/i18n/route gates.
- `production-acceptance.sql`, `production-closeout.cjs`, `verify-preservation.cjs`, `verify-artifacts.cjs`: local bounded verification/seed runners; not committed or part of application runtime.

Secrets are omitted. Local evidence/backup paths are operational recovery references, not claims that those files are included in the remote repository.
