# Browser Proof — Operational Stock Receiving (Batch S)

## Test Results

| # | Test | Result |
|---|------|--------|
| 01 | Login works — dashboard visible | PASS |
| 02 | Navigate to operational-receipts page | PASS |
| 03 | Page renders without crash (no internal server error) | PASS |
| 04 | No console errors | PASS |
| 05 | No network failures | PASS |
| 06 | No ChunkLoadError | PASS |
| 07 | No _next/static failures | PASS |
| 08 | Create receipt form opens (modal/drawer/inline) | PASS |
| 09 | Warehouse selector visible | PASS |
| 10 | Reason input works | PASS |
| 11 | Quantity input works | PASS |
| 12 | Arabic mode works (no page errors) | PASS |
| 13 | English mode works (no page errors) | PASS |
| 14 | No raw i18n keys visible in UI | PASS |
| 15 | No purchase order section visible | PASS |
| 16 | No finance section visible | PASS |
| 17 | Sidebar has no purchasing | PASS |
| 18 | Sidebar has no finance | PASS |
| 19 | Sidebar has no HR | PASS |
| 20 | Sidebar has no Sales | PASS |
| 21 | Page loads without crash on slow network | PASS |
| 22 | Ledger section accessible | PASS |
| 23 | Reconciliation section accessible | PASS |
| 24 | Batch R (transfers) cross-check | PASS |
| 25 | Batch Q (counts) cross-check | PASS |
| 26 | Batch O (stock issue) cross-check | PASS |
| 27 | Notifications area check | PASS |
| 28 | Multiple page navigations stable | PASS |
| 29 | Submit/approve/post workflow controls visible | PASS |
| 30 | Posted receipt edit/delete blocked | PASS |

## Summary

| Metric | Value |
|--------|-------|
| Total checks | **30** |
| Passed | **30** |
| Failed | **0** |
| Screenshots | DISABLED_BY_USER |
| Date | 2026-07-27 |
| Runtime | Playwright (headless Chromium) |
| Web server | Next.js production on localhost:3000 |
| API server | NestJS on localhost:4000 |
| Database | SQL Server (production) |
