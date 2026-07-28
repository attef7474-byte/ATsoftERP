# 04 — Raw Key and Hardcoded String Scan Proof

## Frontend Scan

### Raw i18n Keys
- Scan method: Provider returns raw key if translation missing. Checked all pages affected by this batch.
- Login page: Uses `t('validation.required')`, `t('auth.invalidCredentials')`, `t('common.appName')`, `t('auth.welcomeBack')`, `t('auth.emailPlaceholder')` (NEW), `t('auth.email')`, `t('auth.password')`, `t('auth.loggingIn')`, `t('auth.loginButton')` — all have corresponding AR/EN keys.
- Result: **No raw keys visible in tested pages** ✅

### `OperationalPerson` in Arabic Files
- Before: 2 occurrences in `ar/settings.ts`
- After: 0 occurrences ✅

### Orphan JSON References
- Before: `en-numbering.json` + `ar-numbering.json` (not imported, content duplicated in settings.ts)
- After: Both deleted ✅

### Hardcoded `placeholder="admin@atsofterp.com"`
- Before: In `login/page.tsx:59`
- After: `placeholder={t('auth.emailPlaceholder')}` ✅

### English Strings in Arabic Locale Files
- Only `OperationalPerson` was found — now fixed ✅

### EN/AR Key Parity
- All 13 EN files have matching AR counterparts
- Same structure, same keys
- New `emailPlaceholder` key added to both ✅

## API Scan

### English-Only API Exceptions Found and Localized

| File | Before | After | messageKey |
|------|--------|-------|------------|
| `auth/auth.service.ts:17` | `'Invalid credentials'` | `{ messageKey: 'auth.invalidCredentials', ... }` | `auth.invalidCredentials` |
| `auth/auth.service.ts:19` | `'Account is inactive'` | `{ messageKey: 'auth.userInactive', ... }` | `auth.userInactive` |
| `auth/auth.service.ts:22` | `'Invalid credentials'` | `{ messageKey: 'auth.invalidCredentials', ... }` | `auth.invalidCredentials` |
| `auth/guards/jwt-auth.guard.ts:22` | `'Invalid or expired token'` | `{ messageKey: 'auth.tokenInvalid', ... }` | `auth.tokenInvalid` |
| `auth/guards/permissions.guard.ts:20` | `'No user found'` | `{ messageKey: 'auth.noUserFound', ... }` | `auth.noUserFound` |
| `auth/guards/permissions.guard.ts:45` | `'Insufficient permissions'` | `{ messageKey: 'auth.insufficientPermissions', ... }` | `auth.insufficientPermissions` |
| `auth/strategies/jwt.strategy.ts:24` | `'User not found or inactive'` | `{ messageKey: 'auth.userNotFound', ... }` | `auth.userNotFound` |
| `numbering/numbering.service.ts:40,46,65` | `'Number sequence not found'` | `{ messageKey: 'numbering.sequenceNotFound', ... }` | `numbering.sequenceNotFound` |

### Remaining English-Only Exceptions (Not Yet Localized)
The foundation is ready but these real routes still need localization in future batches:
- Inventory: `warehouse.notFound`, `product.notFound`, `movement.notFound`
- Maintenance: `request.notFound`, `machine.notFound`, `sparePart.notFound`
- Stock: `insufficient.balance`, `blocked.warehouse`
- Companies: `company.notFound`
- Branches: `branch.notFound`
- General CRUD: `notFound`, `badRequest` in other services

These are documented as future work. The core auth + numbering + common messages are implemented and proven at runtime.

## Summary
| Check | Result |
|-------|--------|
| Frontend: raw keys visible | PASS — none found |
| Frontend: English in AR files | PASS — fixed |
| Frontend: orphan JSON | PASS — removed |
| Frontend: hardcoded placeholder | PASS — fixed |
| Frontend: EN/AR parity | PASS — maintained |
| API: localized auth errors | PASS — 6 keys |
| API: localized numbering errors | PASS — 1 key |
| API: remaining English exceptions | Documented — ~15+ services pending |
