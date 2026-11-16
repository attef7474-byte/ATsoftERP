# Inventory Ledger REGISTER print — implementation proof (2026-11-13)

Status: **`INVENTORY_LEDGER_REGISTER_AUTOMATED_COMPLETE_NATIVE_NOT_VERIFIED`**.

Scope: implement the Inventory Ledger print surface only (`/admin/inventory/ledger`, `GET /inventory/ledger/movements`, `inventory-ledger:read`) as a thin route-specific wrapper over the accepted shared InventoryMovement register model. Reconciliation, Balances, Stock Card, Valuation and Production documents are out of scope. This phase adds no running/opening/closing balance, no valuation and no new business entity.

## 1. Decision and authorization

- Prior classification: `INVENTORY_LEDGER_CLASSIFIED_AS_REGISTER`.
- Prior design: `INVENTORY_LEDGER_DESIGN_EXTEND_EXISTING_MOVEMENTS_REGISTER_WITH_LEDGER_FILTERS`, `DESIGN_APPROVED`, readiness `READY`.
- Prior hardening: `INVENTORY_LEDGER_SOURCE_FILTER_CONTRACT_HARDENED`.
- This phase consumes that authorization for the register print surface only.
- Final decision: **`INVENTORY_LEDGER_REGISTER_AUTOMATED_COMPLETE_NATIVE_NOT_VERIFIED`**.
- `NEXT_AUTHORIZED_PHASE = NONE`.

## 2. Architecture

One canonical register model is shared; the ledger is not a second competing register.

| Layer | File | Responsibility |
| --- | --- | --- |
| Shared business model | `apps/web/src/components/print/inventory-movement-register-print.ts` | `MovementRegisterRow`, `MovementRegisterPrintData`, `movementRegisterColumns`, `buildMovementRegisterPrint`; six columns, movement-count summary, redaction, shared notes |
| Accepted Movements adapter | `apps/web/src/components/print/inventory-movements-print.ts` | Delegates to the shared builder; output unchanged (`EXISTING_MOVEMENTS_REGISTER_REGRESSION = PASS`) |
| Ledger adapter | `apps/web/src/components/print/inventory-ledger-register-print.ts` | Ledger title `inventoryLedger.title` ("Inventory Ledger"), mode `REGISTER`, A4 portrait, applied-filter metadata, readable labels |
| Ledger route | `apps/web/src/app/admin/inventory/ledger/page.tsx` | Real list read, applied filters, print action, snapshot capture, bounded collector, scope/data-change guards |
| Filter contract | `apps/web/src/app/admin/inventory/ledger/filter-contract.ts` | Whitelisted applied-filter serializer and `meta` normalizer for print |

Both adapters call the same `buildMovementRegisterPrint` → `PrintDocument` (`mode: REGISTER`, A4 portrait) → shared `printDocumentCss`. The print and PDF representations are the same model; there is no second renderer.

## 3. Print scope and collector

- Scope: all applied filtered rows, not just the visible 20-row page.
- Collector: `collectPrintRows` with 100 rows per page and a hard 500-row cap.
- 500 rows: accepted.
- 501 rows: blocked with the localized narrow-filters error; no partial PDF, no truncation, no "Full Ledger" label.
- Every page must match the captured applied filters and the expected total; duplicate identities fail closed.
- A denied later page aborts preparation; no document opens.
- A failed screen refresh invalidates the snapshot so stale data cannot print.
- An operational scope change during collection aborts preparation.
- Pagination is deterministic: `movementDate desc, id desc`.
- Date-only `dateTo` includes the whole selected day (exclusive next-day UTC boundary); full timestamps keep exact `lte`.

## 4. Authorization separation

| Route | Data read | Permission | Print action permission |
| --- | --- | --- | --- |
| `/admin/inventory/ledger` | `GET /inventory/ledger/movements` | `inventory-ledger:read` | `inventory-ledger:read` |
| `/admin/reports/inventory/movements` | `GET /reports/inventory/movements` | `reports.inventory:read` | existing route authority |

`SHARED_MODEL != SHARED_AUTHORIZATION`. No `inventory-ledger:print` permission exists or was added. `PERMISSION_CHANGE = 0`. The ledger print flow never calls the Reports endpoint.

## 5. Applied filters

`filter-contract.ts` sends only:

`page`, `limit`, `search`, `warehouseId`, `productId`, `movementType`, `status`, `direction`, `sourceType`, `dateFrom`, `dateTo`.

Never sent: `companyId`, `branchId`, `sourceId`, raw `locationId`, display labels, unknown UI fields. Empty values are omitted. `status` is sent as `status`, never `countStatus`. Location and source filters remain deferred because no safe readable selector exists.

The printed filter block uses human-readable values:

- search → `inventoryLedger.search`
- warehouse → `reports.warehouse` (readable `[code] name`; raw id refused)
- product → `inventoryLedger.product` (readable label; raw id refused)
- movement type → `inventoryLedger.movementType`
- status → `inventoryLedger.status`
- direction → `inventoryLedger.direction`
- source type → `inventoryLedger.sourceType`
- dates → `reports.dateFrom` / `reports.dateTo` with `fmt.dateOnly`

Missing readable warehouse/product labels throw `PrintPreparationError('unavailable')`; the adapter never prints a raw id in place of a label.

## 6. Columns, summary and exclusions

Exactly six business columns, one row per `InventoryMovement` header:

1. Movement Number (`movementNumber`)
2. Date (`movementDate`, date-only)
3. Movement Type (localized)
4. Warehouse (readable `[code] name`)
5. Status (localized)
6. Notes

There is no product column, no quantity column, no UOM column, no line detail and no mixed-UOM total. Summary is total movements only. There is no running/opening/closing balance, no `InventoryBalance` read and no valuation/cost/currency total.

Never printed: `id`, `movementId`, `sourceId`, `productId`, `warehouseId`, `locationId`, `companyId`, `branchId`, any actor `*ById`, `lockVersion`, `requestId`, `_count`, permission arrays, tokens, session data or secrets. `sourceType` appears only as a localized label.

## 7. Test coverage (ILR-P01–P33)

Focused suite: `apps/web/tests/inventory-ledger-register-print.test.ts` (24 tests). Accepted movements regression: `apps/web/tests/inventory-movements-print.test.ts` (9 tests). Combined: **2 suites / 33 tests PASS**.

| IDs | Coverage |
| --- | --- |
| ILR-P01/P02 | Arabic RTL and English LTR Ledger register rendering through the shared document |
| ILR-P03 | Ledger title differs while business rows/columns remain exactly those of the Movements register |
| ILR-P04–P09 | Canonical six columns and readable business values |
| ILR-P10–P14 | Movement-count summary only; no product/quantity/UOM/balance/valuation output |
| ILR-P15/P16 | Technical ids, `sourceId`, actor ids and secrets redacted |
| ILR-P17 | Applied filters printed as human-readable metadata, never raw filter ids |
| ILR-P18/P19 | Readable warehouse/product labels required; raw ids refused |
| ILR-P18/P19/P20/P21 | Applied status/direction/product filters printed; never `countStatus` |
| ILR-P20/P21 | One header row even when product/direction filters match line facts |
| ILR-P17 (flow) | Remembered readable warehouse/product labels, never ids |
| ILR-P18 (draft) | Editing draft filters does not change the printed applied scope |
| ILR-P22/P23 | Every bounded page collected; each movement number exactly once |
| ILR-P24 | 500-row boundary accepted |
| ILR-P25 | 501 rows blocked with the localized narrow-filters error; no partial document |
| ILR-P26 | Abort on operational scope change during collection |
| ILR-P27 | Fail closed on duplicate identities or changed total |
| ILR-P28 | Denied later page aborts without a document |
| ILR-P29/P30 | Uses only `inventory-ledger:read`; never calls the Reports endpoint |
| ILR-P31/P32 | Runtime REGISTER document; print and PDF share one model |
| ILR-P33 | Accepted Movements Register output identical after shared extraction |
| Date parity | Applied date-only contract reused; never `countStatus` |
| Refresh failure | Snapshot invalidated; no stale scope can print |
| Normalizer | Ledger `meta` envelope normalized without mutating business rows |
| Builder guard | Canonical builder keeps shared columns when route metadata is absent |

Additional non-ILR tests in the suite cover the same boundaries (movements unchanged, denied page, invalid refresh, normalizer).

## 8. Validation results

| Gate | Result |
| --- | --- |
| Focused Ledger register | **1 suite / 24 tests PASS** |
| Accepted Movements regression | **1 suite / 9 tests PASS** |
| Combined focused | **2 suites / 33 tests PASS** |
| Related inventory/unified print regression | **14 suites / 203 tests PASS** |
| Full Web suite | **123 suites / 2322 tests PASS** |
| Full API suite | **219 suites / 4735 tests PASS** |
| All-workspace typecheck (`npm run typecheck`) | **PASS** (API + Web) |
| Web production build | **PASS**, 304 page routes, 194/194 static pages |
| i18n | **PASS**, 7069 EN / 7069 AR, synchronized |
| Raw-key check | **PASS** |
| UI baseline | **PASS**, 99 checks |
| Permission UI | **PASS** |
| API route contract | **PASS**, 1185 backend routes, 0 malformed/unresolved/mismatches |
| Hardcoded credentials | **PASS** |
| `git diff --check` | **PASS** |
| U+FFFD scan of touched files | **PASS**, 0 files |

The related regression set was:

`inventory-ledger-register-print`, `inventory-ledger-filter-contract`, `inventory-movements-print`, `inventory-movement-document-print`, `inventory-opening-balance-document-print`, `inventory-count-document-print`, `inventory-count-variance-print`, `inventory-adjustment-document-print`, `inventory-adjustments-print`, `inventory-stock-adjustment-document-print`, `inventory-balances-print`, `inventory-overview-print`, `unified-print-runtime`, `unified-print`.

The prior `inventory-ledger-filter-contract.test.ts` OOM was traced to its mock of `useReportPrintSnapshot` returning fresh callback identities on every render, which made `fetchData` change identity forever. The mock now uses stable module-level callbacks matching the real hook's `useCallback` contract; the suite passes 16/16 with no production-code workaround.

## 9. PDF proof

Generator: `.tmp/unified-print/ledger-register-proof.cjs`. Inspector: `.tmp/unified-print/inspect-ledger-register-pdfs.py`. Manifest: `.tmp/unified-print/inventory-ledger-register-render-manifest.json`.

The generator renders the real `inventoryLedgerPrintModel` through the real `PrintDocument` and shared `printDocumentCss` with in-memory fixtures only. It performs no database writes and no API calls. "Actual" is a realistic full fixture, not a live canonical database record; this is stated explicitly instead of claiming live data.

| PDF | Locale | Mode | Pages | Bytes | Result |
| --- | --- | --- | --- | --- | --- |
| `inventory-ledger-register-actual-ar.pdf` | AR | actual | 1 | 19921 | PASS |
| `inventory-ledger-register-empty-ar.pdf` | AR | empty | 1 | 15843 | PASS |
| `inventory-ledger-register-multipage-ar.pdf` | AR | multipage | 3 | 31317 | PASS |
| `inventory-ledger-register-actual-en.pdf` | EN | actual | 1 | 13589 | PASS |
| `inventory-ledger-register-empty-en.pdf` | EN | empty | 1 | 11121 | PASS |
| `inventory-ledger-register-multipage-en.pdf` | EN | multipage | 3 | 25350 | PASS |

Inspector results, all six: `A4Portrait = PASS`, `textBounds = PASS`, `noAppChrome = PASS`, `noTechnicalIds = PASS`, `noQuantityUomValuation = PASS`, `title = PASS`. Empty PDFs: `emptyState = PASS`. Multipage PDFs: `rowUniqueness = PASS`, `repeatedHeader = PASS` (3 pages per language, 65 rows exactly once). Native browser: `NOT_VERIFIED`.

The inspector forbids app chrome, technical ids/`sourceId`/actor ids/`requestId`/`_count`, private fixture markers, running/opening/closing balance labels, `totalCost`, currency and quantity/UOM leaks. It intentionally does not reject the word "valuation" because the accepted mixed-units note legitimately contains it; cost/quantity leaks are checked separately.

Artifacts: `docs/print/proofs/inventory-ledger-register-*.pdf`, `-page-*.png` and `-page-*.txt`.

## 10. Zero-write and scope sentinels

`DATABASE_WRITE = 0`, `INVENTORY_BUSINESS_WRITE = 0`, `API_MODIFICATION = 0`, `NEW_ENDPOINT = 0`, `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`, `PERMISSION_CHANGE = 0`, `INVENTORY_QUANTITY_DELTA = 0`, `MOVEMENT_CREATED = 0`, `BALANCE_WRITE = 0`, `VALUATION_WRITE = 0`.

No API, DTO, service, Prisma schema, migration, seed, permission or business transaction was changed. The only backend file touched in the broader dirty worktree for ledger work is the prior hardening service change; this phase made no API change.

## 11. Files

Created:

- `apps/web/src/components/print/inventory-movement-register-print.ts`
- `apps/web/src/components/print/inventory-ledger-register-print.ts`
- `apps/web/tests/inventory-ledger-register-print.test.ts`
- `docs/proofs/inventory-ledger-register-print-2026-11-13.md`

Modified:

- `apps/web/src/components/print/inventory-movements-print.ts`
- `apps/web/src/app/admin/inventory/ledger/page.tsx`
- `apps/web/src/app/admin/inventory/ledger/filter-contract.ts`
- `apps/web/tests/inventory-ledger-filter-contract.test.ts`
- `docs/print/ATsoftERP-operational-print-justification.md`
- `docs/print/ATsoftERP-print-page-matrix.md`
- `docs/print/ATsoftERP-print-column-rules.md`
- `docs/print/ATsoftERP-print-rollout.md`
- `docs/print/ATsoftERP-print-validation.md`
- `docs/print/ATsoftERP-print-standard.md`
- `docs/print/ATsoftERP-print-audit.md`

Generated proof artifacts (not source):

- `.tmp/unified-print/ledger-register-proof.cjs`
- `.tmp/unified-print/inspect-ledger-register-pdfs.py`
- `.tmp/unified-print/inventory-ledger-register-render-manifest.json`
- `.tmp/unified-print/inventory-ledger-register-*.html`
- `docs/print/proofs/inventory-ledger-register-*`

## 12. Limitations and honest status

- Native browser Print preview, native Save-as-PDF, cancellation and physical paper are **NOT_VERIFIED**. No claim of native completion is made.
- The PDF proof uses labelled in-memory fixtures, not a live canonical database record.
- Human visual review of the rendered pages is outstanding; inspection is structural/programmatic plus raster generation.
- `sourceId` is not printable because the canonical contract exposes no readable source document number.
- Warehouse-location filter remains deferred; no safe readable selector exists.
- The word "valuation" appears only inside the accepted mixed-units note; no valuation fact, column, total or computation is printed.
- No running/opening/closing balance is printed or inferred.
- `INVENTORY_LEDGER_REGISTER = COMPLETE` only for the automated model/test/PDF gate; overall status remains `..._NATIVE_NOT_VERIFIED`.

## 13. Evidence index

- Focused test: `apps/web/tests/inventory-ledger-register-print.test.ts`
- Accepted regression: `apps/web/tests/inventory-movements-print.test.ts`
- Shared model: `apps/web/src/components/print/inventory-movement-register-print.ts`
- Ledger model: `apps/web/src/components/print/inventory-ledger-register-print.ts`
- Ledger page: `apps/web/src/app/admin/inventory/ledger/page.tsx`
- Filter contract: `apps/web/src/app/admin/inventory/ledger/filter-contract.ts`
- PDFs: `docs/print/proofs/inventory-ledger-register-*.pdf`
- Render manifest: `.tmp/unified-print/inventory-ledger-register-render-manifest.json`
- Inspector output: `.tmp/ledger-register-inspection.log`
- Prior design: `docs/proofs/inventory-ledger-register-design-gate-2026-11-13.md`
- Prior hardening: `docs/proofs/inventory-ledger-source-filter-hardening-2026-11-13.md`
