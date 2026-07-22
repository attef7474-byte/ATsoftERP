# Fix Report

## Summary
13 files modified across Core, Access, Settings, and Inventory modules.

## Changes

### Pattern 1: Add detail fetch to inline edit modals (7 files)
- Added `detailLoading` state
- Made `openEdit` async with `GET /:id` call
- Access `res.data` to unwrap response interceptor
- Show `<LoadingState />` inside modal while fetching
- Close modal + show toast on fetch error
- Use `??` instead of `||` for default values

### Pattern 2: Fix detail response access on separate edit pages (6 files)
- Changed `api.get<Entity>(/:id)` to `api.get<any>(/:id)`
- Added `const item = res.data as Entity`
- Changed `res.field` to `item.field`
- Changed `||` to `??` for default values

## Key Files
- `apps/web/src/components/admin/admin-data-grid.tsx` — No changes needed (Portal/action menu was already fixed)
- `apps/api/src/common/interceptors/response.interceptor.ts` — No changes needed (Interceptor is correct)
