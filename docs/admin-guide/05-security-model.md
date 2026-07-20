# Security Model

> Admin Guide — Section 5

## Authentication

- **Mechanism**: JWT (JSON Web Token)
- **Password hashing**: bcrypt
- **Token storage**: localStorage (web SPA)
- **Token transmission**: Authorization header (`Bearer <token>`)

## Authorization

Two-layer guard system:
1. **JwtAuthGuard** — Verifies the JWT token is valid and not expired
2. **PermissionsGuard** — Checks the user's role has the required permission

## Security Rules

| Rule | Enforced |
|------|----------|
| Public endpoints limited | ✅ Only login is public |
| All operational endpoints protected | ✅ 46/46 verified in Batch 38 |
| passwordHash never returned in API | ✅ Verified |
| .env never committed | ✅ Gitignored |
| JWT not printed in logs | ✅ Verified |
| No hardcoded secrets in source | ✅ Verified |
| No SQL injection via query params | ✅ Prisma parameterized queries |
| CORS not weakened | ✅ Default configuration |
| Global guards not weakened | ✅ JwtAuthGuard, PermissionsGuard, ValidationPipe all active |

## Sensitive Data

- **Do not** store passwords in plain text
- **Do not** share JWT tokens
- **Do not** commit `.env` files
- **Do not** log DATABASE_URL or connection strings
- **Do not** expose `passwordHash` in any API response

## Batch 38 Security Audit Results

| Check | Result |
|-------|--------|
| Hardcoded secrets | None found |
| .env committed | No |
| JWT exposure | None |
| passwordHash leak | None |
| Unsafe public endpoints | None |
| SQL injection vectors | None found |
| Guards weakened | None |

## Rejected Domains Security

The following domains are not mounted, not exposed, and not accessible:
Sales, Purchasing, Finance, HR, AI, IoT, BI, Forecasting, Workflows, Import/Export Designer, Print Template Designer

Batch 38 confirmed 11/11 rejected domains absent from API and web.
