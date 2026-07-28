# Implementation Map — AF-AG

## Files Changed

### Backend — New/Modified

| File | Change Type | Lines |
|------|-------------|-------|
| `apps/api/src/modules/reports/services/maintenance-reports.service.ts` | **Modified** | Added 6 new methods + 2 private helpers |
| `apps/api/src/modules/reports/reports.service.ts` | **Modified** | Added 5 new delegation methods |
| `apps/api/src/modules/reports/reports.controller.ts` | **Modified** | Added 5 new GET endpoints |
| `apps/api/src/modules/reports/services/report-export.service.ts` | **Modified** | Added 5 new export cases |
| `apps/api/src/modules/factory/maintenance/maintenance-reliability/maintenance-reliability.service.ts` | **Modified** | Added 3 new methods, injected PrismaService |
| `apps/api/src/modules/factory/maintenance/maintenance-reliability/maintenance-reliability.controller.ts` | **Modified** | Added 3 new GET endpoints |
| `apps/api/src/modules/factory/maintenance/maintenance-reliability/maintenance-reliability.module.ts` | **Modified** | Added PrismaModule import |

### Frontend — New

| File | Change Type |
|------|-------------|
| `apps/web/src/app/admin/reports/maintenance/kpis/page.tsx` | **New** — KPI overview page |
| `apps/web/src/components/admin/shell/navigation-data.ts` | **Modified** — Added KPI report nav link |

### i18n

| File | Change Type |
|------|-------------|
| `apps/web/src/lib/i18n/locales/en/navigation.ts` | **Modified** — Added `maintenanceKpisReport` |
| `apps/web/src/lib/i18n/locales/ar/navigation.ts` | **Modified** — Added `maintenanceKpisReport` |
| `apps/web/src/lib/i18n/locales/en/maintenance.ts` | **Modified** — Added 12 new KPI keys |
| `apps/web/src/lib/i18n/locales/ar/maintenance.ts` | **Modified** — Added 12 new KPI keys |

### Proof Docs

| File | Content |
|------|---------|
| `docs/proofs/afag-maintenance-cost-reports-kpis-reliability/01-current-reporting-data-audit.md` | Phase 1 audit |
| `docs/proofs/afag-maintenance-cost-reports-kpis-reliability/02-kpi-formula-contract.md` | Phase 2 KPI definitions |
| `docs/proofs/afag-maintenance-cost-reports-kpis-reliability/03-implementation-map.md` | This file |

## New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/maintenance/costs/analysis` | Consolidated cost analysis with trends |
| GET | `/api/reports/maintenance/costs/by-machine` | Cost grouped by machine |
| GET | `/api/reports/maintenance/schedule-compliance` | PM compliance rate |
| GET | `/api/reports/maintenance/kpi-overview` | All operational KPIs |
| GET | `/api/reports/maintenance/backlog-trend` | Monthly backlog by month |
| GET | `/api/maintenance/reliability/repeat-failure-rate` | Repeat failure % |
| GET | `/api/maintenance/reliability/availability` | Approximate system availability |
| GET | `/api/maintenance/reliability/sla-times` | Avg SLA response/repair time |

## New Frontend Page

| Route | Content |
|-------|---------|
| `/admin/reports/maintenance/kpis` | KPI overview showing cost KPIs, reliability KPIs, schedule compliance |
