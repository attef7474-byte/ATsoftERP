# Smoke Test Report

> Batch 37 — Verification of critical production endpoints (pre-login + post-login)

## Pre-Login Checks (Unauthenticated)

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 1 | `http://localhost:3000` (Web homepage) | 200 | ✅ |
| 2 | `http://localhost:3000/login` (Login page) | 200 | ✅ |

## Authentication

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 3 | POST `/api/v1/auth/login` (admin@atsofterp.com) | 200 + JWT | ✅ |

## Post-Login Checks (Authenticated)

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 4 | GET `/api/v1/users` | 200 | ✅ |
| 5 | GET `/api/v1/products` | 200 | ✅ |
| 6 | GET `/api/v1/roles` | 200 | ✅ |
| 7 | GET `/api/v1/auth/me` | 200 | ✅ |
| 8 | GET `http://localhost:4000/api/docs` (Swagger) | 200 | ✅ |

## Smoke Check: 8/8 PASS

All critical user-facing and API endpoints respond correctly:
- Web application homepage and login page render
- API authentication produces valid JWT token
- Core CRUD endpoints return data
- Swagger documentation accessible
