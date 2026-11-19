# Unified Item Master — Phase 1 Production Migration, Deployment & Browser Proof

**Date:** 2026-11-19
**Status:** `COMPLETE`
**Release SHA deployed:** `4f36eec550cb2ed07996ef88c6d6cc34f4e5b2db`
**Migration:** `20261119120000_add_product_item_type`
**Deployed Build ID:** `g6VifmDBRklyf7CqT50wF`

---

## 1. Release provenance

| Item | Value |
|---|---|
| Baseline | `08f152ee2efcba2d0aade07665f88ec875cc8be7` (= `origin/main`, clean, ahead/behind `0/0`) |
| Feature branch | `feat/unified-item-master-phase-1`, commit `4f36eec5` (40 files) |
| Feature push | new branch pushed; local = remote = `4f36eec5` |
| Merge | `git merge --ff-only feat/unified-item-master-phase-1` on `main` (`08f152ee..4f36eec5`) |
| Main push | `08f152ee..4f36eec5  main -> main`, normal push, no force |
| Final state | local `main` = `origin/main` = `4f36eec5`, working tree clean |
| Previously deployed source | `88d547f5b0fc310372d3802423b6165e54723e86` |

## 2. Backup and production migration

| Item | Value |
|---|---|
| Verified backup | `C:\Users\attef\AppData\Local\Temp\ATsofterp_pre_phase1_20261119.bak` (COPY_ONLY + CHECKSUM) |
| `RESTORE VERIFYONLY` | `The backup set on file 1 is valid.` (exit 0) |
| Migration command | `npx prisma migrate deploy --schema prisma/schema.prisma` with process-local integrated-auth `DATABASE_URL` |
| Result | Applied `20261119120000_add_product_item_type`; "All migrations successfully applied" (exit 0) |
| `migrate status` | 97 migrations found; "Database schema is up to date!" (exit 0) |
| Structural proof | `itemType` NVARCHAR(1000) (`COL_LENGTH=2000` bytes), trusted CHECK `products_item_type_ck` (`is_not_trusted=0`), index `products_itemType_idx` present |
| Backfill proof | NULL 12 (1 conflict + 3 active unclassified + 8 deleted), `FINISHED_GOOD` 106, `RAW_MATERIAL` 7, `PACKAGING_MATERIAL` 2, `SPARE_PART` 1; total 128 preserved |
| Conflict row | `cmrlb0uf40002gg956cmv26mu` / `AT7-PROD-1784073037845` — remains NULL |
| Lazy backfill | `CONSUMABLE`/`GENERAL` rows = 0 |
| CHECK enforcement | Invalid value rejected with SQL error 547 |

The migration was first proven on a byte-faithful COPY_ONLY clone (`.tmp/.../phase1-clone-verify.sql`, 171-table parity, only `_prisma_migrations` 115→116). The production post-state matches the clone proof exactly.

## 3. Clean release build (detached worktree at exact merged SHA)

| Gate | Result |
|---|---|
| `api` typecheck | exit 0 |
| `web` typecheck | exit 0 |
| `api` build (`tsc`) | exit 0 (4687 artifact files) |
| `web` build (`next build`) | exit 0 (4497 artifact files, BUILD_ID `g6VifmDBRklyf7CqT50wF`) |

Build ran in `.tmp/unified-item-master-phase1-release-20261119/release-worktree` at detached HEAD `4f36eec5` with junctioned dependencies; worktree status clean. Result JSONs include `release` and `exitCode=0` for all four gates.

| Artifact | Files | SHA256 of manifest |
|---|---|---|
| Built web `.next` | 4497 | `43f9479712413001b462104a86fc3657cdaf1144b5e04b4ba68aa9ad835e6e36` |
| Built API `dist` | 4687 | `2ba61d5eca1ac15364ff50d2ae961bc09453dbd35b72928e77e416ff53bf4cee` |

## 4. Deployment execution

Elevated script `.tmp/unified-item-master-phase1-release-20261119/deploy.ps1` (Administrator token) verified, in order: release HEAD, all four gate JSONs, production migration status, artifact directories (not junctions), absence of prior rollback dirs, BUILD_ID, and Caddy config hash. It then stopped only `ATsoftERP_API` and `ATsoftERP_Web`, moved live artifacts to `previous-web-next` / `previous-api-dist`, moved the clean release artifacts into `apps/web/.next` and `apps/api/dist`, restarted both services, and left `ATsoftERP_Caddy` untouched.

```
DEPLOY_START RELEASE=4f36eec5 BUILD=g6VifmDBRklyf7CqT50wF
API_WEB_STOPPED
ARTIFACTS_SWAPPED
API_WEB_RUNNING_CADDY_UNTOUCHED
DEPLOY_RESULT=SUCCESS
```

`deployment-state.json`: `status=DEPLOYED`, `at=2026-11-19T05:59:41.2549339+03:00`.

Rollback points: `.tmp/unified-item-master-phase1-release-20261119/previous-web-next` and `previous-api-dist` (pre-swap live artifacts, manifest-hashed).

## 5. Post-deploy health and parity

| Check | Result |
|---|---|
| `http://localhost:4000/api/v1/health` | **200** |
| `http://localhost:3000/login` | **200** |
| `https://dell` (Caddy proxy) | **200** |
| Served BUILD_ID | `g6VifmDBRklyf7CqT50wF` — matches built artifact |
| Web deployed manifest vs built | **identical** (`43f94797…`, 4497 files) |
| API deployed manifest vs built | **identical** (`2ba61d5e…`, 4687 files) |
| Caddy PID | 7520 before and after (unchanged) |
| Caddyfile SHA256 | `C0FC215B143A1B1F246EA253C0B2BE8FA1B0252A86FA871EF12FB78FBCC1D389` before and after (unchanged) |
| API log | `Nest application successfully started`, `Server running on http://localhost:4000`; no fatal errors |
| Web log | `Ready in 517ms`; only the pre-existing `next start` / standalone notice |
| Services | `ATsoftERP_API`, `ATsoftERP_Web`, `ATsoftERP_Caddy` all Running |

## 6. Runtime browser proof (deployed production, read-only)

Script: `.tmp/unified-item-master-phase1-release-20261119/browser-proof.cjs`; results: `browser-proof-results.json`; screenshots: `browser-{en,ar}-{items,production}.png`.

Authentication used the repository's established short-lived-token proof convention (same pattern as tracked `tools/health/prodproof.cjs`) with the existing `admin@atsofterp.com` SUPER_ADMIN account. No password was guessed, no production record was created/edited/deleted, and the ephemeral token file was removed after the run.

| # | Check | EN / LTR | AR / RTL |
|---|---|---|---|
| 1 | Canonical Items catalog title (`Items` / `الأصناف`) | PASS | PASS |
| 2 | `documentElement.dir` / `lang` | `ltr` / `en` | `rtl` / `ar` |
| 3 | All six translated item-type filter chips | PASS | PASS |
| 4 | Item Type column header translated | PASS (`ITEM TYPE`, CSS-uppercased) | PASS (`نوع الصنف`) |
| 5 | SPARE_PART chip clickable | PASS | PASS |
| 6 | Filter sent to server (`GET /products?...&itemType=SPARE_PART`) | PASS | PASS |
| 7 | Server result correct (`total=1`, only `SPARE_PART`) | PASS | PASS |
| 8 | Production Product Setup title (`Production Product Setup` / `إعداد المنتجات للإنتاج`) | PASS | PASS |
| 9 | Production setup uses same catalog with `itemType=FINISHED_GOOD` | PASS | PASS |
| 10 | SparePart product F9 lookup filters `SPARE_PART` on server | PASS | PASS |
| 11 | No uncaught page errors | PASS | PASS |
| 12 | No fatal console errors | PASS | PASS |

**Total: 24/24 checks passed (0 failed).**

The six Arabic labels rendered exactly as specified: `مادة خام`, `منتج تام`, `قطعة غيار`, `مادة تعبئة وتغليف`, `مستهلك`, `عام`; unclassified vocabulary `غير مصنف` is covered by the shared label module's focused tests and i18n parity check.

## 7. Known limitations / honest notes

* `npm run route-contract:check` still exits 1 with pre-existing malformed/unresolved dynamic paths in untouched `issue-vouchers-panel.tsx` and `warehouse-approvals-panel.tsx`; `MISMATCHES=0` for Phase 1 routes.
* The 500 on global F9 "All entities" `cost-snapshots` adapter is pre-existing and unrelated; it was not triggered in this proof.
* API Jest worker teardown warning and 60 dynamic `t()` raw-key warnings are pre-existing, non-failing signals.
* No write/create/edit browser action was executed against production: write paths, type-change audit, tenant denials, and duplicate-submission are proven by the passing API unit/integration suite (5002 tests) and focused specs (36 tests), not by mutating production data.
