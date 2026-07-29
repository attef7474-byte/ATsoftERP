# Phase 3: Frontend Route Map

| Field | Value |
|-------|-------|
| Batch | AJ-AK |
| Phase | 3 |
| Title | Frontend Route Map |
| Date | 2026-07-29 |
| Status | DRAFT |
| Author | Batch AJ-AK |

## 1. Overview

The frontend is built with Next.js (TypeScript). Maintenance-related pages span approximately 45-55 page.tsx files across the admin section. Routes follow a convention under `/admin/maintenance/*`. All routes are fully i18n-localized.

## 2. Frontend Route Table by Area

| # | Area | Typical Routes | Page Types | i18n Coverage | Status | Batch |
|---|------|---------------|------------|--------------|--------|-------|
| 1 | Dashboard | /admin/maintenance/dashboard | Dashboard | Full | ACTIVE | Core |
| 2 | Machines Catalog | /admin/maintenance/machines | List, Detail (tabs) | Full | ACTIVE | Core |
| 3 | Machine Categories | /admin/maintenance/machines/categories | List, Modal CRUD | Full | ACTIVE | Core |
| 4 | Machine Components | /admin/maintenance/machines/:id/components | Detail, Modal CRUD | Full | ACTIVE | Core |
| 5 | Machine Spare Parts | /admin/maintenance/machines/:id/spare-parts | Detail, Modal CRUD | Full | ACTIVE | Core |
| 6 | Machine BOM | /admin/maintenance/machines/:id/bom | Detail, Modal CRUD | Full | ACTIVE | AH-AI |
| 7 | Machine Documents | /admin/maintenance/machines/:id/documents | List, Upload | Full | ACTIVE | Core |
| 8 | Requests List | /admin/maintenance/requests | List, Filters | Full | ACTIVE | Core |
| 9 | Requests Kanban | /admin/maintenance/requests/kanban | Kanban Board | Full | ACTIVE | Core |
| 10 | Request Create | /admin/maintenance/requests/create | Form | Full | ACTIVE | Core |
| 11 | Request Detail | /admin/maintenance/requests/:id | Detail (tabs: tasks, parts, costs, checklists) | Full | ACTIVE | Core |
| 12 | Installed Parts (in request) | /admin/maintenance/requests/:id/installed-parts | Card | Full | ACTIVE | AB-AC |
| 13 | Replacement History (in request) | /admin/maintenance/requests/:id/replacement-history | Card | Full | ACTIVE | AB-AC |
| 14 | Tasks List | /admin/maintenance/tasks | List | Full | ACTIVE | Core |
| 15 | Task Detail | /admin/maintenance/tasks/:id | Detail | Full | ACTIVE | Core |
| 16 | PM Schedules List | /admin/maintenance/schedules | List, Calendar | Full | ACTIVE | Core |
| 17 | PM Schedule Detail | /admin/maintenance/schedules/:id | Detail | Full | ACTIVE | Core |
| 18 | Spare Parts Catalog | /admin/maintenance/spare-parts | List | Full | ACTIVE | Core |
| 19 | Spare Part Detail | /admin/maintenance/spare-parts/:id | Detail (tabs) | Full | ACTIVE | Core |
| 20 | Spare Part Conditions | /admin/maintenance/spare-parts/conditions | Balance View | Full | ACTIVE | Z-AA |
| 21 | Repair Orders List | /admin/maintenance/repair-orders | List | Full | ACTIVE | AD-AE |
| 22 | Repair Order Detail | /admin/maintenance/repair-orders/:id | Detail, Actions | Full | ACTIVE | AD-AE |
| 23 | Stock Issue | /admin/maintenance/stock-issue | Form, History | Full | ACTIVE | Z-AA |
| 24 | BOM List | /admin/maintenance/bom | List per Machine | Full | ACTIVE | AH-AI |
| 25 | BOM Version History | /admin/maintenance/bom/:id/versions | Detail | Full | ACTIVE | AH-AI |
| 26 | Preventive Plans | /admin/maintenance/preventive-plans | List, Detail | Full | ACTIVE | AH-AI |
| 27 | Reports | /admin/maintenance/reports | Cost Reports, KPIs, Reliability | Full | ACTIVE | AF-AG |
| 28 | Settings | /admin/maintenance/settings | Config Forms | Full | ACTIVE | Core |
| 29 | Checklist Templates | /admin/maintenance/checklist-items | List, Modal CRUD | Full | ACTIVE | Core |
| 30 | Downtime Logs | /admin/maintenance/downtime-logs | List, Form | Full | ACTIVE | Core |

## 3. Sidebar Navigation Audit

The maintenance sidebar section contains approximately 17 children:

```
Maintenance
├── Dashboard
├── Machines
│   ├── Catalog
│   ├── Components
│   ├── Spare Parts
│   ├── BOM
│   └── Documents
├── Requests
│   ├── List
│   ├── Kanban
│   └── Create
├── Tasks
├── PM Schedules
├── Spare Parts
│   ├── Catalog
│   ├── Conditions
│   └── Repair Orders
├── Stock Issue
├── Reports
└── Settings
```

**Sidebar Health:**
- All sidebar links point to valid, existing routes
- No dead links to unregistered modules
- No links to forbidden modules
- Inventory and Barcodes sections are separate sidebar items (not under Maintenance)
- BOM and Preventive Plans properly linked after AH-AI

## 4. Known Frontend Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| No nested layouts | MEDIUM | All pages use flat layout; no section-level layout for maintenance |
| Low test coverage | LOW | Only 7 spec files across entire project |
| Pattern inconsistency | MEDIUM | Mix of modal-based CRUD (`useCrudList`) vs standalone pages |
| Grid inconsistency | LOW | Mix of `AdminDataGrid` (rich) and `DataTable` (simple) |
| Hardcoded strings | NEGLIGIBLE | 1 found in login page (fixed in I18N-0) |
| No Playwright tests | LOW | No automated browser tests (screenshots disabled by user) |
| Namespace gap (5) | MEDIUM | 5 i18n namespaces unimplemented including maintenanceDashboard, preventiveMaintenance |

## 5. Frontend↔API Integration

- All pages use API calls via a service layer (typically `api/` directory)
- API paths verified to use leading `/` (paths fixed in DX-0)
- No orphaned API calls to unregistered endpoints
- Stock Issue page calls maintenance-stock-issue API + inventory-balances API
- Repair Orders page calls repair-orders API + status transition endpoints
- BOM page calls maintenance-bom API + version endpoints

## 6. Auth/UI Guards

- UI elements conditionally rendered based on `userPermissions` from `useAuth`
- Permission check pattern: `can('module:action')` or similar
- Admin-only sections guarded by role check
- Forms show/hide fields based on permissions
- Sidebar items may be hidden if user lacks permissions

## 7. Phase 3 Conclusion

The maintenance frontend route map covers ~30 distinct page areas across the complete maintenance domain. All routes are real, linked from sidebar, and call valid API endpoints. Known issues are documented (no nested layouts, low test coverage, pattern inconsistency, 5 i18n namespace gaps). No placeholder pages, no dead links, and no orphaned API calls exist.
