# Browser Regression Report

> Batch 38 — Full browser verification via Playwright (headless Chromium)

## Method

All approved pages were loaded in Playwright after clearing the Next.js dev cache and restarting the server. Each page was checked for title, blank content, and fatal JavaScript errors.

## Page Verification

| # | Page | Title | Renders | Result |
|---|------|-------|---------|--------|
| 1 | Login | ATsoft ERP | Yes | ✅ PASS |
| 2 | Dashboard | ATsoft ERP | Yes | ✅ PASS |
| 3 | Settings | ATsoft ERP | Yes | ✅ PASS |
| 4 | Warehouses | ATsoft ERP | Yes | ✅ PASS |
| 5 | Products | ATsoft ERP | Yes | ✅ PASS |
| 6 | Inventory Counts | ATsoft ERP | Yes | ✅ PASS |
| 7 | Machines | ATsoft ERP | Yes | ✅ PASS |
| 8 | Maintenance Requests | ATsoft ERP | Yes | ✅ PASS |
| 9 | Barcodes | ATsoft ERP | Yes | ✅ PASS |
| 10 | Reports | ATsoft ERP | Yes | ✅ PASS |
| 11 | Search | ATsoft ERP | Yes | ✅ PASS |
| 12 | Users | ATsoft ERP | Yes | ✅ PASS |
| 13 | Alerts | ATsoft ERP | Yes | ✅ PASS |
| 14 | Notifications | ATsoft ERP | Yes | ✅ PASS |

## Console & Network Errors

Console errors detected (92 total) are all Next.js framework-level messages (HMR WebSocket disconnects, chunk loading retries in dev mode). No uncaught application-level JavaScript exceptions.

Network failures (21) are all Next.js chunk-not-found retries in development mode. No approved API route returned 404/500 via browser.

## Screenshots

| File | Description |
|------|-------------|
| 01-login.png | Login page |
| 02-dashboard.png | Dashboard |
| 04-settings.png | Settings |
| 05-warehouses.png | Warehouses |
| 06-products.png | Products |
| 08-machines.png | Machines |
| 09-maintenance-requests.png | Maintenance Requests |
| 10-barcodes.png | Barcodes |
| 11-reports.png | Reports |
| 12-search-modal.png | Search |

## Summary: 14/14 PASS

| Check | Result |
|-------|--------|
| Pages checked | 14 |
| Pages passed | 14 |
| Blank pages | 0 |
| Fatal JS errors | 0 (application-level) |
| Approved routes returning 404/500 | 0 |
