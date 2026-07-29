# Screenshot Issue Inventory

## Batch

- Title: Runtime UI + Reports i18n + Full Browser Operations Proof Patch
- Starting branch: `main`
- Starting commit: `64ba3c2`
- Initial release status: `NOT_RELEASE_READY_UNTIL_RUNTIME_UI_REPORTS_I18N_FIXES`
- Evidence source: user-supplied runtime screenshots and visible error text

The screenshot findings are treated as real release blockers. A source-code
inspection or successful build alone cannot close an item; the required runtime,
network, console, and visible-DOM proof must also pass.

## P0 runtime and API contract blockers

| Route | Visible problem | Severity | Expected corrective action | Required proof |
| --- | --- | --- | --- | --- |
| `/admin/maintenance/machines/[existing-machine-id]` | Runtime `TypeError: data.map is not a function` from the shared `DataTable` | P0 | Identify the non-array relation, normalize it at the page/API boundary, and defensively render only array rows in `DataTable` without hiding API errors | Real machine-detail browser load; related tables or real empty states render; no overlay, console error, 404, or 500 |
| `/admin/installed-parts` | `property page should not exist` | P0 | Align the frontend query with the endpoint DTO: remove unsupported pagination parameters or implement the existing documented contract without broad validation changes | Authenticated API request plus real page DOM showing a table or real empty state |
| `/admin/maintenance/repair-orders` | `property page should not exist` | P0 | Align the frontend query with the repair-order query DTO; do not send unsupported `page` parameters | Authenticated API request plus real page DOM showing a table or real empty state |
| `/admin/maintenance/bom` | `page must not be less than 1` | P0 | Convert zero-based UI page state to API page numbers and guarantee every request sends `page >= 1` where pagination is supported | Network proof of a page value of at least 1 and real DOM without the validation error |

## P1 raw i18n key blockers

| Area/routes | Visible problem examples | Severity | Expected corrective action | Required proof |
| --- | --- | --- | --- | --- |
| Reports hub and all active reports, including `/admin/reports`, `/admin/reports/audit`, `/admin/reports/maintenance`, `/admin/reports/maintenance/kpis` | Raw `reports.*` labels for schedules, costs, stock, scans, count variance, movements, balances, requests, audit, users, partners, attachments, notifications, products, machines, and warehouses | P1 | Add every missing report label in EN and AR, use the correct namespace, and preserve exact key parity | Static key scan, EN/AR parity, and visible DOM with no `reports.` text |
| Report KPI/audit cards | Uppercase keys such as `REPORTS.UNIQUEENTITIES`, `REPORTS.TOTALREQUESTS`, and `REPORTS.TOTALCOST` | P1 | Stop uppercasing translation lookup keys; translate first and only transform display text if safe | Visible cards contain translated text and zero uppercase raw keys |
| Maintenance reports and operational pages | Raw `maintenance.*` and `maintenanceDashboard.*` labels for KPIs, cost, backlog, SLA, schedules, planning, calendar, workload, installed parts, and condition balances | P1 | Complete both locale namespaces and correct lookup namespaces | Static and browser-visible raw-key scans pass |
| Reports navigation groups | `navigation.otherReports`, `navigation.inventoryReports`, `navigation.maintenanceReports` | P1 | Add matching EN/AR navigation labels and use the correct keys | Sidebar/report hub DOM contains localized group names |
| Barcode routes: preview, records, templates, product labels, machine cards, print jobs | Raw `barcodes.preview.*`, `barcodes.productLabels.*`, `barcodes.machineCards.*`, `barcodes.scan.*`, `barcodes.printJobs.*`, and records keys | P1 | Complete barcode keys in both languages and correct page lookups | All six barcode route groups render without raw keys |
| Inventory opening balances and stock adjustments | Raw `inventory.openingBalances`, `inventory.stockAdjustments`, `inventory.stockAdjustmentCode`, and `inventoryCounting.*` workflow/document keys | P1 | Add EN/AR keys and correct namespace use | Real DOM and action labels contain localized text |
| Shared UI | Raw `common.currency`, `common.clear`, `common.preview`, `COMMON.COUNT`, `COMMON.QUANTITY`, `status.status`, and `STATUS.STATUS` | P1 | Add missing shared labels and remove uppercase-key lookup behavior | Shared component pages show translated labels; no raw shared keys |

## P1 enum, status, action, and unit blockers

The screenshots contain untranslated system values including:

- Actions: `GENERATE`, `ENTER_COUNT`, `DELETE`, `DEACTIVATE`, `CREATE`,
  `COMPLETE`, `CLOSE`, `CANCEL`, `APPROVE`, `ADD_LINE`, `ACTIVATE`,
  `SUBMIT`, `START`, `SCAN`, `RETURN_STOCK`, `RETIRE`, `REOPEN`,
  `REMOVE_LINE`, `REJECT`, `RECALCULATE`, `PRINT`, `POST`,
  `ISSUE_STOCK`, `GENERATE_FROM_COUNT`, `VOID`, `VERIFY`, `UPDATE_LINE`,
  and `UPDATE`.
- Statuses/types: `EMERGENCY`, `USED_SERVICEABLE`, `NEW`,
  `MAINTENANCE_REQUEST`, `TECHNICIAN`, `QR_CODE`, `PRODUCT`, `MACHINE`,
  `RETIRED`, `NOT_FOUND`, `GENERAL_LOOKUP`, `SUCCESS`, `WEB`, `DRAFT`,
  `POSTED`, `REJECTED`, `CANCELLED`, and `APPROVED`.
- Human-readable variants still shown in English: `Corrective`,
  `Preventive`, `High`, `Medium`, `Open`, `Closed`, `In_progress`,
  `Cancelled`, `active`, `under_maintenance`, and `Movements`.
- Units: `bytes`, `minutes`, quantity/count, and currency.

Severity: **P1**.

Expected corrective action: reuse or extend centralized enum translators for
actions, statuses, priorities, maintenance types, barcode/entity types,
movement types, and units. Stored free-text descriptions must remain unchanged.

Required proof: visible Arabic DOM values are translated in tables, badges,
cards, and menus; EN mode remains valid; no raw enum from the identified set is
visible on tested active pages.

## P2 safe UI quality issues

| Visible problem | Severity | Expected corrective action | Required proof |
| --- | --- | --- | --- |
| Dark KPI cards have weak contrast | P2 | Reuse existing theme-safe classes/tokens and improve text contrast without redesign | KPI text is visibly readable in runtime DOM/styles |
| Zero values render as a dot or ambiguous mark | P2 | Render numeric zero explicitly while preserving null/unknown semantics | KPI/table proof shows `0` where the real value is zero |
| Footer/status strip contains empty system fields on list/report pages | P2 | Hide non-applicable empty fields or use an existing meaningful list/report state, without fake values | List/report footer has no misleading empty field labels |
| Mixed Arabic, English, raw keys, and technical values | P2 | Apply namespace and enum fixes consistently | Arabic route set has coherent translated UI |
| Active navigation exposes pages that appear incomplete | P2 | Fix active in-scope pages; hide only links to forbidden/unregistered modules, never add placeholders | Navigation links resolve to real active pages with no unexpected 404 |
| Disabled actions have no clear reason | P2 | Preserve permission/status gating and provide existing tooltip/reason patterns where safe | Disabled controls are explainable by permission or state |
| Excessive nested scrolling | P2 | Remove only redundant inner scroll containers where safe; no broad layout redesign | Tested pages remain usable without clipping or regressions |

## Mandatory screenshot-route retest set

The browser proof must cover all 21 routes specified by the patch, substituting
an existing real machine ID for the dynamic machine-detail route. Any other
route modified during implementation is added to the same runtime proof.

## Acceptance gate

Any remaining active-page crash, visible raw key, unexpected frontend-facing
404/500, or code-only browser claim keeps the release at `NOT_RELEASE_READY`.
