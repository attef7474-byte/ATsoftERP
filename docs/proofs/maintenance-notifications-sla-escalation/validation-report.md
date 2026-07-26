# Validation Report — Batch M

## Results

| Check | Status | Details |
|---|---|---|
| prisma validate | ✅ PASS | Schema valid |
| prisma generate | ✅ PASS | Client generated to @prisma/client |
| build:api (tsc) | ✅ PASS | 0 errors |
| typecheck | ✅ PASS | (same as build:api) |
| build:web (next build) | ✅ PASS | 137 routes compiled, 0 errors |
| i18n check | ✅ PASS | All keys present (AR/EN parity) |
| health check | ✅ 4/4 PASS | All endpoints healthy |
| smoke check | ✅ 8/8 PASS | Full suite: web homepage, login page, API login, users, products, roles, profile, swagger |

## Smoke Check Details
- Command: `powershell -ExecutionPolicy Bypass -File tools/health/smoke-check.ps1 -Password "<from .env>"`
- Email: `admin@atsofterp.com`
- Password source: `SEED_ADMIN_PASSWORD` in `apps/api/.env`
- Tests: 8/8 PASS
  - Web homepage (200)
  - Web login page (200)
  - API login (token received)
  - API GET /users (3 records)
  - API GET /products (4 records)
  - API GET /roles (4 records)
  - API GET /auth/me (admin@atsofterp.com)
  - API Swagger docs (200)

## i18n Check
- Total keys: 2479 (increased by 7 from Batch L's 2474)
- 4 new maintenance SLA keys (AR/EN)
- 3 new dashboard SLA keys (AR/EN)
- All keys have both Arabic and English translations
- Raw keys displayed = 0

## Build Outputs
- API: tsc compiled successfully, 0 errors
- Web: Next.js 15.5.20, 137 pages, compiled in 16.1s
- No ESLint issues detected

## Prisma
- Schema: valid
- Client: generated
- Migration: applied and resolved
- Database: SQL Server
