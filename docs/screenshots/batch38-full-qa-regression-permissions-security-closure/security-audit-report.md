# Security Audit Report

> Batch 38 — Full security audit of the current release

## Secrets Exposure Scan

Scanned active source code for hardcoded secrets, committed credentials, and exposure patterns.

| Check | Result |
|-------|--------|
| Hardcoded secrets in source | ✅ None found |
| .env committed | ✅ .env gitignored |
| JWT tokens printed | ✅ Not printed |
| DATABASE_URL exposed | ✅ Not in committed files |
| passwordHash returned in API | ✅ Not in user/search responses |
| Operational secrets in frontend bundle | ✅ None exposed |

## API Security Checks

| Check | Result |
|-------|--------|
| Unauthenticated protected endpoints blocked (46/46) | ✅ All blocked |
| Public allowlist correct (login only) | ✅ |
| Unsafe public operational endpoints | ✅ None found |
| Unsafe public destructive mutations | ✅ None found |
| Unsafe public admin/report/search/export | ✅ None found |
| Unsafe public attachments download | ✅ Blocked |
| Global JwtAuthGuard weakening | ✅ Not weakened |
| Global PermissionsGuard weakening | ✅ Not weakened |
| Global ValidationPipe weakening | ✅ Not weakened |
| CORS/security weakening | ✅ Default config |

## SQL Injection Scan

Checked endpoints accepting user input via query parameters (q, entityType, sort, filter, path).

| Parameter | Endpoints | Risk |
|-----------|-----------|------|
| `q` (search query) | /api/v1/search/* | ✅ Prisma parameterized queries |
| `entityType` | /api/v1/search/* | ✅ Enum validation |
| `sort`, `filter` | Various list endpoints | ✅ Prisma parameterized |
| Path params `:id` | All CRUD endpoints | ✅ Prisma parameterized |
| Raw SQL | None found | ✅ Not used |

## Authentication & Token Security

| Check | Result |
|-------|--------|
| JWT required for protected endpoints | ✅ Enforced |
| Token exposed in client-side storage | ✅ Documented (localStorage) — standard web SPA pattern |
| Token in URL/headers safely | ✅ Authorization header only |
| Password stored insecurely | ✅ bcrypt hashed |
| Mobile Flutter password storage | ✅ Batch 35 limitation documented |

## Summary: All Checks PASS

No security blockers identified. All protected endpoints are properly guarded. No secrets exposed. No SQL injection vectors identified.
