# Fix Report

## Previously Applied Fix (V3 - Prior Session)
**File**: `apps/web/src/app/admin/settings/company/page.tsx:37`
**Change**: Added `id` to destructuring in `handleSave()`:
```
- const { defaultLanguage, timezone, currencyCode, ...payload } = form;
+ const { id, defaultLanguage, timezone, currencyCode, ...payload } = form;
```
**Root Cause**: GET /settings/company-profile returns `id` field. The frontend spreads the full response into form state via `setForm(res)`. When saving, the destructure removed `defaultLanguage/timezone/currencyCode` but NOT `id`, so `id` was included in the PATCH body and rejected by the global ValidationPipe with `forbidNonWhitelisted: true` → 400 error.

## No New Fixes Required
This validation gate found zero new defects. All pages load, all saves persist, all security checks pass.

## Fixes NOT Applied
Per the strict rules:
- Global ValidationPipe NOT weakened
- No UI calls removed to hide errors
- No guards removed
- No domains activated
- No database modifications
