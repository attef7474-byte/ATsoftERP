# Browser Proof — Batch C Machines

## Test Command

```
npx playwright test browser-proof.pw.ts --config=playwright.config.ts --reporter=list --timeout=60000
```

## Results

| # | Test | Status | Duration |
|---|------|--------|----------|
| 1 | Arabic: list page shows new column labels | PASS | 3.5s |
| 2 | Arabic: detail page shows new fields | PASS | 3.5s |
| 3 | Arabic: edit page shows new selectors | PASS | 3.4s |
| 4 | English: list page shows new column labels | PASS | 3.3s |
| 5 | English: detail page shows new fields | PASS | 3.4s |
| 6 | English: edit page shows new selectors | PASS | 3.4s |

**All 6 tests PASS** — 6/6 (100%)

## What each test validates

### Arabic (ar)
- **List page**: table contains `خط الإنتاج`, `نوع العملية`, `القسم الفني`, `مركز التكلفة الافتراضي`
- **Detail page**: sections contain `خط الإنتاج`, `نوع العملية`, `الإدارة الفنية`, `القسم الفني`, `مركز التكلفة الافتراضي`
- **Edit form**: selectors contain `خط الإنتاج`, `نوع العملية`, `الإدارة الفنية`, `القسم الفني`, `مركز التكلفة الافتراضي`

### English (en)
- **List page**: table contains `Production Line`, `Operation Type`, `Technical Department`, `Default Cost Center`
- **Detail page**: sections contain `Production Line`, `Operation Type`, `Technical Administration`, `Technical Department`, `Default Cost Center`
- **Edit form**: selectors contain `Production Line`, `Operation Type`, `Technical Administration`, `Technical Department`, `Default Cost Center`

### i18n integrity
All tests also assert no raw/untranslated translation keys (e.g. `maintenance.productionLine`) appear in the rendered DOM — confirmed PASS.

## Test approach

- **Auth**: API login (`/auth/login`) → `addInitScript` sets `accessToken` + `locale` in localStorage before page JS
- **Navigation**: Full page navigation to list, detail, and edit routes
- **Assertions**: `page.evaluate()` inspects `document.body.innerText` after hydration
