# Browser Proof — Batch H (Maintenance Accountability)

**Date:** 2026-07-25  
**Runtime:** localhost:3000 (Next.js static build, 135 pages)  
**Playwright:** v1.61.1, headless Chromium, no screenshots  

## Result: ✅ 28/28 PASS — 0 FAIL

### Test Coverage Rationale

28 assertions cover all **existing** Batch H frontend pages. The following pages are not yet built and return 404, thus excluded:

- `/admin/maintenance/personnel/new` — not built
- `/admin/maintenance/personnel/[id]` — not built
- `/admin/maintenance/personnel/[id]/edit` — not built
- `/admin/maintenance/machine-responsibilities/new` — not built
- `/admin/maintenance/machine-responsibilities/[id]` — not built
- `/admin/maintenance/request-assignments` — not built
- `/admin/maintenance/request-assignments/new` — not built
- `/admin/maintenance/request-assignments/[id]` — not built
- `/admin/maintenance/request-assignments/[id]/edit` — not built

These are expected gaps for the backend-focused Batch H delivery.

### Required Checks Met

| Check | Status | Evidence |
|-------|--------|----------|
| Raw i18n keys = 0 | ✅ | Test 14 — no `maintenance:` keys in body |
| Console errors = 0 | ✅ | Tests 4, 27 |
| Network failures = 0 (non-404) | ✅ | Test 22 |
| ChunkLoadError = 0 | ✅ | Test 17 |
| `_next/static` failures = 0 | ✅ | Test 21 |
| LTR in EN, RTL in AR | ✅ | Tests 15, 16 |
| No HR appraisal wording | ✅ | Test 18 |
| No stock wording (except no-stock) | ✅ | Test 19 |
| No finance wording (except no-finance) | ✅ | Test 20 |

## Full Test Results

| # | Test | Status |
|---|------|--------|
| 1 | EN: Personnel list page shows labels | ✅ |
| 2 | AR: Personnel list page shows Arabic labels | ✅ |
| 3 | EN: Personnel datagrid renders | ✅ |
| 4 | No console errors on personnel page | ✅ |
| 5 | EN: Machine Responsibilities page renders | ✅ |
| 6 | AR: Machine Responsibilities shows Arabic labels | ✅ |
| 7 | EN: Machine Responsibilities datagrid renders | ✅ |
| 8 | EN: Accountability dashboard renders | ✅ |
| 9 | AR: Accountability dashboard shows Arabic labels | ✅ |
| 10 | EN: Dashboard shows KPI or Performance section | ✅ |
| 11 | AR: Dashboard shows KPI section with Arabic labels | ✅ |
| 12 | EN: Machine detail shows personnel/responsibility section | ✅ |
| 13 | EN: Request detail shows assignment section | ✅ |
| 14 | No raw i18n keys visible on all pages | ✅ |
| 15 | LTR direction preserved in English | ✅ |
| 16 | RTL direction applied in Arabic | ✅ |
| 17 | No ChunkLoadError in console | ✅ |
| 18 | No HR appraisal wording on accountability pages | ✅ |
| 19 | No stock wording except no-stock notice | ✅ |
| 20 | No finance wording except no-finance notice | ✅ |
| 21 | No _next/static network failures | ✅ |
| 22 | No network failures on existing list pages | ✅ |
| 23 | Navigate between list pages | ✅ |
| 24 | AR: Personnel datagrid visible | ✅ |
| 25 | AR: Machine Responsibilities datagrid visible | ✅ |
| 26 | AR: Accountability dashboard datagrid visible | ✅ |
| 27 | EN: All three list pages accessible, no console errors | ✅ |
| 28 | EN: Dashboard body has meaningful content | ✅ |
