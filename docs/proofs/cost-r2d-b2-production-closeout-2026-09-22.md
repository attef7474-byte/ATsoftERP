# COST-R2D-B2 final production closeout

Evidence date: 2026-09-22. Technical production gates: PASS.

Implementation commit: `03099a47535fb0f3856f96449ab058e1b052c37c`.
Parent (base origin/main): `74587e6936bee5fc2cf431713d2ddcfbce0f587c`.

This document records the completed B2 source, database, deployment and validation work
and the exact limitation of the Production runtime proof. Following the non-recursive Git
evidence model used for previous releases, this document does not claim its own future
commit hash or a push that had not happened when it was written. The implementation commit
is not amended; this document is a separate docs-only closeout commit.

`B3_EXECUTED=NO`. No B3 scope was started by this closeout.

## Continuation boundary and root cause

The previous tool completed the verified B2 implementation, selective staging, production
backup/VERIFYONLY, real backup-derived clone, clone runtime, production deployment,
migration registration, artifact deployment and the full post-deployment regression. It
stopped after Production deployment and final regression, before the docs-only closeout
commit and Git publication. This continuation finished only those closeout/Git steps and
did not rerun any production deployment, backup, clone, migration or test campaign.

## Implementation commit and migration

Implementation commit:

- SHA256 commit: `03099a47535fb0f3856f96449ab058e1b052c37c`
- Subject: `feat(cost): implement B2 overhead allocation with verified contracts`
- Author: altef ali
- Date: 2026-09-22 01:36:12 +0300
- Parent: `74587e6936bee5fc2cf431713d2ddcfbce0f587c`

Migration:

- Name: `20260915010000_cost_r2d_b2_allocation_engine`
- File: `apps/api/prisma/migrations/20260915010000_cost_r2d_b2_allocation_engine/migration.sql`
- SHA256 (computed at closeout from the committed file): `DF038D5611B00D39D3EBFC46ABA72DF892BD1EDB50604A8AB13545429A2697D9`
- Frozen production checksum (lower-case as stored by Prisma): `df038d5611b00d39d3ebfc46aba72df892bd1edb50604a8ab13545429a2697d9`

The two values are case-normalized identical; no migration byte drift between commit and
production registration.

## B2 model/catalog contract

The reviewed additive migration creates exactly three tables:

- `dbo.operational_overhead_period_allocations`
- `dbo.operational_overhead_allocation_lines`
- `dbo.operational_overhead_allocation_sources`

Clone and production catalog exports match on: 3 tables, 50 columns, 8 keys, 14 enabled
FKs, 18 trusted/enabled CHECK constraints, 8 bounded mirrors, unsafe keys = 0, FK-width
mismatch = 0, cost-snapshot FK width match = PASS, SQL error 1753 = 0.

## Production backup and VERIFYONLY

Fresh COPY_ONLY backup with CHECKSUM was created before any deployment mutation:

- Backup target: `ATsoftERP_DB_COST_R2D_B2_COPYONLY_20260921T223700.bak`
- Evidence: `release-20260922/backup.sql` (COPY_ONLY + CHECKSUM)
- `backup-verify.log`: "BACKUP DATABASE successfully processed 9138 pages ... The backup
  set on file 1 is valid." — `PRODUCTION_BACKUP=PASS`
- `RESTORE VERIFYONLY ... WITH CHECKSUM` exit 0, backup set valid — `RESTORE_VERIFYONLY=PASS`

## Real production-derived clone

The exact backup was restored with CHECKSUM/MOVE/RECOVERY into:

- `ATsoftERP_B2_PRODCLONE_20260921T223700`

`restore-clone.log`: RESTORE DATABASE successfully processed 9138 pages, exit successful,
database ONLINE. Clone preconditions matched production: no B2 tables/migration before
rehearsal, both MIG-PROV migrations active, no duplicate/unresolved migration rows
(`clone-b1-before.log`, `clone-proof-receipt.json`). `CLONE_B2_MIGRATION=PASS`.

## Clone authenticated runtime

Full authenticated runtime was executed against the real production-derived clone with
the rebuilt API and freshly generated Prisma client.

- `runtime-receipt.json`: stage `complete`, **165 cases / 0 failed**
- `CLONE_RUNTIME_165_0=PASS`

Coverage includes: real password login (2 users + 1 denied), strict status matrix,
authentication, active-context enforcement, unauthorized company denial, normal
period open/close and source create/finalize x3, allocation create (201), idempotent
create reusing the same header, one-period-per-allocation 409, permission denials
(403) on GET/POST/PATCH/calculate/finalize for a denied role, tenant isolation
(foreign company cannot read/lines/sources/history/edit/reference period — 404; search
no leak — 200 empty), DRAFT notes update preserves same record (PATCH 200), unknown
monetary/calculation field rejection (400), purpose-pool preview, exact HALF_UP(4) with
stable ID-based remainder, frozen driver authority, half-open membership boundaries,
calculate persisting no lines/sources, concurrent FINALIZE A/B both 200 with immutable
identical identity and persisted snapshot relation, exact monetary conservation,
atomic audit events, FINAL immutable (409), recalc forbidden (409), repeat finalize
idempotent (200), bounded paged reads of lines/sources/history, B2 does not mutate
snapshot monetary data, too-small/tiny-zero/negative-remainder/zero-recipient precision
rejection (400 `notRepresentableAtPrecision`) in Arabic and English with atomic FINAL
rejection and no partial success, minimum-valid/single/unequal allocation with exact
persisted candidate and finalize 200, real close-for-valuation (201) with exact snapshot
runtime values and immutable repeated-close rejection (409) producing one snapshot,
non-authoritative/missing-evidence close rejection (400 `zeroOutput`), and the
repaired-driver scenario: B2 preview from the actual repaired-close snapshot (201),
raced B2 FINAL + valuation close behind the shared branch boundary, no unclosed target
admission, and repaired snapshot immutability through B2 finalization.

## Clone fixture cleanup

Post-runtime cleanup removed all fixture rows by exact reviewed IDs with ownership
checks. Receipt values:

- `CLEANUP_EXACT_INVENTORY_SHA256=4e13ee87d178521eb6eda72ea908515467b1119874fa171b92efbae84b57011c`
- `SURVIVING_FIXTURE_COUNT=0`
- `CLONE_FIXTURE_CLEANUP=PASS`

## Production DDL and migration registration

- `production-b1-before.log` / `production-preflight.sql`: before deployment, no B2
  tables, no B2 migration row, active migrations 82, zero duplicate active names, zero
  unresolved failures, MIG-PROV active = 2, B1 checksums valid.
- B2 DDL applied once with SQLCMD exit 0 (`production-ddl.log` clean); catalog verified
  after application (`production-catalog-after.json`).
- `production-prisma-resolve.stdout.log`: "Migration
  20260915010000_cost_r2d_b2_allocation_engine marked as applied."
- `production-final.json` migration record: `finished_at 2026-09-21T23:02:05.7548426Z`,
  `rolled_back_at null`, stored checksum exactly the frozen B2 SHA256.
- `production-prisma-status.stdout.log`: "83 migrations found in prisma/migrations ...
  Database schema is up to date!"
- `PRODUCTION_DDL=PASS`, `PRODUCTION_MIGRATION_REGISTERED=PASS`

## Deployed artifact hash parity

Deployed artifacts were compared to the isolated implementation build. All mismatch
counts are zero:

- `apps/api/dist`: 4228 files, mismatch 0
- `node_modules/.prisma/client`: 16 files, mismatch 0
- `apps/web/.next`: 1564 files, mismatch 0

Evidence: `artifacts-deployed.json`. `PRODUCTION_ARTIFACT_HASH_PARITY=PASS`.

## B1 and MIG-PROV preservation

Before and after comparisons show no regression to protected domains:

- B1: 2 tables, 41 columns, 5 mirrors, 16 checks, 6 FKs, 9 indexes; bad B1 checks = 0,
  bad B1 FKs = 0; B1 migration checksum unchanged.
- `out_of_scope_tables` moved 0 -> 3, exactly the three new B2 tables (expected).
- MIG-PROV: active = 2, unsafe keys = 0, bad checks = 0, bad FKs = 0.
- `B1_PRESERVED=PASS`, `MIG_PROV_PRESERVED=PASS`

## Production runtime acceptance and its exact limitation

Production itself received only the approved safe post-deploy checks:

- Service health `/api/v1/health` HTTP 200 (`permission-read-proof.cjs` and health
  smoke) — `PRODUCTION_HEALTH_HTTP_200=PASS`
- Read proof against deployed service + Prisma client + production DB: unauthenticated
  requests to all status variants rejected 401; missing operational context denied (2);
  nonexistent detail reads 404 (1); no synthetic rows created or surviving (
  `syntheticRowsCreated: 0`); permissionCount 5 seeded idempotently.
  `production-proof-receipt.json`: readProof PASS.
- Seed idempotent: 5 B2 permissions created once; no role/user rewriting
  (`production-seed-receipt.json`: createdPermissions 5, createdAssignments 5,
  idempotent true).

**Exact limitation (recorded honestly):** the full 165-scenario authenticated runtime
was executed on the real production-derived clone, not against live Production. Live
Production received only the safe health/guard/read acceptance checks above. This
document does not claim that all 165 authenticated scenarios were executed against live
Production, and it does not claim any production business fixture was created
(`counts` unchanged; production business rows before/after identical).

## Final post-deployment regression

All gates ran after deployment from the exact committed isolated source.

| Gate | Result |
|---|---|
| Full API Jest | 160 suites / 2872 tests PASS, 0 failed (full-api-tests.json; api-tests.receipt exit 0) |
| Full Web logic Jest | 36 suites / 997 tests PASS, 0 failed (full-web-tests.json; web-tests.receipt exit 0) |
| API build | PASS (api-build.receipt exit 0) |
| Web build | PASS (web-build.receipt exit 0) |
| API typecheck | PASS (api-typecheck.receipt exit 0) |
| Web typecheck | PASS (web-typecheck.receipt exit 0) |
| Prisma validate / generate | PASS |
| Prisma production status | PASS, 83 migrations up to date |
| i18n | PASS (i18n.receipt exit 0) |
| Raw-key | PASS (raw-key.receipt exit 0) |
| Route contract | PASS (route-contract.receipt exit 0) |
| UI baseline | PASS (ui-baseline.receipt exit 0) |
| Permission UI | PASS (permission-ui.receipt exit 0) |
| Schema/migration parity | PASS (`production-zero-parent-ddl.json`: exit 0, parentGeneratedDdlCount 0, diff not executed) |

`POST_DEPLOY_API_2872=PASS`, `POST_DEPLOY_WEB_997=PASS`, all other post-deploy gates PASS.

## Git closeout

Authorized operations on the isolated branch `cost-r2d-b2-final-20260915`:

1. The isolated B2 worktree deletions were proven to be tracked-file deletions only
   (0 untracked, 0 unstaged modifications, index == HEAD) and restored non-destructively
   to the committed tree; working tree clean after restore.
2. This document is staged with the closeout commit chain:
   `74587e69` -> `03099a47` -> docs-only closeout commit.
3. `git fetch origin` was executed; current origin/main was verified.
4. Normal fast-forward push of `cost-r2d-b2-final-20260915` -> `origin/main`, no force,
   no merge, no rebase.
5. Post-push: isolated HEAD == fetched origin/main, ahead/behind 0/0.

Original historical dirty main checkout was preserved (do not reset to make its HEAD
match remote); its pre-existing user changes remain uncommitted by this closeout.

## Evidence locations

Local evidence root: `%LOCALAPPDATA%/Temp/ATsofterp-COST-R2D-B2-FINAL-20260915/`.

- `release-20260922/`: all production/clone/regression receipts referenced above.
- `worktree/`: isolated branch worktree at commit `03099a47...` + this closeout document.

Secrets are omitted. Local evidence/backup paths are operational recovery references,
not claims that those files are included in the remote repository.