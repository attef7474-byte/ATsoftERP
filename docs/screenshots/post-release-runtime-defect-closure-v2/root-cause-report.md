# Root Cause Report

## 1. Settings Appearance 400
- **File**: `apps/web/src/app/admin/settings/appearance/page.tsx` line 30
- **Root Cause**: Frontend sends UI state object `{ theme, primaryColor, fontSize, compactMode, sidebarCollapsed }` directly as PATCH body, but `UpdateAppearanceSettingsDto` expects `{ themeMode, accentColor, compactMode, sidebarDensity, tableDensity, showStatusBar, showActionBar }`. Global ValidationPipe rejects unknown fields.

## 2. Settings Language 400
- **File**: `apps/web/src/app/admin/settings/language/page.tsx` line 35
- **Root Cause**: Frontend sends `{ defaultLanguage }` but DTO expects `{ defaultLocale }`.

## 3. Settings Company Profile 400
- **File**: `apps/web/src/app/admin/settings/company/page.tsx` line 37
- **Root Cause**: Frontend sends extra fields `defaultLanguage`, `timezone`, `currencyCode` not defined in `UpdateCompanyProfileDto`.

## 4. Notification Rules 404
- **File**: `apps/web/src/app/admin/settings/notification-rules/page.tsx` line 38
- **Root Cause**: Frontend calls `GET /api/v1/settings/notification-rules` but the correct endpoint is `GET /api/v1/notifications/rules`. The SystemSettingsController's `@Get(':id')` catches the call.

## 5. Audit User Activity 404
- **File**: `apps/api/src/modules/audit/audit.controller.ts`
- **Root Cause**: No dedicated route for `GET /audit-logs/user-activity`. The `@Get(':id')` catch-all matched "user-activity" as `:id`. The service method `findUserActivity()` existed but was not exposed as an HTTP endpoint.

## 6. Audit Login History 404
- **Same as #5** — no dedicated route for `GET /audit-logs/login-history`.

## 7. Frontend i18n/common Fatal Error
- **File**: `apps/web/src/lib/i18n/i18n-provider.tsx` line 43
- **Root Cause**: `localeData[actualNs]` crashes when `translations[locale]` is undefined (locale is neither 'en' nor 'ar'). No guard before property access.
