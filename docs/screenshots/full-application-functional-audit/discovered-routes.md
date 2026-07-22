# Discovered Routes — Full Application Functional Audit

**Total routes:** ~219  
**Dynamic [id] routes:** ~87  
**Date:** 2026-07-22

## Dashboard / Auth (2 routes)

| Route | File | Type |
|-------|------|------|
| `/` | `apps/web/src/app/page.tsx` | Redirect |
| `/login` | `apps/web/src/app/login/page.tsx` | Login |

## Core (6 routes)

| Route | File | List | View | Create | Edit | Delete/Deactivate |
|-------|------|------|------|--------|------|-------------------|
| `/admin/core/companies` | `companies/page.tsx` | ✅ | ✅ | ✅ modal | ✅ modal | ✅ |
| `/admin/core/companies/[id]` | `companies/[id]/page.tsx` | — | ✅ tabs | — | ✅ modal | ✅ |
| `/admin/core/branches` | `branches/page.tsx` | ✅ | — | ✅ modal | ✅ modal | ✅ |
| `/admin/core/branches/[id]` | `branches/[id]/page.tsx` | — | ✅ | — | ✅ modal | — |
| `/admin/core/departments` | `departments/page.tsx` | ✅ | — | ✅ modal | ✅ modal | ✅ |
| `/admin/core/departments/[id]` | `departments/[id]/page.tsx` | — | ✅ | — | ✅ modal | — |

## Access Control (12 routes)

| Route | File | List | View | Create | Edit | Delete/Deactivate |
|-------|------|------|------|--------|------|-------------------|
| `/admin/access/users` | `users/page.tsx` | ✅ | — | ✅ modal | ✅ modal | ✅ |
| `/admin/access/users/[id]` | `users/[id]/page.tsx` | — | ✅ tabs | — | — | — |
| `/admin/access/users/[id]/roles` | `users/[id]/roles/page.tsx` | — | ✅ | — | ✅ | — |
| `/admin/access/users/[id]/login-history` | `users/[id]/login-history/page.tsx` | ✅ | — | — | — | — |
| `/admin/access/users/[id]/activity` | `users/[id]/activity/page.tsx` | ✅ | — | — | — | — |
| `/admin/access/roles` | `roles/page.tsx` | ✅ | — | — | — | — |
| `/admin/access/roles/new` | `roles/new/page.tsx` | — | — | ✅ | — | — |
| `/admin/access/roles/[id]` | `roles/[id]/page.tsx` | — | ✅ | — | — | — |
| `/admin/access/roles/[id]/edit` | `roles/[id]/edit/page.tsx` | — | — | — | ✅ | — |
| `/admin/access/roles/[id]/permissions` | `roles/[id]/permissions/page.tsx` | — | ✅ | — | ✅ | — |
| `/admin/access/permissions` | `permissions/page.tsx` | ✅ | — | — | — | — |
| `/admin/access/permissions/matrix` | `permissions/matrix/page.tsx` | — | ✅ matrix | — | — | — |

## Settings / Audit (10 routes)

| Route | File | List | View | Create | Edit |
|-------|------|------|------|--------|------|
| `/admin/settings` | `settings/page.tsx` | ✅ | — | ✅ | ✅ |
| `/admin/settings/company` | `settings/company/page.tsx` | — | ✅ | — | ✅ |
| `/admin/settings/language` | `settings/language/page.tsx` | — | ✅ | — | ✅ |
| `/admin/settings/appearance` | `settings/appearance/page.tsx` | — | ✅ | — | ✅ |
| `/admin/settings/security` | `settings/security/page.tsx` | — | ✅ | — | ✅ |
| `/admin/settings/numbering` | `settings/numbering/page.tsx` | — | ✅ | — | ✅ |
| `/admin/settings/notification-rules` | `settings/notification-rules/page.tsx` | — | ✅ | ✅ | ✅ |
| `/admin/settings/audit` | `settings/audit/page.tsx` | ✅ | — | — | — |
| `/admin/settings/audit/user-activity` | `settings/audit/user-activity/page.tsx` | ✅ | — | — | — |
| `/admin/settings/audit/login-history` | `settings/audit/login-history/page.tsx` | ✅ | — | — | — |

## Alerts / Notifications (2 routes)

| Route | File | List | View |
|-------|------|------|------|
| `/admin/alerts` | `alerts/page.tsx` | ✅ | — |
| `/admin/notifications` | `notifications/page.tsx` | ✅ | ✅ |

## Attachments (2 routes)

| Route | File | List | View | Create |
|-------|------|------|------|--------|
| `/admin/documents/attachments` | `documents/attachments/page.tsx` | ✅ | — | — |
| `/admin/documents/attachments/upload` | `documents/attachments/upload/page.tsx` | — | — | ✅ |

## Inventory (43 routes)

| Route | List | Create | View | Edit | Notes |
|-------|------|--------|------|------|-------|
| `/admin/inventory/warehouses` | ✅ | ✅ modal | — | ✅ modal | Activate/Deactivate |
| `/admin/inventory/warehouses/new` | — | ✅ page | — | — | |
| `/admin/inventory/warehouses/[id]` | — | — | ✅ | — | |
| `/admin/inventory/warehouses/[id]/edit` | — | — | — | ✅ | |
| `/admin/inventory/locations` | ✅ | ✅ modal | — | ✅ modal | |
| `/admin/inventory/locations/new` | — | ✅ page | — | — | |
| `/admin/inventory/locations/[id]` | — | — | ✅ | — | |
| `/admin/inventory/locations/[id]/edit` | — | — | — | ✅ | |
| `/admin/inventory/products` | ✅ | ✅ modal | — | ✅ modal | Page-level edit link |
| `/admin/inventory/products/new` | — | ✅ page | — | — | |
| `/admin/inventory/products/[id]` | — | — | ✅ | — | |
| `/admin/inventory/products/[id]/edit` | — | — | — | ✅ | |
| `/admin/inventory/products/[id]/qr` | — | — | ✅ QR | — | |
| `/admin/inventory/products/[id]/label` | — | — | ✅ label | — | |
| `/admin/inventory/products/[id]/balances` | ✅ | — | — | — | |
| `/admin/inventory/product-categories` | ✅ | ✅ modal | — | ✅ modal | |
| `/admin/inventory/product-categories/new` | — | ✅ page | — | — | |
| `/admin/inventory/product-categories/[id]` | — | — | ✅ | — | |
| `/admin/inventory/product-categories/[id]/edit` | — | — | — | ✅ | |
| `/admin/inventory/balances` | ✅ | — | — | — | Read-only |
| `/admin/inventory/balances/[id]` | — | — | ✅ | — | |
| `/admin/inventory/movements` | ✅ | — | — | — | |
| `/admin/inventory/movements/new` | — | ✅ page | — | — | |
| `/admin/inventory/movements/[id]` | — | — | ✅ | — | |
| `/admin/inventory/movements/[id]/edit` | — | — | — | ✅ | |
| `/admin/inventory/movements/[id]/lines` | ✅ | — | — | — | |
| `/admin/inventory/adjustments` | ✅ | — | — | — | |
| `/admin/inventory/adjustments/new` | — | ✅ page | — | — | |
| `/admin/inventory/adjustments/[id]` | — | — | ✅ | — | |
| `/admin/inventory/adjustments/[id]/edit` | — | — | — | ✅ | |
| `/admin/inventory/adjustments/[id]/lines` | ✅ | — | — | — | |
| `/admin/inventory/counts` | ✅ | — | — | — | |
| `/admin/inventory/counts/new` | — | ✅ page | — | — | |
| `/admin/inventory/counts/history` | ✅ | — | — | — | |
| `/admin/inventory/counts/[id]` | — | — | ✅ | — | |
| `/admin/inventory/counts/[id]/edit` | — | — | — | ✅ | |
| `/admin/inventory/counts/[id]/start` | — | — | — | ✅ | |
| `/admin/inventory/counts/[id]/execute` | — | ✅ | — | ✅ | |
| `/admin/inventory/counts/[id]/review` | — | ✅ | — | — | |
| `/admin/inventory/counts/[id]/results` | — | ✅ | — | — | |
| `/admin/inventory/counts/[id]/approve` | — | — | — | ✅ | |
| `/admin/inventory/counts/[id]/adjust` | — | — | — | ✅ | |
| `/admin/inventory/counts/[id]/history` | ✅ | — | — | — | |

## Maintenance (85 routes)

Key primary pages:
- `/admin/maintenance/dashboard` + 7 widget sub-pages
- `/admin/maintenance/machines` + 18 [id] sub-pages
- `/admin/maintenance/machine-categories` + 3 sub-pages
- `/admin/maintenance/machine-parts` + 4 sub-pages
- `/admin/maintenance/machine-documents` + 5 sub-pages
- `/admin/maintenance/requests` + 11 sub-pages
- `/admin/maintenance/tasks` + 6 sub-pages
- `/admin/maintenance/schedules` + 5 sub-pages
- `/admin/maintenance/checklist-items`
- `/admin/maintenance/downtime-logs` + 6 sub-pages
- `/admin/maintenance/preventive` + 4 sub-pages

## Barcode (24 routes)

Key primary pages:
- `/admin/barcodes` overview
- `/admin/barcodes/generate`, `/admin/barcodes/print`, `/admin/barcodes/preview`, `/admin/barcodes/scan`
- `/admin/barcodes/records` + 1 sub-page
- `/admin/barcodes/scans` + 1 sub-page
- `/admin/barcodes/templates` + 4 sub-pages
- `/admin/barcodes/product-labels` + 4 sub-pages
- `/admin/barcodes/machine-cards` + 4 sub-pages
- `/admin/barcodes/print-jobs` + 1 sub-page

## Reports (23 routes)

All report pages under `/admin/reports/` — see full list in route-discovery output.

## Other (8 routes)

- `/admin/search`, `/admin/search/results`, `/admin/search/recent`, `/admin/search/entities`
- `/admin/messaging`, `/admin/messaging/[id]`
- `/admin/profile`, `/admin/profile/password`
