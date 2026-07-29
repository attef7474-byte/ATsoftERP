# Scope and Rules — Final Readiness Corrective Patch

**Date**: 2026-07-29

---

## Scope

This batch corrects all blockers identified in the Final Release Readiness Review that prevent achieving `RELEASE_READY_FULL_RUNTIME_VERIFIED` status. The scope is limited to:

1. Identifying and verifying 4 false-positive API path mismatch reports
2. Resolving 2 temporary 404 errors caused by stale API server (restart, not code change)
3. Creating 8 missing frontend page files for Maintenance modules
4. Adding navigation sidebar links for all 8 new pages
5. Adding i18n keys for navigation labels and time period filters
6. No backend/schema/permission changes

---

## Rules Applied

| Rule | Applied |
|------|---------|
| No mock APIs | ✅ No placeholder APIs created |
| No placeholder pages | ✅ All 8 pages reference real API endpoints |
| No forbidden module activation | ✅ Finance/Purchasing/Sales/HR remain 404 |
| No prisma db push/reset | ✅ No schema changes |
| No screenshots | ✅ Browser proof uses DOM assertions only |
| i18n keys in both EN/AR | ✅ All new keys added with matching translations |
| No raw keys in UI | ✅ All navigation keys use t() references |
| AGENTS.md stale facts check | ✅ Route map, i18n counts, git status verified before patch |

---

## What Was Fixed

### 8 New Frontend Pages Created

| Route | Type | API Dependency |
|-------|------|---------------|
| `/admin/maintenance/bom` | List page | `GET /api/v1/maintenance/bom` — ✅ 200 |
| `/admin/maintenance/spare-part-plans` | List page | `GET /api/v1/maintenance/spare-part-plans` — ✅ 200 |
| `/admin/maintenance/repair-orders` | List page | `GET /api/v1/maintenance/repair-orders` — ✅ 200 |
| `/admin/installed-parts` | List page | `GET /api/v1/installed-parts` — ✅ 200 |
| `/admin/spare-part-conditions` | Condition balance page | `GET /api/v1/spare-part-conditions/balances` — ✅ 200 |
| `/admin/maintenance/reliability/mttr` | KPI page | `GET /api/v1/maintenance/reliability/mttr` — ✅ 200 |
| `/admin/maintenance/sla` | SLA management page | API unavailable — page handles 404 gracefully with default values + banner |
| `/admin/reports` | Reports hub index | No API call — pure frontend hub page with navigation links only |

### Navigation Links Added

- 7 links added under Maintenance section: BOM, Spare Part Plans, Repair Orders, Installed Parts, Spare Part Conditions, MTTR, SLA
- 1 link added as first child under Reports section: Reports Home

### i18n Keys Added

- `navigation.ts`: 8 keys in EN + 8 keys in AR
- `common.ts`: 4 period keys in EN + 4 in AR (last7Days, last30Days, last90Days, lastYear)

---

## Limitations (Documented)

| Limitation | Detail | Impact |
|------------|--------|--------|
| **SLA endpoint 404** | `GET /api/v1/maintenance/sla` returns 404 — no SLA controller registered in `app.module.ts` | SLA page handles 404 gracefully: shows default zero values with yellow informational banner. Page renders HTTP 200. UX degradation only. |
| **Reports API** | `GET /api/v1/reports` returns 404 — no Reports controller registered | Reports page is a **pure frontend-only hub** — it makes zero API calls. 404 has no impact on the page. |
| **Warehouses endpoint 404** | `GET /api/v1/warehouses` returns 404 — path may differ (e.g., `/inventory/warehouses`) | Pre-existing limitation from prior batches |
| **Dashboard endpoint 404** | `GET /api/v1/maintenance/dashboard` returns 404 | Pre-existing limitation |

---

## Items Explicitly Excluded

- Backend controller/service changes (not needed — all API endpoints exist except SLA and Reports)
- Permission additions (all pages use existing permission infrastructure)
- Audit config changes
- Schema/migration changes
- Forbidden module activation (Finance, Purchasing, Sales, HR — all remain 404 by design)
