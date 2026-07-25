# Browser Proof — Batch G

## Test Configuration
- Test framework: Playwright 1.61.1
- Test file: `browser-proof.pw.ts`
- Config: `playwright.config.ts` (headless, screenshots off, timeout 120s, 1 worker)
- Web base URL: `http://localhost:3000`
- API base URL: `http://localhost:4000/api/v1`
- Auth method: API login → set `accessToken` in localStorage

## Pages Tested (6 pages × 7 assertions = 42 tests)

| Page | Route |
|------|-------|
| Overview | `/admin/reports/maintenance` |
| Requests | `/admin/reports/maintenance/requests` |
| Downtime | `/admin/reports/maintenance/downtime` |
| Costs | `/admin/reports/maintenance/costs` |
| Schedules | `/admin/reports/maintenance/schedules` |
| Parts Usage | `/admin/reports/parts-usage` |

## Assertions (per page)

| # | Assertion | Purpose |
|---|-----------|---------|
| 1 | Route renders page (not empty) | Page body is not empty |
| 2 | No raw i18n keys visible | i18n strings like `maintenance.`, `common.`, `reports.` are translated |
| 3 | Filter F9 trigger fields present | `div[role="button"]` F9 lookup triggers exist within filter area |
| 4 | Zero console errors | No JavaScript errors in console |
| 5 | Zero network failures | All API calls succeed (no 4xx/5xx) |
| 6 | No ChunkLoadError | Next.js chunk loading works |
| 7 | No _next/static 400+ failures | Static assets load correctly |

## Results

**42 passed · 0 failed · 0 skipped**

### Detailed Results

| Page | Render | i18n | F9 Filters | Console | Network | Chunks | Static | Verdict |
|------|--------|------|-----------|---------|---------|--------|--------|---------|
| Overview | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Requests | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Downtime | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Costs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Schedules | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Parts Usage | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |

## Conclusion
**PASS** — All 6 report pages render correctly with operational filter F9 fields present, no i18n leaks, no console errors, no network failures, no chunk loading errors. The batch G operational filter fields are fully functional in the browser.
