# COST-R2D-B3 final production closeout

Evidence date: 2026-09-22. Technical production gates: PASS.

Implementation commit: `3c36b98c49b2c965e056850753fd25236c3c8338`.

Parent (base origin/main): `57952886ca690109ce7b79be909755ed0fc4d519`.

This document records the completed B3 source, database, deployment and validation work.
Following the non-recursive Git evidence model used for previous releases, this document
does not claim its own future commit hash or a push that had not happened when it was
written. The implementation commit is not amended; this document is a separate docs-only
closeout commit.

## B3 scope

B3 is the canonical overhead-allocation ledger posting phase. It adds three operations on
a FINAL overhead allocation and one bounded read:

- `POST /production/overhead-allocations/:id/post-to-ledger` — idempotent canonical
  ledger posting with deterministic clientRequestId fingerprint, generation tracking and
  reconciliation-driven auto-repair of missing PRIMARY lines.
- `POST /production/overhead-allocations/:id/ledger-reversal` — reversal of a posted
  PRIMARY line with immutable contract (395 preconditions, 409 on double reversal).
- `GET /production/overhead-allocations/:id/reconciliation` — line-versus-ledger
  comparison returning `ALL_CLEAN`, `LINE_MISSING`, `VALUE_MISMATCH` or
  `CURRENCY_MISMATCH` decisions.
- The B3 adapter writes canonical `PRIMARY_COST`/`REVERSAL` rows with
  `sourceType=OVERHEAD_ALLOCATION_LINE`, `sourceId=allocation id`,
  `sourceLineId=allocation line id` through the existing Unified Cost Ledger writer.
  The generic public posting DTO stays unchanged and does not accept this value.

## Implementation commit and migration

Implementation commit:

- SHA256 commit: `3c36b98c49b2c965e056850753fd25236c3c8338`
- Subject: `feat(cost): implement B3 overhead allocation ledger posting with verified contracts`
- Author: altef ali
- Parent: `57952886ca690109ce7b79be909755ed0fc4d519`

Migration:

- Name: `20260922010000_cost_r2d_b3_overhead_allocation_ledger_source_type`
- File: `apps/api/prisma/migrations/20260922010000_cost_r2d_b3_overhead_allocation_ledger_source_type/migration.sql`
- SHA256 (computed at closeout from the committed file): `AD856BD342497E021EE85686B640D3A988C6D4938379837FB59B3B05E6077220`
- Stored production checksum (lower-case as stored by Prisma):
  `ad856bd342497e021ee85686b640d3a988c6d4938379837fb59b3b05e6077220`

The two values are case-normalized identical; no migration byte drift between commit and
production registration.

## B3 catalog contract

The migration is a constraint-only additive vocabulary extension of the inherited
operational cost ledger. No table, column, row set or non-CHECK constraint changes:

- `operational_cost_transactions_source_type_ck` is dropped and rebuilt WITH CHECK with
  one added vocabulary value `N'OVERHEAD_ALLOCATION_LINE'` (12 -> 13 accepted values).
- Verified on the production-derived clone: EXISTING data rows unaffected (0 inserted /
  0 updated / 0 deleted), new value accepted by Prisma insert, legacy invalid value
  rejected SQL 547, `WITH CHECK` re-creation yields enabled and trusted constraint
  (`is_disabled=0`, `is_not_trusted=0`), catalog deltas 0/0/0/0/1 (tables/columns/
  indexes/FKs exactly unchanged, one CHECK rebuilt).

New reserved business keys (B3 permission seed, idempotent upsert):

- `production-cost-overhead-allocation:post`
- `production-cost-overhead-allocation:reconcile`

## Production backup and clone

Backup used for the clone was created before any B3 mutation:

- Backup target: `ATsoftERP_DB_COST_R2D_B3_COPYONLY_20260922T053825.bak`
- `RESTORE VERIFYONLY ... WITH CHECKSUM` exit 0 — `BACKUP_VERIFYONLY=PASS`

The exact backup was restored into the rehearsal clone:

- `ATsoftERP_B3_PRODCLONE_20260922T053825`

Clone preconditions matched Production before rehearsal: no B3 migration row, no B3
permission rows, 83 applied active migrations, prior checksum inventory valid.

## Clone authenticated runtime

Full authenticated runtime was executed against the real production-derived clone with
the rebuilt API and freshly generated Prisma client:

- `runtime-receipt.json`: stage `complete`, **119 cases / 0 failed**
- `CLONE_RUNTIME_119_0=PASS`

Coverage includes: real password login (2 users + 1 denied), authentication required,
active-context required, unauthorized company header denied, normal period create/open/
source-create x3/finalize x3/close and allocation create/calculate, DRAFT notes update
same record with preserved ID, unknown monetary and calculation field rejection (400),
DRAFT cannot post to ledger (409 `postingRequiresFinal`), allocation finalize + idempotent
repeat, ledger post FINAL (201), exactly N PRIMARY lines and ledger rows with
amount/currency/costPurpose/costCenter/productionRun conservation, source
type/id/line/fingerprint contract, generic POST DTO cannot fabricate the authoritative
overhead source (400), idempotent retry reports already-posted with zero duplicate
PRIMARY, concurrent duplicate posts yield exactly one active PRIMARY each, reconciliation
ALL_CLEAN, zero-driver target rejected fail-closed at calculate (400 `invalidDriver`),
zero-line lifecycle with database-level rejection of a zero-amount allocation line,
reverse PRIMARY with immutable contract, double reversal prevented (409), reconciliation
after reversal detects missing active line, replacement post after reversal produces a
single new-generation active PRIMARY with reused deterministic fingerprint, reconciliation
clean after repair, mismatch detection for amount and currency, missing PRIMARY detection,
repair auto-repost and clean reconciliation, canonical ledger paging includes B3
sourceType, tenant isolation (foreign company cannot read/lines/sources/history/
reconciliation/post/reverse/edit or reference period — 404; foreign search and foreign
ledger page do not leak — empty 200), permission denials for a denied role (403) across
GET/POST/PATCH/calculate/finalize/post-to-ledger/reconciliation/ledger-reversal, FINAL
update and recalculate forbidden (409), bounded paged reads of lines/sources/history,
atomic audit events with actors and tenant, Arabic and English localized messageKey
stability, one active PRIMARY per line at end, Prisma-generated snapshot cuid with exact
frozen value, omitted timestamps use existing SQL UTC defaults, and the database
one-snapshot-per-run uniqueness remains enforced.

## Clone fixture cleanup

Post-runtime cleanup removed all fixture rows by exact reviewed IDs with ownership
checks. Receipt values:

- `CLEANUP_EXACT_INVENTORY_SHA256=6f08c5248474fec103766844398530d2fa6544eb7b2c4d92765d20af3891f2f2`
- `exactInventoryRows=160`
- `SURVIVING_FIXTURE_COUNT=0`
- `CLONE_FIXTURE_CLEANUP=PASS`

Verified zero surviving B3PROOF rows across the tenant tables that the B3 runtime contacts
(companies, branches, users, scopes, roles, role_permissions, products, operation types,
definitions, versions, orders, lines, units, points, capacity, snapshots, transitions,
output_events, periods, entries, allocations, allocation_lines, allocation_sources,
cost_transactions, source_changes, audit_logs).

## Production DDL and migration registration

- Before deployment: `ATsoftERP_DB` had 83 applied active migrations, no B3 migration row,
  no B3 permission rows, last migration `20260915010000_cost_r2d_b2_allocation_engine`.
- B3 DDL applied once with SQLCMD exit 0; constraint after application shows 13 vocabulary
  values including `OVERHEAD_ALLOCATION_LINE`, `is_disabled=0`, `is_not_trusted=0`.
- Production constraint rejects an invalid legacy-incompatible source value with SQL 547
  inside a rolled-back transaction (no row persisted: 0 rows in all cost tables after).
- Production migration history row registered exactly once with the frozen SHA256
  `ad856bd3...6077220`, `applied_steps_count=1`, `rolled_back_at=NULL`.
- `prisma migrate status` against Production: **"84 migrations found ... Database schema
  is up to date!"**
- 13 legacy rolled-back migration rows were never touched.
- `PRODUCTION_DDL=PASS`, `PRODUCTION_MIGRATION_REGISTERED=PASS`

## Production permission seed

- Before seed: 5 B3-related allocation permission rows (B2 keys) present and linked to
  SUPER_ADMIN.
- The two B3 keys `production-cost-overhead-allocation:post` and
  `production-cost-overhead-allocation:reconcile` were upserted (ACTIVE) and linked to
  SUPER_ADMIN. Final: 7 permission keys, 7 SUPER_ADMIN links, no user/role rewriting.
- `PRODUCTION_PERMISSION_SEED=PASS`

## Deployed artifact hash parity

Deployed dist files (`apps/api/dist` under the production service AppDirectory) were
verified byte-exact against the isolated B3 build from exact commit `3c36b98c...`:

- `overhead-allocation.ledger.js` = `4682C6A9...`
- `overhead-allocation.service.js` = `76587834...`
- `operational-cost-reconciliation.service.js` = `C2A34DFF...`
- `overhead-allocation.controller.js` = `EEC0D667...`
- `overhead-allocation.dto.js` = `6A6BF627...`
- `overhead-allocation.module.js` = `9B257C70...`
- `production-cost.constants.js` = `D2C4F7CA...`
- plus 9 other B3 changed/new dist files (specs, seed keys, api-messages) copied from the
  exact build. Full manifest: `release-20260922/artifacts/release-artifacts-manifest.json`.
- `PRODUCTION_ARTIFACT_HASH_PARITY=PASS`

## Production deployment and service restart

- `ATsoftERP_API` restarted via nssm: STOP/START completed successfully, service Running.
- Startup stdout shows B3 routes mapped by the rebuilt API:
  `POST /api/production/overhead-allocations/:id/post-to-ledger`,
  `GET .../:id/reconciliation`,
  `POST .../:id/ledger-reversal`,
  and `Nest application successfully started`, `Server running on http://localhost:4000`.
- `PRODUCTION_DEPLOYED_AND_RUNNING=PASS`

## Production runtime acceptance and its exact limitation

Production itself received only the approved safe read/guard checks (no synthetic business
rows, no ledger post, no allocation created on Production; all cost tables remain at 0
rows):

- Authenticated login `POST /api/v1/auth/login` issued a token for
  `admin@atsofterp.com`; `GET /api/v1/auth/me` returned HTTP 200 with the same email.
- `GET /api/v1/production/overhead-allocations?page=1&limit=5` with active-company and
  active-branch headers returned HTTP 200 with `{"data":[],"meta":{...,"total":0}}`.
- Unknown query field `pageSize` is rejected HTTP 400 `validation.unknownField` (DTO
  unknown-field rejection, correct contract).
- `GET .../overhead-allocations/eligible-periods` HTTP 200.
- Nonexistent allocation detail and reconciliation reads return HTTP 404 (tenant-safe
  not-found, no leak).
- Unauthenticated requests to all B3 routes return HTTP 401; authenticated request without
  operational-context headers returns HTTP 403 `operationalContext.headersRequired`
  (missing context never broadens access).
- Live login-rate-limit guard tripped after exceeding the configured 3 attempts / 30 min
  window (HTTP 429 `auth.tooManyAttempts`), then recovered on window expiry — direct
  evidence the production security control is active.
- `PRODUCTION_SAFE_READ_ACCEPTANCE=PASS`

**Exact limitation (recorded honestly):** the full 119-scenario authenticated runtime was
executed on the real production-derived clone, not against live Production. Live Production
received only the safe login/guard/read acceptance checks above. This document does not
claim that all 119 authenticated scenarios were executed against live Production, and it
does not claim any production business fixture was created or any production cost row
written (all witnessed cost tables remain at 0 rows before and after; Production business
rows unchanged).

## Post-deployment regression (exact committed source)

All gates ran after deployment from the exact committed isolated source `3c36b98c...`.

| Gate | Result |
|---|---|
| Full API Jest | 163 suites / 2898 tests PASS, 0 failed |
| Full Web logic Jest | 36 suites / 1011 tests PASS, 0 failed |
| API build (tsc) | PASS, exit 0 |
| Web build (next) | PASS, exit 0 |
| API typecheck | PASS, exit 0 |
| Web typecheck | PASS, exit 0 |
| Prisma validate / generate | PASS |
| i18n | PASS, 6110 keys in en, 6110 keys in ar, synchronized, all namespaces registered |
| Raw-key | PASS |
| Route contract | PASS, 1112 runtime routes, 0 malformed, 0 unresolved, 0 mismatches |
| UI baseline | PASS |
| Credentials check | PASS, no hardcoded credentials |

`POST_DEPLOY_API_2898=PASS`, `POST_DEPLOY_WEB_1011=PASS`, all other post-deploy gates PASS.

## Git closeout

Authorized operations:

1. `git fetch origin` was executed; current origin/main was verified as
   `57952886ca690109ce7b79be909755ed0fc4d519` == the B3 implementation parent.
2. This document is committed with a docs-only closeout commit on top of `3c36b98c...`.
3. Normal fast-forward push of the B3 branch into `origin/main` (no force, no merge, no
   rebase).

Post-push: isolated HEAD == fetched origin/main, ahead/behind 0/0.

## Evidence locations

Local evidence root: `%LOCALAPPDATA%/Temp/ATsofterp-COST-R2D-B3-P2-20260922/`.

- `release-20260922/`: production/clone receipts: `runtime-receipt.json` (119/0),
  `clone-runtime.log`, `cleanup-exact-inventory.json`, `fixture-manifest.json`.
- `release-20260922/artifacts/`: migration SQL (SHA256 above), B3 dist artifact copy,
  `release-artifacts-manifest.json`.

Secrets are omitted. Local evidence/backup paths are operational recovery references, not
claims that those files are included in the remote repository.