# Entity Workspace UI Redesign — Summary

**Batch**: v11 Entity Workspace UI Redesign (design phase + corrective phase)
**Previous**: v10 validation error toast corrective (commit `2a5ead7`)
**Current branch**: `main`

## What was done

Redesigned 5 organization workspace pages with a compact master-table + opposite-side detail drawer pattern using 10 reusable entity workspace components, preserving all existing routes, permissions, APIs, and CRUD operations.

## Pages redesigned

| Page | Route | Pattern | Sections in Drawer |
|------|-------|---------|-------------------|
| Companies | `/admin/core/companies` | useCrudList + Modal | Overview, Branches, Departments, Users, Warehouses |
| Branches | `/admin/core/branches` | useCrudList + Modal | Overview, Departments, Users, Warehouses |
| Departments | `/admin/core/departments` | useCrudList + Modal | Overview, Users |
| Users | `/admin/access/users` | Manual + Modal | Overview, Roles (inline) |
| Warehouses | `/admin/inventory/warehouses` | Manual + Modal | Overview, Locations |

## Corrective phase (Playwright-verified)

Root causes confirmed live via HTTP probes against `localhost:4000/api/v1`:

1. **False empty drawer sections**: `/warehouses` → 404 (correct route `/inventory/warehouses`); `/users/:id/roles`, `/users/:id/operational-scopes`, `/inventory/warehouses/:id/balance-summary` → 404; `findLocations` returns a plain array (old `res.data || []` → always empty); users API has no `branchId`/`departmentId` filters.
2. **Stale data on row switch**: per-section fetches were manual `useEffect` handlers with no race protection.
3. **Unclickable close button**: drawer was rendered inside `.admin-main` (z-40 stacking context) — the fixed topbar (z-60) intercepted clicks. Fixed by rendering the drawer via `createPortal` to `document.body` (overlay z-80, panel z-90).
4. **Disconnected theme**: workspace components used hardcoded teal/gray. Now driven by `--ws-*` CSS tokens with accent variant blocks (`teal`/`blue`/`emerald`/`violet`) that follow the Appearance page `data-sidebar-accent` attribute.
5. **Machine Parts label**: `المنتج` → `الصنف المخزني المرتبط` (Linked Inventory Item) in form, edit, and detail pages + list context.

## Key outcomes

- **10 reusable components** in `apps/web/src/components/entity/` (incl. new `use-drawer-section-data` race-safe hook)
- **5 page refactors** — section data via `useDrawerSectionData` (clears on entity change, discards out-of-order responses, `loaded` flag prevents false empty)
- **Errors**: all drawer/API error paths → `useApiErrorHandler` (Global Error Dialog), no error toasts on the 5 pages
- **i18n**: `workspace` namespace (11 keys) + 2 new `maintenance` keys (`linkedInventoryItem`, `linkedInventoryItemHint`) EN/AR
- **Design tokens**: `--ws-*` token block + 3 accent variant blocks in `globals.css`
- **Playwright proof**: 25/25 PASS (real browser against `localhost:3000`, zero console errors, zero request failures, zero unexpected 4xx/5xx)
- **Build**: PASS (166 pages, zero errors)
- **No route/permission/API/DB changes**

## What was preserved

- All existing `useCrudList` hook configurations
- All Modal create/edit forms
- All ConfirmDialog delete/status operations
- All action bar registrations (`useRegisterAdminActions`)
- All `showToast` success messages
- All existing detail routes (`/[id]/page.tsx`)
- All permission checks
- All API endpoints — unchanged
- Database schema — unchanged
- Forbidden modules — zero activation
