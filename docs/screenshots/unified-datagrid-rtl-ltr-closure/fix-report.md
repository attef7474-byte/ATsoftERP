# Fix Report: Unified AdminDataGrid RTL/LTR Implementation

## Summary
Replaced the minimal DataTable component across 9 admin pages with the new AdminDataGrid component featuring dark green header, column filters, sort indicators, actions dropdown, and full RTL/LTR support.

## Changes Made

### New Files
- `apps/web/src/components/admin/admin-data-grid.tsx` — AdminDataGrid component with GridColumn/GridAction types

### Modified Files
- `apps/web/src/app/globals.css` — Added .admin-grid-wrapper and related CSS classes
- `apps/web/src/lib/i18n/types.ts` — Added 'grid' to TranslationNamespace
- `apps/web/src/lib/i18n/locales/en.ts` — Added 28 grid-related i18n keys
- `apps/web/src/lib/i18n/locales/ar.ts` — Added 28 Arabic grid-related i18n keys
- `apps/web/src/app/admin/settings/numbering/page.tsx` — Full rewrite with AdminDataGrid
- `apps/web/src/app/admin/settings/notification-rules/page.tsx` — Updated to AdminDataGrid
- `apps/web/src/app/admin/settings/audit/page.tsx` — Updated to AdminDataGrid
- `apps/web/src/app/admin/settings/audit/user-activity/page.tsx` — Updated to AdminDataGrid
- `apps/web/src/app/admin/settings/audit/login-history/page.tsx` — Updated to AdminDataGrid
- `apps/web/src/app/admin/inventory/products/page.tsx` — Updated to AdminDataGrid
- `apps/web/src/app/admin/inventory/warehouses/page.tsx` — Updated to AdminDataGrid
- `apps/web/src/app/admin/inventory/movements/page.tsx` — Updated to AdminDataGrid
- `apps/web/src/app/admin/inventory/balances/page.tsx` — Updated to AdminDataGrid

## Verification Passed
- prisma validate: PASS
- prisma generate: PASS
- build:api: PASS
- typecheck: PASS
- build:web: PASS (Next.js production build successful)
- i18n:check: PASS (2137 keys synchronized)

## Key Features Delivered
1. Dark green header (#1a5632) with white text — matches enterprise grid design
2. Sticky header on vertical scroll
3. Column filter row (toggleable via Filter button)
4. Per-column sort with asc/desc indicators
5. Actions dropdown (three-dot menu) per row
6. Full RTL/LTR support via dir prop from i18n context
7. Arabic column order (actions first) for Number Sequences
8. English column order (code first) for Number Sequences
9. Global search bar built into grid toolbar
10. Refresh button with loading spinner
11. Loading/Empty/Error states built in
12. Alternating row backgrounds
13. Row selection highlight
14. Filter status indicator (blue dot)
15. i18n keys for grid labels in both languages
