# Defect Register — Maintenance Stock Issue Integration (Batch O)

**Date:** 2026-07-27
**Status:** CLOSED (zero open defects)

## Defects Found During Development

| # | Description | Severity | Status | Resolution |
|---|---|---|---|---|
| D1 | `@map` annotations caused snake_case columns (`issued_quantity`) instead of camelCase | Medium | CLOSED | Removed `@map` from schema.prisma, regenerated migration with plain camelCase column names |
| D2 | `prisma migrate dev` failed due to SQL Server cross-database FK reference | High | CLOSED | Wrote manual migration SQL using `sp_executesql` with proper schema-qualified table names |
| D3 | T13 browser test used dangerous `page.waitForFunction` polling loop | Medium | CLOSED | Replaced with direct `apiLogin()` + standard Playwright locator waits |
| D4 | T11 browser test failed due to button text "Issue to Site" not matching regex filter | Low | CLOSED | Changed from `getByRole` exact text to `filter({ hasText: /Issue/i })` |
| D5 | i18n hydration delay showed raw keys before translation | Low | CLOSED | Added `waitForFunction` to check for i18n hydration or used regex matchers |

## Open Defects

*None.*

## Notes

- All defects identified during development were resolved before final acceptance.
- The `@map` removal was the most impactful change, requiring a complete migration rewrite.
- No production-disrupting defects were found.
