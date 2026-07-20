# Runtime Health & Smoke Report

> Batch 38 — Full QA Regression, Permissions, and Security Closure

## Health Check

| # | Check | Result |
|---|-------|--------|
| 1 | API reachable on :4000 | ✅ PASS |
| 2 | Web reachable on :3000 | ✅ PASS |
| 3 | Swagger docs reachable | ✅ PASS |
| 4 | SQL Server port 50079 open | ✅ PASS |

**Health: 4/4 PASS**

## Smoke Check

| # | Check | Result |
|---|-------|--------|
| 1 | Web homepage (200) | ✅ PASS |
| 2 | Login page (200) | ✅ PASS |
| 3 | API login (200 + JWT) | ✅ PASS |
| 4 | GET /api/v1/users | ✅ PASS |
| 5 | GET /api/v1/products | ✅ PASS |
| 6 | GET /api/v1/roles | ✅ PASS |
| 7 | GET /api/v1/auth/me | ✅ PASS |
| 8 | Swagger docs (200) | ✅ PASS |

**Smoke: 8/8 PASS**

## Runtime Summary

- API uptime: 2913s (48min)
- Web: Next.js dev on :3000
- SQL Server: WINCC:50079 / ATsoftERP_DB
