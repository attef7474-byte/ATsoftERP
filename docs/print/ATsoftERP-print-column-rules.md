# ATsoftERP print column rules

Updated 2026-11-13. The reference, twelve additional P0 adapters, five P1 inventory reports, five P1 system reports and the cross-domain operations report are implemented, verified and owner-accepted. The P0 Maintenance operational batch is closed for the automated/PDF gate: Work Order and Repair Order DOCUMENTs implemented, Maintenance Request reused, Tasks not printable, Spare Part Issue deferred; native preview is NOT_VERIFIED. The Inventory Opening Balance, Inventory Movement and Inventory Count DOCUMENTs are implemented and automated/PDF PASS with native previews NOT_VERIFIED. The Inventory Adjustment DOCUMENT (legacy `InventoryAdjustment`, `/admin/inventory/adjustments`) is **implemented** and automated/PDF PASS (`INVENTORY_ADJUSTMENT_AUTOMATED_COMPLETE_NATIVE_NOT_VERIFIED`): canonical print-time re-read, stored historical snapshot and difference sign, per-line recorded unit, conditional readable location and line notes, with no live balance, after-quantity, cost/valuation, movement reference, lot/serial or raw ids. See `docs/proofs/inventory-adjustment-document-print-2026-11-13.md`. The audit inventory is discovery material; its screen columns are not approved print definitions for other routes.

## Maintenance Requests reference

Route: `/admin/reports/maintenance/requests`; endpoint: `GET /api/v1/reports/maintenance/requests`; existing permission: `reports.maintenance:read`.

| Column | Canonical source | Rule |
| --- | --- | --- |
| Request number | requestNumber | Business identity, highest priority, relative width 20 |
| Name/title | title | Highest priority, wrap full business meaning, width 24 |
| Machine | machine.name | Readable name from existing report relation, width 19 |
| Production line | Successfully applied line filter label | Include only when the dataset is scoped to that selected line; never print productionLineId |
| Maintenance type | type | Canonical localized enum, width 11 |
| Priority | priority | Canonical localized enum, width 9 |
| Status | status | Canonical localized enum, width 11 |
| Request creation date | createdAt | Shared localized Gregorian date formatter, width 16 so ten-character numeric dates remain readable with the optional eighth column |

Default: seven columns, A4 portrait. A selected line adds an eighth column. The API includes machine code/name but no line or assignee relation; do not fetch extra hidden fields or invent technician/line values. Assignee, downtime duration, component and cost center are excluded from the default row layout because no readable relation/duration is supplied by this report. Active component/cost-center filters still print their successfully selected readable labels.

Always excluded: id, machineId, assignedToId, productionLineId, costCenterId, createdById, lockVersion, request IDs, API metadata, row navigation, actions, controls and unselected optional fields. The PrintColumn value function is an explicit allowlist. No object serialization is used for business output.

Summary: reuse canonical API cards (total/open/in progress/completed/cancelled), localized and compact. Do not invent a suspended metric, recalculate backend aggregates, or total status/date/code columns. No row-level monetary or quantity total is meaningful here.

Filters: selected line/machine/component/operation/cost center/spare part use readable lookup labels. Status/type/priority use localized enum values. Date boundaries appear in metadata only when active. Pagination fields never appear as business filters. No default "All" values are printed.

## Reviewed operational DOCUMENT definition

Route: `/admin/maintenance/work-orders/[id]`; endpoint: `GET /maintenance-work-orders/:id`; existing permission: `maintenance-work-order:read`; mode DOCUMENT, A4 portrait. Print re-reads the canonical detail endpoint; it is not a list extract and does not add a backend endpoint. All columns use an explicit allowlist.

| Section / field | Canonical source | Rule |
| --- | --- | --- |
| Document identity | workOrderNumber | Business identity; highest priority; never the database `id` |
| Title / description | title, description | Business heading and body; missing description omitted, never a dash-only row |
| Status / type / priority / scope | status, type, priority, scopeType | Canonical localized enums; scope shown as machine/line/general label |
| Context | company, branch, machine, productionLine, machineComponent, costCenter, workLocation, request, warehouse | Readable code/name values only; relation IDs never printed; optional rows omitted when absent |
| Assignment | assignedTo, supervisor, createdBy | Readable names only |
| Dates | plannedStartAt, plannedEndAt, startedAt, completedAt, createdAt, updatedAt, cancelledAt | Shared localized date/time formatter with LTR isolation |
| Parts | parts[].sparePart/product, quantity, unit, unitCost, totalCost, stockIssueStatus, issuedQuantity | Per-line values with the line's own unit; localized issue status; no cross-unit quantity total |
| Cost entries | costEntries[].type, description, amount, incurredAt, createdBy | Localized cost type; amount printed as a number because no currency is supplied |
| Summary | estimatedCost, actualCost, parts count, cost-entry count | Canonical detail values; counts are not monetary or quantity totals |
| Notes | model note plus work-order notes | Contract note always printed; business notes appended when present |

Always excluded: `id`, `companyId`, `branchId`, `machineId`, `machineComponentId`, `productionLineId`, `costCenterId`, `requestId`, `warehouseId`, `assignedToId`, `supervisorId`, `createdById`, `lockVersion`, nested relation IDs, action controls, navigation and application chrome. No total is computed across mixed or missing units, and no currency is invented.

### Repair Order document

Route: `/admin/maintenance/repair-orders/[id]`; endpoint: `GET /maintenance/repair-orders/:id`; existing permission: `repair-orders:read`; mode DOCUMENT, A4 portrait. Print re-reads the canonical detail endpoint and stays read-only.

| Section / field | Canonical source | Rule |
| --- | --- | --- |
| Document identity | repairOrderNumber | Business identity; required; never the database `id` |
| Subtitle | sparePart.code/name | Business part identity; required |
| Status / condition / target | status, sourceCondition, targetCondition | Canonical localized enums |
| Quantities | sourceQuantity, reservedQuantity, repairedQuantity, scrappedQuantity, remainingQuantity | Recorded values in the source part unit; never converted |
| Context | warehouse, machine, machineComponent, maintenanceRequest | Readable code/name values only; optional rows omitted when absent |
| External repair | externalRepair, externalRepairProviderName | Yes/no plus provider name only when recorded |
| Dates | openedAt, inspectionStartedAt, repairStartedAt, testStartedAt, completedAt, cancelledAt, createdAt, updatedAt | Shared localized formatter with LTR isolation; unrecorded dates omitted |
| Narrative | inspectionResult, failureDescription, repairDescription, testResult, testNotes, cancelReason | Two-column record section; empty rows and empty section omitted |
| Actions | actions[].actionType, actionStatus, description, result, performedAt, durationMinutes | Localized labels; performed date/time LTR; duration is minutes |
| Summary | estimatedRepairCost, actualRepairCost, action count | Costs printed only when recorded and as numbers (no currency in the contract) |
| Notes | model note plus repair-order notes | Contract note always printed; business notes appended when present |

Always excluded: `id`, `repairOrderId`, `sparePartId`, `productId`, `warehouseId`, `machineId`, `machineComponentId`, `maintenanceRequestId`, `replacementHistoryId`, `installedPartId`, condition movement IDs, `inventoryScrapMovementId`, all user IDs including `performedByUserId`, `sourceType`/`sourceId`, `lockVersion`, action controls and application chrome. Performer identity is omitted because the contract exposes no display name.

The existing Maintenance Request document is reused unchanged (`EXISTING_DOCUMENT_REUSED`). Tasks is `NOT_PRINTABLE`: its persisted execution record has no business number and sourced executions are covered by the request/work-order document.

## Remaining report review queue

P0 is complete for the approved report scope, including explicit legacy-contract qualifications. P1 inventory (overview, balances, movements, adjustments, count variance) is implemented and rendered-verified; see the inventory table below. P1 system (audit, user activity, notifications, attachments, partners) is implemented and rendered-verified with explicit security allowlists; see the system table below. Cross-domain operations is implemented and rendered-verified with a composite overview plus bounded drilldown; see the operations table below. Remaining: the separately justified operational documents. The legacy cost report combines independently paginated sources and must not inherit the reference collector blindly.

Operational documents require metadata plus canonical line items, business document number, status, dates, meaningful totals and notes. A transaction register cannot substitute for an individual document. Barcode labels/cards retain their specialized dimensions. The Maintenance Work Order and Repair Order documents are reviewed above; the Maintenance Request document is reused unchanged, Tasks is not printable, and other operational routes remain pending in the page matrix and justification file.

## Reviewed P0 definitions

All use A4 portrait and explicit typed allowlists. Generic IDs, relation IDs, row controls and technical metadata are excluded. Date/code fields use LTR isolation. Missing optional values remain a dash. No extra lookup API calls are made merely to invent row labels.

| Route | Mode | Independent business columns | Applied filters and scope | Meaningful totals |
| --- | --- | --- | --- | --- |
| /admin/reports/maintenance | REPORT | Eight independent summary/ranking/list sections | Applied lookup labels; section-specific scope notes | Canonical counts/amounts; global metrics explicitly separated |
| /admin/reports/maintenance/kpis | REPORT | Metric, value, per-metric scope; KPI/reliability/compliance sections | Applied labels and dates; time/scope exceptions qualified | Canonical values; percentage-point normalization; null remains dash |
| /admin/reports/maintenance/downtime | REPORT | Machine, reason, start, end, recorded minutes, textual status | Applied labels and start-date range | Canonical cards; no open-duration estimation |
| /admin/reports/maintenance/costs | REPORT | Separate cost and parts streams; request, description/product, amount/quantity, dates | CURRENT_PAGE extract; date/parts filter differences explicit | Full-scope canonical totals separate from partial rows |
| /admin/reports/maintenance/schedules | REPORT | Title, machine, type, frequency, start, end, status | Applied lookup and due-status labels | Canonical indicators; due-horizon qualification |
| /admin/reports/assets | REGISTER | Code, name, category, location, status, created date | Search/status; branch-shared assets qualified | Canonical cards/status distribution; status override qualified |
| /admin/reports/machine-log | REPORT | Request number, title, machine, type, status, created date | Applied machine label and created-date range | Canonical request count |
| /admin/reports/parts-usage | REPORT | Request, product, quantity, row unit, cost, created date | Applied machine/product labels and recorded-date range | Canonical row count/cost; no mixed-unit quantity sum |
| /admin/reports/upcoming-preventive | REPORT | Title, machine, type, frequency, due date, status | Applied machine label; active next-30-day window | Canonical matching count only; misleading week/all-active cards excluded |
| /admin/reports/overdue-preventive | REPORT | Title, machine, type, frequency, due date, status | Applied machine label; active overdue window | Canonical matching count only; false overall compliance excluded |
| /admin/reports/parts | REGISTER | Code, name, part number, actual quantity, row unit | Search; unsupported status explicitly not applied | Canonical count; machine-parts list not inventory balances |
| /admin/reports/low-stock | REGISTER | Code, name, part number, actual quantity, row unit | Search; fixed quantity below 10 threshold | Canonical count; no mixed-unit sum or invented reorder rule |

Paginated reports use ALL_FILTERED_RESULTS up to 500 rows. Costs use CURRENT_PAGE with a prominent partial-extract notice and separate full-scope totals. Overview is a bounded canonical top-10 snapshot; KPI values are summary responses with per-metric scopes. See [P0 checkpoint](../proofs/unified-print-p0-maintenance-2026-11-12.md) for exact existing API defects and exclusions. No cost currency or quantity unit is invented. No mixed-unit quantity grand total is printed.

## Reviewed P1 inventory definitions

All five use explicit typed allowlists, localized formatters, LTR-isolated code/date/quantity fields and a dash for missing values. No generic ID, row control or technical metadata is printed. Applied lookup labels are required; if a selected filter has no readable label the document is not prepared.

| Route | Mode / orientation | Independent business columns | Applied filters and scope | Meaningful totals |
| --- | --- | --- | --- | --- |
| /admin/reports/inventory | REPORT / portrait | Row-count metrics; balances-by-warehouse row counts; recent count/movement/adjustment documents (code, warehouse, status, created) | Current company/branch; latest 10 per register | Canonical counts only; no mixed-UOM sum; catalog counters excluded |
| /admin/reports/inventory/balances | REPORT / portrait | Code, product, warehouse, location, quantity, updated date | Warehouse/product readable labels | Canonical balance-row count; no unit/value/availability inference |
| /admin/reports/inventory/movements | REGISTER / portrait | Movement number, date, type, warehouse, status, notes | Warehouse readable label; status explicitly NOT APPLIED; date range | Canonical document count; headers only |
| /admin/reports/inventory/adjustments | REGISTER / portrait | Adjustment number, date, warehouse, reason, status, linked count number | Warehouse readable label; status explicitly NOT APPLIED; date range | Canonical document count; headers only |
| /admin/reports/inventory/count-variance | REPORT / landscape | Count number, product code, product, location, system qty, counted qty, variance qty, count-line status | Warehouse/product readable labels; variance-only flag | Canonical matching count-line count; recorded values only, null is dash |

Overview is a bounded canonical snapshot with no multi-page register; the other four use ALL_FILTERED_RESULTS with the 500-row guard. Movements/adjustments intentionally do not print item lines, quantities, units or user names because the current report source supplies document headers only. Balances intentionally omit unit, reserved/available and valuation because they are absent from the response. Count variance never recalculates a recorded variance and never sums unlike units.

## Reviewed P1 system definitions

All five use explicit typed allowlists, localized formatters, LTR-isolated code/date/quantity fields and a dash for missing values. No generic ID, row control or technical metadata is printed. Security is enforced in the print model: audit details are parsed and only whitelisted business fields are printed with tenant/user/record cuids and UUIDs redacted; notifications print titles and types only; attachments print metadata only; partners print business contact data only; user-activity prints no password, token or session field.

| Route | Mode / orientation | Independent business columns | Applied filters and scope | Meaningful totals |
| --- | --- | --- | --- | --- |
| /admin/reports/audit | REPORT / portrait | Action, entity, user name, redacted business details, created date; action and entity distributions | Search/date filters; tenant/user/record ID payloads redacted | Canonical audit-entry count; unique action/entity counts |
| /admin/reports/user-activity | REPORT / portrait | Name, email, status, last login, created date | Search/status filters; no password/token/session | Canonical user count; active/inactive counts |
| /admin/reports/notifications | REPORT / portrait | Title, localized type, read/unread, created date; type distribution | Search/date filters; titles and types only | Canonical notification count; no message bodies or links |
| /admin/reports/attachments | REPORT / portrait | Name, entity type, MIME type, readable size (B/KB/MB), generated by, created date; entity-type distribution | Search/date filters; metadata only | Canonical attachment count and total size; no mixed units |
| /admin/reports/partners | REPORT / portrait | Code, name, localized type, email, phone, active/blocked; type distribution | Search/type filters; business contact only | Canonical partner count; no bank/tax/identity numbers |

Audit details never print the raw stored JSON: only message, reason, status transitions, work performed and a small whitelisted numeric set survive, and any remaining cuid/UUID token is replaced. Notification bodies and links are never selected. Attachment contents and download URLs are never selected. Partner bank, tax and personal identity numbers are never selected. All five use ALL_FILTERED_RESULTS with the 500-row guard and identical AR/EN print/PDF data.

## Reviewed P1 operations definition

The operations report is a composite document: the authoritative overview is fetched once, and the production-run drilldown is collected in bounded 50-row pages up to the shared 500-row print limit. The collector rejects inconsistent totals, page sizes, duplicate run IDs or a late permission denial; the model also rejects a drilldown above the limit. No technical ID, internal context ID or row control is printed.

| Route | Mode / orientation | Independent business columns | Applied filters and scope | Meaningful totals |
| --- | --- | --- | --- | --- |
| /admin/reports/operations | REPORT / landscape | Run number, status, line, machine, product, start, planned/operating minutes, output, good output, OEE; cost by event type; downtime by machine | Applied date window; optional production line and machine readable labels | Authoritative OEE/availability/performance/quality, MTBF, total downtime, operational cost; separate fact sets never added |

The run register uses ALL_FILTERED_RESULTS with the 500-row guard. The summary prints recorded factor percentages (a null factor is a dash), MTBF hours, downtime hours with event count, and operational cost with transaction count. Cost-by-event-type and downtime-by-machine are separate sections. OEE, maintenance-reliability and operational-cost facts are never multiplied through a cross-fact join or added into one physical-event total; the report contract and OEE formula version are printed as metadata. Optional lookup filters print only when a readable label exists; an ID alone is never printed. AR/EN print/PDF data is identical.

## Reviewed inventory opening balance document definition

Route: `/admin/inventory/opening-balances/[id]`; canonical source: `GET /inventory/opening-balances/:id` re-read at print time with the existing `inventory:opening-balance:read`; A4 portrait; one `DOCUMENT` section with allowlisted columns.

| Column / block | Canonical source | Rule |
| --- | --- | --- |
| Document number | `code` | Business identity, required; the model refuses to render without it |
| Status | `status` | Localized business label, never the raw enum |
| Company / Branch | authenticated operational context | Company required; branch printed only when supplied |
| Warehouse | `warehouse.code` + `warehouse.name` | Localized `[code] name`; omitted when absent |
| Document date / Posted / Created / Updated | `documentDate`, `postedAt`, `createdAt`, `updatedAt` | Localized date/time with LTR isolation; missing values are a dash |
| Reason | `reason` | Required business justification |
| Line count | `lines.length` | A meaningful count; not a quantity total |
| Line: row number | derived order | Sequential, localized digits |
| Line: product code / name | `product.code`, `product.name` | Readable business identity; a dash when absent |
| Line: quantity | `quantity` | Recorded value only; no recomputation, no conversion, no sum |
| Line: unit | `product.unit` | Actual source unit; no conversion and no cross-unit total |
| Line: unit cost / currency | `unitCost`, `currencyCode` | Printed only when recorded; missing is a dash; no invented currency or valuation |
| Line notes | `notes` | Business note when present |
| Document notes | `notes` + scope note | Scope/limitation note always printed; user notes appended when present |
| Print metadata | runtime `printedAt`, `timeZone`, authenticated user/company/branch | Print date/time is generated by the runtime, never from record dates |

Always excluded: `id`, `companyId`, `branchId`, `warehouseId`, `locationId`, `productId`, `openingBalanceId`, `submittedById`, `approvedById`, `rejectedById`, `postedById`, `cancelledById`, `movementId`, `quantityBase`, `valuationReason`, `lockVersion`, `_count`, action controls and application chrome. Location, lot and user display names are omitted because the canonical detail supplies no readable names; they are never replaced with raw IDs. No computed line value, document monetary total, valuation or mixed-UOM quantity total is printed. A zero-line document is not legally creatable (`ArrayMinSize(1)` and a required reason), but the adapter renders a localized empty state for legacy or unexpected data.

## Reviewed inventory movement document definition

Route: `/admin/inventory/movements/[id]`; canonical source: `GET /inventory/movements/:id` re-read at print time with the existing `inventory-movement:read`; A4 portrait; one `DOCUMENT` section with allowlisted columns.

| Column / block | Canonical source | Rule |
| --- | --- | --- |
| Movement number | `movementNumber` | Business identity, required; the model refuses to render without it |
| Movement type / Status | `movementType`, `status` | Localized business labels via canonical translators; unknown types fall back to a humanized label, never a raw key |
| Company / Branch | authenticated operational context | Company required; branch printed only when supplied |
| Warehouse | `warehouse.code` + `warehouse.name` | Exactly one warehouse, localized `[code] name`; omitted when absent |
| Movement / Posted / Cancelled / Created / Updated | `movementDate`, `postedAt`, `cancelledAt`, `createdAt`, `updatedAt` | Localized date/time with LTR isolation; missing values are omitted |
| Source type | `sourceType` | Localized source-type label only; the referenced business document number is not exposed by the contract and is not invented |
| Line count | `lines.length` | A meaningful count; not a quantity total |
| Line: row number | derived order | Sequential, localized digits |
| Line: product code / name | `product.code`, `product.name` | Readable business identity; a dash when absent |
| Line: quantity / unit | `quantity`, `unit` | Recorded transaction quantity and the recorded line unit snapshot; `quantityBase` and `product.unit` are not substituted; no conversion or cross-unit total |
| Line: direction | `line.direction` | Recorded per-line IN/OUT, localized; no sign or direction is inferred; no header direction and no source/destination warehouse pair |
| Line: batch / serial / expiry | `batchNumber`, `serialNumber`, `expiryDate` | Printed only when recorded; parameter column omitted when no line carries the value |
| Line: unit cost / total cost / currency | `unitCost`, `totalCost`, `currencyCode` | Recorded line scalars only, printed when present; no computed document total or valuation |
| Line notes | `notes` | Business note when present |
| Document notes | `notes` + scope note | Scope/limitation note always printed; user notes appended when present |
| Print metadata | runtime `printedAt`, `timeZone`, authenticated user/company/branch | Print date/time is generated by the runtime, never from record dates |

Always excluded: `id`, `companyId`, `branchId`, `warehouseId`, `warehouseLocationId`, `productId`, `movementId`, `sourceId`, `requestId`, `postedById`, `cancelledById`, `reversesMovementId`, `quantityBase`, `lockVersion`, `_count`, action controls and application chrome. Warehouse-location names and readable user names are not supplied by the canonical detail, so those fields are omitted rather than replaced with IDs. No document quantity total, mixed-UOM sum, computed line value, valuation or ledger reconciliation is printed. A zero-line movement is legacy-only; the adapter renders a localized empty state for robustness.

## Reviewed inventory count document definition

Route: `/admin/inventory/counts/[id]`; canonical family: `InventoryCount` (navigation entry `inventoryCounts`; the second `InventoryPhysicalCount` family is deferred and not printed); canonical source: count-scoped `GET /inventory/counts/:id/results` re-read at print time with the existing `inventory-count:read`; A4 portrait; one `DOCUMENT` section with allowlisted columns.

The read endpoint is count-scoped and internally re-runs the same `findOne` company/branch/warehouse scope as `GET /inventory/counts/:id`. It is used because the legacy `/:id` select omits the product unit while the results read exposes the recorded UOM per line; no backend contract change is made in this phase.

| Column / block | Canonical source | Rule |
| --- | --- | --- |
| Count number | `countNumber` | Business identity, required; the model refuses to render without it |
| Status | `status` | Localized business label; unknown statuses fall back to a humanized label, never a raw key |
| Company / Branch | authenticated operational context | Company required; branch printed only when supplied |
| Warehouse | `warehouse.code` + `warehouse.name` | Exactly one printable count warehouse, localized `[code] name`; omitted when absent |
| Count / Started / Completed / Cancelled / Created / Updated | `countDate`, `startedAt`, `completedAt`, `cancelledAt`, `createdAt`, `updatedAt` | Localized date/time with LTR isolation; missing values are omitted |
| Line / counted-line / verified-line counts | `lines.length` and derived line status | Meaningful counts; never a quantity total |
| Line: row number | derived business order | Sequential, localized digits; rows ordered by product code, then location code, then internal tie-break (never printed) |
| Line: product code / name | `product.code`, `product.name` | Readable business identity; a dash when absent |
| Line: system quantity | `systemQty` | The stored count-time snapshot captured when the line was created or through an authorized override; the current `InventoryBalance` is never read, refreshed or substituted |
| Line: counted quantity | `countedQty` | Recorded count value only; no recomputation or conversion |
| Line: difference | `differenceQty` | The recorded canonical value with the domain sign (`countedQty - systemQty`); never recalculated from current stock and never absolute-valued |
| Line: unit | `product.unit` | Recorded source unit printed per line; no conversion and no cross-unit total |
| Line: location | `warehouseLocation.code` + `warehouseLocation.name` | Readable `[code] name`; parameter column omitted when no line carries a readable location |
| Line status | `line.status` | Localized recorded line status (`PENDING` / `COUNTED` / `VERIFIED`) |
| Line notes | `notes` | Business note when present; column omitted when no line carries one |
| Document notes | `notes` + scope note | Scope/limitation note always printed; user notes appended when present |
| Print metadata | runtime `printedAt`, `timeZone`, authenticated user/company/branch | Print date/time is generated by the runtime, never from record dates |

Always excluded: `id`, `countId`, `companyId`, `branchId`, `warehouseId`, `warehouseLocationId`, `productId`, `countedById`, `verifiedById`, `createdById`, `startedById`, `completedById`, `cancelledById`, `lockVersion`, `_count`, action controls and application chrome. Counter/verifier display names are not supplied by the count contract (only ids), so those identities are omitted rather than replaced with IDs. No cost, currency, lot/batch/serial, valuation, document quantity total or mixed-UOM sum is printed. `BLIND_COUNT_MODEL = NOT_SUPPORTED`: the current workflow has no blind count, hidden expected quantity, variance mask, recount pass or multiple independent counters, and the authorized detail screen already shows system/counted/difference to `inventory-count:read` holders, so print visibility equals existing authorized UI visibility. Zero-line counts are legacy-only in practice; the adapter renders a localized empty state for robustness.

## Reviewed inventory adjustment document definition

Route: `/admin/inventory/adjustments/[id]`; canonical family: legacy `InventoryAdjustment` (navigation `inv-adjustments`); canonical read: `GET /inventory/adjustments/:id` with existing `inventory-adjustment:read` and `assertRowInContext` company/branch scope. The print action re-reads that endpoint at print time and aborts with a localized error when the read is denied or fails; list/React state is never used. **Implemented** as `inventory-adjustment-document-print.ts` (`mode: DOCUMENT`, A4 portrait).

- Status: source contract `PASS` (`INVENTORY_ADJUSTMENT_READ_CONTRACT_ENRICHED`, additive Phase 5 enrichment); document gate `PASS` for the automated model and PDF structure; native preview/Save-as-PDF/cancellation/paper `NOT_VERIFIED`.
- `ADJUSTMENT_TYPE = NOT_APPLICABLE` (no type/method field exists), `MOVEMENT_REFERENCE = NOT_APPLICABLE` (legacy posting creates no movement), `COST_VALUE = NOT_APPLICABLE`, `LOT_BATCH_SERIAL = NOT_APPLICABLE`.

| Field | Source | Rule |
| --- | --- | --- |
| Title / document number | localization + `adjustmentNumber` | Business number only; the model refuses to prepare without it |
| Status | `status` (`DRAFT` / `POSTED` / `CANCELLED`) | Localized canonical status |
| Reason | `reason` | Business text; omitted when empty |
| Adjustment date | `adjustmentDate` | Localized date, LTR-isolated |
| Posted / cancelled / created / updated | `postedAt`, `cancelledAt`, `createdAt`, `updatedAt` | Localized date/time; missing values omitted |
| Company / branch | runtime authorized context | Context labels only |
| Warehouse | `warehouse.code` + `warehouse.name` | Readable `[code] name` |
| Linked count | `inventoryCount.countNumber` | Business number only; omitted when absent; never the count id |
| Line: row number | derived business order | Sequential localized digits; ordered by product code, then location code, then an internal tie-break that is never printed |
| Line: product code / name | `product.code`, `product.name` | Readable business identity |
| Line: unit | `product.unit` | Recorded source unit per line; no conversion and no cross-unit total |
| Line: system quantity | `systemQty` | Stored count-time snapshot only; the current `InventoryBalance` is never read, refreshed or substituted; no after-quantity is derived |
| Line: counted quantity | `countedQty` | Recorded value only; no recomputation |
| Line: difference | `differenceQty` | Recorded canonical value with the stored domain sign (`countedQty - systemQty`); never recalculated, never absolute-valued, never shown as an after-quantity |
| Line: location | `warehouseLocation.code` + `.name` | Readable `[code] name`; column omitted when no line carries a readable location |
| Line notes | `notes` | Business note when present; column omitted when no line carries one |
| Document notes | `notes` + scope/limitation note | Limitation note always printed; user notes appended |
| Summary | `lines.length` | Line count only; no mixed-UOM quantity total and no difference grand total |
| Print metadata | runtime `printedAt`, `timeZone`, authenticated user/company/branch | Print date/time from the runtime, never from record dates |

Always excluded: `id`, `adjustmentId`, `companyId`, `branchId`, `warehouseId`, `warehouseLocationId`, `productId`, `inventoryCountId`, `createdById`, `postedById`, `cancelledById`, `lockVersion`, `requestId`, `_count`, action controls and application chrome. Readable user names, movement number, after-quantity, cost/value/currency, lot/batch/serial and valuation are not supplied by the contract, so they are omitted rather than replaced with IDs or inferred. Zero-line adjustments are legacy-only in practice; the adapter renders a localized empty state for robustness.

### Inventory Stock Adjustment document

Stock Adjustment (`/admin/inventory/stock-adjustments`, `InventoryStockAdjustment`) is a separate implemented DOCUMENT family. Canonical detail read: `GET /inventory/stock-adjustments/:id` with `inventory:stock-adjustment:read`, re-read at print time. The `[id]` page is read-only and exposes no workflow action.

- Status: document gate `PASS` for the automated model and PDF structure; native preview/Save-as-PDF/cancellation/paper `NOT_VERIFIED`.
- `BEFORE_QTY_HISTORICAL_INTEGRITY = NOT_APPLICABLE` (no before/after quantity is stored), `AFTER_QTY = OMITTED_NOT_STORED`, `LOCATION = NOT_APPLICABLE` (the detail contract exposes no readable location relation), `MOVEMENT_REFERENCE = OMITTED_SOURCE_NOT_READABLE` (the detail contract exposes no movement business number), `REJECTION_REASON = NOT_APPLICABLE` (no field exists), `SOURCE_REFERENCE = NOT_APPLICABLE` (no field exists), `COST_VALUE = OMITTED_NOT_COMPUTED` (per-line recorded unit cost/currency only), `LOT_BATCH_SERIAL = NOT_APPLICABLE`.

| Field | Source | Rule |
| --- | --- | --- |
| Title / document number | localization + `code` | Business number only; the model refuses to prepare without it |
| Status | `status` (`DRAFT` / `SUBMITTED` / `APPROVED` / `REJECTED` / `POSTED` / `CANCELLED`) | Localized canonical status |
| Document date | `documentDate` | Localized date, LTR-isolated |
| Reason | `reason` | Business text; omitted when empty |
| Company / branch | `company.name`, `branch.name` | Readable names only |
| Warehouse | `warehouse.code` + `warehouse.name` | Readable `[code] name` |
| Workflow timestamps | `submittedAt`, `approvedAt`, `rejectedAt`, `postedAt`, `cancelledAt` | Localized date/time; missing values omitted; actor ids never printed |
| Created / updated | `createdAt`, `updatedAt` | Localized date/time; missing values omitted |
| Line: row number | derived business order | Sequential localized digits; ordered by product code, then adjustment type, then an internal tie-break that is never printed |
| Line: product code / name | `product.code`, `product.name` | Readable business identity |
| Line: adjustment type | `adjustmentType` (`ADJUSTMENT_IN` / `ADJUSTMENT_OUT`) | Localized stored direction; never derived from the quantity sign |
| Line: quantity | `quantity` | Stored positive quantity; never negated, absolute-valued or direction-adjusted |
| Line: unit | `product.unit` | Source product unit per line; no historical UOM snapshot exists in the contract; no conversion and no cross-unit total |
| Line: unit cost / currency | `unitCost`, `currencyCode` | Printed only when recorded on the line (typically `ADJUSTMENT_IN`); never computed, never defaulted |
| Line: valuation reason | `valuationReason` | Printed only when present; column omitted otherwise |
| Line notes | `notes` | Business note when present; column omitted when no line carries one |
| Document notes | `notes` + scope/limitation note | Limitation note always printed; user notes appended |
| Summary | `lines.length` | Line count only; no mixed-UOM quantity total, line value, document total or cross-currency total |
| Print metadata | runtime `printedAt`, `timeZone`, authenticated user/company/branch | Print date/time from the runtime, never from record dates |

Always excluded: `id`, `adjustmentId`, `companyId`, `branchId`, `warehouseId`, `locationId`, `productId`, `movementId`, `submittedById`, `approvedById`, `rejectedById`, `postedById`, `cancelledById`, `createdById`, `updatedById`, `lockVersion`, `requestId`, `_count`, action controls and application chrome. Live `InventoryBalance`, derived before/after quantities, movement references, readable user identities, lot/batch/serial and any computed valuation are not printed. See `docs/proofs/inventory-stock-adjustment-document-print-2026-11-13.md`.

### Inventory movement register (shared model; implemented for Movements and Ledger)

The Inventory Ledger (`/admin/inventory/ledger`, `REGISTER`) is not a second print surface. The design gate approved one shared InventoryMovement register model/collector/columns/redaction used by both the accepted movements register (`/admin/reports/inventory/movements`) and the ledger route. It is now implemented in `inventory-movement-register-print.ts`, with accepted Movements output preserved and a thin ledger wrapper in `inventory-ledger-register-print.ts`.

- Decision `INVENTORY_LEDGER_DESIGN_EXTEND_EXISTING_MOVEMENTS_REGISTER_WITH_LEDGER_FILTERS`; status `IMPLEMENTED`; final decision `INVENTORY_LEDGER_REGISTER_AUTOMATED_COMPLETE_NATIVE_NOT_VERIFIED`; `PERMISSION_CHANGE = 0`; no print permission.
- One row per `InventoryMovement` header, identified by `movementNumber`; line detail belongs to the accepted movement DOCUMENT, not to the register.
- Columns stay the accepted six: movement number, date, localized movement type, readable warehouse, status, notes. A source-type column is optional future work and would require re-accepting the register.
- No quantity column and no line quantity/UOM column: `MIXED_UOM_HEADER_TOTAL = FORBIDDEN`. Summary is movement count only. The former ledger screen defect (summing `lines[].quantity` across units) was removed and replaced by a line count.
- No running, opening or closing balance; no `InventoryBalance` read. No valuation, no computed or cross-currency total.
- Deterministic collection: both movement lists order by `movementDate desc, id desc`, so offset pagination has no duplicate or missing same-timestamp rows.
- Date semantics: a date-only `dateTo` is inclusive of the whole selected day (exclusive next-day UTC boundary); `dateFrom` stays at start-of-day; full timestamps keep exact `lte`. Invalid dates and inverted ranges are rejected with `BadRequestException` before any query.
- All-filtered scope through `collectPrintRows` (100 per page, 500-row cap, fail-closed). Above the cap, block and require filter narrowing with the localized message; never print a partial document or label it full.
- Route-specific filters and permissions: ledger keeps `inventory-ledger:read` on `GET /inventory/ledger/movements`; reports keeps `reports.inventory:read` on `GET /reports/inventory/movements`. `SHARED_MODEL != SHARED_AUTHORIZATION`; no print permission; `PERMISSION_CHANGE = 0`.
- Ledger filter contract (`filter-contract.ts`) sends only: `page`, `limit`, `search`, `warehouseId`, `productId`, `movementType`, `status`, `direction`, `sourceType`, `dateFrom`, `dateTo`. Empty values are omitted; tenant fields (`companyId`, `branchId`), `sourceId`, raw `locationId` and display labels are never sent. Location and `sourceId` filters are `DEFERRED` / `NOT_AUTHORIZED` because no safe readable selector exists.
- Never printed: raw ids, `sourceId`, `companyId`/`branchId` (server scope only), `lockVersion`, `requestId`, `_count`, tokens or session data. `sourceType` is printed only as a localized label.
- Implementation: the shared builder owns the six columns, movement-count summary, redaction and notes; the ledger adapter supplies title/filter metadata and the route keeps its own data load. The print action is gated by `inventory-ledger:read`. Blockers: none remaining. Evidence: `docs/proofs/inventory-ledger-source-filter-hardening-2026-11-13.md`; design: `docs/proofs/inventory-ledger-register-design-gate-2026-11-13.md`.
