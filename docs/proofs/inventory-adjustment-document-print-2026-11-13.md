# Inventory Adjustment DOCUMENT print — 2026-11-13

Status: **INVENTORY_ADJUSTMENT_AUTOMATED_COMPLETE_NATIVE_NOT_VERIFIED** (automated model gate PASS; PDF structural gate PASS; native preview / Save-as-PDF / cancellation / physical paper NOT_VERIFIED)

Scope history:

- Phase 4 audited Inventory Adjustment print and returned `INVENTORY_ADJUSTMENT_SOURCE_INCOMPLETE` because the canonical detail read omitted line UOM.
- Phase 5 enriched the existing canonical read contract only. No print document, adapter, page wiring, translation key, print test, PDF or screenshot was created. The shared print engine, accepted report rollout, Maintenance batch and the closed Opening Balance, Movement and Count documents were not rebuilt or re-audited. No Stock Adjustment, Ledger, Reconciliation, Balances register, Physical Count or Production Material Document work was started. No database write, schema change, migration, new endpoint or permission change was made.
- Phase 4B (this record) implemented the Inventory Adjustment `DOCUMENT` on the existing shared print engine, reusing the already enriched canonical read. No API, DTO, endpoint, schema, migration or permission change; no adjustment, count, movement or balance write. Stock Adjustment, Ledger, Reconciliation, Balances register, Physical Count and Production Material Document remain untouched. Sections 1–13 are the preserved Phase 4/5 record; sections 14–20 record Phase 4B.

## 1. Final decision (Phase 4/5 record)

- Business artifact: Inventory Adjustment document (`DOCUMENT`), not implemented at the time of Phase 5.
- Source decision: **`INVENTORY_ADJUSTMENT_READ_CONTRACT_ENRICHED`**.
- Document gate: **`NOT_STARTED`** (at the time of Phase 5; superseded by Phase 4B in sections 14–20).
- The canonical `GET /inventory/adjustments/:id` now returns per-line `product.unit` and a readable `warehouseLocation { id, code, name }`, which removes the blocking UOM/source gap for a future document phase. The document itself still required separate owner authorization, which Phase 4B received.

## 2. Adjustment-family audit

| Family / surface | Route / contract | Model / permission | Decision |
| --- | --- | --- | --- |
| Legacy Inventory Adjustment | `/admin/inventory/adjustments`, `[id]` (`inv-adjustments` navigation, linked from counts, reports, dashboard, barcode and search) | `InventoryAdjustment` / `InventoryAdjustmentLine`, `inventory-adjustment:*` (`create/read/update/post/cancel`) | **Selected canonical family**; read contract enriched (Phase 4/5 record; DOCUMENT implemented in Phase 4B — see section 14) |
| Stock Adjustment | `/admin/inventory/stock-adjustments` (`inv-stock-adjustments`, `inventory:stock-adjustment:read`) | `InventoryStockAdjustment` / `InventoryStockAdjustmentLine` with submit/approve/reject/post workflow, `adjustmentType` IN/OUT, `quantity`, `unit`, `unitCost`/`currencyCode`, `movementId`, valuation integration | **Separate family; deferred**. Not the same canonical transaction as legacy Inventory Adjustment; not printed and not marked complete |
| InventoryPhysicalCount adjustment generation | `/admin/inventory/physical-counts` and `[id]` | `InventoryPhysicalCount` posts `COUNT_VARIANCE_IN/OUT` movements; separate workflow | **Separate workflow; out of scope** |
| InventoryCount adjustment generation | `/admin/inventory/counts` (`generate-adjustment`) creates `InventoryAdjustment` from count differences | Uses the selected legacy family at creation time | Generation workflow audited; the document under review remains the legacy `InventoryAdjustment` detail, not the count document |
| Adjustment reports | `/admin/reports/inventory/adjustments`, dashboard/summary endpoints | Aggregate/header-only report and summary reads | **Not a document source**; reports remain closed/accepted as reports |

## 3. Canonical source audit (selected family)

- Canonical detail endpoint: `GET /inventory/adjustments/:id` (`apps/api/src/modules/factory/inventory-adjustments/inventory-adjustments.controller.ts`, `@Permissions('inventory-adjustment:read')`, `@Get(':id')`). Unchanged by this phase.
- Service: `InventoryAdjustmentsService.findOne` (`apps/api/src/modules/factory/inventory-adjustments/inventory-adjustments.service.ts`).
- Read scope: `where: { id }` followed by a soft-delete check and `assertRowInContext(adjustment, ctx, 'inventory adjustment')` (`apps/api/src/common/operational-context/tenant-guards.ts`). Company scope is always enforced; branch scope is enforced when the record carries a branch. Not a naked-ID fetch.
- Related detail routes: no separate lines endpoint; `GET /inventory/adjustments/:id/summary` is aggregate-only. `GET /reports/inventory/adjustments` is header-only and not a document source.
- Warehouse assertion: `assertWarehouseInContext` remains enforced on create/post flows; warehouse membership is not separately re-asserted in `findOne` beyond the row's company/branch context.

### Fields returned by the canonical read (after enrichment)

Header: `id`, `adjustmentNumber`, `companyId`, `branchId`, `warehouseId`, `inventoryCountId`, `status` (`DRAFT|POSTED|CANCELLED`), `reason`, `adjustmentDate`, `postedAt`, `cancelledAt`, `notes`, `createdById`, `postedById`, `cancelledById`, `createdAt`, `updatedAt`, `deletedAt`, plus included relations `company`, `branch`, `warehouse`, `inventoryCount`, `lines`.

Lines (`InventoryAdjustmentLine`): `id`, `adjustmentId`, `productId`, `warehouseLocationId`, `systemQty`, `countedQty`, `differenceQty`, `notes`, `createdAt`, `updatedAt`, plus:

- `product: { id, name, code, unit }` — `unit` added by this phase.
- `warehouseLocation: { id, code, name } | null` — added by this phase.

## 4. Source-completeness and historical-integrity assessment

| Required field / rule | Canonical source | Assessment |
| --- | --- | --- |
| Business adjustment number | `adjustmentNumber` | Available |
| Status | `status` (`DRAFT/POSTED/CANCELLED`) | Available |
| Adjustment type / method | none | No type/method field exists. `NOT_APPLICABLE` by source; must not be invented |
| Reason | `reason` | Available |
| Adjustment date | `adjustmentDate` | Available |
| Company / branch / warehouse | `company`, `branch`, `warehouse` (+ active context) | Available/readable names available from relations |
| Readable warehouse location | `warehouseLocation.code`, `warehouseLocation.name` | **Available** via the existing relation added to the read |
| Linked count reference | `inventoryCount.countNumber` (optional relation) | Available when present; printable as reference only |
| Linked movement reference | none | Legacy posting creates no `InventoryMovement`; `NOT_APPLICABLE` |
| Item code / name | `product.code`, `product.name` | Available |
| Quantity + UOM per line | `systemQty`, `countedQty`, `differenceQty`, `product.unit` | **Available**; UOM now returned by the canonical read |
| Authorized before / adjustment / after | `systemQty` (stored snapshot from count or authorized override), `countedQty`, `differenceQty = countedQty - systemQty`; posting applies `differenceQty` to the balance | Before and adjustment are stored historical facts. After-quantity is not stored and must never be substituted from current `InventoryBalance`; a future document must omit it unless a canonical stored fact is added |
| Sign / direction semantics | `differenceQty` keeps domain sign (`countedQty - systemQty`) | Available as recorded value; must never be recalculated from current stock or absolute-valued |
| Cost / value / currency / lot / batch / serial | none on legacy `InventoryAdjustmentLine` | `NOT_APPLICABLE` by source; must not be printed or inferred |
| Readable user identities | `createdById`, `postedById`, `cancelledById` only | No readable names; a document must omit them rather than print raw ids |
| Runtime print metadata | print runtime (`printedAt`, `timeZone`, printed-by, context) | Available from shared runtime only; never from record dates |

## 5. Original blocking evidence (resolved in this phase)

The Phase 4 audit recorded that `InventoryAdjustmentLine` had no UOM snapshot and that `findOne` selected only `product { id, name, code }`. Printing unitless quantities would have violated the quantity/UOM safety rule and the release gate `QUANTITY_UOM = PASS`.

That gap is resolved by the additive read-contract enrichment below. No schema change was needed because `Product.unit` and the `InventoryAdjustmentLine.warehouseLocation` relation already existed (`apps/api/prisma/schema.prisma`).

## 6. Read-contract enrichment implemented

`InventoryAdjustmentsService.findOne` line include now reads:

```ts
lines: {
  include: {
    product: { select: { id: true, name: true, code: true, unit: true } },
    warehouseLocation: { select: { id: true, code: true, name: true } },
  },
},
```

Constraints preserved:

- Same endpoint `GET /inventory/adjustments/:id`; no print/details/export route.
- Same permission `inventory-adjustment:read`; no print/document permission.
- Same `assertRowInContext` company/branch enforcement and soft-delete behaviour.
- Same single Prisma query with relation selection; no N+1 and no per-line lookups.
- Additive only: no existing field removed or renamed.
- Quantity fields, difference sign and count reference untouched.
- No schema edit, no migration, no DTO/mutation change, no inventory write.

## 7. Read-contract tests

Added to `inventory-adjustments.service.spec.ts` (service-level, exercising the real `findOne` and its Prisma selection) and `inventory-adjustments.permissions.spec.ts`:

| Case | Coverage | Result |
| --- | --- | --- |
| IAR-P01 | Authorized read returns `product.unit`; Prisma select must contain `unit: true` | PASS |
| IAR-P02 | Product code/name preserved | PASS |
| IAR-P03/P04/P05 | `systemQty`, `countedQty`, `differenceQty` unchanged | PASS |
| IAR-P06 | `inventoryCount.countNumber` unchanged | PASS |
| IAR-P07 | Cross-company record denied | PASS |
| IAR-P08 | Cross-branch record denied | PASS |
| IAR-P09 | Soft-deleted record unavailable | PASS |
| IAR-P10 | `inventory-adjustment:read` still required; no print/document permission | PASS |
| IAR-P11 | Readable location `code`/`name` returned; Prisma select asserted | PASS |
| IAR-P12 | Missing location stays null safely | PASS |
| Write guard | `findOne` performs no create/update/delete/balance/audit write | PASS |

Contract proof (sanitized): `product: { id, name, code, unit: "pc" }`, `warehouseLocation: { id, code: "L1", name: "Aisle 1" }`, `systemQty: 10`, `countedQty: 8`, `differenceQty: -2`, `inventoryCount.countNumber: "IC-0001"`.

## 8. Validation gates

- Focused suite: 2 suites / 20 tests PASS.
- Full API regression: 217 suites / 4716 tests PASS (fresh run in this phase).
- API typecheck: PASS (`tsc --noEmit`).
- Web typecheck: PASS. The frontend type already declared `product.unit` and `warehouseLocation`, so no Web source change was required.
- `git diff --check`: clean.
- No Web production build was run (no Web source change).
- No i18n, raw-key or UI-baseline change was required (no user-facing text or UI change).

## 9. Zero-write sentinels

`DATABASE_WRITE = 0`, `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`, `NEW_ENDPOINT = 0`, `PERMISSION_CHANGE = 0`, `DTO_MUTATION_CHANGE = 0`, `API_BUSINESS_MUTATION = 0`, `CREATE_BEHAVIOR_DELTA = 0`, `UPDATE_BEHAVIOR_DELTA = 0`, `POST_BEHAVIOR_DELTA = 0`, `CANCEL_BEHAVIOR_DELTA = 0`, `INVENTORY_QUANTITY_DELTA = 0`, `ADJUSTMENT_STATUS_DELTA = 0`, `ADJUSTMENT_LINE_DELTA = 0`, `MOVEMENT_CREATED = 0`, `COUNT_DELTA = 0`, `STOCK_ADJUSTMENT_DELTA = 0`, `PRODUCTION_DELTA = 0`, `BUSINESS_WRITE_DURING_TEST = 0`.

## 10. Pre-existing defects observed (out of scope, not fixed)

- `/admin/inventory/adjustments` list create payload sends `adjustmentDate` (not in `CreateInventoryAdjustmentDto`) and omits required `systemQty` per line (`apps/web/src/app/admin/inventory/adjustments/page.tsx`); the global `ValidationPipe` uses `forbidNonWhitelisted: true` (`apps/api/src/main.ts`), so direct UI creation would be rejected. Count-generated adjustments remain the working path. Recorded as `PRE_EXISTING_OUT_OF_SCOPE`.
- `apps/web/src/lib/admin-types/inventory.ts` was already dirty before this phase with unrelated Opening Balance fields; it was not edited.

## 11. Document gate (Phase 4/5 record)

At the end of Phase 5 the document gate was `NOT_STARTED`: no `inventory-adjustment-document-print.ts`, Print action, PDF, DOCUMENT adapter, print translation, print test or proof existed.

The required contract for a separately authorized document was: canonical print-time re-read of `GET /inventory/adjustments/:id` with `inventory-adjustment:read`, abort on denial/failure, no list/React state, A4 portrait, AR/EN with RTL/LTR, stored `systemQty` snapshot, recorded `differenceQty` sign, per-line `product.unit`, readable location, no after-quantity substitution from current balance, no cost/valuation, no raw ids, no mixed-UOM total, exactly-once multipage lines, runtime print date/time and printed-by. Phase 4B (sections 14–20) implemented exactly this contract.

## 12. Git state (Phase 4/5 record)

- Branch: `main`; HEAD: `54e3706f`.
- Worktree dirty before and after (114 entries: 61 modified, 53 untracked before this phase; unrelated employee/mobile/production/print work preserved).
- No `git add`, commit, push, merge, rebase, reset, clean, branch or tag was performed.

## 13. Next authorized phase (Phase 4/5 record)

`NONE`. At that time the read contract was enriched and proven; the Inventory Adjustment DOCUMENT required new explicit owner authorization before any print implementation began.

## 14. Phase 4B — DOCUMENT implementation

Business artifact: Inventory Adjustment `DOCUMENT` on the shared print engine. Source: the already enriched canonical `GET /inventory/adjustments/:id`.

Created:

- `apps/web/src/components/print/inventory-adjustment-document-print.ts` — `inventoryAdjustmentDocumentModel(data, t, locale)`, `mode: 'DOCUMENT'`, A4 portrait, historical snapshot rendering, conditional location and line-note columns.
- `apps/web/tests/inventory-adjustment-document-print.test.ts` — IAD focused suite plus page canonical re-read / denied-read / timestamp coverage.
- `.tmp/unified-print/adjustment-document-proof.cjs` and `.tmp/unified-print/inspect-adjustment-document-pdfs.py` — fixture renderer and structural PDF inspector (in-memory fixtures, zero DB writes, zero API calls).
- `docs/print/proofs/inventory-adjustment-document-{actual,empty,multipage}-{ar,en}.pdf` — six rendered PDFs plus PNG/text extracts.

Modified:

- `apps/web/src/app/admin/inventory/adjustments/[id]/page.tsx` — Print action registered with `inventory-adjustment:read`, `enabled: !!data && !printing`, `ActionPrintIcon`, and a print-time `api.get<InventoryAdjustment>('/inventory/adjustments/${id}')` re-read through `usePrintDocument().print(scopeKey, async assertScope => …)`; the fresh record (not list/React state) is passed to the adapter and scope is asserted before printing.
- `apps/web/src/lib/i18n/locales/en/reports.ts` and `.../ar/reports.ts` — `reports.printDocument.adjustmentDocumentScope` and `...adjustmentDocumentNote`, synchronized AR/EN.

Printed: title, `adjustmentNumber`, localized status, reason, `adjustmentDate`, `postedAt`, `cancelledAt`, created/updated timestamps, company, branch, warehouse `[code] name`, readable line location `[code] name`, `inventoryCount.countNumber`, product code/name, `product.unit`, `systemQty`, `countedQty`, `differenceQty` with stored sign, line notes (conditional), document notes, runtime print date/time and printed-by.

Never printed: after quantity, current `InventoryBalance`, movement reference, cost/value/currency, lot/batch/serial, raw user ids, raw DB ids/FKs, `lockVersion`, `requestId`, `_count`, app chrome. The adapter never reads a live balance and never recomputes `differenceQty`; no `AFTER_QTY` is derived from `systemQty + differenceQty`.

Source-absent decisions: `ADJUSTMENT_TYPE = NOT_APPLICABLE`, `MOVEMENT_REFERENCE = NOT_APPLICABLE`, `COST_VALUE = NOT_APPLICABLE`, `LOT_BATCH_SERIAL = NOT_APPLICABLE`.

Aggregation safety: no mixed-UOM quantity total and no difference grand total; safe summary is line count only.

## 15. Phase 4B focused tests (IAD)

`apps/web/tests/inventory-adjustment-document-print.test.ts` — **1 suite / 18 tests PASS**.

| Case group | Coverage |
| --- | --- |
| IAD-P01/P02/P04/P05/P06/P07/P08 | AR and EN render: business number, localized title/scope, company/branch, metadata (date, warehouse label, reason, count, posted/created/updated), section title, column set, warehouse `[code] name`, readable location, product code/name, per-line UOM, line and document notes |
| IAD-P03 | Refuses to print without the generated `adjustmentNumber` |
| IAD-P04 | Canonical status printed as a localized field (`DRAFT/POSTED/CANCELLED`) |
| IAD-P06 | Location column present only when a readable location exists; omitted otherwise; location id never printed |
| IAD-P09/P10/P11 | Historical fixture `systemQty 100 / countedQty 92 / differenceQty -8` prints stored values and `-8` sign; injected live balance/current/after `9999` never appears; no `afterQty`/`currentBalance` column; nothing recomputed |
| IAD-P12/P13 | Count reference by number only; no movement reference; cost/value/currency fields excluded from columns and output |
| IAD-P14/P16 | Line-count-only summary; mixed KG/PCS quantities never summed; no `1,200,000` total |
| IAD-P15 | All fixture ids, technical keys, cost, lot and serial redacted; no app chrome |
| IAD-P17 | Localized empty state for a legacy zero-line adjustment; blank optional metadata; 0 line count; no `undefined`/`null` text |
| IAD-P18 | 120-line multipage model keeps every line exactly once with unique line numbers and product codes |
| IAD-P20 | Arabic and English printable HTML contains every model value (PDF/text parity) |
| Line-note rule | `lineNotes` column omitted when no line has notes |
| Stock Adjustment guard | No Stock Adjustment contract/route reference in the document |
| IAD-P19 | Page re-reads `GET /inventory/adjustments/:id` at print time (2 calls total), opens the shared document, uses fresh data, company/branch/printed-by from runtime |
| IAD-P20 (page) | Print-time read denial opens no document and shows the localized error |
| IAD-P21 | Runtime print timestamp (not adjustment date or page load); printed-by and timezone present |
| Chrome guard | Rendered body contains no `button`/`input`/`select`/`nav` and no permission keys |

Related Web print regression: **5 suites / 76 tests PASS** (`inventory-adjustment-document-print`, `inventory-adjustments-print`, `inventory-opening-balance-document-print`, `inventory-movement-document-print`, `inventory-count-document-print`).

## 16. Phase 4B PDF structural proof

Six PDFs rendered through the real adapter, real `PrintDocument` component and real shared `printDocumentCss` (`docs/print/proofs/inventory-adjustment-document-*`), then inspected with PyMuPDF. All six PASS:

| Document | Pages | Notes |
| --- | --- | --- |
| `actual-en` | 2 | Real-like data, historical snapshot, mixed UOM |
| `actual-ar` | 1 | RTL Arabic, same fixture |
| `empty-en` | 1 | Localized empty state, single line |
| `empty-ar` | 1 | RTL empty state |
| `multipage-en` | 8 | 120 lines, repeated header |
| `multipage-ar` | 8 | 120 lines, repeated header |

Per-document structural checks: A4 portrait (595.28 × 841.89 pt), text inside printable bounds, no blank page, no app chrome, no technical ids/CUIDs, no cost/value/currency/lot/serial, no live `9999` balance, business number and company/branch present, warehouse `[code] name`, count reference by number, no movement reference, per-line UOM preserved, historical `100 / 92 / -8` and positive differences, exactly-once product codes, repeated table header on every multipage page, localized empty state, no `NaN`/`Invalid Date`/raw keys/`undefined`. Manifest: `.tmp/unified-print/inventory-adjustment-document-render-manifest.json`; results: `.tmp/unified-print/inventory-adjustment-document-pdf-inspection.json`.

## 17. Phase 4B validation gates

- Web focused suite: 1 suite / 18 tests PASS.
- Related Web print suites: 5 suites / 76 tests PASS.
- Relevant API adjustment regression: 2 suites / 20 tests PASS.
- Full Web regression: 120 suites / 2252 tests PASS.
- Full API regression: 217 suites / 4716 tests PASS.
- Web typecheck: PASS.
- API typecheck: PASS.
- Web production build: PASS.
- i18n check: PASS — 7059 EN / 7059 AR keys synchronized, all namespaces registered, 11,149 literal keys resolve.
- UI baseline check: PASS (`check-ui-baseline.mjs`, `check-i18n.mjs`, `check-raw-keys.mjs`, `verify-permission-ui.mjs`).
- Route contract: PASS — `BACKENDROUTES=1185`, `MATCHED=1164`, `MISMATCHES=0` (no new endpoint).
- Credentials check: PASS.
- `git diff --check`: clean.
- U+FFFD scan of changed/new files: 0.
- Native browser preview / Save-as-PDF / cancellation / physical paper: **NOT_VERIFIED** (no desktop native print surface available in this environment).

## 18. Phase 4B zero-mutation sentinels

`DATABASE_WRITE = 0`, `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`, `NEW_ENDPOINT = 0`, `API_BUSINESS_MUTATION = 0`, `PERMISSION_CHANGE = 0`, `DTO_MUTATION_CHANGE = 0`, `INVENTORY_QUANTITY_DELTA = 0`, `ADJUSTMENT_STATUS_DELTA = 0`, `ADJUSTMENT_LINE_DELTA = 0`, `MOVEMENT_CREATED = 0`, `COUNT_DELTA = 0`, `STOCK_ADJUSTMENT_DELTA = 0`, `MAINTENANCE_STATUS_CHANGE = 0`, `PRODUCTION_DELTA = 0`.

All fixtures are in-memory; the proof script makes no API call and performs no Prisma operation.

## 19. Phase 4B pre-existing defects (out of scope, not fixed)

- `PRE_EXISTING_OUT_OF_SCOPE` — the `/admin/inventory/adjustments` create form sends `adjustmentDate` (not in `CreateInventoryAdjustmentDto`) and omits required `systemQty` per line; with `forbidNonWhitelisted: true` a direct UI create would return 400. Count-generated adjustments remain the working path. Not fixed in this print-only phase.
- `apps/web/src/lib/admin-types/inventory.ts` and other unrelated files remain dirty from prior work and were not edited by Phase 4B.

## 20. Phase 4B final decision

- Automated model gate: **PASS**.
- PDF structural gate: **PASS**.
- Native preview / Save-as-PDF / cancellation / physical paper: **NOT_VERIFIED** (tracked separately).
- Decision: **`INVENTORY_ADJUSTMENT_AUTOMATED_COMPLETE_NATIVE_NOT_VERIFIED`**.
- Stock Adjustment, Ledger, Reconciliation, Balances register, Physical Count and Production Material Document remain not implemented/complete.
- Next authorized phase: **`NONE`**.
- No `git add`, commit, push, merge, rebase, reset, clean, branch or tag was performed.
