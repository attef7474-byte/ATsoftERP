# Excel Import/Export — Master Data

**Scope (implemented):** Machines, Machine Components, Spare Parts, Products.
**PRISMA_SCHEMA_CHANGE:** NONE. **MIGRATION:** NONE. **PRODUCTION_DEPLOYMENT:** NOT_AUTHORIZED.
**Inventory/production side effects:** none by design (master-data only; isolated proof verified inventory/production sentinels unchanged).

## 1. Endpoints (actual)

Base path: `POST|GET /api/v1/master-data-excel/:entity/...` (global prefix `api`, URI version `1`). Guard: `JwtAuthGuard`. Entity path param: `machines | machine-components | spare-parts | products`.

| Method | Path | Purpose | Request | Response |
|---|---|---|---|---|
| GET | `/master-data-excel/:entity/template` | Download localized workbook template | Query: `locale=ar\|en` (default `ar`) | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` attachment `<entity>-template.xlsx` |
| GET | `/master-data-excel/:entity/export` | Export filtered current records | Query: `locale=ar\|en`, `search?` | XLSX attachment `<entity>-export.xlsx` |
| POST | `/master-data-excel/:entity/validate` | Parse + authoritative preview (no writes) | Multipart: `file` (XLSX), fields `mode` (`CREATE_ONLY\|UPDATE_EXISTING\|CREATE_AND_UPDATE`, default `CREATE_ONLY`), `locale?` | JSON preview: `{ token, expires, rows, warnings, summary, canImport, sharedCatalog }` |
| POST | `/master-data-excel/:entity/import` | Confirm import of a previously validated file | Multipart: `file`, fields `mode`, `token` (UUID preview token) | JSON `ExcelImportResult` summary |
| POST | `/master-data-excel/:entity/errors` | Download authoritative localized error workbook for current planning result | Multipart: `file`, fields `mode`, `locale?` | XLSX attachment `<entity>-errors.xlsx` |

Upload limits (controller): `fileSize 2MB`, `files 1`, `fields 4`, `parts 5`, `fieldSize 200`. Workbook/parse limits (`EXCEL_LIMITS`): 2 MB, 200 import rows, 5000 export rows, 32 columns, 4000 cell chars, 4 sheets, bounded zip inflation/entry checks.

## 2. Import modes, keys, and identity rules

- **Modes:** `CREATE_ONLY`, `UPDATE_EXISTING`, `CREATE_AND_UPDATE`.
- **Business keys (`keyHeaders`):**
  - `machines`: `Code`
  - `machine-components`: `MachineCode`, `Code` (composite)
  - `spare-parts`: `Code`
  - `products`: `Code`
- **Preview/commit safety:** validate returns a token bound to `user`, active operational context key (company/branch/admin/department/archive), entity, mode, file hash, and plan fingerprint; import re-parses and re-plans inside a `Serializable` transaction and rejects expired/busy/mismatched token, file/context change, stale fingerprint/data, or invalid/empty rows.
- **Duplicate handling:** duplicate business keys inside the file are marked `DUPLICATE_IN_FILE` and block import; existing conflicts / unavailable keys / unknown keys (per mode) produce errors; concurrent same-token import guarded (`busy`/result reuse, HTTP simultaneous same-token proof wrote once with `201,409`).
- **Canonical identity (shared catalogs):** spare parts/products reuse existing canonical identity policies (`evaluateSparePartCanonicalIdentity`, `evaluateProductCanonicalIdentity`) to prevent conflicts (e.g. part number/manufacturer/product linkage, barcode/code collisions) — never fuzzy name matching.
- **Blank semantics:** optional blank cells preserve existing values on update (no clear). `__CLEAR__` is rejected. Read-only/non-importable columns are ignored for mutation; immutable columns cannot be changed on update.
- **Hierarchy (machine components):** parent resolved within same machine by `ParentComponentCode`; same-file later parent rows supported via planning/order; self-reference/cycle/invalid parent denied.
- **References:** resolved by business codes (not raw DB IDs). Tenant-owned references scoped to current company/branch context (and company-wide where applicable, e.g. machine scope allows branch-null per existing rules). Global/historical inactive reference reuse is only allowed for specific unchanged cases per planner rules; tenant-owned references and re-pointing are not silently relaxed. Ambiguous/unavailable/inactive/cross-tenant references denied.

## 3. Entity column matrices (Data sheet, exact headers)

Headers are the exact `Code`/column headers below. Types: `text` unless noted; enum values as listed; `date` = `YYYY-MM-DD`; booleans `true|false`; nonnegative numbers. `required: identity` = key (required), immutable on update for identity semantics where defined; `required: create` = required on create; others optional (blank preserves). `update` indicates allowed to change on update when importable.

### 3.1 Machines (`machines`, permission base `machine`, tenant-scoped)
| Header | Field | Required | Update | Type/Ref | Notes |
|---|---|---|---|---|---|
| Code | code | identity | no | text | business key |
| Name | name | create | yes | text | |
| CategoryCode | categoryId | optional | yes | ref `machineCategory` | active category code |
| DepartmentCode | departmentId | optional | yes | ref `department` | tenant-scoped |
| ProductionLineCode | productionLineId | optional | yes | ref `productionLine` | tenant-scoped; must be compatible with department/admin/company/branch context |
| OperationTypeCode | operationTypeId | optional | yes | ref `operationType` | |
| Manufacturer | manufacturer | optional | yes | text | |
| Model | model | optional | yes | text | |
| SerialNumber | serialNumber | optional | yes | text | |
| PurchaseDate | purchaseDate | optional | yes | date | |
| WarrantyEnd | warrantyEnd | optional | yes | date | |
| Location | location | optional | yes | text | |
| Notes | notes | optional | yes | text | |
| CostCenterName | costCenterName | optional | no (immutable on update path) | text | used for dedicated cost center on create; exported from default cost center |
| CostCenterType | costCenterType | create | no | enum `PRODUCTION,MAINTENANCE,PROJECT,DEVELOPMENT,QUALITY,UTILITIES,ADMIN,OTHER` | dedicated cost center type on create |

### 3.2 Machine Components (`machine-components`, permission base `machine-component`, tenant-scoped via machine)
| Header | Field | Required | Update | Type/Ref | Notes |
|---|---|---|---|---|---|
| MachineCode | machineId | identity | no | ref `machine` | tenant-scoped machine |
| Code | code | identity | no | text | component code within machine |
| Name | name | create | yes | text | |
| ParentComponentCode | parentComponentId | optional | yes | ref `parentComponent` (same machine) | hierarchy; cycle/self/invalid denied |
| ComponentType | componentType | create | yes | enum `MECHANICAL,ELECTRICAL,CONTROL,PNEUMATIC,HYDRAULIC,HEATING,COOLING,SENSOR,SAFETY,CONVEYOR,FRAME,UTILITY,OTHER` | |
| Criticality | criticality | optional | yes | enum `LOW,MEDIUM,HIGH,CRITICAL` | |
| Description | description | optional | yes | text | |
| LocationInMachine | locationInMachine | optional | yes | text | |
| Manufacturer | manufacturer | optional | yes | text | |
| Model | model | optional | yes | text | |
| SerialNumber | serialNumber | optional | yes | text | |

### 3.3 Spare Parts (`spare-parts`, permission base `spare-part`, **shared catalog**)
| Header | Field | Required | Update | Type/Ref | Notes |
|---|---|---|---|---|---|
| Code | code | identity | no | text | key |
| Name | name | create | yes | text | |
| Description | description | optional | yes | text | |
| Category | category | optional | yes | text | |
| Specification | specification | optional | yes | text | |
| UnitCode | unitId | optional | no | ref `unit` (active) | resolved to unit |
| UnitLabel | unit | optional | no | text (export/read-only, not importable) | display/export |
| Manufacturer | manufacturer | optional | yes | text | |
| Model | model | optional | yes | text | |
| PartNumber | partNumber | optional | yes | text | canonical identity input |
| Barcode | barcode | optional | yes | text | |
| ProductCode | productId | optional | yes | ref `product` | canonical/link conflict checked |
| MinRecommendedStock | minRecommendedStock | optional | yes | number | master field only; no stock movement/balance change |
| MaxRecommendedStock | maxRecommendedStock | optional | yes | number | |
| ReorderPoint | reorderPoint | optional | yes | number | |
| IsCritical | isCritical | optional | yes | boolean | |
| TechnicalClassification | technicalClassification | optional | yes | text | |
| UsageType | usageType | optional | yes | text | |
| Nature | nature | optional | yes | text | |
| Importance | importance | optional | yes | text | |

### 3.4 Products (`products`, permission base `products`, **shared catalog**)
| Header | Field | Required | Update | Type/Ref | Notes |
|---|---|---|---|---|---|
| Code | code | identity | no | text | key |
| Name | name | create | yes | text | |
| Description | description | optional | yes | text | |
| CategoryCode | categoryId | optional | yes | ref `productCategory` | |
| UnitCode | unitId | create | no | ref `unit` (active) | required on create |
| UnitLabel | unit | optional | no | text (export/read-only, not importable) | |
| Barcode | barcode | optional | yes | text | canonical identity input |
| MinStock | minStock | optional | yes | number | master field only; no stock movement/balance change |
| MaxStock | maxStock | optional | yes | number | |

## 4. Workbook structure and safety

- Sheets: `Data` (first, required), `Instructions` (metadata/scope/policy/column guide), `Errors` (only in error workbook). Max 4 sheets total on parse.
- Data export columns are text-safe/typed; string cells written as explicit text (formula-injection safe for leading `=,+,-,@`); date/number/boolean typed as appropriate. Exported workbooks contain no formula cells (proof). No raw/internal DB ID headers in Data sheets.
- Error workbook includes required columns `OriginalRowNumber, Status, ErrorColumn, ErrorCode, ErrorMessage` plus original business fields; localized messages; no stack traces/secrets (proof).
- Parser/zip protections: XLSX type/size checks, bounded zip inspection/inflation, prohibited content checks (e.g. VBA/external links/active content patterns guarded), header validation, row/column/cell limits, formula cells rejected in data values.

## 5. Authorization, audit, scope

- Permission checks per entity base: template/export/validate/errors require `read`; import additionally requires `create` and/or `update` depending on mode (`CREATE_ONLY`→create, `UPDATE_EXISTING`→update, `CREATE_AND_UPDATE`→both). Frontend hides/disables actions based on permissions and archived context.
- Active operational context required (company/branch); archived context blocks import. Shared catalogs (`products`, `spare-parts`) are clearly indicated in UI/workbook instructions but still require authorized context and audited writes.
- Transactional audit: import writes `EXCEL_IMPORT` audit record (entity/model, token as entityId, company/branch, shared flag, mode, file hash, summary) within the same Serializable transaction as data changes.
- No raw DB IDs exposed in preview/template/export/error Data headers (proof). No inventory movements/balances or production tables modified (proof).

## 6. Frontend integration

- Shared component: `apps/web/src/components/admin/excel-master-data-actions.tsx` (template/export, import modal with mode selection per permissions, validate/preview, confirmation gate, error workbook download, busy/abort/context-reset handling, shared-catalog notice).
- Integrated into admin pages/workspaces: machines, machine components, spare parts, products (inventory products workspace with `excelEnabled`).
- i18n keys added under `common.excel.*` and `validation.excel*` in `apps/web/src/lib/i18n/locales/{en,ar}/{common,validation}.ts` and API messages in `apps/api/src/common/i18n/api-messages.ts`.

## 7. Proof and validation evidence (2026-11-17)

- Isolated DB: `ATsoftERP_EXCEL_20261117000316` (non-production clone). Proof artifacts under `.tmp/excel-master-data-20261117/` (`runtime-proof.json` 23 PASS, `runtime-proof-supplement.json` 8 PASS, generated templates/exports/error workbook).
- Focused tests: API Excel 3 suites/56 tests PASS; Web Excel 1 suite/8 tests PASS.
- Fresh gates: `route-contract:check` MATCHED=1169 MISMATCHES=0; `i18n:check` 7103/7103; `raw-keys:check` PASS; `credentials:check` PASS; `ui-baseline:check` 99 PASS (incl. permission UI); API `tsc --noEmit` PASS; Web `tsc --noEmit` PASS; `build:web` PASS; `git diff --check` clean; U+FFFD only in pre-existing unrelated files.
- Full regression suites (fresh after multipart fix): **API PASS** 222 suites / 4791 tests; **Web PASS** 124 suites / 2330 tests (exit 0). Logs: `.tmp/excel-master-data-20261117/api-full-fresh.log`, `.tmp/excel-master-data-20261117/web-full-fresh.log`. Details in `docs/proofs/excel-import-export-master-data-2026-11-17.md`.
- Details and per-sentinel results: `docs/proofs/excel-import-export-master-data-2026-11-17.md`.
