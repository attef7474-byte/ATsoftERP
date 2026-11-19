# MachineComponent shared multi-machine — production deployment and reconciliation

**Date:** 2026-11-19 (Asia/Aden)
**Release SHA deployed:** `88d547f5b0fc310372d3802423b6165e54723e86`
**Migration:** `20261119000000_shared_machine_component_multi_machine`
**Status:** `COMPLETE`

## 1. Git and release provenance

| Item | Value |
|---|---|
| Starting baseline | `main` clean, `HEAD = origin/main = 029f5e6f8cad220116df30cd67056faf49e00ad0` |
| Feature branch | `fix/machine-components-shared-multi-machine` |
| Implementation commit | `88d547f5b0fc310372d3802423b6165e54723e86` |
| Fast-forward merge | local `main` advanced to the implementation commit |
| Push result | `029f5e6f..88d547f5  main -> main`, normal push, no force |
| Final HEAD / origin/main | both `88d547f5b0fc310372d3802423b6165e54723e86`, ahead/behind `0 / 0` |
| Working tree | clean; `git diff --check` passed |

## 2. Backup and recovery assets

| Item | Value |
|---|---|
| Verified backup | `C:\Users\attef\AppData\Local\Temp\ATsofterp_pre_MCM_20261119_030636.bak` |
| Backup options | `COPY_ONLY, CHECKSUM` |
| Re-verification at deployment | `RESTORE VERIFYONLY ... WITH CHECKSUM` — `The backup set on file 1 is valid.` |
| Database | `ATsoftERP_DB` on `tcp:localhost,50079` |
| Destructive operations | none; no reset, no db push, no table drop/truncate, no applied-migration edit |

## 3. Prisma migration recovery and application

The first `prisma migrate deploy` attempt used the runtime SQL login from the repository `.env`. It failed with `P3018` / SQL Server error `1088`: the login `atsofterp_dev` is not `db_owner` and lacks `ALTER` on `dbo.machine_components` and `CREATE TABLE` on `dbo`. Diagnosis confirmed the migration's own `BEGIN TRY / CATCH / ROLLBACK` left the schema completely unchanged (`companyId`, `branchId`, join table and filtered index all absent).

Recovery used the supported, non-destructive Prisma path and a least-change privilege route:

1. `prisma migrate resolve --rolled-back 20261119000000_shared_machine_component_multi_machine` with Windows integrated authentication (`dbo`, `db_owner`) recorded the verified rollback; no migration history row was deleted or edited.
2. `prisma migrate deploy` with the same integrated-authentication session applied the reviewed migration.
3. `prisma migrate status` reported **96 migrations found** and **Database schema is up to date!**

The application runtime continues to use its existing restricted SQL login; no permanent role or grant was changed.

## 4. Production reconciliation

Read-only SQL reconciliation before and after the migration used the runtime SQL login.

| Metric | Before | After | Result |
|---|---:|---:|---|
| `machine_components` total | 13 | 13 | preserved |
| `machine_components` active | 4 | 4 | preserved |
| `machine_components` soft-deleted | 9 | 9 | preserved |
| `machine_component_machines` total | 0 | 14 | created |
| `machine_component_machines` active | 0 | 14 | created |
| Orphan links | 0 | 0 | clean |
| Active duplicate-code groups | 0 | 0 | preserved |
| Rows with null ownership | 0 (columns absent) | 3 | expected legacy backfill; hidden from non-`SUPER_ADMIN` |
| `mcmmerged_*` links | 0 | 1 | proven duplicate preserved |
| `AMBIGUOUS_GROUPS_AUTO_MERGED` | — | 0 | no ambiguity auto-resolved |

Downstream row counts were unchanged: `maintenance_requests 21/15`, `maintenance_work_orders 7/6`, `maintenance_request_required_parts 5`, `maintenance_part_accountability 0`, `maintenance_tasks 15`, `machine_installed_parts 3`, `spare_part_replacement_histories 0`, `spare_part_repair_orders 0`, `maintenance_boms 0/0`, `component_spare_parts 0`, `production_measurement_points 0/0`.

The merged link is `mcmmerged_cmwmrhf1d000320953szhrgpp`, pointing to canonical component `cmwmrhf0p00012095az0mn5hu` (`U-000005`). Post-deployment reconciliation was byte-identical to post-migration reconciliation.

## 5. Clean release build

A clean detached worktree at `88d547f5` was used with junctions to the existing installed `node_modules`; no `npm install` and no local `.env` were copied into the build checkout.

| Gate | Result |
|---|---|
| API typecheck | exit 0 |
| Web typecheck | exit 0 |
| API build | exit 0 |
| Web build | exit 0 |

Web `BUILD_ID`: `MPqKcD8txvjrVo_FG7eLe`.

## 6. Deployment method and result

Established Windows NSSM services were used. The deploy script required an Administrator token, verified the release SHA, all four gate results, migration status, artifact directories, BUILD_ID, Caddy config hash and absence of prior rollback directories. It stopped only `ATsoftERP_API` and `ATsoftERP_Web`, moved the live artifacts to `previous-web-next` / `previous-api-dist`, moved the clean release artifacts into place, restarted API and Web, and recorded `DEPLOYED` at `2026-11-19T04:44:49.4617625+03:00`.

| Artifact | Built files | Deployed files | Manifest SHA256 parity |
|---|---:|---:|---|
| Web `.next` (excluding cache/trace) | 4497 / 901,221,911 B | 4497 / 901,221,911 B | `cdf690d9f3bbfc648d70b340ad99c9462e6db7a53bfd92a27c431bcb951b1fa6` — PASS |
| API `dist` | 4666 / 20,065,160 B | 4666 / 20,065,160 B | `603de187d60c374f0329f7c1e519e7c8e960ce313ff094399b32b99457eb5dc8` — PASS |

Rollback point retained: `.tmp/machine-component-shared-release-20261119/previous-web-next` and `previous-api-dist`. Honest limitation: the live Web artifact immediately before the swap was a development-regenerated `.next` with no `BUILD_ID` (created by the earlier isolated browser-proof dev server). It is the rollback point actually present at swap time; the older production build had been moved aside during that proof. The deployed build is the clean release build above.

## 7. Post-deployment runtime verification

| Check | Result |
|---|---|
| `ATsoftERP_API`, `ATsoftERP_Web`, `ATsoftERP_Caddy` | Running |
| API process / Web process after restart | 20780 / 44752 |
| Caddy PID and config SHA256 | unchanged (7520 / `C0FC215B...D389`) |
| `http://localhost:4000/api/v1/health` | 200, `{"status":"ok",...}` |
| `http://localhost:3000/login` | 200, served HTML contains `MPqKcD8txvjrVo_FG7eLe` |
| `http://localhost:3000/admin/maintenance/machine-components` | 200 anonymous route shell |
| `https://dell/login`, `https://dell/api/v1/health` | 200 / 200 |
| Anonymous machine-components API and Excel endpoints | 401 (auth guard) |
| Fresh API/Web stderr | only established CORS/Swagger/Next-standalone warnings |
| Fresh fatal errors | 0 |

## 8. Known limitations

* No authenticated production browser create/edit/F9 proof was run: no production credentials were used and no synthetic production records were created. That flow was proven against the proof-only API/Web instances on the verified clone before deployment.
* Global F9 “All entities” still has a pre-existing `500` in an unrelated production cost-snapshot path; scoped machine-component F9 is healthy.
* Nine legacy soft-deleted components retain `ACTIVE` association rows by design; all application reads filter `deletedAt IS NULL`.
* Excel semicolon-delimited values cannot represent a literal `;`; misaligned list lengths produce row errors; legacy `machineCode` is single-machine only.

## 9. Evidence files

All raw deployment logs, manifests, reconciliation outputs, migration status, log offsets and service snapshots are under `.tmp/machine-component-shared-release-20261119/`. Architecture/browser evidence is in `docs/proofs/machine-component-shared-architecture-runtime-proof-2026-11-19.md`; clone migration evidence is in `docs/proofs/machine-component-migration-clone-reconciliation-2026-11-19.md`.
