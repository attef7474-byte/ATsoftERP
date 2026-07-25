# Browser Proof — Batch H (Maintenance Accountability)

**Date:** 2026-07-25  
**Runtime:** localhost:3000 (Next.js static build, 135 pages)  
**Playwright:** v1.61.1, headless Chromium, no screenshots  

## Result: ✅ 28/28 PASS — 0 FAIL

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | EN: Personnel list page shows labels | ✅ | |
| 2 | AR: Personnel list page shows Arabic labels | ✅ | |
| 3 | EN: Personnel datagrid renders | ✅ | |
| 4 | No console errors on personnel page | ✅ | |
| 5 | EN: Machine Responsibilities page renders | ✅ | |
| 6 | AR: Machine Responsibilities shows Arabic labels | ✅ | |
| 7 | EN: Machine Responsibilities datagrid renders | ✅ | |
| 8 | EN: Accountability dashboard renders | ✅ | |
| 9 | AR: Accountability dashboard shows Arabic labels | ✅ | |
| 10 | EN: Dashboard shows KPI or Performance section | ✅ | |
| 11 | AR: Dashboard shows KPI section with Arabic labels | ✅ | |
| 12 | EN: Machine detail shows personnel/responsibility section | ✅ | |
| 13 | EN: Request detail shows assignment section | ✅ | |
| 14 | No raw i18n keys visible on all pages | ✅ | 3 pages checked |
| 15 | LTR direction preserved in English | ✅ | |
| 16 | RTL direction applied in Arabic | ✅ | |
| 17 | No ChunkLoadError in console | ✅ | |
| 18 | No HR appraisal wording on accountability pages | ✅ | |
| 19 | No stock wording except no-stock notice | ✅ | |
| 20 | No finance wording except no-finance notice | ✅ | |
| 21 | No _next/static network failures | ✅ | |
| 22 | No network failures on existing list pages | ✅ | 404 pages excluded |
| 23 | Navigate between list pages | ✅ | |
| 24 | AR: Personnel datagrid visible | ✅ | |
| 25 | AR: Machine Responsibilities datagrid visible | ✅ | |
| 26 | AR: Accountability dashboard datagrid visible | ✅ | |
| 27 | EN: All three list pages accessible, no console errors | ✅ | |
| 28 | EN: Accountability dashboard body has meaningful content | ✅ | |

## Known Gaps (Frontend Pages Not Yet Built)

These pages are served by the backend API but have no corresponding Next.js page:

- `/admin/maintenance/personnel/new` — new/create form (returns 404)
- `/admin/maintenance/personnel/[id]` — detail page (returns 404)
- `/admin/maintenance/personnel/[id]/edit` — edit form (returns 404)
- `/admin/maintenance/machine-responsibilities/new` — new form (returns 404)
- `/admin/maintenance/machine-responsibilities/[id]` — detail page (returns 404)
- `/admin/maintenance/request-assignments` — list page (returns 404)
- `/admin/maintenance/request-assignments/new` — new form (returns 404)
- `/admin/maintenance/request-assignments/[id]` — detail page (returns 404)
- `/admin/maintenance/request-assignments/[id]/edit` — edit page (returns 404)

These are expected frontend gaps for the backend-focused Batch H delivery.
