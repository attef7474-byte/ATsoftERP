# Smoke Check Report

> Batch 37 — Verification of critical production endpoints

## Pre-Login (Unauthenticated)

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 1 | Web Homepage (http://localhost:3000) | 200 | PASS |
| 2 | Login Page (http://localhost:3000/login) | 200 | PASS |

## Authentication

| # | Action | Status | Result |
|---|--------|--------|--------|
| 3 | POST /api/v1/auth/login (admin@atsofterp.com) | 200 + JWT | PASS |

## Post-Login (Authenticated)

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 4 | GET /api/v1/users | 200 | PASS |
| 5 | GET /api/v1/products | 200 | PASS |
| 6 | GET /api/v1/roles | 200 | PASS |
| 7 | GET /api/v1/auth/me | 200 | PASS |
| 8 | Swagger Docs (http://localhost:4000/api/docs) | 200 | PASS |

## Result: 8/8 PASS

All critical endpoints respond correctly. The API, Web, and Swagger are operational.
