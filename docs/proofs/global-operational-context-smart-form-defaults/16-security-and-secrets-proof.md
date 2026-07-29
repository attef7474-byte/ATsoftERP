# 16 — Security and Secrets Proof

## Secrets Exposure Check

| Secret | Status |
|--------|--------|
| DATABASE_URL | Not printed in any proof doc or log |
| JWT_SECRET | Not printed in any proof doc or log |
| Password hashes | Not leaked in API responses |
| Two-factor secrets | Not applicable |
| Refresh tokens | Not stored or logged |
| SMTP passwords | Not applicable |
| Private certificates | Not applicable |

## Code Security

| Check | Result |
|-------|--------|
| Stack traces in API errors | ❌ None — all errors use Arabic localized `messageKey` |
| SQL Server errors leaked | ❌ None |
| Prisma raw exceptions leaked | ❌ None |
| Internal file paths leaked | ❌ None |
| Sensitive user fields leaked | ❌ None |
| Hardcoded credentials | ❌ None |
| `.env` contents in proof docs | ❌ None |
| Permission checks | ✅ JWT guard on all protected endpoints |
| Public endpoints | ✅ Only `health` and `auth/login` are public |
| Operational context validation | ✅ Validates active/deleted status of all entities |

## API Error Examples (from runtime proof)

All 403 errors return localized Arabic:
```json
{
  "success": false,
  "statusCode": 403,
  "message": ["رمز التوثيق غير صالح أو منتهي الصلاحية"],
  "messageKey": "auth.tokenInvalid"
}
```

No stack trace, no SQL details, no file paths, no internal IDs leaked.

## Security Headers

The operational context interceptor validates all incoming `x-company-id`, `x-branch-id`, `x-administration-id`, `x-department-id` headers and rejects invalid or inactive entity references.

## Decision

**PASS** — No security or secrets violations.
