# Changed files

## Phase 1 — useCrudList / safe CRUD helpers
- `apps/web/src/lib/form-utils.ts` (modified — added unwrapApiData, safeString, safeNumber, safeBoolean, safeDateInput, stripReadOnlyFields, ensureLoadedBeforeSave)
- `apps/web/src/hooks/useCrudList.ts` (new)
- `docs/screenshots/full-refactor-safe-crud-closure/useCrudList-report.md` (new)

## Phase 2 — admin-types split
- `apps/web/src/lib/admin-types.ts` (modified — now re-exports from domain files)
- `apps/web/src/lib/admin-types/` (11 files — domain type files + index barrel)
- `docs/screenshots/full-refactor-safe-crud-closure/admin-types-split-map.md` (new)

## Phase 3 — ui.tsx split
- `apps/web/src/components/admin/ui.tsx` (modified — now re-exports from domain components)
- `apps/web/src/components/admin/ui/` (18 files — component files + index barrel)
- `docs/screenshots/full-refactor-safe-crud-closure/ui-split-map.md` (new)

## Phase 4 — admin-data-grid split
- `apps/web/src/components/admin/admin-data-grid.tsx` (modified — now re-exports from datagrid)
- `apps/web/src/components/admin/datagrid/` (9 files — grid sub-components + index barrel)
- `docs/screenshots/full-refactor-safe-crud-closure/datagrid-split-map.md` (new)

## Phase 5 — admin-shell split
- `apps/web/src/components/admin/admin-shell.tsx` (modified — now re-exports from shell)
- `apps/web/src/components/admin/shell/` (12 files — shell sub-components + index barrel)
- `docs/screenshots/full-refactor-safe-crud-closure/admin-shell-split-map.md` (new)

## Phase 6 — i18n split
- `apps/web/src/lib/i18n/locales/ar.ts` (modified — now re-exports from domain namespaces)
- `apps/web/src/lib/i18n/locales/en.ts` (modified — now re-exports from domain namespaces)
- `apps/web/src/lib/i18n/locales/ar/` (13 files — Arabic namespace files + index barrel)
- `apps/web/src/lib/i18n/locales/en/` (13 files — English namespace files + index barrel)
- `docs/screenshots/full-refactor-safe-crud-closure/i18n-split-map.md` (new)

## Phase 7 — reports.service split
- `apps/api/src/modules/reports/reports.service.ts` (modified — now a compatibility facade delegating to domain services)
- `apps/api/src/modules/reports/reports.module.ts` (modified — registers 8 providers)
- `apps/api/src/modules/reports/services/report-query-utils.ts` (new — shared query utilities)
- `apps/api/src/modules/reports/services/dashboard-reports.service.ts` (new — dashboard/overview reports)
- `apps/api/src/modules/reports/services/maintenance-reports.service.ts` (new — maintenance reports)
- `apps/api/src/modules/reports/services/inventory-reports.service.ts` (new — inventory reports)
- `apps/api/src/modules/reports/services/barcode-reports.service.ts` (new — barcode reports)
- `apps/api/src/modules/reports/services/system-reports.service.ts` (new — system/asset reports)
- `apps/api/src/modules/reports/services/audit-reports.service.ts` (new — audit/activity reports)
- `apps/api/src/modules/reports/services/report-export.service.ts` (new — CSV/Excel export)
- `docs/screenshots/full-refactor-safe-crud-closure/reports-service-split-map.md` (new)
- `docs/screenshots/full-refactor-safe-crud-closure/reports-route-compatibility.md` (new)
- `docs/screenshots/full-refactor-safe-crud-closure/reports-export-compatibility.md` (new)

## Pages (modified for CRUD prefill — previous session)
- 13 admin page files modified for edit prefill (companies, branches, departments, users, roles, numbering, notification-rules, warehouses, products, counts, machines, requests, barcode records)
