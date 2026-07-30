# Phase 1 — Scope and Design Specification

## Repository
- Branch: `main`
- Starting commit: `2a5ead7`
- Working tree: clean (2 untracked v10 proof docs, unrelated)
- Ahead/behind: 0/0

## Scope
Redesign 5 organization workspace pages with a reusable compact layout pattern:
1. Companies (`/admin/core/companies`)
2. Branches (`/admin/core/branches`)
3. Departments (`/admin/core/departments`)
4. Users (`/admin/access/users`)
5. Warehouses (`/admin/inventory/warehouses`)

## What this batch does
- Create reusable frontend components (layout, header, toolbar, table, drawer, nav, empty state, status badge)
- Refactor page layout to compact modern design
- Add side detail drawer opening opposite the main sidebar
- Add vertical internal drawer navigation
- Display related data sections inside the same drawer without route navigation
- Highlight selected table row
- Add row click guard to prevent accidental drawer open on action clicks
- Close drawer on route change, operational context change, deletion, unavailable entity

## What this batch does NOT do
- Route changes: NO
- Permission changes: NO
- Database schema changes: NO
- Forbidden module activation: NO
- Backend/business logic changes: NO
- Mock/fake data: NO
- Screenshots: NOT required
- Error Toast: NOT introduced
- v9 sidebar: preserved
- v10 Global Error Dialog: preserved
- Existing detail routes: preserved

## Error handling policy
- API errors -> Global Error Dialog (`handleApiError`)
- Empty required fields -> inline validation
- Success/info -> Toast allowed
- No `showToast(..., 'error')` introduced
- `showError` if used must be verified as Global Error Dialog

## Target pages summary
| Page | Route | Detail route exists? | Permission |
|------|-------|---------------------|------------|
| Companies | /admin/core/companies | Yes (/admin/core/companies/[id]) | companies:read (implied by access) |
| Branches | /admin/core/branches | Yes (/admin/core/branches/[id]) | branches:read |
| Departments | /admin/core/departments | Yes (/admin/core/departments/[id]) | departments:read |
| Users | /admin/access/users | Yes (/admin/access/users/[id]) | users:read |
| Warehouses | /admin/inventory/warehouses | Yes (/admin/inventory/warehouses/[id]) | warehouses:read |

## Reusable components to create
1. `EntityWorkspaceLayout` — wraps page header, toolbar, table, drawer
2. `EntityPageHeader` — compact gradient header with icon badge
3. `EntityToolbar` — standardized action toolbar
4. `EntityDataTable` — reusable table wrapper with row click guard
5. `EntityDetailDrawer` — side drawer with responsive width
6. `EntityDrawerNav` — vertical nav inside drawer
7. `EntityEmptyState` — consistent empty states
8. `EntityStatusBadge` — status badges
