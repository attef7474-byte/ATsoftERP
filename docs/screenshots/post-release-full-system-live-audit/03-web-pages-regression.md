# Web Pages Regression Test

**Date:** 2026-07-20
**Runtime:** Production mode (next start) on :3010
**Build:** 124 pages compiled successfully

## Summary

| Metric | Value |
|--------|-------|
| Pages Tested | 21 (key routes) |
| Passed | 21 |
| Failed | 0 |
| Pass Rate | 100% |

## Detailed Results

| Route | Status | Size | Notes |
|-------|--------|------|-------|
| /login | 200 | 7602 B | Login page |
| / | 200 | 5796 B | Landing page |
| /admin/dashboard | 200 | 7715 B | Admin dashboard |
| /admin/alerts | 200 | 7648 B | Alerts page |
| /admin/notifications | 200 | 7681 B | Notifications |
| /admin/profile | 200 | 7653 B | User profile |
| /admin/settings | 200 | 7658 B | Settings root |
| /admin/settings/appearance | 200 | 8154 B | Appearance settings |
| /admin/search | 200 | 7521 B | Unified search |
| /admin/access/permissions | 200 | 8148 B | Permissions matrix |
| /admin/access/roles | 200 | 8119 B | Roles list |
| /admin/access/users | 200 | 8299 B | Users list |
| /admin/barcodes | 200 | 7710 B | Barcodes module |
| /admin/core/companies | 200 | 8129 B | Companies |
| /admin/inventory/products | 200 | 8329 B | Products list |
| /admin/inventory/warehouses | 200 | 8339 B | Warehouses |
| /admin/maintenance/machines | 200 | 8339 B | Machines list |
| /admin/maintenance/requests | 200 | 8339 B | Maintenance requests |
| /admin/maintenance/tasks | 200 | 8324 B | Tasks list |
| /admin/reports/maintenance | 200 | 8154 B | Maintenance reports |
| /admin/documents/attachments | 200 | 8164 B | Attachments |

## Previously-Failing Pages (Now Resolved)

The following 4 pages previously returned 500 due to stale `.next` dev build cache.
After clean production build, all return 200:

- `/admin/dashboard` → 200
- `/admin/settings/appearance` → 200
- `/admin/alerts` → 200
- `/admin/documents/attachments` → 200

## Root Cause of Earlier 500 Errors

Stale `.next/server/pages/_document.js` from a previous dev session.
The dev server attempted to serve Admin Router pages via Pages Router artifacts.
**Resolution:** Clean production build (`next build`) regenerated all artifacts correctly.

## Conclusion

All 21 key page routes serve correctly in production mode.
Static prerendering is functioning for all 124 pages.
No broken routes or rendering errors detected.
