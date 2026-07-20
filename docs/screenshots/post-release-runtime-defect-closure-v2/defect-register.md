# Defect Register — Runtime Defect Closure V2

| # | Domain | Endpoint | Error | Severity | Root Cause | Fix | Status |
|---|--------|----------|-------|----------|------------|-----|--------|
| 1 | Settings | PATCH /api/v1/settings/appearance | 400 | High | Field name mismatch (theme vs themeMode, primaryColor vs accentColor) | Mapped frontend fields to DTO in handleSave() | CLOSED |
| 2 | Settings | PATCH /api/v1/settings/language | 400 | High | Field name mismatch (defaultLanguage vs defaultLocale) | Send `{ defaultLocale }` instead of `{ defaultLanguage }` | CLOSED |
| 3 | Settings | PATCH /api/v1/settings/company-profile | 400 | High | Extra fields (defaultLanguage, timezone, currencyCode) not in DTO | Strip extra fields before PATCH | CLOSED |
| 4 | Settings | GET /api/v1/settings/notification-rules | 404 | High | Wrong URL (/settings/ instead of /notifications/rules) | Changed frontend URL to /notifications/rules | CLOSED |
| 5 | Audit | GET /api/v1/audit-logs/user-activity | 404 | High | Route shadowed by :id param | Added dedicated GET route | CLOSED |
| 6 | Audit | GET /api/v1/audit-logs/login-history | 404 | High | Route shadowed by :id param | Added dedicated GET route | CLOSED |
| 7 | Frontend | Dashboard/layout | Fatal | Critical | i18n localeData undefined crash | Added guard in t() function | CLOSED |

## Verification
- All 7 defects: CLOSED
- ValidationPipe: secure (forbidNonWhitelisted=true)
- Build: PASS (API + Web)
- Typecheck: PASS
- Health: 4/4 PASS
- Smoke: 8/8 PASS
- Rejected domains: inactive (404)
