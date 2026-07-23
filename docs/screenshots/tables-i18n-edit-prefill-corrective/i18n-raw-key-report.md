# i18n Raw Key Visibility Report

## Defect: Raw translation keys visible instead of localized text

## Root Cause
The `t()` function falls back to the raw key string if the namespace+key is missing from locale files. Dynamic template-literal keys (`t(\`ns.${var}\`)`) and static hardcoded English strings both caused visible raw keys.

## Fixes Applied

### 1. alerts/page.tsx — Dynamic severity key
**Before:** `t(severityKey(item.type))` could return `common.status.INFO` if key missing
**After:** `t(severityKey(item.type), item.type)` — added fallback to `item.type`

### 2. barcodes/scans/page.tsx — Purpose filter key mapping
**Before:** `purposeKey(p)` returned snake_case keys like `product_label` not found in locale
**After:** Added `PURPOSE_KEY_MAP` mapping enum values to camelCase keys (`purpose.productLabel`); added `|| p` fallback

### 3. settings/notification-rules/page.tsx — Severity filter, enabled column, channel select
**Fix:** Severity filter buttons now use `t('status.INFO'|'status.WARNING'|'status.ERROR')` with `|| v` fallback
**Fix:** Enabled column uses `t('common.active'|'common.inactive')` with fallback
**Fix:** Channel select uses `t('settings.notificationRules.channels.IN_APP'|'EMAIL'|'SMS'|'PUSH')` with `|| c` fallback

### 4. status-badge.tsx — StatusBadge component
**Before:** Directly displayed enum values like `active`, `inactive`, `pending` as text
**After:** Uses `t(prefix + status)` to translate via locale keys

### 5. Locale keys added
**en/common.ts, ar/common.ts:** `status.INFO`, `status.WARNING`, `status.ERROR`
**en/settings.ts, ar/settings.ts:** `notificationRules.channels.IN_APP`, `notificationRules.channels.EMAIL`, `notificationRules.channels.SMS`, `notificationRules.channels.PUSH`

## Validation
- `i18n:check` — PASS (2,144 keys synchronized across 12 namespaces × 2 locales)
- All fixed pages tested via Playwright full audit: no raw i18n keys detected
- No `undefined` or `null` text fragments on any page

## Status: CLOSED
