# Root Cause: Edit Form Prefill Bug

## Bug 1: Inline edit modals use grid LIST data instead of detail fetch

All inline edit modal pages (Companies, Branches, Departments, Users, Numbering, Notification Rules, Warehouses) used grid row data from the LIST API response to prefill form fields. If the LIST API ever returns partial data, missing fields would show as empty.

While the current LIST APIs return all scalar fields, this pattern is fragile. The fix adds a full detail fetch (`GET /:id`) before opening the edit form, guaranteeing complete and fresh data.

**Affected files (7):**
- `apps/web/src/app/admin/core/companies/page.tsx`
- `apps/web/src/app/admin/core/branches/page.tsx`
- `apps/web/src/app/admin/core/departments/page.tsx`
- `apps/web/src/app/admin/access/users/page.tsx`
- `apps/web/src/app/admin/settings/numbering/page.tsx`
- `apps/web/src/app/admin/settings/notification-rules/page.tsx`
- `apps/web/src/app/admin/inventory/warehouses/page.tsx`

## Bug 2: Separate edit pages access `res.field` instead of `res.data.field`

The global `ResponseInterceptor` (`apps/api/src/common/interceptors/response.interceptor.ts`) wraps ALL API responses in `{ success: true, data: ... }`. However, several separate edit pages accessed the response fields directly (`res.code`, `res.name`) instead of accessing through `res.data` (`res.data.code`, `res.data.name`).

Since `res` was the wrapper object `{ success: true, data: { code: ..., name: ... } }`, accessing `res.code` returned `undefined`, causing ALL form fields to be empty.

**Affected files (6):**
- `apps/web/src/app/admin/access/roles/[id]/edit/page.tsx`
- `apps/web/src/app/admin/inventory/warehouses/[id]/edit/page.tsx`
- `apps/web/src/app/admin/inventory/locations/[id]/edit/page.tsx`
- `apps/web/src/app/admin/inventory/movements/[id]/edit/page.tsx`
- `apps/web/src/app/admin/inventory/adjustments/[id]/edit/page.tsx`
- `apps/web/src/app/admin/inventory/product-categories/[id]/edit/page.tsx`
