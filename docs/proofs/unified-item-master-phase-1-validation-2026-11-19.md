# Unified Item Master — Phase 1 Validation / Migration / Data-Integrity Proof

**Date:** 2026-11-19
**Branch:** `feat/unified-item-master-phase-1`
**Baseline commit:** `08f152ee2efcba2d0aade07665f88ec875cc8be7` (= `origin/main` at start, ahead/behind `0/0`)
**Rule:** production database was queried SELECT-only at all times. The migration was applied **only** to a uniquely named COPY_ONLY clone; production was never migrated by this work.

---

## 1. Validation gate results (all run on the feature branch working tree)

| # | Gate | Command | Result |
|---|---|---|---|
| 1 | Focused web contract tests | `npx jest --config tests/jest.config.js --runInBand tests/unified-item-master-phase-1.test.ts` | **PASS — 18/18** |
| 2 | Full web logic suite | `npm test -- --runInBand` (apps/web) | **PASS — 130 suites / 2431 tests** |
| 3 | Full API suite | `npm run test -- --runInBand` (apps/api) | **PASS — 234 suites / 5002 tests** |
| 4 | Prisma schema validation | `npx prisma validate --schema prisma/schema.prisma` | **PASS — schema valid** |
| 5 | Prisma client generation | `npx prisma generate --schema prisma/schema.prisma` | **PASS — Prisma Client v7.8.0** |
| 6 | API type check | `npm run typecheck` (apps/api) | **PASS** |
| 7 | Web type check | `npm run typecheck` (apps/web) | **PASS** |
| 8 | API build | `npm run build:api` (`tsc`) | **PASS — exit 0** |
| 9 | Web build | `npm run build:web` (`next build`) | **PASS — 198 static pages, exit 0** |
| 10 | i18n consistency | `npm run i18n:check` | **PASS — 7390 EN / 7390 AR keys, synchronized, no empty values** |
| 11 | UI / appearance / i18n / access baseline | `node scripts/check-ui-baseline.mjs` | **PASS — 99 checks** |
| 12 | Raw-key safety | `node scripts/check-raw-keys.mjs` | **PASS** |
| 13 | Permission-UI verification | `node scripts/verify-permission-ui.mjs` | **PASS — all checks** |
| 14 | Whitespace / patch hygiene | `git diff --check` | **PASS — exit 0** |

### 1.1 Notes on non-blocking / pre-existing signals

* **Route-contract check** (`npm run route-contract:check`) exits 1 with `MALFORMED=3`, `UNRESOLVED=3`, `MISMATCHES=0`. Every reported path lives in `apps/web/src/components/inventory/issue-vouchers-panel.tsx` and `apps/web/src/components/inventory/warehouse-approvals-panel.tsx` — files **not modified** by Phase 1. These are pre-existing dynamic-path-construction limitations of the static checker, not Phase 1 regressions. All Phase 1 API routes/call sites produce zero mismatches.
* **Web build initial failure** (`Can't resolve .../builtin/global-not-found.js`) was caused by a stale generated `.next/cache/webpack/*` persistent cache containing a relative path baked in from a different checkout location. Removing/rebuilding the generated `.next` cache produced a clean successful build. No source change was needed; the cause is a generated artifact, not Phase 1 code.
* API Jest emits a pre-existing "worker process failed to exit gracefully" teardown warning; all 5002 assertions still pass.
* `check-raw-keys.mjs` reports 60 pre-existing dynamic `t()` template-literal sites as warnings (documented as safe with the fallback contract); zero errors.

---

## 2. Production read-only data-integrity proof (`sqlcmd -E`, SELECT only)

Command: `sqlcmd -S "tcp:localhost,50079" -E -C -b -d "ATsoftERP_DB" -i .tmp/phase1-classification-exclusive.sql`

| Evidence bucket | Rows | Active | Deleted | Phase 1 action |
|---|---|---|---|---|
| `SPARE_PART` (active `SparePart.productId`) | 1 | 1 | 0 | backfill `SPARE_PART` |
| `FINISHED_GOOD` (active `ProductionProductDefinition` / posted FG receipt) | 106 | 106 | 0 | backfill `FINISHED_GOOD` |
| `RAW_MATERIAL` (raw requirement / material document / consumption) | 7 | 7 | 0 | backfill `RAW_MATERIAL` |
| `PACKAGING_MATERIAL` (`componentRole='PACKAGING'`) | 2 | 2 | 0 | backfill `PACKAGING_MATERIAL` |
| `CONFLICT_REQUIRES_REVIEW` | 1 | 1 | 0 | leave NULL |
| `UNCLASSIFIED` (no authoritative evidence) | 11 | 3 | 8 | leave NULL → `غير مصنف` |
| **Total** | **128** | **120** | **8** | — |

Safety assertion before migration:

```
itemType_col
ITEMTYPE_ABSENT_PRODUCTION_UNMIGRATED
_migrations = 115   (latest applied: 20261119000000_shared_machine_component_multi_machine)
```

Conflict row: `cmrlb0uf40002gg956cmv26mu` / `AT7-PROD-1784073037845` / `AT7 Test Product` (active FG definition + material-document evidence) — deliberately left NULL.

No name-based guessing; `GENERAL` is not used as a lazy backfill.

---

## 3. Safe clone migration proof

### 3.1 Backup + restore (no production writes)

1. `BACKUP DATABASE [ATsoftERP_DB] TO DISK = N'...\ATsoftERP_Phase1_proof.bak' WITH COPY_ONLY, CHECKSUM, INIT` → success, 11690 pages.
2. `RESTORE DATABASE [ATsoftERP_Phase1Clone_20261119] FROM DISK = ... WITH CHECKSUM, MOVE ...` → success.
3. Clone pre-migration state: `itemType_col=ABSENT`, `products=128`, `spare_parts=406`, `prod_defs=108`, `_prisma_migrations=115`.

### 3.2 Apply migration on the clone only

```
$env:DATABASE_URL='sqlserver://localhost:50079;database=ATsoftERP_Phase1Clone_20261119;integratedSecurity=true;trustServerCertificate=true'
npx prisma migrate deploy --schema prisma/schema.prisma
→ Applying migration `20261119120000_add_product_item_type`
→ All migrations have been successfully applied. (exit 0)

npx prisma migrate status --schema prisma/schema.prisma
→ 97 migrations found in prisma/migrations
→ Database schema is up to date! (exit 0)
```

### 3.3 Post-migration structural + data verification (clone, SELECT only)

```
itemType_len | ck_exists | ck_not_trusted | idx_exists
2000         | 1         | 0              | 1
```
`itemType` = nullable NVARCHAR(1000) (Prisma `String?`); CHECK `products_item_type_ck` present and **trusted**; index `products_itemType_idx` present.

Backfill buckets after migration:

| itemType | n | active | deleted |
|---|---|---|---|
| `<NULL>` | 12 | 4 | 8 |
| `FINISHED_GOOD` | 106 | 106 | 0 |
| `PACKAGING_MATERIAL` | 2 | 2 | 0 |
| `RAW_MATERIAL` | 7 | 7 | 0 |
| `SPARE_PART` | 1 | 1 | 0 |

NULL 12 = 1 conflict + 3 active unclassified + 8 deleted unclassified — matches the pre-migration evidence exactly. Total 128 preserved. `CONSUMABLE`/`GENERAL` backfill rows = **0**.

Conflict row after migration: `cmrlb0uf40002gg956cmv26mu` / `AT7-PROD-1784073037845` / `AT7 Test Product` / `itemType = NULL` — still NULL.

CHECK enforcement proof: `UPDATE ... SET itemType='INVALID_TYPE'` → SQL error **547**, constraint `products_item_type_ck`. Invalid values cannot be written.

### 3.4 Row/identity preservation across all user tables

Compared `SUM(rows)` over `sys.partitions` for all **171** user tables in production vs. clone. Result: **all counts identical except `_prisma_migrations` 116 (clone) vs 115 (production)** — exactly one new migration ledger row. No product row, stock row, movement row, SparePart row or identity value was changed.

---

## 4. Conclusion

Phase 1 implementation passes every validation gate applicable to source code. The only failing checker (`route-contract:check`) is a pre-existing static-analysis limitation in untouched files, and the only build failure encountered was a stale generated webpack cache, resolved by a clean regeneration. The additive migration is proven safe on a byte-faithful COPY_ONLY clone: correct nullable column, trusted CHECK constraint, justified index, exact evidence-based backfill with conflicts/unclassified left NULL, and zero operational-data changes across 171 tables.

Production remains un-migrated by this work; applying the reviewed migration to production is a separate, explicitly authorized step.
