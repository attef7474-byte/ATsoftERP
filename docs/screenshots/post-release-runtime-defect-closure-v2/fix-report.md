# Fix Report

## Fix 1: Settings Appearance — Map frontend fields to DTO
- **File**: `apps/web/src/app/admin/settings/appearance/page.tsx`
- **Change**: In `handleSave()`, destructure UI state and build `{ themeMode, accentColor, compactMode }` from the frontend fields before PATCH.
- **Result**: Valid save returns 200. Invalid extra fields still return 400.

## Fix 2: Settings Language — Map defaultLanguage to defaultLocale
- **File**: `apps/web/src/app/admin/settings/language/page.tsx`
- **Change**: In `handleSave()`, send `{ defaultLocale: settings.defaultLanguage }` instead of raw settings.
- **Result**: Valid save returns 200.

## Fix 3: Settings Company Profile — Strip extra fields
- **File**: `apps/web/src/app/admin/settings/company/page.tsx`
- **Change**: In `handleSave()`, destructure and remove `defaultLanguage`, `timezone`, `currencyCode` before PATCH.
- **Result**: Valid save returns 200.

## Fix 4: Notification Rules — Correct URL
- **File**: `apps/web/src/app/admin/settings/notification-rules/page.tsx`
- **Change**: Changed all API calls from `/settings/notification-rules` to `/notifications/rules`. Changed activate/deactivate from `api.post` to `api.patch` to match backend verbs.
- **Result**: Authenticated returns 200, unauthenticated returns 401.

## Fix 5 & 6: Audit Logs — Add dedicated routes
- **File**: `apps/api/src/modules/audit/audit.controller.ts`
- **Change**: Added `@Get('user-activity')` and `@Get('login-history')` routes BEFORE `@Get(':id')`.
  - `user-activity`: delegates to `findAll()` with optional userId filter
  - `login-history`: filters by LOGIN actions, delegates to `findLoginHistory()` when userId provided
- **Result**: Both endpoints return 200 with paginated data, 401 when unauthenticated.

## Fix 7: i18n Guard — Prevent undefined localeData crash
- **File**: `apps/web/src/lib/i18n/i18n-provider.tsx`
- **Change**: Added `if (!localeData) return key;` guard before accessing `localeData[actualNs]`.
- **Result**: If locale is invalid, `t()` returns the key instead of crashing.
