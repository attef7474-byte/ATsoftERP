# Z-AA — i18n Proof

## API Messages

4 new keys added to `api-messages.ts`:

| Key | EN | AR |
|-----|----|----|
| `stock.insufficientConditionBalance` | Insufficient condition balance | الرصيد حسب الحالة غير كافٍ |
| `stock.invalidCondition` | Invalid condition | حالة غير صالحة |
| `stock.invalidDirection` | Invalid movement direction | اتجاه الحركة غير صالح |
| `stock.conditionMovementNotFound` | Condition movement not found | حركة الحالة غير موجودة |

## Frontend Settings i18n

Added `SPARE_PART_CONDITION_MOVEMENT` to both `operationNameMap` and `modelNameMap` in:

| File | operationNameMap | modelNameMap |
|------|------------------|-------------|
| `en/settings.ts` | `'Spare Part Condition Movement'` | `'SparePartConditionMovement'` |
| `ar/settings.ts` | `'حركة حالة قطع الغيار'` | `'SparePartConditionMovement'` |

## Frontend Maintenance i18n

Added `availableConditionBalances` to `maintenance.ts`:

| File | Key | Value |
|------|-----|-------|
| `en/maintenance.ts` | `availableConditionBalances` | `'Available Condition Balances'` |
| `ar/maintenance.ts` | `availableConditionBalances` | `'أرصدة الحالات المتوفرة'` |

## Runtime i18n Verification

During API test execution, the following localized error messages were verified:
- `stock.invalidCondition` → 400 with Arabic/English message ✅
- `stock.invalidDirection` → 400 with Arabic/English message ✅
- `stock.insufficientConditionBalance` → 400 with correct available/requested values ✅
- `auth.tokenInvalid` → returned as Arabic message `'لا يمكن الوصول. يرجى تسجيل الدخول'` ✅

## i18n Priority Resolution

API error messages follow existing `getRequestLanguage()` resolution:
1. `x-locale` header
2. `Accept-Language` header
3. Fallback: `'ar'`

## Key Count Summary

| Domain | EN keys | AR keys | Match |
|--------|---------|---------|-------|
| settings.ts (numbering labels) | 2 | 2 | ✅ 100% |
| maintenance.ts (condition display) | 1 | 1 | ✅ 100% |
| api-messages.ts (API errors) | 4 | 4 | ✅ 100% |
