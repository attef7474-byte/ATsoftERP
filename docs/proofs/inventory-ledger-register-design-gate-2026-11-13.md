# Inventory Ledger register de-duplication and implementation design gate — 2026-11-13

Design/audit proof only. No print surface, adapter, PDF, test, route, translation key, endpoint, schema, permission or inventory data was created or changed.

## 1. Result

| Item | Value |
| --- | --- |
| Classification (unchanged) | `REGISTER` |
| Design decision | `INVENTORY_LEDGER_DESIGN_EXTEND_EXISTING_MOVEMENTS_REGISTER_WITH_LEDGER_FILTERS` |
| Design status | `DESIGN_APPROVED` |
| Implementation status | `BLOCKED_PENDING_DEPENDENCIES` |
| `IMPLEMENTATION_AUTHORIZED` | `NO` |
| `ROW_BUSINESS_ENTITY_DUPLICATION` | `YES` |
| `REGISTER_PRINT_SCOPE` | `ALL_FILTERED_ROWS` |
| `COLLECTOR_REUSE` | `YES` |
| `DETERMINISTIC_COLLECTION` | `BLOCKED` |
| `MIXED_UOM_HEADER_TOTAL` | `FORBIDDEN` |
| `RUNNING_BALANCE` | `OUT_OF_SCOPE` |

Zero-change sentinels: `DATABASE_WRITE = 0`, `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`, `API_MODIFICATION = 0`, `NEW_ENDPOINT = 0`, `PERMISSION_CHANGE = 0`, `INVENTORY_BUSINESS_WRITE = 0`.

## 2. Method and evidence

Actual source was inspected, not prior prose:

- `apps/web/src/app/admin/inventory/ledger/page.tsx`
- `apps/web/src/app/admin/reports/inventory/movements/page.tsx`
- `apps/web/src/components/print/inventory-movements-print.ts`
- `apps/web/src/components/print/use-report-print-snapshot.ts`
- `apps/web/src/components/print/use-print-document.ts`
- `apps/web/src/lib/print.ts`
- `apps/web/src/lib/i18n/literals.ts`
- `apps/web/src/components/f9/lookup-adapters.ts`
- `apps/web/tests/inventory-movements-print.test.ts`
- `apps/api/src/modules/factory/inventory-ledger-reconciliation/inventory-ledger-reconciliation.controller.ts`
- `apps/api/src/modules/factory/inventory-ledger-reconciliation/inventory-ledger-reconciliation.service.ts`
- `apps/api/src/modules/reports/reports.controller.ts`
- `apps/api/src/modules/reports/services/inventory-reports.service.ts`
- `apps/api/src/modules/reports/services/report-query-utils.ts`
- `apps/api/src/modules/reports/dto/report-filter.dto.ts`
- `apps/api/prisma/schema.prisma` (`InventoryMovement`, `InventoryMovementLine`, `InventoryBalance`)

## 3. Existing Movements Register contract

| Contract item | Actual behaviour |
| --- | --- |
| Route | `/admin/reports/inventory/movements` |
| Title | `reports.movementsReport` |
| Endpoint | `GET /reports/inventory/movements` |
| Permission | `reports.inventory:read` (`reports.controller.ts`) |
| Adapter | `inventory-movements-print.ts`, mode `REGISTER` |
| Row unit | One `InventoryMovement` header per row; the endpoint includes only `warehouse { id, code, name }` and no lines |
| Columns | `movementNumber`, `movementDate`, `movementType`, `warehouse`, `status`, `notes` (six; widths 19/17/18/21/15/25) |
| Summary | Total movements only (`data.total`) |
| Notes | Movement headers only; mixed units are not summed; the ignored legacy status filter is disclosed when `countStatus` is present |
| Orientation / paper | A4 portrait, `scopeLabel` = all filtered results (maximum 500 rows) |
| Period | `periodStart`/`periodEnd` from `dateFrom`/`dateTo` |
| API filters | `warehouseId`, `productId`, `movementType`, `direction`, `sourceType`, `status`, `search` (movement number only), `dateFrom`/`dateTo` |
| Screen filters | Warehouse F9, status dropdown bound to `countStatus`, `dateFrom`, `dateTo` |
| Ignored screen filter | `countStatus` is accepted by the DTO but the report service never applies it; the print model marks it NOT APPLIED and adds the status limitation note (test asserts this) |
| Collection | `collectPrintRows` via `useReportPrintSnapshot`; page size `PRINT_PAGE_SIZE = 100`; identity `row.id`; abort when the operational scope changes |
| Safe row limit | `PRINT_ROW_LIMIT = 500`; `total > 500` throws `limitExceeded` |
| Sorting | `movementDate desc` only |
| Response shape | `{ cards, rows, total, page, pageSize, totalPages }` |
| AR/EN | Locale-aware labels, `translateMovementType`, `translateEnum`, LTR-isolated dates and numbers |
| Redaction | No ids printed; the focused test asserts `sourceId`/`createdById` are never rendered |
| Print-time requirements | Readable warehouse label is mandatory; the model throws `unavailable` when the F9 label is absent (no raw `warehouseId` printing) |
| Evidence | `apps/web/tests/inventory-movements-print.test.ts` (model columns/summary/notes/redaction, page collector, denied later page, snapshot invalidation) |

## 4. Ledger contract

| Contract item | Actual behaviour |
| --- | --- |
| Route | `/admin/inventory/ledger`, navigation id `inv-ledger`, title `inventoryLedger.title` |
| Endpoint | `GET /inventory/ledger/movements` |
| Permission | `inventory-ledger:read` |
| Controller input | `@Query() query: any` — no DTO whitelist or validation |
| Row unit | One `InventoryMovement` header per row |
| Row payload | `warehouse { id, code, name }`, `company { id, name }`, `lines[]` with full line fields and `product { id, code, name, unit }` |
| API filters | `search` (movement number **or notes**), `warehouseId`, `movementType`, `status`, `sourceType`, `sourceId`, `productId` (line `some`), `direction` (line `some`), `locationId` (validated, resolves warehouse), `dateFrom`/`dateTo` |
| Ignored query fields | `companyId`, `branchId` are accepted in the query type but never used; scope always comes from `ActiveOperationalContext` |
| Screen filters | None. The page sends only `page` and `limit` |
| Paging | `page` default 1, `limit` default 20, hard cap `Math.min(limit, 100)`; returns `meta { page, limit, total, totalPages }` |
| Sorting | `movementDate desc` only |
| Response shape | `{ data, meta }` — differs from the register `PrintPage` shape |
| Balance fields | None. No opening, running or closing balance; `InventoryBalance` is used only by reconciliation |
| Valuation | Line-level nullable `unitCost`, `totalCost`, `currencyCode`, `valuationMethod` are returned but not displayed or aggregated; no header currency |
| Other reads | `/ledger/movements/:id`, `/by-product`, `/by-warehouse`, `/by-location/:locationId`, `/by-source`; `by-location` and `by-source` are unpaginated |
| Screen defect | The "Quantity" column sums `lines[].quantity` across products/UOMs — mathematically invalid, must not be reproduced |
| Tenant scope | company always, branch `null OR ctx.branchId`, warehouse company + branch + not deleted, location re-validated in context |
| Print | No print action, no adapter, no PDF |

## 5. Business row identity

`ROW_BUSINESS_ENTITY_DUPLICATION = YES`.

Both surfaces read the same `InventoryMovement` table and both identify a row by `movementNumber`. The ledger adds includes (`lines`, `company`) and filter depth; neither creates a new business entity. Ledger payload depth is not a different business row.

## 6. Business purpose comparison

| Dimension | Movements Register | Inventory Ledger |
| --- | --- | --- |
| Primary purpose | Official chronological register of inventory movement documents | Same transaction history, reachable from the inventory monitoring workspace |
| Primary user | Inventory controller, internal audit | Warehouse staff, inventory controller, internal audit |
| Scope | All filtered movements | All filtered movements |
| Row identity | `movementNumber` | `movementNumber` |
| Official use | Period movement listing | Same listing with product/direction/location/source search depth |
| Audit use | Movement evidence | Same evidence, narrower selection |
| Warehouse use | Warehouse-wide listing | Warehouse plus product/direction selection |
| Accounting use | Not a valuation or balance paper | Not a valuation or balance paper |

Distinction class: **B — navigation and filter depth**. No distinct business semantics, columns, summaries, workflow or legal purpose.

## 7. Existing print surface overlap

| Surface | Business rows | Filters | Balance semantics | Valuation | Print mode | Primary purpose | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Movements Register (`/admin/reports/inventory/movements`) | `InventoryMovement` headers | warehouse, status (not applied), date range | none | none | `REGISTER` | movement listing | accepted, automated/PDF PASS |
| Inventory Ledger (`/admin/inventory/ledger`) | `InventoryMovement` headers | 11 backend filters, none exposed in UI | none | none (returned, not shown) | none yet | same listing with filter depth | classified, not implemented |
| Stock Card (`/admin/inventory/reports/stock-card`) | movement lines for one product | product required, warehouse, location, dates | opening, running, closing | none | `REPORT` (browser `window.print()`, no accepted adapter) | item balance history | audited, not approved |
| Balances (`/admin/reports/inventory/balances`) | current balance rows | warehouse, product | current balance only | none | `REPORT` | current stock | accepted |
| Valuation (`/admin/inventory/valuation`) | policies/initializations | warehouse, policy | none | recorded cost policies | none | valuation control | audited |
| Movement DOCUMENT (`/admin/inventory/movements/[id]`) | one movement with lines | — | none | recorded line values | `DOCUMENT` | single transaction | accepted |

## 8. Filter matrix

`Ledger API` = `GET /inventory/ledger/movements`; `Ledger UI` = current page; `Report API` = `GET /reports/inventory/movements`; `Print` = what the accepted register print actually sends.

| Filter | Ledger API | Ledger UI | Report API | Print | Print-safe | Needs fix before reuse |
| --- | --- | --- | --- | --- | --- | --- |
| `search` | Yes (number OR notes) | No | Yes (number only) | No | Yes, truncate | UI exposure; align note search semantics |
| `warehouseId` | Yes, context-validated | No | Yes | Yes (readable F9 label) | Yes | UI exposure |
| `movementType` | Yes, unvalidated | No | Yes | No | Yes, translated | UI exposure and label |
| `status` | Yes, unvalidated | No | Yes (`status`), but screen sends ignored `countStatus` | No; marked NOT APPLIED | Yes, translated | UI must send `status`; separate reports fix |
| `sourceType` | Yes | No | Yes | No | Yes, `translateMovementSourceType` | UI exposure and label |
| `sourceId` | Yes | No | No | No | **No — raw id** | Never print; omit |
| `productId` | Yes (line `some`) | No | Yes (line `some`) | No | Yes with F9 label | UI exposure; label; matches movements containing the product |
| `direction` | Yes (line `some`) | No | Yes (line `some`) | No | Yes, IN/OUT translated | UI exposure and label |
| `locationId` | Yes, context-validated | No | No | No | Yes only with readable location | No location F9 adapter; row payload has no `warehouseLocation`; defer |
| `dateFrom` | Yes | No | Yes | Yes (`periodStart`) | Yes | UI exposure |
| `dateTo` | Yes | No | Yes | Yes (`periodEnd`) | Yes after semantics fix | Date-only upper-bound fix (blocking) |
| `companyId` / `branchId` | Accepted, ignored | No | Accepted, ignored | No | No — server scope only | Never use as client scope |

## 9. Filter defect classification

| Defect | Evidence | Classification |
| --- | --- | --- |
| No deterministic secondary sort (`movementDate desc` only) on both endpoints | ledger service `orderBy`; reports service `orderBy` | `BLOCKING_FOR_IMPLEMENTATION` (all-filtered collection) |
| `dateTo` date-only interpreted as midnight, excluding later same-day rows | both use `new Date(dateTo)` with `lte`; `buildDateFilter` also | `BLOCKING_FOR_IMPLEMENTATION` (period evidence) |
| Ledger UI exposes no filters | page sends only `page`/`limit` | `BLOCKING_FOR_IMPLEMENTATION` (value proposition) |
| `companyId`/`branchId` accepted then ignored | ledger query type; reports DTO base fields | `NON_BLOCKING` (intended; never client scope) |
| Ledger `status`/`direction`/`movementType` unvalidated | `@Query() query: any` | `SHOULD_FIX_SEPARATELY` (date inputs are UI-generated; enum selects needed with the filter UI) |
| `sourceId` raw, no readable source number | model field only | `NON_BLOCKING` with explicit omission |
| `by-location` / `by-source` unpaginated | service methods | `IRRELEVANT_TO_PRINT` (not used by the register) |
| Movements report ignores `countStatus` | service applies `status` only; test asserts NOT APPLIED | `SHOULD_FIX_SEPARATELY` (accepted surface, out of this phase) |
| Ledger page mixed-UOM quantity sum | page `lines[].quantity` reduce | `BLOCKING_FOR_IMPLEMENTATION` if reused; excluded by design |

## 10. Permission comparison

| Surface | Permission | Data endpoint |
| --- | --- | --- |
| Inventory Ledger | `inventory-ledger:read` | `GET /inventory/ledger/movements` |
| Movements Register | `reports.inventory:read` | `GET /reports/inventory/movements` |

`SHARED_MODEL != SHARED_AUTHORIZATION`. A shared client-side renderer does not require a shared endpoint, and the ledger route must never depend on `reports.inventory:read`. No print permission is created or proposed.

## 11. Pagination and determinism

- Both endpoints use offset paging with `movementDate desc` and no tie-break.
- Equal timestamps can reorder between pages. `collectPrintRows` fails closed (`dataChanged`) on duplicate identity, wrong row count, changed totals or inconsistent `totalPages`.
- `DETERMINISTIC_COLLECTION = BLOCKED`.
- Minimum future source change: add a stable secondary key to both `orderBy` clauses (`[{ movementDate: 'desc' }, { id: 'desc' }]` or `movementNumber`), and to the by-product/by-warehouse reads if they are ever printed. Not changed in this phase.

## 12. Date semantics

`new Date('2026-11-13')` parses as `2026-11-13T00:00:00Z`. With `lte`, a date-only upper bound excludes movements later that day. The defect exists on both endpoints and on the accepted register. Classification: `NON_BLOCKING` for the screen, `BLOCKING_FOR_IMPLEMENTATION` for a period register. Minimum future fix: treat date-only `dateTo` as an exclusive next-day boundary (`lt` next day start) in the shared date helper and in the ledger service; do not compensate silently inside the print adapter.

## 13. Dataset risk and bounded collection

- Movement headers can reach thousands to tens of thousands of rows.
- `PRINT_ROW_LIMIT = 500`, `PRINT_PAGE_SIZE = 100`, maximum five pages, identity check per row.
- Overflow policy: `BLOCK_PRINT_AND_REQUIRE_FILTERS`. `limitExceeded` shows the localized "limited to 500 rows, narrow the filters" message and no document opens.
- No partial document, no silent truncation, no "full ledger" label on a bounded result.
- Required labels: `ALL_FILTERED_RESULTS` (maximum 500) or an explicit error; never `CURRENT_PAGE`, `PARTIAL_SOURCE` or `LIMIT_EXCEEDED` presented as complete.

## 14. Scope, granularity, identity and source reference

- `REGISTER_PRINT_SCOPE = ALL_FILTERED_ROWS` (confirmed; one page is not a ledger).
- Granularity: one row per `InventoryMovement` header. Line rows would change the business row family, break movement-count totals and mix UOMs. Line detail is already the accepted movement DOCUMENT.
- Identity: `movementNumber`; never invented ledger numbering.
- `sourceType` is printable via `translateMovementSourceType`; `sourceId` is never printed. The accepted register already omits source references, so the missing readable source document number does not block implementation.

## 15. Quantity, UOM and valuation decisions

- No header quantity column. `MIXED_UOM_HEADER_TOTAL = FORBIDDEN`.
- No line quantity/UOM columns in the register; line-level quantity and unit belong to the movement DOCUMENT.
- Summary: movement count only. No mixed-UOM sum, no per-UOM grouping in this register.
- Valuation: omitted entirely from the register. Recorded line cost stays a document concern; valuation reporting stays with the valuation surfaces. No computed or current valuation, no cross-currency total.
- `RUNNING_BALANCE = OUT_OF_SCOPE`, `OPENING_BALANCE = OUT_OF_SCOPE`, `CLOSING_BALANCE = OUT_OF_SCOPE`. No `InventoryBalance` read.

## 16. Proposed register columns

| # | Column | Level | Source | Conditional | AR/EN key | Technical-ID risk | UOM risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Movement number | Header | `movementNumber` | Required | `inventoryCounting.movementNumber` | None | None |
| 2 | Date | Header | `movementDate` | Required | `common.date` | None | None |
| 3 | Movement type | Header | `movementType` | Required | `inventoryCounting.movementType` | None | None |
| 4 | Warehouse | Header | `warehouse.name` / `warehouse.code` | Required, readable only | `reports.warehouse` | None | None |
| 5 | Status | Header | `status` | Required | `reports.status` | None | None |
| 6 | Notes | Header | `notes` | Optional value, column kept | `common.notes` | None | None |

Source type as a column is `OPTIONAL_FUTURE`: it is translatable, but adding it would diverge from the accepted register output and require re-acceptance.

## 17. Proposed filter labels

| Filter | Label source | Printable form | Forbidden form |
| --- | --- | --- | --- |
| Warehouse | F9 `warehouseAdapter` | readable name or code | `warehouseId` |
| Product | F9 `productAdapter` | readable product name/code | `productId` |
| Movement type | `translateMovementType` | localized label | raw enum |
| Status | `translateEnum` | localized label | raw enum |
| Direction | `translateEnum`, `inventoryCounting` namespace | localized IN/OUT | raw enum |
| Source type | `translateMovementSourceType` | localized label | raw enum |
| Source id | — | not printed | `sourceId` |
| Date range | formatter `dateOnly` | localized date | ISO timestamp |
| Search text | user text | truncated business text | — |
| Location | deferred (no adapter, no readable name in payload) | — | `locationId` |

## 18. Orientation

A4 portrait. Six business columns and a count summary do not justify landscape.

## 19. Security and redaction

Never printed: `id`, `movementId`, `sourceId`, `productId`, `warehouseId`, `locationId`, `companyId`, `branchId`, any `*ById`, `lockVersion`, `requestId`, `_count`, permission arrays, tokens, session data, and the ledger `meta` object. Business numbers, readable names and localized labels only.

## 20. Final architecture

`EXTEND_EXISTING_MOVEMENTS_REGISTER_WITH_LEDGER_FILTERS`.

- One shared InventoryMovement REGISTER model, one shared bounded collector, one shared column set and one shared redaction rule.
- The existing `inventory-movements-print.ts` remains canonical for the accepted output; a later refactor extracts the shared mapper (conceptual name `inventory-movement-register-print.ts`) without changing the accepted register's bytes.
- Route-specific filter inputs and route-specific permission-gated data loads: ledger → `/inventory/ledger/movements` with `inventory-ledger:read`; reports → `/reports/inventory/movements` with `reports.inventory:read`.
- Response-shape normalizer maps ledger `{ data, meta }` into the register `PrintPage` contract (`rows`, `pageSize`, `totalPages`).
- UX: the ledger route gets its own Print action using the shared model after its filters are exposed; it must not link users to the reports register, because that would require `reports.inventory:read`.
- No new register, no second adapter, no duplicated columns or totals.

## 21. Implementation dependencies

| Dependency | Class |
| --- | --- |
| Deterministic secondary sort on both movement endpoints | `MUST_FIX_BEFORE_IMPLEMENTATION` |
| Date-only `dateTo` inclusive upper-bound semantics | `MUST_FIX_BEFORE_IMPLEMENTATION` |
| Ledger UI filter exposure (warehouse, product, movement type, status, direction, source type, date range, optional search) | `MUST_FIX_BEFORE_IMPLEMENTATION` (otherwise fall back to no ledger print surface) |
| Keep `inventory-ledger:read` and `reports.inventory:read` separate | `MUST_FIX_BEFORE_IMPLEMENTATION` (design constraint, no permission change) |
| Readable filter labels for warehouse/product/enums | `MUST_FIX_BEFORE_IMPLEMENTATION` |
| `sourceId` omitted, source type localized | `CAN_IMPLEMENT_WITH_EXPLICIT_LIMITATION` |
| Location filter omitted from v1 (no adapter, no readable name) | `CAN_IMPLEMENT_WITH_EXPLICIT_LIMITATION` |
| Ledger `{ data, meta }` to `PrintPage` normalizer | `CAN_IMPLEMENT_WITH_EXPLICIT_LIMITATION` |
| Reports `countStatus` gap stays marked NOT APPLIED | `CAN_IMPLEMENT_WITH_EXPLICIT_LIMITATION` |
| 500-row cap with filter-narrowing error | `CAN_IMPLEMENT_WITH_EXPLICIT_LIMITATION` |
| Source type column | `OPTIONAL` |
| Location F9 adapter and filter | `OPTIONAL` |
| Search parity (notes) between endpoints | `OPTIONAL` |

## 22. Blocking issues

1. Non-deterministic pagination for all-filtered collection.
2. Date-only upper-bound exclusion in period filtering.
3. No ledger UI filter contract to justify a ledger print surface.
4. Value proposition collapses to the accepted register if filters are not exposed.

## 23. Non-blocking limitations

1. `sourceId` is raw; the register prints movement number and localized source type only.
2. Location filtering has no readable label source in the current payload or F9 set.
3. The accepted movements register still ignores `countStatus`; separate fix.
4. The ledger page's mixed-UOM quantity column remains a screen defect and is excluded from print.
5. No secondary sort tie-break also affects the accepted register; the collector fails closed rather than printing a corrupted page.

## 24. Validation and git state

- `git diff --check`: clean (exit 0).
- U+FFFD scan: 0 hits in every changed/new document.
- Trailing whitespace: 0 lines.
- Table pipe-count consistency checked on the new ledger tables.
- Web/API tests, typecheck and build were **not** run (documentation-only phase); no fresh regression is claimed.
- Branch `main`, HEAD `54e3706f`, dirty worktree preserved, no Git writes.
