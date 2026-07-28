# 02 — API Message Foundation Proof

## Files Created/Updated

### 1. `apps/api/src/common/i18n/api-messages.ts` (NEW — was empty)
Complete bilingual message map with:
- **46 message keys** across 9 domains
- Both Arabic (`ar`) and English (`en`) translations
- Fallback to `ar` for unknown locales
- Support for optional interpolation params

**Domains implemented:**
| Domain | Keys | Examples |
|--------|------|---------|
| common | 7 | badRequest, unauthorized, forbidden, notFound, conflict, internalError, validationFailed |
| auth | 8 | invalidCredentials, userInactive, tokenMissing, tokenInvalid, userNotFound, noUserFound, insufficientPermissions, loggedOut |
| validation | 5 | required, invalidEnum, invalidQuantity, invalidDate, invalidId |
| numbering | 8 | sequenceNotFound, sequenceInactive, duplicateCode, manualCodeNotAllowed, codeImmutable, invalidScope, invalidResetPolicy, previewDoesNotConsumeNumber |
| stock/inventory | 8 | insufficientBalance, sparePartWarehouseRequired, productWarehouseBlocked, rawMaterialWarehouseBlocked, conditionBalanceNotFound, movementNotFound, warehouseNotFound, productNotFound |
| maintenance | 8 | requestNotFound, machineRequired, machineNotFound, componentNotFound, sparePartNotFound, invalidReplacementAction, removedPartRequired, noReturnReasonRequired |
| permissions | 2 | permissionDenied, roleRequired |
| organization | 4 | companyNotFound, branchNotFound, companyNotAllowed, branchNotAllowed |

**Exported functions:**
- `getApiMessage(key, locale, params?)` — resolves a message by key
- `getApiMessageEntry(key)` — returns raw `{ ar, en }` entry
- `localizedApiError(key, locale, statusCode, error?, params?)` — creates standardized error response shape

### 2. `apps/api/src/common/i18n/get-request-language.ts` (NEW — was empty)
Language resolution from HTTP request:
- Priority 1: `x-locale` header
- Priority 2: `Accept-Language` header (first language tag)
- Fallback: `ar`
- Handles: `ar`, `en`, `ar-YE`, `en-US`, unknown, null, empty

### 3. `apps/api/src/common/filters/http-exception.filter.ts` (UPDATED)
Global exception filter enhanced:
- No longer returns generic English-only messages
- Detects `messageKey` property from thrown exceptions
- Resolves localized message via `getApiMessage()`
- Preserves `messageKey` in response body
- Maintains backward compatibility with existing error format

### 4. `apps/api/src/main.ts` (UPDATED)
- Added `app.useGlobalFilters(new AllExceptionsFilter())` — registers the filter

## Message Key Response Shape
```json
{
  "success": false,
  "statusCode": 401,
  "message": ["بيانات الدخول غير صحيحة"],
  "timestamp": "2026-07-28T...",
  "messageKey": "auth.invalidCredentials"
}
```

## Language Resolution Order
1. `x-locale` header (explicit)
2. `Accept-Language` header (first tag)
3. Fallback: `ar`
