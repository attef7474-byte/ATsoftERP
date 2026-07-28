# 03 — Frontend i18n Cleanup Proof

## Fixed Issues

### 1. `OperationalPerson` in Arabic Settings
**File**: `apps/web/src/lib/i18n/locales/ar/settings.ts`
**Lines**: 83 (`modelNameMap.MAINTENANCE_PERSONNEL`) and 214 (`modelNameAlt.MAINTENANCE_PERSONNEL`)
**Before**: `'OperationalPerson'` (English text in Arabic locale)
**After**: `'موظفي الصيانة'` (consistent with `operationNameMap` usage on line 45)

### 2. Orphan JSON Files Removed
**Deleted files**:
- `apps/web/src/lib/i18n/locales/en-numbering.json` (103 lines)
- `apps/web/src/lib/i18n/locales/ar-numbering.json` (103 lines)

**Reason**: These JSON files were NOT imported by any locale `index.ts`. Their content was fully duplicated in `settings.ts` (the `numbering` section with `operationNameMap`, `modelNameMap`, `status`, `scope`, `resetPolicy`, `button`). Removing them eliminates stale/duplicate translation data.

### 3. Login Placeholder
**File**: `apps/web/src/app/login/page.tsx:59`
**Before**: `placeholder="admin@atsofterp.com"` (hardcoded English string)
**After**: `placeholder={t('auth.emailPlaceholder')}` (i18n key)

**New keys added**:
- `en/common.ts`: `auth.emailPlaceholder: 'admin@atsofterp.com'`
- `ar/common.ts`: `auth.emailPlaceholder: 'admin@atsofterp.com'`

### 4. Missing Namespaces
5 namespaces defined in `types.ts` but never implemented as locale objects:
- `inventoryCounting`
- `maintenanceDashboard`
- `preventiveMaintenance`
- `downtimeAnalysis`
- `sparePartRequest`

**Action**: No change needed. Confirmed via grep that NO code imports or uses these namespaces as translation keys. They remain as type definitions for future use. EN/AR parity is maintained (both have them as type-only).

## EN/AR Parity Verification
- Before: 13 EN files + 13 AR files = balanced
- After: 13 EN files + 13 AR files = balanced
- JSON files deleted from both = balanced
- New `emailPlaceholder` key added to both = balanced

## Summary
| Issue | Status |
|-------|--------|
| OperationalPerson → Arabic | ✅ Fixed |
| Orphan JSON removed | ✅ Done |
| Login placeholder i18n | ✅ Fixed |
| Missing namespaces | ✅ Documented — no action needed |
| EN/AR parity | ✅ Maintained |
