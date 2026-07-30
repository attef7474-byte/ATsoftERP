# Entity Workspace UI Redesign — Summary

**Batch**: v11 Entity Workspace UI Redesign
**Previous**: v10 validation error toast corrective (commit `2a5ead7`)
**Current branch**: `main`
**Starting commit**: `2a5ead7`

## What was done

Redesigned 5 organization workspace pages with a compact master-table + opposite-side detail drawer pattern using 9 reusable entity workspace components, preserving all existing routes, permissions, APIs, and CRUD operations.

## Pages redesigned

| Page | Route | Pattern | Sections in Drawer |
|------|-------|---------|-------------------|
| Companies | `/admin/core/companies` | useCrudList + Modal | Overview, Branches, Departments, Users, Warehouses |
| Branches | `/admin/core/branches` | useCrudList + Modal | Overview, Departments, Users, Warehouses |
| Departments | `/admin/core/departments` | useCrudList + Modal | Overview, Users |
| Users | `/admin/access/users` | Manual + Modal | Overview, Roles, Operational Scopes |
| Warehouses | `/admin/inventory/warehouses` | Manual + Modal | Overview, Locations, Balance Summary |

## Key outcomes

- **9 reusable components** in `apps/web/src/components/entity/`
- **5 page refactors** — 1059 insertions, 43 deletions
- **i18n**: `workspace` namespace created — 11 keys EN/AR
- **BodyRow click guard**: skips interactive elements to prevent accidental drawer open
- **Design tokens**: 73 lines of CSS in `globals.css`
- **Build**: PASS (166 pages, zero errors)
- **No route/permission/API/DB changes**

## What was preserved

- All existing `useCrudList` hook configurations
- All Modal create/edit forms
- All ConfirmDialog delete/status operations
- All action bar registrations (`useRegisterAdminActions`)
- All `showToast` success messages
- All `useApiErrorHandler` catch blocks
- All existing detail routes (`/[id]/page.tsx`)
- All permission checks
- All API endpoints — unchanged
- Database schema — unchanged
- Forbidden modules — zero activation
