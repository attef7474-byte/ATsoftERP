# I18n Provider Crash Root Cause

## Error
apps/web/src/lib/i18n/i18n-provider.tsx:43
Uncaught TypeError: Cannot read properties of undefined (reading 'common')

## Root Cause
When `locale` state had a non-standard value (e.g., "ar-SA", "en-US"),
`translations[locale]` returned `undefined`. Line 43 then tried to access
`undefined['common']` which threw the TypeError.

This happened when the language settings page called
`setLocale(settings.defaultLanguage)` where `defaultLanguage` came from
the API response (a database-stored value). If the DB had a non-standard
value like "ar-SA", the crash occurred.

## Fix
1. Added `normalizeLocale()` function:
   - "ar", "ar-SA", "ar_YE" → "ar"
   - "en", "en-US", "en_GB" → "en"
   - undefined/null/invalid → "ar" (default)
2. `t()` now normalizes locale before accessing translations.
3. `setLocale()` normalizes input before saving to state/localStorage.
4. Storage reader in useEffect uses normalizeLocale.
