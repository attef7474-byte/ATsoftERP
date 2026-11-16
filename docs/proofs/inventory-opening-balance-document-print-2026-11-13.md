# Inventory Opening Balance DOCUMENT print — 2026-11-13

Status: **INVENTORY_OPENING_BALANCE_AUTOMATED_COMPLETE_NATIVE_NOT_VERIFIED**

Scope: Phase 1 inventory operational print, Inventory Opening Balance document only. The shared print engine, the accepted report rollout and the accepted Maintenance operational print batch were not rebuilt or re-audited. No other inventory document (Movement, Count, Adjustment, Stock Adjustment, Ledger, Reconciliation, Balances register) was started.

## 1. Approval and classification

- Business artifact: Inventory Opening Balance document.
- Classification: `DOCUMENT`.
- Decision: `APPROVE` (implemented, automated PASS), recorded in `docs/print/ATsoftERP-operational-print-justification.md`.
- Gate satisfied: canonical detail read exists, the artifact carries a business number, and the existing read permission plus authenticated company/branch scope are sufficient.
- A read-only frontend `[id]` detail route was required because the list page already pushed to `/admin/inventory/opening-balances/${id}` but no such route existed.

## 2. Canonical source audit

- Endpoint: `GET /inventory/opening-balances/:id` (`inventory.controller.ts` → `opening-balances.service.ts#findOne`).
- Permission: `inventory:opening-balance:read` (existing; not changed).
- Tenancy: `findOne` uses `assertRowInContext`, so the record is resolved inside the authorized company/branch context rather than by naked ID.
- Payload used: `code`, `status`, `documentDate`, `reason`, `notes`, `submittedAt`, `approvedAt`, `rejectedAt`, `postedAt`, `cancelledAt`, `createdAt`, `updatedAt`, company, branch, warehouse, and lines with `quantity`, `unitCost`, `currencyCode`, `notes`, `product { code, name, unit }`.
- The canonical detail does **not** return readable location, lot or user display names. Those fields are omitted from the document rather than replaced with database IDs. `createdBy`/`postedBy` are not present as readable values.
- No new endpoint, DTO, service method, permission or migration was added.

## 3. Implementation files

Created:

- `apps/web/src/components/print/inventory-opening-balance-document-print.ts` — typed DOCUMENT adapter, A4 portrait, required business number, localized metadata/sections/notes, conditional cost/currency, localized empty state.
- `apps/web/src/app/admin/inventory/opening-balances/[id]/page.tsx` — read-only detail page (Back/Refresh/Print), loading/error/not-found/empty states, print gated by `inventory:opening-balance:read`, print-time canonical re-read, reserved-ID guard.
- `apps/web/tests/inventory-opening-balance-document-print.test.ts` — focused suite OB-P01–OB-P18.

Modified:

- `apps/web/src/lib/admin-types/inventory.ts` — extended `OpeningBalance`/`OpeningBalanceLine` types with `locationId`, `quantityBase`, `unitCost`, `currencyCode`, `valuationReason`, `movementId`, timestamps.
- `apps/web/src/lib/i18n/locales/en/reports.ts` and `apps/web/src/lib/i18n/locales/ar/reports.ts` — `openingBalanceDocumentScope`, `openingBalanceDocumentNote`, `rowNumber` (synchronized EN/AR).

## 4. What the document prints

- Business number (`code`), localized status.
- Company and branch from the authenticated operational context; warehouse `[code] name`.
- Document date, posted date, created date, updated date (localized, LTR-isolated).
- Reason, line count.
- One lines section: row number, product code, product name, recorded quantity, actual product unit, unit cost and currency only when recorded, line notes.
- A scope/limitation note plus user notes.
- Runtime print date/time, timezone, printed-by and company/branch footer.

Never printed: `id`, `companyId`, `branchId`, `warehouseId`, `locationId`, `productId`, `openingBalanceId`, `submittedById`, `approvedById`, `rejectedById`, `postedById`, `cancelledById`, `movementId`, `quantityBase`, `valuationReason`, `lockVersion`, `_count`, raw permissions, tokens, passwords, application chrome, location/lot, computed line values, document monetary total, valuation, or a mixed-UOM quantity total.

Rationale: quantities are recorded values in each line's own source unit. Summing mixed or missing units would be misleading, and no line value/total/valuation is canonical for this document.

## 5. Tests

- Focused suite `apps/web/tests/inventory-opening-balance-document-print.test.ts`: **13/13 PASS** (OB-P01–OB-P18 mapped across the 13 executed assertions).
- Related regression `npm test -- inventory unified-print maintenance-work-order-document-print maintenance-repair-order-document-print maintenance-request-document-print`: **15 suites / 179 tests PASS**.
- Fresh full Web regression `npm test --workspace apps/web`: **117 suites / 2198 tests PASS**.

Coverage includes: AR/EN model, required business number, metadata, warehouse, status localization, conditional cost/currency, line order and exactly-once identity, mixed-unit no-total, empty state, print-time canonical re-read, denied/absent read, technical-ID redaction and no application chrome.

## 6. PDF proof

Renderer: the real `inventoryOpeningBalanceDocumentModel`, the real `PrintDocument` component and the real shared `printDocumentCss`, driven by `.tmp/unified-print/opening-balance-proof.cjs`. **Fixtures are in-memory only**: zero database writes, zero API calls, zero inventory mutations. The API was not running during this batch, so no live canonical record was used.

| PDF | Locale | Mode | Pages | Bytes |
| --- | --- | --- | --- | --- |
| `inventory-opening-balance-actual-ar.pdf` | AR | actual | 1 | 22116 |
| `inventory-opening-balance-actual-en.pdf` | EN | actual | 1 | 14736 |
| `inventory-opening-balance-empty-ar.pdf` | AR | empty | 1 | 19031 |
| `inventory-opening-balance-empty-en.pdf` | EN | empty | 1 | 12443 |
| `inventory-opening-balance-multipage-ar.pdf` | AR | 120 lines | 6 | 51577 |
| `inventory-opening-balance-multipage-en.pdf` | EN | 120 lines | 6 | 44290 |

Inspection (`.tmp/unified-print/inspect-opening-balance-pdfs.py`, `.tmp/unified-print/inspect-opening-balance-layout.py`):

- A4 portrait 595.28 × 841.89 pt on every page.
- All text blocks inside the printable canvas.
- No `<button|input|select|nav>`, `lockVersion`, internal IDs, CUID/UUID, `NaN`, `Invalid Date`, untranslated keys or `undefined`.
- Business number, company and branch present; warehouse `[code] name` present when applicable.
- Actual case: each of `ITEM-001`–`ITEM-004` appears exactly once; `12.5`/`USD` printed; no `1,200,000`/`1200000` quantity total.
- Empty case: localized empty state present.
- Multipage case: 6 pages per language; every one of 120 product codes appears exactly once; document number on page 1 only (shared-engine header behaviour, not introduced by this document).
- Zero block collisions on every page.
- Raster check: all pages non-blank (`.tmp/unified-print/inventory-opening-balance-raster-inspection.json`).

## 7. Gates

- Web typecheck: PASS.
- Web production build: PASS, 194/194 pages, route `/admin/inventory/opening-balances/[id]` emitted (6.8 kB).
- `npm run ui-baseline:check`: PASS (UI baseline 99 checks, i18n 7021 EN / 7021 AR synchronized, raw-key safety, permission UI).
- `npm run route-contract:check`: PASS, 1161 matched / 0 malformed / 0 unresolved / 0 mismatches.
- `npm run credentials:check`: PASS.
- `git diff --check`: clean.
- U+FFFD scan on changed Opening Balance files: clean.

## 8. Zero-write sentinels

`DATABASE_WRITE = 0`, `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`, `API_BUSINESS_MUTATION = 0`, `PERMISSION_CHANGE = 0`, `INVENTORY_QUANTITY_DELTA = 0`, `MAINTENANCE_STATUS_CHANGE = 0`, `PRODUCTION_DELTA = 0`.

Print is GET-only and re-reads the canonical detail at print time. No inventory mutation, posting, workflow transition or fixture record was created.

## 9. Not verified

- Native browser preview of the Print/PDF dialog.
- Native Save-as-PDF.
- Print cancellation behaviour.
- Physical paper output.
- Human visual review of the rendered PNG pages. Evidence is programmatic PDF text/bounds/collision/raster inspection; the current environment could not view the raster images.
- Live canonical record: all PDFs are explicitly labelled in-memory fixtures.

These must remain `NOT_VERIFIED` until the owner or a manual review records concrete evidence.

## 10. Evidence paths

- Focused test: `apps/web/tests/inventory-opening-balance-document-print.test.ts`.
- Render script: `.tmp/unified-print/opening-balance-proof.cjs`.
- PDF inspector: `.tmp/unified-print/inspect-opening-balance-pdfs.py`.
- Layout inspector: `.tmp/unified-print/inspect-opening-balance-layout.py`.
- Manifests: `.tmp/unified-print/inventory-opening-balance-render-manifest.json`, `inventory-opening-balance-pdf-inspection.json`, `inventory-opening-balance-layout-inspection.json`, `inventory-opening-balance-raster-inspection.json`.
- PDFs/PNGs/text: `docs/print/proofs/inventory-opening-balance-*`.

## 11. Documentation updated

`docs/print/ATsoftERP-operational-print-justification.md`, `ATsoftERP-print-page-matrix.md`, `ATsoftERP-print-audit.md`, `ATsoftERP-print-rollout.md`, `ATsoftERP-print-column-rules.md`, `ATsoftERP-print-validation.md` and `ATsoftERP-print-standard.md` were updated for Opening Balance only. Movement, Count, Adjustment, Stock Adjustment, Ledger, Reconciliation and Balances register are not documented as complete.

## 12. Git

Branch `main`, HEAD `54e3706f`. No commit, push, merge, reset, branch, tag or staging was performed. The worktree already contained unrelated employee/mobile/production changes plus prior print work; they were preserved. The Opening Balance changes are classified `PRINT_INVENTORY_OPENING_BALANCE`.
