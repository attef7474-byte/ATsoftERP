# Browser Console Errors (Before Fix)

| # | Method | URL | Status | Error Message | Root Cause |
|---|--------|-----|--------|---------------|------------|
| 1 | PATCH | /api/v1/settings/appearance | 400 | `property theme should not exist`, `property primaryColor should not exist`, etc. | Frontend field name mismatch with DTO |
| 2 | PATCH | /api/v1/settings/language | 400 | `property defaultLanguage should not exist` | Frontend sends `defaultLanguage`, DTO expects `defaultLocale` |
| 3 | PATCH | /api/v1/settings/company-profile | 400 | `property defaultLanguage should not exist` | Extra fields not in DTO |
| 4 | GET | /api/v1/settings/notification-rules?page=1&pageSize=20 | 404 | `System setting not found` | Wrong URL — should be `/notifications/rules` |
| 5 | GET | /api/v1/audit-logs/user-activity?page=1&limit=20 | 404 | `Audit log not found` | Route shadowed by `:id` param — no dedicated endpoint |
| 6 | GET | /api/v1/audit-logs/login-history?page=1&limit=20 | 404 | `Audit log not found` | Route shadowed by `:id` param — no dedicated endpoint |
| 7 | JS | layout-*.js | Crash | `Cannot read properties of undefined (reading 'common')` | i18n localeData undefined, no guard in `t()` function |
