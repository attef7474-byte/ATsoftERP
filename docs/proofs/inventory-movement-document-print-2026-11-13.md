# Inventory Movement DOCUMENT print — 2026-11-13

Status: **INVENTORY_MOVEMENT_AUTOMATED_COMPLETE_NATIVE_NOT_VERIFIED**

Scope: Phase 2 inventory operational print, Inventory Movement document only. The shared print engine, the accepted report rollout, the accepted Maintenance operational print batch and the accepted Inventory Opening Balance work were not rebuilt or re-audited. No other inventory document (Count, Adjustment, Stock Adjustment, Ledger, Reconciliation, Balances register) and no Production Material Document was started.

## 1. Approval and classification

- Business artifact: Inventory Movement document.
- Classification: `DOCUMENT`.
- Decision: `APPROVE` (implemented, automated PASS), recorded in `docs/print/ATsoftERP-operational-print-justification.md`.
- Gate satisfied: the canonical detail read exists, the artifact carries a business number, and the existing read permission plus authenticated company/branch scope are sufficient.
- No new frontend route was required: `/admin/inventory/movements/[id]` already existed and gained a Print action.

## 2. Canonical source audit

- Endpoint: `GET /inventory/movements/:id` (inventory movements controller → `inventory-movements.service.ts#findOwned`).
- Permission: `inventory-movement:read` (existing; not changed).
- Tenancy: `findOwned` resolves the record and rejects it when `deletedAt` is set or when company/branch context fails (`isInContext`); it is not a naked-ID fetch. Branch must equal the active context branch or be null.
- Payload used: `movementNumber`, `movementType`, `status`, `movementDate`, `sourceType`, `postedAt`, `cancelledAt`, `createdAt`, `updatedAt`, `notes`, company, branch, warehouse, and lines with `quantity`, `unit`, `direction`, optional `batchNumber`/`serialNumber`/`expiryDate`/`unitCost`/`totalCost`/`currencyCode`, `notes`, and `product { code, name }`.
- Contract findings that shaped the document:
  - The movement is single-warehouse. The header carries one warehouse and each line carries its own `IN`/`OUT` direction. There is no header `direction` field and no source/destination warehouse pair.
  - `sourceType` is exposed, but the referenced business document number is not. The reference is therefore identified by type only; the API was not widened.
  - `warehouseLocationId` is exposed without a readable location name and readable user display names are absent. Those fields are omitted rather than replaced with IDs.
  - `quantity` is the recorded transaction quantity when a unit is selected, otherwise the base quantity; `unit` is the recorded line unit snapshot. `quantityBase` is not printed.
- No new endpoint, DTO, service method, permission or migration was added.

## 3. Implementation files

Created:

- `apps/web/src/components/print/inventory-movement-document-print.ts` — typed DOCUMENT adapter, A4 portrait, required business number, localized metadata/sections/notes, conditional batch/serial/expiry/cost columns, per-line direction, localized empty state.
- `apps/web/tests/inventory-movement-document-print.test.ts` — focused suite IM-P01–IM-P20 mapped across 17 executed tests.

Modified:

- `apps/web/src/app/admin/inventory/movements/[id]/page.tsx` — added the Print action gated by `inventory-movement:read`, print-time canonical re-read, and a guarded pre-existing raw direction display.
- `apps/web/src/lib/i18n/literals.ts` — added `translateMovementSourceType` with a humanized fallback, so unknown source types never render as raw keys.
- `apps/web/src/lib/i18n/locales/en/common.ts` and `ar/common.ts` — added the missing movement-type status labels (for example `OPENING_BALANCE`, `STOCK_RECEIVING`, `STOCK_TRANSFER_IN/OUT`, `STOCK_ADJUSTMENT_IN/OUT`, `PRODUCTION_FG_RECEIPT_REVERSAL`, `MANUAL`).
- `apps/web/src/lib/i18n/locales/en/inventory.ts` and `ar/inventory.ts` — added batch/serial/expiry/total-cost labels and the localized movement source-type map.
- `apps/web/src/lib/i18n/locales/en/reports.ts` and `ar/reports.ts` — added `movementDocumentScope` and `movementDocumentNote`.
- `apps/web/src/lib/admin-types/inventory-movement.ts` — aligned the Movement types with the canonical payload (extra movement types, optional line `quantityBase`, batch/serial/expiry/cost/currency, optional `product.unit`).

## 4. What the document prints

- Movement number (`movementNumber`), localized movement type and status.
- Company and branch from the authenticated operational context; the one movement warehouse as `[code] name`.
- Movement date, posted date, cancelled date, created date, updated date (localized, LTR-isolated; missing optional dates omitted).
- Localized source type.
- Line count.
- One lines section: row number, product code, product name, recorded transaction quantity, recorded line unit, per-line IN/OUT direction, and — only when at least one line carries them — batch, serial, expiry, unit cost, total cost, currency, line notes.
- A scope/limitation note plus user notes.
- Runtime print date/time, timezone, printed-by and company/branch footer.

Never printed: `id`, `companyId`, `branchId`, `warehouseId`, `warehouseLocationId`, `productId`, `movementId`, `sourceId`, `requestId`, `postedById`, `cancelledById`, `reversesMovementId`, `quantityBase`, `lockVersion`, `_count`, raw permissions, tokens, passwords, application chrome, warehouse-location names, user identities, a document quantity total, a mixed-UOM sum, a computed valuation or a ledger reconciliation.

Rationale: quantities are recorded values in each line's own recorded unit. Summing mixed or missing units would be misleading, and no document quantity total or valuation is canonical for this document. Direction is printed as recorded per line, never inferred from a sign.

## 5. Tests

- Focused suite `apps/web/tests/inventory-movement-document-print.test.ts`: **1 suite / 17 tests PASS** (IM-P01–IM-P20 mapped across 17 executed tests).
- Related regression `inventory-opening-balance-document-print`, `inventory-movements-print`, `unified-print`, `unified-print-runtime`, `maintenance-work-order-document-print`, `maintenance-repair-order-document-print`, `maintenance-request-document-print`: **7 suites / 70 tests PASS**.
- Fresh full Web regression `npm test --workspace apps/web`: **118 suites / 2215 tests PASS**.

Coverage includes: AR/EN model, required business number, metadata, single warehouse, per-line direction (no source/destination pair), source-type-only reference, conditional batch/serial/expiry/cost, mixed-unit no-total, empty state, print-time canonical re-read, denied read, technical-ID redaction and no application chrome.

## 6. PDF proof

Renderer: the real `inventoryMovementDocumentModel`, the real `PrintDocument` component and the real shared `printDocumentCss`, driven by `.tmp/unified-print/movement-document-proof.cjs`. **Fixtures are in-memory only**: zero database writes, zero API calls, zero inventory mutations. The API was not running during this batch, so no live canonical record was used.

| PDF | Locale | Mode | Pages | Bytes |
| --- | --- | --- | --- | --- |
| `inventory-movement-document-actual-ar.pdf` | AR | actual | 1 | 24453 |
| `inventory-movement-document-actual-en.pdf` | EN | actual | 2 | 16885 |
| `inventory-movement-document-empty-ar.pdf` | AR | empty | 1 | 18728 |
| `inventory-movement-document-empty-en.pdf` | EN | empty | 1 | 12664 |
| `inventory-movement-document-multipage-ar.pdf` | AR | 120 lines | 8 | 66022 |
| `inventory-movement-document-multipage-en.pdf` | EN | 120 lines | 8 | 58380 |

Inspection (`.tmp/unified-print/inspect-movement-document-pdfs.py`):

- A4 portrait 595.28 × 841.89 pt on every page.
- All text blocks inside the printable canvas; no blank page.
- No `<button|input|select|nav>`, `lockVersion`, `companyId`/`branchId`/`warehouseId`/`locationId`/`productId`/`movementId`/`sourceId`/`requestId`/`postedById`/`cancelledById`/`reversesMovementId`, CUID/UUID, `NaN`, `Invalid Date`, untranslated keys, `undefined` or `null`.
- Business number, company and branch present; the one warehouse `[code] name` present when applicable.
- No `Source warehouse` / `Destination warehouse` labels, because the contract has no such pair.
- Actual case: each of `ITEM-001`–`ITEM-004` appears exactly once; `LOT-77`, `SN-9001`, `12.5`, `312.5` and `USD` printed; no document quantity total.
- Direction: per-line values are only the localized `IN`/`OUT` labels (`Out`/`In` in EN, `صادر`/`وارد` in AR); no sign is inferred.
- Empty case: localized empty state present.
- Multipage case: 8 pages per language; every one of 120 product codes appears exactly once; table headers repeat on every page with rows.

## 7. Gates

- Web typecheck: PASS.
- Web production build: PASS, 194/194 pages, exit 0; route `/admin/inventory/movements/[id]` emitted.
- i18n check: PASS, **7055 EN / 7055 AR**, all namespaces registered, no empty values.
- Raw-key safety: PASS.
- UI baseline: PASS, 99 checks; permission-UI check PASS.
- `npm run route-contract:check`: PASS, 1162 matched / 0 malformed / 0 unresolved / 0 mismatches.
- `npm run credentials:check`: PASS.
- `git diff --check`: clean.
- U+FFFD scan on changed Movement files: clean.

## 8. Zero-write sentinels

`DATABASE_WRITE = 0`, `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`, `API_BUSINESS_MUTATION = 0`, `PERMISSION_CHANGE = 0`, `INVENTORY_QUANTITY_DELTA = 0`, `MAINTENANCE_STATUS_CHANGE = 0`, `PRODUCTION_DELTA = 0`.

Print is GET-only and re-reads the canonical detail at print time. No inventory mutation, posting, workflow transition or fixture record was created.

## 9. Not verified

- Native browser preview of the Print/PDF dialog.
- Native Save-as-PDF.
- Print cancellation behaviour.
- Physical paper output.
- Human visual review of the rendered PNG pages. Evidence is programmatic PDF text/bounds/raster inspection; the current environment could not view the raster images.
- Live canonical record: all PDFs are explicitly labelled in-memory fixtures.

These must remain `NOT_VERIFIED` until the owner or a manual review records concrete evidence.

## 10. Evidence paths

- Focused test: `apps/web/tests/inventory-movement-document-print.test.ts`.
- Render script: `.tmp/unified-print/movement-document-proof.cjs`.
- PDF inspector: `.tmp/unified-print/inspect-movement-document-pdfs.py`.
- Manifests: `.tmp/unified-print/inventory-movement-document-render-manifest.json`, `inventory-movement-document-pdf-inspection.json`.
- PDFs/PNGs/text: `docs/print/proofs/inventory-movement-document-*`.

## 11. Documentation updated

`docs/print/ATsoftERP-operational-print-justification.md`, `ATsoftERP-print-standard.md`, `ATsoftERP-print-page-matrix.md`, `ATsoftERP-print-column-rules.md`, `ATsoftERP-print-rollout.md` and `ATsoftERP-print-validation.md` were updated for Inventory Movement only. Count, Adjustment, Stock Adjustment, Ledger, Reconciliation, Balances register and Production Material Document are not documented as complete.

## 12. Git

Branch `main`, HEAD `54e3706f`. No commit, push, merge, reset, branch, tag or staging was performed. The worktree already contained unrelated employee/mobile/production changes plus prior print work; they were preserved. The Inventory Movement changes are classified `PRINT_INVENTORY_MOVEMENT`.
