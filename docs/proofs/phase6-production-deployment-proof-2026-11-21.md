# Phase 6 Production Deployment Proof — 2026-11-21

Status: COMPLETE

## 1. Deployed source identity

| Item | Value |
| --- | --- |
| Branch | `feat/governance-excel-reports-phase-6` |
| Deployed commit | `8c62740f3c95890a9daa99c93bf32aa5efe80026` |
| `main` after publication | `8c62740f3c95890a9daa99c93bf32aa5efe80026` |
| `origin/main` after publication | `8c62740f3c95890a9daa99c93bf32aa5efe80026` |
| `origin/feat/governance-excel-reports-phase-6` | `8c62740f3c95890a9daa99c93bf32aa5efe80026` |
| Base before Phase 6 | `1fce7f1e` |
| Web build ID at runtime | `NQISavjyFU9fpF-SCxeHz` |

Five logical commits were created and pushed. No history rewrite, force push, reset, clean, or unrequested Git write operation was performed.

## 2. Logical commit sequence

1. `86625174` — `fix(auth): seed governance permission keys`
2. `7d4c7e31` — `feat(audit): record actor-aware business audit events`
3. `9c3a5723` — `feat(reports): wire canonical audited XLSX exports`
4. `c1dd185f` — `feat(excel): add governed export-only domain adapters`
5. `8c62740f` — `docs(governance): record Phase 6 closure gates`

## 3. Release artifact

| Item | Value |
| --- | --- |
| Staged release directory | `C:\ATsoftERP\Releases\phase6-8c62740f` |
| Package | `C:\ATsoftERP\Releases\atsoft-erp-phase6-8c62740f.zip` |
| Authoritative SHA256 | `784b1ab8afa41050157562c413e74aefaf0d97fcfe9c39e566f2f8f7e62dcf32` |
| Package size | 133.28 MB |
| Superseded SHA256 | `6e2773a2d7ff5e611e2002b125a1a755c127c9bb74ee500b4b80874085446938` |

The earlier hash was superseded after the seed-module correction described in section 7. The corrected manifest is `C:\ATsoftERP\Releases\atsoft-erp-phase6-8c62740f.zip.manifest.json`.

## 4. Deployment method

Deployment used the reviewed Phase 5-style artifact swap/rename procedure. The generic `deploy-local-windows.ps1` was not used. Only `ATsoftERP_API` and `ATsoftERP_Web` were stopped; `ATsoftERP_Caddy` remained Running throughout. Rollback directories were created by reversible rename, not deletion.

## 5. Rollback point

| Item | Value |
| --- | --- |
| Pre-deploy backup | `C:\ATsoftERP\App\_rollback\phase6-predeploy-20261121-225919` |
| Previous live release | `C:\ATsoftERP\App\phase5-c812021a` |
| Previous release commit | `c812021a` |

The previous release tree was retained; no database was reset, recreated, truncated, or overwritten.

## 6. Deployed identity readback

After restart, the runtime reported commit `8c62740f3c95890a9daa99c93bf32aa5efe80026`. The deployed Web `BUILD_ID` was `NQISavjyFU9fpF-SCxeHz`. The runtime `.env` and native dependency set were checked and left intact. No credentials were printed; any credential references are `REDACTED`.

## 7. Seed-module startup correction

The first API start failed with `Cannot find module '../../../../prisma/seed/seed-overhead-allocation-permission-keys'`. The staged `api/prisma/seed` directory contained TypeScript sources, while runtime imports require compiled JavaScript. The release and live directories were corrected to use `apps/api/dist/prisma/seed` compiled JS output (75 JS files). API startup then succeeded.

The retired TypeScript sources were renamed to explicit `seed.ts-source-phase6` markers rather than deleted because shell policy rejected recursive removal outside the workspace. Known markers remain in:

* `C:\ATsoftERP\Releases\phase6-8c62740f\api\prisma\seed.ts-source-phase6`
* `C:\ATsoftERP\App\phase5-c812021a\api\prisma\seed.ts-source-phase6`

They are inert, unserved source copies and are documented rather than silently claimed as cleaned.

## 8. Service state

| Service | Final state |
| --- | --- |
| `ATsoftERP_API` | Running |
| `ATsoftERP_Web` | Running |
| `ATsoftERP_Caddy` | Running (never stopped) |

## 9. Health checks

| URL | Result |
| --- | --- |
| `http://localhost:4000/api/v1/health` | HTTP 200 |
| `http://localhost:3000` | HTTP 200 |
| `https://dell/api/v1/health` | HTTP 200 |

The Caddy result proves proxy reachability separately. Browser proof used the Next-origin `http://localhost:3000` path so `/api/v1/:path*` rewrites to `http://127.0.0.1:4000/api/v1/:path*`; no permissive CORS change was made.

## 10. Migration status

A read-only `prisma migrate status` was run against the live database from the isolated worktree with only `DATABASE_URL` injected from the deployed env. Result: `100 migrations found` and `Database schema is up to date!`. No migration was applied, resolved, edited, or regenerated during this deployment. Credentials were not printed.

## 11. Deployment conclusion

The deployed identity, artifact hash, service state, health checks, proxy path, and migration state are verified. The seed-module correction is documented with its inert renamed source markers. Deployment status is COMPLETE.
