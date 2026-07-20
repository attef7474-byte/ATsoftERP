# Rejected Domains Regression Report

> Batch 38 — Verification that 11 user-rejected business domains remain absent

## Method

Full rendered page content was scanned via Playwright after navigating through all approved pages. API Swagger route list was checked for any mounted rejected-domain routes.

## Results

| # | Domain | Sidebar Visible | Dashboard Link | Web Route | API Route | Permission Active | In Release % | Result |
|---|--------|-----------------|----------------|-----------|-----------|-------------------|--------------|--------|
| 1 | Sales | No | No | No | No | No | No | ✅ PASS |
| 2 | Purchasing | No | No | No | No | No | No | ✅ PASS |
| 3 | Finance | No | No | No | No | No | No | ✅ PASS |
| 4 | HR | No* | No* | No | No | No | No | ✅ PASS* |
| 5 | AI | No* | No* | No | No | No | No | ✅ PASS* |
| 6 | IoT | No | No | No | No | No | No | ✅ PASS |
| 7 | BI | No* | No* | No | No | No | No | ✅ PASS* |
| 8 | Forecasting | No | No | No | No | No | No | ✅ PASS |
| 9 | Workflows | No | No | No | No | No | No | ✅ PASS |
| 10 | Import/Export Designer | No | No | No | No | No | No | ✅ PASS |
| 11 | Print Template Designer | No | No | No | No | No | No | ✅ PASS |

## False Positive Notes

- *"HR"* — Found only as substring in Next.js internal variable name `fullHref` (JavaScript source code). Not a business feature.
- *"AI"* — Found only as substring in function name `await viewport()` / `ViewportReady`. Not a business feature.
- *"BI"* — Found only as substring in `forbidden` / `unauthorized` strings from Next.js error handling. Not a business feature.

These are code artifacts from the framework's JavaScript source strings, not actual application features or business domains.

## Prohibited Technologies

| Technology | In Use | Verified |
|------------|--------|----------|
| Docker | No | ✅ |
| PostgreSQL | No | ✅ (SQL Server only) |
| pgAdmin | No | ✅ |
| prisma db push | Not used | ✅ |
| migrate reset | Not used | ✅ |
| Database reset | Not performed | ✅ |

## Summary: 11/11 ABSENT

No rejected business domain is exposed as a feature, sidebar link, dashboard link, web route, or API endpoint. The 3 false positives are framework-internal code strings.
