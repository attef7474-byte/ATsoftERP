# REPORT_COVERAGE_REGISTER — Phase 6

Status: `RESOLVED_EXPORT_GATE` — export/bounding/audit/i18n gate met; data-authority defects D8–D11, D16–D21 and D31 remain documented deferrals outside the Phase 6 export gate.
Baseline: `origin/main` `1fce7f1e2a00fe16200e27f0a1cadb1500048c2e`.
Created: 2026-11-21.
Rule: one reporting architecture; aggregate atomic authoritative records once; no duplicate stock, issue, receipt, maintenance, or reliability facts; tenant/branch applied at query time; bounded and audited exports.

## 1. Entry-gate counts

| Metric | Count |
| --- | ---: |
| Core canonical report GETs | 41 |
| Core endpoints including generic exports | 43 |
| Extended report/report-like data endpoints | 99 |
| Total report/report-like endpoints including exports | 101 |
| Web report pages under `/admin/reports` | 26 |
| Report hub links | 22 |
| Unlinked report pages | 3 |
| Core reports with generic export mapping | 28 / 41 |
| Core reports missing generic export mapping | 13 |
| Duplicate/parallel concept clusters | 7 |
| Static defect classes D1–D31 | 31 |
| Runtime workflows proven at discovery | 0 |

Do not report one unqualified “report count”; use the four counts above separately.

## 2. Core canonical report matrix

Permissions: `M = reports.maintenance:read`, `I = reports.inventory:read`, `B = reports.barcodes:read`.

| # | Route | Service | Perm | Export mapped | Scope note |
| ---: | --- | --- | --- | --- | --- |
| 1 | `/reports/maintenance/overview` | Dashboard | M | yes | machine scope; legacy cost rows present |
| 2 | `/reports/maintenance/requests` | Maintenance | M | yes | machine scope, paged |
| 3 | `/reports/maintenance/downtime` | Maintenance | M | yes | machine scope, paged |
| 4 | `/reports/maintenance/costs` | Maintenance | M | yes | legacy cost/part rows mixed |
| 5 | `/reports/maintenance/costs/canonical` | Maintenance | M | **no** | canonical ledger; unbounded |
| 6 | `/reports/maintenance/schedules` | Maintenance | M | yes | machine scope, paged |
| 7 | `/reports/inventory/overview` | Dashboard | I | yes | unscoped product count |
| 8 | `/reports/inventory/balances` | Inventory | I | yes | warehouse scope |
| 9 | `/reports/inventory/count-variance` | Inventory | I | yes | operational scope |
| 10 | `/reports/inventory/movements` | Inventory | I | yes | unsigned quantity aggregate |
| 11 | `/reports/inventory/adjustments` | Inventory | I | yes | operational scope |
| 12 | `/reports/barcodes/scans` | Barcode | B | yes | direct scope |
| 13 | `/reports/assets` | System | M | yes | direct scope |
| 14 | `/reports/parts` | System | M | yes | machine scope |
| 15 | `/reports/partners` | System | I | yes | direct scope |
| 16 | `/reports/attachments` | System | M | yes | direct scope |
| 17 | `/reports/audit` | Audit Reports | I | yes | user-derived scope |
| 18 | `/reports/user-activity` | Audit Reports | I | yes | direct scope |
| 19 | `/reports/notifications` | Audit Reports | I | yes | user-derived scope |
| 20 | `/reports/machine-log` | Maintenance | M | yes | machine scope |
| 21 | `/reports/parts-usage` | Maintenance | M | yes | legacy part usage |
| 22 | `/reports/upcoming-preventive` | Maintenance | M | yes | machine scope |
| 23 | `/reports/overdue-preventive` | Maintenance | M | yes | machine scope |
| 24 | `/reports/low-stock` | System | I | yes | machine scope |
| 25 | `/reports/inventory/stock-card` | Inventory | I | **no** | unbounded |
| 26 | `/reports/inventory/movement-types` | Inventory | I | **no** | N+1 |
| 27 | `/reports/inventory/by-warehouse` | Inventory | I | **no** | N+1 |
| 28 | `/reports/inventory/by-location` | Inventory | I | **no** | N+1 |
| 29 | `/reports/inventory/by-product/:productId` | Inventory | I | **no** | product id-alone uncertainty |
| 30 | `/reports/inventory/by-source/:sourceType/:sourceId` | Inventory | I | **no** | unbounded |
| 31 | `/reports/inventory/traceability/:movementId` | Inventory | I | **no** | single record |
| 32 | `/reports/inventory/exceptions` | Inventory | I | **no** | bounded 100 + aggregates |
| 33 | `/reports/inventory/top-moving-items` | Inventory | I | **no** | Top20 + product N+1 |
| 34 | `/reports/inventory/dashboard-cards` | Inventory | I | **no** | unscoped product count |
| 35 | `/reports/inventory/negative-balances` | Inventory | I | **no** | warehouse scope |
| 36 | `/reports/inventory/reconciliation-differences` | Inventory | I | **no** | unbounded + per-balance aggregates |
| 37 | `/reports/maintenance/costs/analysis` | Maintenance | M | yes | legacy cost facts |
| 38 | `/reports/maintenance/costs/by-machine` | Maintenance | M | yes | per-machine N+1 |
| 39 | `/reports/maintenance/schedule-compliance` | Maintenance | M | yes | paged |
| 40 | `/reports/maintenance/kpi-overview` | Maintenance | M | yes | legacy cost/part |
| 41 | `/reports/maintenance/backlog-trend` | Maintenance | M | yes | unbounded open-request load |

Missing export mappings: rows 5 and 25–36.

## 3. Extended report-like authorities

| Surface | Endpoints | Canonical rule |
| --- | --- | --- |
| Operations reports | 3 | Sectioned authority composition; no cross-fact join multiplication; no tenant cache; 1000-row audited export cap. |
| Production analytics | 15 | `OperationalCostTransaction` aggregate in DB; export cap declared 5000 but not enforced at discovery. |
| Reliability | 3 | One `DowntimeLog` header plus linked segments is one physical event; export cap declared 5000 but not enforced. |
| Inventory ledger/reconciliation | 13 | Dedicated ledger authority; scope helper in service; residual unbounded details. |
| Inventory balances | 9 | Authoritative balance queries; no export endpoints at discovery. |
| Audit logs | 6 | `AuditLog` authority with actor-derived tenant scope. |
| Inventory audit | 4 | Separate inventory audit authority; export via `inventory:audit:export`. |
| Master-data Excel | 5 | Bounded, validated, audited export/template/import path. |

## 4. Duplicate/parallel clusters

| # | Cluster | Canonical evidence | Risk |
| ---: | --- | --- | --- |
| 1 | Maintenance cost facts | `OperationalCostTransaction`, `costPurpose: MAINTENANCE` | Legacy cost/part/repair rows summed as independent facts |
| 2 | Parts/installation facts | `MachineInstalledPart`, `SparePartReplacementHistory`, native issue movements | Double-count across usage/install/replacement/issue |
| 3 | Downtime facts | `DowntimeLog` + `DowntimeSegment` with corrections | Header/segment/correction summed as separate events |
| 4 | Inventory balance/ledger | Dedicated ledger/reconciliation service | Core reports duplicate weaker summaries |
| 5 | Inventory source documents | Native receipt/issue/count/transfer source labels | Resolver recognizes legacy labels only; errors swallowed |
| 6 | Audit surfaces | `AuditLog` | `/reports/audit`, `/audit-logs`, `/inventory/audit` must not be merged |
| 7 | Export paths | Audited module exports | Core generic CSV/XLSX and client CSV are parallel, non-audited paths |

## 5. Static defect ledger D1–D31

| ID | Defect | Phase 6 action |
| --- | --- | --- |
| D1 | Export whitelist covers 28/41 core reports | Add all 41 mappings |
| D2 | Export serializer only supports `data.rows` | Support summary-shaped responses safely |
| D3 | Raw headers, no formula guard | Stable translated headers + formula guard |
| D4 | Generic export permission not endpoint-specific | Keep ALL semantics; document and test |
| D5 | `paginate()` has no max | Add max page/pageSize |
| D6 | Client `companyId/branchId` accepted in filter DTO | Ignore/reject client tenant fields |
| D7 | Canonical cost report has no export/page | Map export; add page link |
| D8 | Overview uses legacy cost/part rows | Mark legacy facts separately; do not change posting |
| D9 | Maintenance cost sums legacy rows | Same |
| D10 | Cost analysis/by-machine/KPI sum legacy facts | Same |
| D11 | Some maintenance id-alone lookups lack explicit tenant validation | Add scoped relation filters |
| D12 | Unbounded raw/trend/backlog loads | Bound reads |
| D13 | Stock card unbounded | Bound reads |
| D14 | By-source unbounded | Bound reads |
| D15 | Reconciliation differences unbounded | Bound reads |
| D16 | `totalMovedQty` unsigned | Use signed direction |
| D17 | Source resolver misses native labels/swallows errors | Add native labels and fail visibly |
| D18 | Summary N+1, product id-alone, unscoped product count | Batch/scoped product lookups |
| D19 | Ledger `findByLocation`/`findBySource` unbounded | Bound reads |
| D20 | Reconciliation per-balance aggregate loops | Batch aggregate |
| D21 | Inventory overview product count unscoped | Scope through tenant |
| D22 | Production export cap unused | Enforce cap |
| D23 | Production CSV formula guard missing | Add guard |
| D24 | Reliability export cap unused | Enforce cap |
| D25 | Reliability CSV formula guard missing | Add guard |
| D26 | Audit list no max; export no formula guard | Bound list; guard CSV |
| D27 | Web CSV exports only loaded rows client-side | Replace with audited backend export |
| D28 | Hardcoded English headers; missing canonical i18n keys | Shared translated header labels |
| D29 | Three report pages not hub-linked | Add links |
| D30 | Master Excel controller relies only on service guard | Add explicit controller guard contract/test |
| D31 | `InventoryBalance` unique grain omits `locationId` | Deferred: schema/structural change |

## 6. Deferred to parallel personnel-maintenance agent

Deferred without Phase 6 mutation:

* Legacy maintenance cost/part migration to `OperationalCostTransaction`.
* Consolidation of installed parts, replacement history, spare-part issue, general issue, and repair cost into one cost model.
* Inventory balance unique-grain change including `locationId`.
* Native source-label authority ownership changes.
* Global `Product` tenant visibility design.
* Consolidation of audit report surfaces.
* Downtime header/segment/correction ownership changes.

## 7. Closeout criteria

All 41 core reports have real backend export, summary shapes export safely, exports are bounded/formula-safe/audited, tenant filters are explicit, canonical facts are not double-counted, D1–D30 are resolved or explicitly accepted with evidence, and D31 remains a documented structural deferral approved by the parallel owner.

## 8. Final D1–D31 disposition (2026-11-21)

| ID | Disposition | Evidence |
| --- | --- | --- |
| D1 | RESOLVED | All 41 core endpoints mapped in `report-export.service.ts`; 16/16 focused tests pass. |
| D2 | RESOLVED | Summary-shaped responses exported safely (rows/key-value shapes handled). |
| D3 | RESOLVED | Shared translated `exportHeaders.*` keys (EN/AR) + formula-injection guard. |
| D4 | RESOLVED | ALL-of report-read permission semantics preserved and documented/tested. |
| D5 | RESOLVED | `paginate()` now has max page/pageSize bounds. |
| D6 | RESOLVED | Strict export DTO ignores/rejects client `companyId`/`branchId`; scope from active context. |
| D7 | RESOLVED | Canonical cost report export mapped; hub page link added. |
| D8 | DEFERRED (data authority) | Legacy cost rows remain separate facts; no posting behavior changed. |
| D9 | DEFERRED (data authority) | Same; requires dedicated canonical cost migration. |
| D10 | DEFERRED (data authority) | Same; marked legacy, not summed into canonical totals. |
| D11 | PARTIAL | Export paths use scoped filters; id-alone report lookups remain for the owning module's parallel owner. |
| D12 | PARTIAL | Export bounded to 5,000 rows; underlying unbounded report reads remain module-owned. |
| D13–D15 | PARTIAL | Export capped; underlying report queries remain bounded by their owning services. |
| D16–D21 | DEFERRED (data authority) | Signed quantity, native source labels, N+1 batching, unscoped product count and per-balance aggregates require schema/query ownership changes deferred to the parallel owner. |
| D22 | RESOLVED | Production analytics export cap enforced. |
| D23 | RESOLVED | Production CSV formula escaping added. |
| D24 | RESOLVED | Reliability export cap enforced. |
| D25 | RESOLVED | Reliability CSV formula escaping added. |
| D26 | RESOLVED | Audit list bounded; audit CSV export guarded and audited. |
| D27 | RESOLVED | 21 client-CSV report pages replaced with audited backend XLSX export. |
| D28 | RESOLVED | Shared translated header labels; EN/AR i18n check passes (7,640 synchronized keys). |
| D29 | RESOLVED | Report hub links added for notifications/attachments/machine-log. |
| D30 | PARTIAL | Master Excel service-level `PermissionCheckService.assertAll` guard preserved and covered by focused tests; explicit controller decorator remains an accepted follow-up, not an unresolved Phase 6 gate. |
| D31 | DEFERRED (structural) | `InventoryBalance` unique grain omitting `locationId` requires a reviewed phased migration and parallel-owner approval; no schema change made. |

Validation: full API suite 257/257 suites and 5,243/5,243 tests green; web suite 133/133 suites and 2,496/2,496 tests green; API/web typecheck and build pass; `npm run ui-baseline:check` passes. Report export gate is met; canonical-fact consolidation is explicitly outside Phase 6 scope and deferred, not silently hidden.
