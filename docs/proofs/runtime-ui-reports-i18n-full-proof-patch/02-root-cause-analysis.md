# Root Cause Analysis

## Scope

This analysis was completed before application-code changes. It compares each failing page with the active controller DTO/service response and the shared i18n/runtime components.

## P0 runtime failures

### 1. Machine detail: `data.map is not a function`

- Route: `/admin/maintenance/machines/[id]`
- Failing table: the machine/spare-part links table in the `parts` tab.
- Frontend assumption: `api.get<any[]>('/maintenance/machine-spare-parts?...')` returns an array and is assigned directly to `machineSpareLinks`.
- Actual API contract: `MachineSparePartsService.findAll()` returns `{ data, meta }`.
- Failure path: the response object reaches shared `DataTable`, whose body calls `data.map(...)` without an array guard.
- Required correction:
  - normalize `res.data` at the page/API boundary;
  - preserve request failures as a visible page error/empty related-section state;
  - defensively derive `rows = Array.isArray(data) ? data : []` in shared `DataTable`.

### 2. Installed parts: `property page should not exist`

- Route: `/admin/installed-parts`
- Frontend sends `{ page, limit, search }` and expects `{ data, meta }`.
- `QueryInstalledPartDto` supports only relationship/status filters and `onlyActive`; it does not support `page`, `limit`, or `search`.
- The service deliberately returns a plain array, not a paginated envelope.
- Global `ValidationPipe` uses whitelist/forbid-non-whitelisted validation, so `page` fails before controller execution.
- Required correction: stop sending unsupported query fields, consume the array contract, and apply presentation-only search locally without changing global validation or the API response contract.

### 3. Repair orders: `property page should not exist`

- Route: `/admin/maintenance/repair-orders`
- Frontend sends `{ page, limit, search }` and expects `{ data, meta }`.
- `QueryRepairOrderDto` supports filters plus `limit`; it does not support `page` or `search`.
- `RepairOrdersService.findAll()` returns a plain array.
- Required correction: send only supported `limit`, consume the array response, and perform the current grid search locally.

### 4. BOM: `page must not be less than 1`

- Route: `/admin/maintenance/bom`
- The BOM endpoint is genuinely paginated and its DTO correctly enforces `@Min(1)`.
- The page forwards callback/meta page values directly to the API. Shared pagination derives the previous page as `page - 1`; no API-boundary normalization exists.
- A zero/invalid UI page therefore reaches the DTO instead of being converted to the API's one-based contract.
- Required correction: normalize every BOM request page to a finite integer of at least `1`, normalize returned metadata, and harden the shared previous-page callback against emitting `0`.

## P1 i18n failures

### 5. Raw `reports.*` and uppercase-looking `REPORTS.*`

- `ReportSummaryCards` builds `reports.${card.label}` and simultaneously passes the explicit `reports` namespace.
- With an explicit namespace, the provider expects a namespace-relative key. It therefore looks for `reports.reports.<label>` and returns the unresolved full key.
- The component also applies the CSS `uppercase` class, which visually turns the unresolved key into `REPORTS.*`; source scans found no code that uppercases translation keys.
- Several genuine report summary labels are also absent from EN/AR.
- Required correction: normalize API card labels to a namespace-relative key, translate with the explicit namespace once, remove uppercase styling from user-visible labels, and add missing report keys symmetrically.

### 6. Raw `maintenance.*` / `maintenanceDashboard.*`

- KPI cards create dynamic keys from API labels.
- Expressions such as `t(key) || fallback` do not provide a fallback because the provider returns the unresolved key, which is truthy.
- Some dynamic KPI labels are absent from one or both declared namespaces.
- Required correction: complete EN/AR keys and use centralized enum/label translation rather than truthy raw-key fallbacks.

### 7. Raw `navigation.*`

- The reports hub references `maintenanceReports`, `inventoryReports`, and `otherReports` plus report link labels that are not all defined in the active navigation locale object.
- Required correction: add the active report-group/link keys in both locales; do not mount any forbidden-module link.

### 8. Barcode raw keys

- Several pages reference root paths such as `barcodes.preview.*`, while related strings currently exist under other nested groups (for example label/template groups) or are missing.
- Other active pages reference missing search/design/empty-state keys.
- Required correction: align page calls with stable nested keys and add the required EN/AR entries.

### 9. Inventory raw keys

- Core inventory titles exist, but the screenshot routes also reference missing workflow/document action fields under `inventoryCounting`.
- Required correction: add the missing workflow/document labels in both locales and keep existing inventory namespace ownership.

### 10. Raw enum/status/action values

- Report and audit tables render API values directly or only call `.toLowerCase()`.
- Examples include audit actions, request type/priority/status, barcode purpose/entity/result, movement/status values, part condition, and source entity type.
- Lowercasing/capitalizing is formatting, not translation.
- Required correction: extend/reuse centralized translation helpers and use them in shared report cards and the active screenshot routes.

### 11. Units and currency

- Summary cards render `card.unit` directly.
- KPI pages contain literal `h`, while the requested `common.currency`/unit labels are incomplete.
- Required correction: translate known units through a shared helper, add EN/AR currency/unit keys, and leave unknown free-text values unchanged.

## P2 and related findings

- Summary-card label contrast is weakened by small gray uppercase text; unresolved keys made this worse.
- Some KPI zero values use `-` because nullish and zero handling is inconsistent.
- List/report pages inherit a system strip even when the fields are unavailable, producing visually empty values.
- Several disabled actions depend on permission/workflow state but do not always expose a visible reason.
- Corrections will be limited to safe shared label/zero/empty-state behavior on the active routes. No broad redesign is authorized.

## Safety decisions

- No schema or migration is required.
- No global API validation weakening is required.
- No forbidden module activation is required.
- The API contracts for installed parts and repair orders remain non-paginated; only their consumers are corrected.
- Runtime/browser proof must verify these conclusions against current restarted servers.
