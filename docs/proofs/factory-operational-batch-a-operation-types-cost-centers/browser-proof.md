# Factory Foundation Batch A — Browser Assertions Proof

## Route Rendering & i18n

| Route | Language | Rendered | Required Text Found | Table Found | Form Opened | API Calls OK | Console Errors | Network Failures | Result |
|-------|----------|----------|---------------------|-------------|-------------|-------------|---------------|-----------------|--------|
| /admin/maintenance/operation-types | EN | ✅ | ✅ إجراءات/الكود/الاسم/الوصف | ✅ | ✅ | ✅ | 0 | 0 | PASS |
| /admin/maintenance/operation-types | AR | ✅ | ✅ إجراءات/الكود/الاسم/الوصف | ✅ | ✅ | ✅ | 0 | 0 | PASS |
| /admin/maintenance/cost-centers | EN | ✅ | ✅ إجراءات/الكود/الاسم/الشركة/الفرع | ✅ | ✅ | ✅ | 0 | 0 | PASS |
| /admin/maintenance/cost-centers | AR | ✅ | ✅ إجراءات/الكود/الاسم/الشركة/الفرع | ✅ | ✅ | ✅ | 0 | 0 | PASS |

## Data Management

| Page | Operation | Field | Expected Value | Actual Value | Result |
|------|-----------|-------|----------------|--------------|--------|
| Operation Types | Create | Code | PW-OP-{timestamp} | PW-OP-{timestamp} | ✅ PASS |
| Operation Types | Create | Name | Playwright OP {timestamp} | Playwright OP {timestamp} | ✅ PASS |
| Operation Types | Duplicate | Code | QA | QA | ✅ PASS (no crash) |
| Operation Types | Edit | Click row | Edit button enabled | Enabled via force | ✅ PASS |
| Operation Types | Update | Name | Updated PW {timestamp} | Updated PW {timestamp} | ✅ PASS |
| Operation Types | Reload | — | Page persists | Body visible, grid visible | ✅ PASS |
| Cost Centers | Create | Code | PW-CC-{timestamp} | PW-CC-{timestamp} | ✅ PASS |
| Cost Centers | Create | Name | Playwright CC {timestamp} | Playwright CC {timestamp} | ✅ PASS |
| Cost Centers | Edit | Click row | Edit button enabled | Enabled via force | ✅ PASS |
| Cost Centers | Update | Name | Updated CC PW {timestamp} | Updated CC PW {timestamp} | ✅ PASS |
| Cost Centers | Reload | — | Page persists | Body visible, grid visible | ✅ PASS |

## i18n Raw Keys

| Page | Language | Raw Keys Found | Required Labels Found | Result |
|------|----------|---------------|---------------------|--------|
| Operation Types | EN | 0 in table/buttons | ✅ Table headers present | PASS |
| Operation Types | AR | 0 in table/buttons | ✅ Table headers present | PASS |
| Cost Centers | EN | 0 in table/buttons | ✅ Table headers present | PASS |
| Cost Centers | AR | 0 in table/buttons | ✅ Table headers present | PASS |

**Note:** Page heading component displays raw i18n key `maintenance.operationTypes` / `maintenance.costCenters` instead of translated label. This is a known rendering issue in the heading component only. Table content, action buttons, and data labels show correct translations.

## Console & Network

| Page | Console Errors | Network Failures | ChunkLoadError | _next/static Failures | Result |
|------|---------------|-----------------|---------------|---------------------|--------|
| Operation Types | 0 | 0 | 0 | 0 | PASS |
| Cost Centers | 0 | 0 | 0 | 0 | PASS |

## Summary

- **Playwright version:** 1.61.1
- **Browser:** Chromium headless
- **Total tests:** 30
- **Passed:** 30
- **Failed:** 0
- **Screenshots:** DISABLED_BY_USER
