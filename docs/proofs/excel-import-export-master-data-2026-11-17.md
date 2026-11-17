# Excel Master-Data Import/Export — Proof (2026-11-17)

**Status:** PROOF COMPLETE (isolated DB + focused/gate validations). Full regression suite results recorded below (fresh after controller multipart fix).
**Scope:** Machines, Machine Components, Spare Parts, Products. **No schema/migration. No production deployment.**

## 1. Environment, isolation, and source fix

- **Isolated proof DB:** `ATsoftERP_EXCEL_20261117000316` (SQL Server clone, `productionDatabase: false`, `verified: true`, source backup 2026-11-10T00:19:13.684Z). Metadata: `.tmp/excel-master-data-20261117/clone.json`.
- **Proof runtime:** `.tmp/excel-master-data-20261117/runtime.cjs` + `runtime-supplement.cjs` booting Nest app from temp `api-dist` against isolated DB (no production data touched). Generated artifacts: `.tmp/excel-master-data-20261117/*.xlsx`.
- **Blocking fix (kept in source):** `apps/api/src/modules/factory/master-data-excel/master-data-excel.controller.ts` multipart limits increased `fields: 3, parts: 4` → `fields: 4, parts: 5` to allow import `token` field (resolved `400 ["Too many parts"]` on `/master-data-excel/products/import`). Temp `api-dist` controller patched for proof rerun; source contains the fix.
- **Fixture prefix:** `XLSX-1794874755380` (runtime proof).

## 2. Isolated HTTP-level proof results

### 2.1 `runtime-proof.json` — 23/23 PASS
- `unauthenticated denied`: PASS
- Machines: preview zero writes, canonical create+replay, export/update unchanged round-trip: PASS
- Products: preview zero writes, canonical create+replay, export/update unchanged round-trip: PASS
- Spare parts: preview zero writes, canonical create+replay, export/update unchanged round-trip: PASS
- `components later parent hierarchy committed`: PASS
- `foreign company machine reference denied`: PASS
- `canonical same-record update`: PASS
- `invalid duplicate prevents every write`: PASS
- `authoritative localized error workbook`: PASS (`products-errors.xlsx` generated)
- `real SQL rollback after second row audit fault`: PASS (intentional `ISOLATED_EXCEL_AUDIT_FAULT` logged; no partial writes)
- `retry after full rollback creates both rows`: PASS
- `HTTP simultaneous same-token import writes once`: PASS (HTTP `201,409`)
- `stale preview denied after canonical concurrent update`: PASS
- `real role permission denial`: PASS
- `all inventory and production sentinels unchanged`: PASS (before/after identical)
- `transactional Excel import audits persisted`: PASS (count 11)
- `eight real HTTP bilingual templates generated`: PASS

### 2.2 `runtime-proof-supplement.json` — 8/8 PASS
- `machine dedicated cost center created and tenant-scoped`: PASS (PRODUCTION)
- `spare-part and product records created`: PASS
- `valid preview token rejected under different company context`: PASS (409)
- `all 8 templates parse with production parser, header-only, instructions present`: PASS
- `no raw/internal database ID headers in Data sheets of generated workbooks`: PASS (12 files checked)
- `exported workbooks contain no formula cells`: PASS (`products-export.xlsx`)
- `error workbook has required columns and no stack/secret leakage`: PASS (headers include `OriginalRowNumber,Status,ErrorColumn,ErrorCode,ErrorMessage` + original business fields)
- `preview response contains no raw database id fields`: PASS

### 2.3 Inventory/production sentinels (before == after)
| Table | Count | Hash (sha256) |
|---|---:|---|
| inventoryBalance | 20 | `a29a1bdc98296b04effb38c015eff737423c055269e6bb487b165355cae63e16` |
| inventoryMovement | 62 | `7eda6aa39fb3adc63e717e6a146eef36cdd0853aad967b8f72e84b0e5bf7aa6d` |
| productionOrder | 12 | `d5670401c9bd2e20487a5c22935df9bdcf447b4e9a087803836f85f10909461d` |
| productionRun | 1 | `573e03445b79414921bd53b9487f624f5e83e7610b0fe4c758a77f26b9a8c09b` |
| productionMaterialRequirement | 8 | `75e58f478a347262f17bc14a29e92d97d2c069e1919acc056211313f7be534ee` |
| productionMaterialDocument | 2 | `c6923ede9d5cd14c7fa55ee798685ab8c217d9af5edc2038903a7ff67eee53f4` |
| productionFinishedGoodsReceipt | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |

**Conclusion:** no stock quantity/movement/balance or production side effects from Excel master-data operations.

## 3. Proof mapping to requested sentinels (evidence status)

| Sentinel / proof item | Status | Evidence |
|---|---|---|
| Unauthenticated denied | PASS | runtime-proof check 1 |
| Preview no-write (machines/products/spare-parts) | PASS | runtime-proof checks (preview zero writes) |
| Canonical create + replay/idempotent behavior per entity | PASS | runtime-proof create+replay checks |
| Export/update unchanged round-trip | PASS | runtime-proof checks |
| Machine-components later-parent hierarchy commit | PASS | runtime-proof |
| Foreign-company/tenant reference denied | PASS | runtime-proof (foreign company machine reference denied) |
| Canonical same-record update | PASS | runtime-proof |
| Invalid duplicate prevents every write (atomic rejection) | PASS | runtime-proof |
| Authoritative localized error workbook (required columns, original fields, no stack/secret) | PASS | runtime-proof + supplement (headers/content checks, `products-errors.xlsx`) |
| Real SQL rollback after mid-transaction fault + retry | PASS | runtime-proof (audit fault injection, intentional error, retry success) |
| HTTP simultaneous same-token import writes once (duplicate-submit safety) | PASS | runtime-proof `201,409` |
| Stale preview denied after concurrent update (stale-data safety) | PASS | runtime-proof |
| Valid preview token rejected under different company context (context-change safety) | PASS | runtime-supplement (409) |
| Real role permission denial | PASS | runtime-proof |
| 8 real HTTP bilingual templates generated/parseable/header-only/instructions | PASS | runtime-proof + supplement |
| No raw/internal DB ID headers in Data sheets | PASS | runtime-supplement (12 files) |
| Exported workbooks no formula cells (formula injection safety on export) | PASS | runtime-supplement |
| Preview response contains no raw DB ID fields | PASS | runtime-supplement |
| Inventory/production sentinels unchanged (global) | PASS | runtime-proof before/after hashes+counts |
| Transactional EXCEL_IMPORT audits persisted | PASS | runtime-proof (count 11) |
| Template self-compatibility / re-import compatibility | PASS (evidenced) | templates parse with production parser (supplement) + export/update unchanged round-trip flows (runtime-proof) |
| File security / parser hardening | PASS (implemented + unit-tested) | `apps/api/src/common/excel/excel-zip.ts`, `excel-parser.ts`, `excel.spec.ts` (56 API Excel tests incl. parser/zip/workbook cases) + runtime parse checks; exhaustive adversarial matrix beyond suite covered by implementation/tests as available |
| Machine+dedicated cost center created/tenant-scoped | PASS | runtime-supplement |
| Per-entity explicit named inventory balance/movement deltas beyond global sentinels | EVIDENCED BY GLOBAL SENTINELS | all inventoryBalance/inventoryMovement counts+hashes unchanged across full proof run (no entity-specific delta possible given master-data-only paths) |

## 4. Focused and fresh validation gates

| Check | Result | Evidence |
|---|---|---|
| API Excel focused tests | PASS (3 suites, 56 tests) | `npx jest --runInBand src/common/excel/excel.spec.ts src/modules/factory/master-data-excel/excel-plan.spec.ts src/modules/factory/master-data-excel/master-data-excel.service.spec.ts` (apps/api) |
| Web Excel focused test | PASS (1 suite, 8 tests) | `npx jest --config apps/web/tests/jest.config.js excel-master-data` |
| API typecheck | PASS | `cd apps/api && npx tsc --noEmit` |
| Web typecheck | PASS | `cd apps/web && npx tsc --noEmit` |
| Web production build | PASS | `.tmp/excel-master-data-20261117/web-build-fresh.log` (`npm run build:web`) |
| Route contract | PASS (MATCHED=1169, MISMATCHES=0) | `.tmp/excel-master-data-20261117/route-contract-fresh.log` |
| i18n consistency | PASS (7103/7103) | `.tmp/excel-master-data-20261117/i18n-fresh.log` |
| Raw-key check | PASS (dynamic-key warnings safe) | `.tmp/excel-master-data-20261117/raw-keys-fresh.log` |
| Credentials check | PASS | `.tmp/excel-master-data-20261117/credentials-fresh.log` |
| UI baseline integrity (incl. permission UI) | PASS (99 checks) | `.tmp/excel-master-data-20261117/ui-baseline-fresh.log`, `.tmp/excel-master-data-20261117/permission-ui-fresh.log` |
| `git diff --check` | PASS (clean) | session check |
| U+FFFD scan | PASS for changed scope | matches only pre-existing unrelated files (`docs/print/proofs/*.png`, prior proof docs), none in changed Excel sources |

## 5. Full regression suites (fresh after multipart-fix)

| Suite | Command | Result | Log |
|---|---|---|---|
| Full API | `npm run test:api` | **PASS** — 222 suites, 4791 tests passed, 0 failed (97.897s). Exit 0. Note: Jest reported "worker process failed to exit gracefully..." warning in log but suite completed successfully. | `.tmp/excel-master-data-20261117/api-full-fresh.log`, `.tmp/excel-master-data-20261117/api-full-fresh.exit` |
| Full Web | `npm run test:web-logic` | **PASS** — 124 suites, 2330 tests passed, 0 failed (28.784s). Exit 0. | `.tmp/excel-master-data-20261117/web-full-fresh.log`, `.tmp/excel-master-data-20261117/web-full-fresh.exit` |

## 6. Changed/untracked files (Excel scope classification)

See session report for authoritative classification. Excel implementation touches shared parser/workbook/types, API master-data-excel module + controller/service/definitions/plan + app module/i18n, minimal tx-aware hooks in maintenance/machine-components/spare-parts/products service paths, web actions component + admin/product page wiring + api download helper + i18n, and focused tests. No schema/migration files changed.

## 7. Limitations / notes

- Temp proof artifacts/scripts and generated xlsx remain under `.tmp/excel-master-data-20261117/` (not for commit). Temp `api-dist` was patched for proof; source controller is fixed.
- Full adversarial file-security matrix is bounded by implemented parser/zip guards and `excel.spec.ts`; runtime proofs exercised production parser against generated/HTTP workbooks.
- `PRODUCTION_DEPLOYMENT = NOT_AUTHORIZED`. `NEXT_AUTHORIZED_PHASE = NONE`.
