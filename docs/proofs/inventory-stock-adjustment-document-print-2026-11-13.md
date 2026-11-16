# Inventory Stock Adjustment DOCUMENT print — 2026-11-13

Status: **STOCK_ADJUSTMENT_AUTOMATED_COMPLETE_NATIVE_NOT_VERIFIED** (automated model gate PASS; PDF structural gate PASS; native preview / Save-as-PDF / cancellation / physical paper NOT_VERIFIED)

Scope: Phase 4B continuation. The Inventory Adjustment document (legacy `InventoryAdjustment`) is closed and was not revisited. This phase implemented exactly one business artifact — the Inventory Stock Adjustment `DOCUMENT` on the existing shared print engine. No Ledger, Reconciliation, Balances register, Physical Count, Inventory Movement/Count/Opening Balance rework, Production Material Document/Order/Run, bulk print or register print was started. No print program re-audit, no rebuild of the shared engine, the 97 accepted report routes, the Maintenance batch or any closed Inventory document. No Stock Adjustment create/edit/submit/approve/reject/post/cancel, no movement creation and no stock, schema or permission change.

## 1. Final decision

- Business artifact: Inventory Stock Adjustment `DOCUMENT` (canonical family `InventoryStockAdjustment`).
- Source decision: **`STOCK_ADJUSTMENT_SOURCE_COMPLETE`** (existing canonical detail reused; no widening needed).
- Automated model gate: **PASS**.
- PDF structural gate: **PASS** (six AR/EN PDFs, programmatically inspected).
- Native preview / Save-as-PDF / cancellation / physical paper: **`NOT_VERIFIED`** (tracked separately).
- Final decision: **`STOCK_ADJUSTMENT_AUTOMATED_COMPLETE_NATIVE_NOT_VERIFIED`**.
- Next authorized phase: **`NONE`**.

## 2. Stock Adjustment family audit

| Family / surface | Route / contract | Model / permission | Decision |
| --- | --- | --- | --- |
| Inventory Stock Adjustment | `/admin/inventory/stock-adjustments`, new `[id]` document workspace | `InventoryStockAdjustment` / `InventoryStockAdjustmentLine`, `inventory:stock-adjustment:*` | **Selected canonical family**; canonical detail reused unchanged; DOCUMENT implemented |
| Legacy Inventory Adjustment | `/admin/inventory/adjustments`, `[id]` | `InventoryAdjustment` / `InventoryAdjustmentLine`, `inventory-adjustment:*` | Separate closed family; not touched or re-audited |
| Inventory Physical Count | `/admin/inventory/physical-counts` | `InventoryPhysicalCount` posting workflow | Separate workflow; out of scope |
| Inventory Count | `/admin/inventory/counts` (`generate-adjustment`) | Creates legacy `InventoryAdjustment` | Closed document; untouched |
| Inventory Movement / Opening Balance | `/admin/inventory/movements`, `/admin/inventory/opening-balances` | Closed documents | Untouched |
| Adjustment reports | `/admin/reports/inventory/adjustments` | Aggregate/header-only report reads | Not a document source; remain closed as reports |

Canonical family stays `InventoryStockAdjustment`; the legacy `InventoryAdjustment` family was **not** reused, duplicated or renamed.

## 3. Canonical source audit (selected family)

- Canonical detail endpoint: `GET /inventory/stock-adjustments/:id` (`apps/api/src/modules/factory/inventory-stock-adjustments/inventory-stock-adjustments.controller.ts`, `@Permissions('inventory:stock-adjustment:read')`).
- Service: `InventoryStockAdjustmentsService.findOne`.
- Read scope: `findFirst`/`findUnique` with `isInContext` company/branch scope plus `deletedAt: null`. Not a naked-ID read; company scope always enforced, branch scope enforced when the record carries a branch.
- Related detail routes: none needed. No separate lines endpoint, no summary endpoint used.
- No list, React state or cached payload is used for the printed document.

### Fields returned by the canonical detail

Header: business `code`, `companyId`, `branchId`, `warehouseId`, `locationId`, `status`, `documentDate`, `reason`, `notes`, workflow timestamps (`submittedAt`, `approvedAt`, `rejectedAt`, `postedAt`, `cancelledAt`) and actor ids (`submittedById`, `approvedById`, `rejectedById`, `postedById`, `cancelledById`, `createdById`, `updatedById`), `createdAt`, `updatedAt`, `deletedAt`, `lockVersion`, plus included relations `company`, `branch`, `warehouse`, `lines`.

Lines (`InventoryStockAdjustmentLine`): `id`, `stockAdjustmentId`, `productId`, `locationId`, `adjustmentType` (`ADJUSTMENT_IN` / `ADJUSTMENT_OUT`), `quantity` (stored positive), `movementId`, nullable `unitCost`, `currencyCode`, `valuationReason`, `notes`, timestamps, plus `product { id, name, code, unit }`.

## 4. Source-completeness and historical-integrity assessment

| Required field / rule | Canonical source | Assessment |
| --- | --- | --- |
| Business adjustment number | `code` | Available |
| Status | `status` (`DRAFT/SUBMITTED/APPROVED/REJECTED/POSTED/CANCELLED`) | Available |
| Document date | `documentDate` | Available |
| Reason | `reason` | Available |
| Company / branch / warehouse | `company.name`, `branch.name`, `warehouse { code, name }` | Available/readable |
| Readable warehouse location | `locationId` only, no relation | **`LOCATION = NOT_APPLICABLE`** — omitted, never replaced by the raw id |
| Linked movement business number | `movementId` only, no relation | **`MOVEMENT_REFERENCE = OMITTED_SOURCE_NOT_READABLE`** — raw id never printed |
| Item code / name / UOM | `product.code`, `product.name`, `product.unit` | Available |
| Direction | stored `adjustmentType` (`ADJUSTMENT_IN` / `ADJUSTMENT_OUT`) | Available; never derived from quantity sign |
| Quantity | positive `quantity` | Available; never negated or absolute-valued |
| Before quantity | none | **`BEFORE_QTY_HISTORICAL_INTEGRITY = NOT_APPLICABLE`** |
| After quantity | none | **`AFTER_QTY = OMITTED_NOT_STORED`** — never substituted from live `InventoryBalance` |
| Recorded unit cost / currency | nullable `unitCost`, `currencyCode` | Printed per line only when recorded; never computed or defaulted |
| Valuation reason | nullable `valuationReason` | Printed only when present |
| Line value / document total / valuation | none | **`COST_VALUE = OMITTED_NOT_COMPUTED`**; no cross-currency total |
| Workflow timestamps | `submittedAt`, `approvedAt`, `rejectedAt`, `postedAt`, `cancelledAt` | Available; printed only when stored |
| Workflow actor identities | ids only, no readable names | Omitted; printed-by is runtime print metadata, never an approval identity |
| Rejection reason | none | **`REJECTION_REASON = NOT_APPLICABLE`** |
| Source reference | none | **`SOURCE_REFERENCE = NOT_APPLICABLE`** |
| Lot / batch / serial | none | **`LOT_BATCH_SERIAL = NOT_APPLICABLE`** |
| Runtime print metadata | print runtime (`printedAt`, `timeZone`, printed-by, context) | From shared runtime only |

## 5. Canonical reuse (no API widening)

The canonical detail already carried every printable fact, so:

- `NEW_ENDPOINT = 0`.
- `API_MODIFICATION = 0` (no controller/service/DTO change).
- `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`.
- `PERMISSION_CHANGE = 0` (existing `inventory:stock-adjustment:read` reused; workflow permissions are **not** print permissions).
- Company/branch scope and `deletedAt` behaviour unchanged.

## 6. Read-only document workspace

Created `apps/web/src/app/admin/inventory/stock-adjustments/[id]/page.tsx`:

- Back / Refresh / Print only. No create, edit, submit, approve, reject, post, cancel or delete control.
- Initial load and print-time both call the canonical `GET /inventory/stock-adjustments/:id`.
- Print action: `permission: 'inventory:stock-adjustment:read'`, `readOnly: true`, `enabled: !!data && !printing`.
- Print re-reads the canonical detail instead of printing React state; `assertScope()` runs after the fresh read so a denied/failed read opens no document and shows the localized error.
- Reserved detail route ids (`new`, etc.) are rejected by `isReservedDetailRouteId`.
- POSTED/CANCELLED records render a localized read-only notice.

## 7. Adapter and printed content

`apps/web/src/components/print/inventory-stock-adjustment-document-print.ts` — `inventoryStockAdjustmentDocumentModel(data, t, locale)`, `mode: 'DOCUMENT'`, A4 portrait.

Printed: title (`inventoryCounting.stockAdjustment`), business `code` (refuses to prepare without it), localized status, document date, reason, `[code] name` warehouse, submitted/approved/rejected/posted/cancelled/created/updated timestamps, line section with row number, product code, product name, localized stored `adjustmentType`, positive quantity, source product unit, and conditional recorded `unitCost` / `currencyCode` / `valuationReason` / line notes columns. Summary is line count only. Notes contain the always-present limitation note plus the document notes. Runtime print date/time, timezone and printed-by come from the shared runtime.

Never printed: `id`, `stockAdjustmentId`, `companyId`, `branchId`, `warehouseId`, `locationId`, `productId`, `movementId`, `submittedById`, `approvedById`, `rejectedById`, `postedById`, `cancelledById`, `createdById`, `updatedById`, `lockVersion`, `requestId`, `_count`, permission arrays, live `InventoryBalance`, before/after quantity, readable location, movement business reference, line value, document total, cross-currency total, valuation, actor identities, application chrome and workflow buttons.

Column-conditional rules: unit cost/currency/valuation reason/line notes columns appear only when at least one line carries the value; `location` and `movement` columns never appear.

## 8. Focused tests (SA-P01…SA-P29 + supporting)

`apps/web/tests/inventory-stock-adjustment-document-print.test.ts` — **1 suite / 30 tests PASS**.

| Case | Coverage | Result |
| --- | --- | --- |
| SA-P01/P02 (AR/EN) | Business identity, localized title/scope, A4 portrait, company/branch, `[code] name` warehouse | PASS |
| SA-P03 | Refuses to prepare without the generated business `code` | PASS |
| SA-P04 | Every canonical status (`DRAFT/SUBMITTED/APPROVED/REJECTED/POSTED/CANCELLED`) localized, never invented | PASS |
| SA-P05 | Recorded document date/reason printed; empty reason omitted | PASS |
| SA-P06 | Warehouse by code + name only | PASS |
| SA-P07 | Product code, name and canonical source UOM per line | PASS |
| SA-P08 | Stored `adjustmentType` printed as localized direction, never derived | PASS |
| SA-P09 | Positive quantity kept for both directions; never negated or absolute-valued | PASS |
| SA-P10 | No before quantity; injected live balance `9999` never printed | PASS |
| SA-P11 | No after quantity stored, printed or derived | PASS |
| SA-P12 | `LOCATION = NOT_APPLICABLE`; location id never printed | PASS |
| SA-P13 | `MOVEMENT_REFERENCE = OMITTED_SOURCE_NOT_READABLE`; movement id/business number never printed | PASS |
| SA-P14 | Unit cost/currency printed only when recorded; unvalued OUT lines stay blank | PASS |
| SA-P15 | No line value, document total, cross-currency total or valuation | PASS |
| SA-P16 | Recorded valuation reason printed only when present, never invented | PASS |
| SA-P17 | Every internal id/FK/lock/request/`_count` redacted; no app chrome | PASS |
| SA-P18 | Workflow timestamps printed only when stored | PASS |
| SA-P19 | Absent workflow timestamps omitted completely | PASS |
| SA-P20 | Actor identities never printed, only timestamps | PASS |
| SA-P21 | `REJECTION_REASON = NOT_APPLICABLE` | PASS |
| SA-P22 | Localized empty state for a zero-line legacy adjustment | PASS |
| SA-P23 | 120-line multipage model keeps every line exactly once, unique row numbers/codes | PASS |
| SA-P24 | AR and EN printable HTML contains every model value | PASS |
| SA-P25 | Page re-reads canonical detail at print time and prints the shared document | PASS |
| SA-P26 | Denied print-time read opens no document and shows the localized error | PASS |
| SA-P27 | Runtime print timestamp, not document date or page load | PASS |
| SA-P28 | No controls, permission strings or chrome in the document | PASS |
| SA-P29 | Read-only page performs no stock adjustment mutation or movement work | PASS |
| Related regression | Legacy `InventoryAdjustment` document still prints and does not pick up Stock Adjustment contracts | PASS |

Unsupported cases were marked `NOT_APPLICABLE` (SA-P12 location, SA-P21 rejection reason) rather than faked.

Related print regression: **12 suites / 163 tests PASS** (all inventory print suites + unified print runtime suites).

## 9. PDF structural proof

Six PDFs rendered through the real adapter, real `PrintDocument` and real shared `printDocumentCss` (`docs/print/proofs/inventory-stock-adjustment-document-*`), then inspected with PyMuPDF.

| Document | Pages |
| --- | --- |
| `actual-en` | 2 |
| `actual-ar` | 1 |
| `empty-en` | 1 |
| `empty-ar` | 1 |
| `multipage-en` | 7 |
| `multipage-ar` | 6 |

All six PASS: A4 portrait (595.28 × 841.89 pt), text inside printable bounds, no blank page, no word collision, no app chrome, no technical ids/CUIDs, business number + company/branch present, warehouse `[code] name`, positive quantities with the stored direction, recorded unit cost only on valued lines, no computed value/total/valuation, no movement reference, per-line UOM, exactly-once product codes, repeated table header on multipage pages, localized empty state, no `NaN` / `Invalid Date` / raw keys / `undefined`.

The engineless inspection used word-level rectangles because block bounding boxes merge a whole table row and produce false overlap positives.

Manifest: `.tmp/unified-print/inventory-stock-adjustment-document-render-manifest.json`. Results: `.tmp/unified-print/inventory-stock-adjustment-document-pdf-inspection.json`.

## 10. Validation gates

- Focused suite: 1 suite / 30 tests PASS.
- Related Web print suites: 12 suites / 163 tests PASS.
- Full Web regression: 121 suites / 2282 tests PASS.
- Full API regression: 217 suites / 4716 tests PASS.
- Web typecheck: PASS.
- API typecheck: PASS.
- Web production build: PASS — 194/194 pages including `/admin/inventory/stock-adjustments/[id]`.
- i18n check: PASS — 7065 EN / 7065 AR keys synchronized, 22 namespace files registered per locale, no empty values, 11,206 literal `t()` keys resolve.
- UI baseline + permission UI: PASS (`check-ui-baseline.mjs`, `check-i18n.mjs`, `check-raw-keys.mjs`, `verify-permission-ui.mjs`).
- Route contract: PASS — `BACKENDROUTES=1185`, `MATCHED=1166`, `MISMATCHES=0`, `UNRESOLVED=0` (no new endpoint).
- Credentials check: PASS.
- `git diff --check`: clean.
- U+FFFD scan of changed/new files: 0.
- Native browser preview / Save-as-PDF / cancellation / physical paper: **NOT_VERIFIED**.

## 11. Zero-mutation sentinels

`DATABASE_WRITE = 0`, `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`, `NEW_ENDPOINT = 0`, `API_BUSINESS_MUTATION = 0`, `PERMISSION_CHANGE = 0`, `DTO_MUTATION_CHANGE = 0`, `INVENTORY_QUANTITY_DELTA = 0`, `STOCK_ADJUSTMENT_STATUS_DELTA = 0`, `STOCK_ADJUSTMENT_LINE_DELTA = 0`, `MOVEMENT_CREATED = 0`, `LEGACY_ADJUSTMENT_DELTA = 0`, `COUNT_DELTA = 0`, `MAINTENANCE_STATUS_CHANGE = 0`, `PRODUCTION_DELTA = 0`.

All fixtures are in-memory; the render proof makes no API call and performs no Prisma operation.

## 12. Tenant isolation

- The workspace uses only the canonical `GET /inventory/stock-adjustments/:id`, never a naked-ID read; company scope is always enforced and branch scope when present; soft-deleted records are unavailable.
- The print-time re-read uses the same endpoint and the same `inventory:stock-adjustment:read`, so cross-company/cross-branch or denied reads abort before any document opens.
- No list state, React state or client-provided company/branch header is trusted for the printed record.

## 13. Pre-existing issues observed (out of scope, not fixed)

- `PRE_EXISTING_OUT_OF_SCOPE` — unrelated dirty worktree files from prior employee, mobile, production and print tasks remain; they were not edited or reverted.
- The Stock Adjustment list page previously exposed no detail navigation for this workspace; the added `view` action only routes to the new read-only detail page and does not change create/edit/workflow behaviour.

## 14. Git state

- Branch: `main`; HEAD: `54e3706f`.
- Worktree dirty before and after this phase (unrelated prior work preserved); no changes were staged.
- No `git add`, commit, push, merge, rebase, reset, clean, branch or tag was performed.

## 15. Files

Created:

- `apps/web/src/components/print/inventory-stock-adjustment-document-print.ts`
- `apps/web/src/app/admin/inventory/stock-adjustments/[id]/page.tsx`
- `apps/web/tests/inventory-stock-adjustment-document-print.test.ts`
- `.tmp/unified-print/stock-adjustment-document-proof.cjs`
- `.tmp/unified-print/inspect-stock-adjustment-document-pdfs.py`
- `docs/print/proofs/inventory-stock-adjustment-document-{actual,empty,multipage}-{ar,en}.pdf` (+ PNG/text extracts)
- this proof document

Modified:

- `apps/web/src/app/admin/inventory/stock-adjustments/page.tsx` — added the `view` grid action (route only).
- `apps/web/src/lib/admin-types/inventory.ts` — added `InventoryStockAdjustment`, `InventoryStockAdjustmentLine`, `InventoryStockAdjustmentStatus` types.
- `apps/web/src/lib/i18n/locales/en/reports.ts` / `ar/reports.ts` — `stockAdjustmentDocumentScope` / `stockAdjustmentDocumentNote`.
- `apps/web/src/lib/i18n/locales/en/inventory.ts` / `ar/inventory.ts` — `submittedAt`, `approvedAt`, `rejectedAt`.
- `apps/web/src/lib/i18n/locales/en/inventory-valuation.ts` / `ar/inventory-valuation.ts` — `valuationReason`.
- `docs/print/ATsoftERP-print-page-matrix.md`, `ATsoftERP-print-audit.md`, `ATsoftERP-print-column-rules.md`, `ATsoftERP-print-rollout.md`, `ATsoftERP-print-standard.md`, `ATsoftERP-print-validation.md`, `ATsoftERP-operational-print-justification.md` — only the Stock Adjustment rows/sections.
