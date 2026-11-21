# EXCEL_COVERAGE_REGISTER — Phase 6

Status: `RESOLVED` — the `unresolved eligible Excel pages = 0` hard gate is MET.
Baseline: `origin/main` `1fce7f1e2a00fe16200e27f0a1cadb1500048c2e`.
Created: 2026-11-21. Final reconciliation: 2026-11-21.
Rule: one Excel infrastructure; many domain adapters; no duplicate stock, issue, receipt, or maintenance data; no fake import buttons.

## 1. Eligibility policy

| Class | Meaning | Allowed Excel behavior |
| --- | --- | --- |
| M | Master data / registry / configuration | Real XLSX import and export through domain services, tenant/branch scoped. |
| D | DRAFT-capable transaction | Export always real; import only when business-valid and routed through the owning domain service. Never import posted state. |
| P | Posted transaction, report, audit, approval, alert, monitoring | Export only. Never import. |
| N | Utility, dashboard, redirect, analysis-only, or no owned dataset | Not eligible. |
| X | Parallel personnel-maintenance owned | Deferred; excluded from Phase 6 gate. |

## 2. Final gate (honest reconciliation)

| Metric | Count |
| --- | ---: |
| Candidate pages inspected | 122 |
| Eligible pages (M+D+P) | 103 |
| Master-data eligible (M) | 38 |
| DRAFT-capable eligible (D) | 22 (includes row 60 production analytics) |
| Export-only eligible (P) | 43 |
| Not eligible (N) | 17 |
| Deferred parallel-owned (X) | 2 |
| Pages with real XLSX UI/API at discovery | 4 |
| Pages with real XLSX UI/API after Phase 6 | 103 |
| Report pages newly wired to audited backend XLSX export | 25 (21 pre-existing + 4 Phase 6) |
| Fake Excel import buttons | 0 |
| **Unresolved eligible Excel pages** | **0** |

Resolution of the 78 formerly-unresolved pages:

| Category | Rows | Count | Resolution |
| --- | ---: | ---: | --- |
| Master-data M | 1–13, 16–18, 20–24, 26–38 | 34 | Audited tenant-scoped XLSX export via real Prisma-backed domain adapter; import intentionally disabled (identity/settings/catalogue authority stays in the owning domain). |
| DRAFT D | 39–60 | 22 | Audited read-only XLSX export through each owning domain model; no generic importer and no POSTED/ISSUED state mutation from Excel. |
| Export-only P — operational/audit/notification | 61–73, 99–103 | 18 | Audited XLSX export with actor-aware tenant/relation scoping; secrets and binary bodies excluded. |
| Export-only P — unwired reports | 74, 75, 76, 88 | 4 | Wired to canonical audited backend XLSX endpoints (operations overview, maintenance overview, maintenance KPIs, inventory overview). |
| **Total** | | **78** | 34 + 22 + 18 + 4 = 78; all unresolved to zero. |

### 2.1 Deterministic reconciliation method

The count above is produced by parsing every row of §3 and grouping by `Class` and `Status`. Reconciliation result (2026-11-21):

```
TOTAL ROWS: 105
BY CLASS: {"M":38,"D":22,"P":43,"X":2}
BY STATUS: {"EXPORT_ONLY_COMPLETE":78,"COVERED":25,"DEFERRED_TO_PARALLEL_PERSONNEL_MAINTENANCE_AGENT":2}
BY CLASS:STATUS: {"M:EXPORT_ONLY_COMPLETE":34,"M:COVERED":4,"D:EXPORT_ONLY_COMPLETE":22,"P:EXPORT_ONLY_COMPLETE":22,"P:COVERED":21,"X:DEFERRED":2}
DUPLICATE ROUTES: []
NOT_APPLICABLE ROWS: []
ELIGIBLE ROWS (M+D+P): 103
UNRESOLVED ELIGIBLE (GAP): 0
```

There are no duplicate routes, aliases, legacy-route duplicates or overlapping classifications. Rows 104–105 are parallel-agent deferrals and are not counted as eligible. The earlier `65` summary figure was an arithmetic error in the closeout prose (it undercounted P-class operational gaps as 5 instead of 18 and omitted the 4 unwired report rows from that category); the row-level total of `78` is authoritative; Phase 6 drove every eligible GAP row to a real audited export path, so the deterministic gate now reports zero.

Real XLSX after Phase 6: the four original master-data pages (`/admin/maintenance/machines`, `/admin/maintenance/machine-components`, `/admin/maintenance/spare-parts`, `/admin/inventory/products`) through `apps/web/src/components/admin/excel-master-data-actions.tsx`, 74 route-driven read-only adapters in `apps/api/src/modules/factory/master-data-excel/governance-export.definitions.ts` exposed by `apps/web/src/components/admin/excel-governance-export-action.tsx`, 25 report pages wired to `ReportExportButton.reportEndpoint`, and a dedicated audited production-analytics XLSX endpoint. All exports are tenant-scoped, bounded to 5,000 rows, formula-safe and audited as `EXCEL_EXPORT`/`EXPORT`.

## 3. Complete eligible-page register

Status values: `COVERED` (pre-existing real XLSX), `EXPORT_ONLY_COMPLETE` (real audited tenant-scoped XLSX export; no import by design), `DEFERRED_TO_PARALLEL_PERSONNEL_MAINTENANCE_AGENT`.

| # | Route | Class | Current XLSX | Status | Required resolution |
| ---: | --- | --- | --- | --- | --- |
| 1 | `/admin/core/companies` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 2 | `/admin/core/branches` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 3 | `/admin/core/administrations` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 4 | `/admin/core/departments` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 5 | `/admin/core/persons` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 6 | `/admin/core/job-titles` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 7 | `/admin/core/person-assignments` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 8 | `/admin/core/supervisor-assignments` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 9 | `/admin/maintenance/production-lines` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 10 | `/admin/maintenance/machine-categories` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 11 | `/admin/maintenance/cost-centers` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 12 | `/admin/access/roles` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 13 | `/admin/access/permissions` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 14 | `/admin/maintenance/machines` | M | real | COVERED | Preserve |
| 15 | `/admin/maintenance/machine-components` | M | real | COVERED | Preserve |
| 16 | `/admin/maintenance/machine-documents` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 17 | `/admin/maintenance/checklist-items` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 18 | `/admin/maintenance/machine-responsibilities` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 19 | `/admin/maintenance/spare-parts` | M | real | COVERED | Preserve |
| 20 | `/admin/spare-part-conditions` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 21 | `/admin/maintenance/bom` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 22 | `/admin/inventory/warehouses` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 23 | `/admin/inventory/locations` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 24 | `/admin/inventory/product-categories` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 25 | `/admin/inventory/products` | M | real | COVERED | Preserve |
| 26 | `/admin/inventory/units` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 27 | `/admin/barcodes/records` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 28 | `/admin/barcodes/templates` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 29 | `/admin/barcodes/product-labels` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 30 | `/admin/barcodes/machine-cards` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 31 | `/admin/documents/attachments` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 32 | `/admin/settings` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 33 | `/admin/settings/company` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 34 | `/admin/settings/language` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 35 | `/admin/settings/appearance` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 36 | `/admin/settings/notification-rules` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 37 | `/admin/settings/security` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 38 | `/admin/access/users` | M | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 39 | `/admin/maintenance/requests` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 40 | `/admin/maintenance/work-orders` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 41 | `/admin/maintenance/spare-part-issues` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 42 | `/admin/maintenance/repair-orders` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 43 | `/admin/maintenance/spare-part-plans` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 44 | `/admin/inventory/opening-balances` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 45 | `/admin/inventory/movements` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 46 | `/admin/inventory/issues` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 47 | `/admin/inventory/receipts` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 48 | `/admin/inventory/counts` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 49 | `/admin/inventory/adjustments` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 50 | `/admin/inventory/stock-adjustments` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 51 | `/admin/inventory/valuation` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 52 | `/admin/inventory/transfers` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 53 | `/admin/production/product-definitions` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 54 | `/admin/production/shifts` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 55 | `/admin/production/orders` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 56 | `/admin/production/material-documents` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 57 | `/admin/production/downtime` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 58 | `/admin/production/quality/plans` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 59 | `/admin/production/cost/rates` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 60 | `/admin/production/analytics` | D | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 61 | `/admin/maintenance/tasks` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 62 | `/admin/maintenance/schedules` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 63 | `/admin/maintenance/downtime-logs` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 64 | `/admin/installed-parts` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 65 | `/admin/maintenance/repair-orders/queue` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 66 | `/admin/inventory/approvals` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 67 | `/admin/inventory/balances` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 68 | `/admin/inventory/ledger` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 69 | `/admin/inventory/reconciliation` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 70 | `/admin/inventory/governance-audit` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 71 | `/admin/production/monitoring` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 72 | `/admin/barcodes/scans` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 73 | `/admin/barcodes/print-jobs` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 74 | `/admin/reports/operations` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Canonical audited backend XLSX export wired to UI |
| 75 | `/admin/reports/maintenance` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Canonical audited backend XLSX export wired to UI |
| 76 | `/admin/reports/maintenance/kpis` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Canonical audited backend XLSX export wired to UI |
| 77 | `/admin/reports/maintenance/requests` | P | audited XLSX | COVERED | Preserve |
| 78 | `/admin/reports/maintenance/downtime` | P | audited XLSX | COVERED | Preserve |
| 79 | `/admin/reports/maintenance/costs` | P | audited XLSX | COVERED | Preserve |
| 80 | `/admin/reports/maintenance/schedules` | P | audited XLSX | COVERED | Preserve |
| 81 | `/admin/reports/assets` | P | audited XLSX | COVERED | Preserve |
| 82 | `/admin/reports/machine-log` | P | audited XLSX | COVERED | Preserve |
| 83 | `/admin/reports/parts-usage` | P | audited XLSX | COVERED | Preserve |
| 84 | `/admin/reports/upcoming-preventive` | P | audited XLSX | COVERED | Preserve |
| 85 | `/admin/reports/overdue-preventive` | P | audited XLSX | COVERED | Preserve |
| 86 | `/admin/reports/parts` | P | audited XLSX | COVERED | Preserve |
| 87 | `/admin/reports/low-stock` | P | audited XLSX | COVERED | Preserve |
| 88 | `/admin/reports/inventory` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Canonical audited backend XLSX export wired to UI |
| 89 | `/admin/reports/inventory/balances` | P | audited XLSX | COVERED | Preserve |
| 90 | `/admin/reports/inventory/movements` | P | audited XLSX | COVERED | Preserve |
| 91 | `/admin/reports/inventory/adjustments` | P | audited XLSX | COVERED | Preserve |
| 92 | `/admin/reports/inventory/count-variance` | P | audited XLSX | COVERED | Preserve |
| 93 | `/admin/reports/barcodes/scans` | P | audited XLSX | COVERED | Preserve |
| 94 | `/admin/reports/audit` | P | audited XLSX | COVERED | Preserve |
| 95 | `/admin/reports/user-activity` | P | audited XLSX | COVERED | Preserve |
| 96 | `/admin/reports/notifications` | P | audited XLSX | COVERED | Preserve |
| 97 | `/admin/reports/attachments` | P | audited XLSX | COVERED | Preserve |
| 98 | `/admin/reports/partners` | P | audited XLSX | COVERED | Preserve |
| 99 | `/admin/settings/audit` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 100 | `/admin/settings/audit/user-activity` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 101 | `/admin/settings/audit/login-history` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 102 | `/admin/notifications` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 103 | `/admin/alerts` | P | audited XLSX | EXPORT_ONLY_COMPLETE | Audited tenant-scoped XLSX export via domain adapter; import intentionally disabled |
| 104 | `/admin/maintenance/personnel` | X | none | DEFERRED_TO_PARALLEL_PERSONNEL_MAINTENANCE_AGENT | No Phase 6 mutation |
| 105 | `/admin/maintenance/personnel/[id]` | X | none | DEFERRED_TO_PARALLEL_PERSONNEL_MAINTENANCE_AGENT | No Phase 6 mutation |

Rows 1–103 are the gate population; rows 104–105 are explicit deferrals and are not counted as eligible. The extra non-sidebar DRAFT page `/admin/inventory/transfers` is included at row 52.

## 4. Infrastructure delivered and reused

* `apps/api/src/common/excel/*` — bounded parser, formula rejection, workbook builder, ZIP safety (pre-existing, preserved).
* `apps/api/src/modules/factory/master-data-excel/*` — validated preview sessions, domain-service import, transactional audit (pre-existing, preserved).
* `apps/web/src/components/admin/excel-master-data-actions.tsx` — template/export/validate/import pattern (pre-existing, preserved).
* `apps/api/src/modules/reports/services/report-export.service.ts` — 43-endpoint audited XLSX/CSV export with 5,000-row cap, formula guard, strict DTO, summary-shape support (Phase 6).
* `apps/web/src/components/reports/ReportExportButton.tsx` — real backend XLSX export wired into 25 report pages (Phase 6).
* `apps/api/src/modules/factory/master-data-excel/governance-export.definitions.ts` — 74 real Prisma-backed, permission-checked, tenant-scoped export-only adapters (Phase 6).
* `apps/web/src/components/admin/excel-governance-export-action.tsx` + `apps/web/src/lib/excel-governance-routes.json` — shared route-driven audited XLSX action with exact backend permission parity (Phase 6).

## 5. Why the resolution is audited export-only

The existing master-data Excel planner is intentionally domain-specific: it resolves canonical identity, tenant/branch scope, per-model includes, reference resolution and business validation per entity (`excel-plan.ts`, `excel.definitions.ts`). A generic "call create()" importer would violate the non-negotiable reality rule (no fake import, business-valid DRAFT only, never import posted state), so import was deliberately not added for these 74 surfaces. Instead each page is backed by a real Prisma model, a real seeded read permission, a tenant/relation scope, a 5,000-row cap, formula-safe string cells and an `EXCEL_EXPORT` audit event. Transactional, approval, inventory, production and maintenance state transitions remain exclusively owned by their canonical domain services; Excel never controls companyId, branchId, actors or status beyond DRAFT.

## 6. Known non-gate observations

* `GET /reports/export/excel/*endpoint` now has real frontend callers on 25 report pages, plus dedicated audited XLSX endpoints for operations overview and production analytics.
* Generic report export now uses a typed DTO with an allowlisted filter whitelist.
* Master-data Excel preview sessions are process-local; multi-instance behavior is `NOT_VERIFIED`.
* `docs/features/excel-import-export.md` is stale for machine-component keys and product `ItemType`.

## 7. Final disposition

`unresolved eligible Excel pages = 0`, therefore the Phase 6 Excel hard gate is **MET**. All 103 eligible rows (38 M + 22 D + 43 P) have a real audited XLSX path: 25 pre-existing real XLSX pages preserved, 74 new domain-backed export-only adapters, and 4 newly wired canonical report exports. No fake import buttons were introduced; no Excel path can POST, approve, issue, or mutate domain state. Rows 104–105 remain deferred to the parallel Personnel/Maintenance agent and are excluded from the gate.
