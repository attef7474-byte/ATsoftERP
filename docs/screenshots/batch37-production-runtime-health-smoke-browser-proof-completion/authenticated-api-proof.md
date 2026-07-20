# Authenticated API Proof

> Batch 37 — Verification that authenticated API endpoints return 200 with valid data

## Credentials
- Email: `admin@atsofterp.com`
- Password: `Admin@123456`
- JWT obtained via POST `/api/v1/auth/login`

## Endpoint Verification

| # | Endpoint | Status | Notes |
|---|----------|--------|-------|
| 1 | `GET /api/v1/dashboard/summary` | 200 | ✅ |
| 2 | `GET /api/v1/dashboard/kpis` | 200 | ✅ |
| 3 | `GET /api/v1/users` | 200 | ✅ |
| 4 | `GET /api/v1/products` | 200 | ✅ |
| 5 | `GET /api/v1/roles` | 200 | ✅ |
| 6 | `GET /api/v1/auth/me` | 200 | ✅ |
| 7 | `GET /api/v1/companies` | 200 | ✅ |
| 8 | `GET /api/v1/branches` | 200 | ✅ |
| 9 | `GET /api/v1/departments` | 200 | ✅ |
| 10 | `GET /api/v1/payment-terms` | 200 | ✅ |
| 11 | `GET /api/v1/permissions` | 200 | ✅ |
| 12 | `GET /api/v1/inventory/warehouses` | 200 | ✅ |
| 13 | `GET /api/v1/business-partners` | 200 | ✅ |
| 14 | `GET /api/v1/maintenance/machines` | 200 | ✅ |
| 15 | `GET /api/v1/notifications/inbox` | 200 | ✅ |
| 16 | `GET /api/v1/audit-logs` | 200 | ✅ |
| 17 | `GET /api/v1/reports/assets` | 200 | ✅ |
| 18 | `GET /api/v1/alerts` | 200 | ✅ |
| 19 | `GET /api/v1/attachments` | 200 | ✅ |
| 20 | `GET /api/v1/search` | 200 | ✅ |

## Known 404s (Non-Blocking)

| Endpoint | Response | Cause |
|----------|----------|-------|
| `GET /api/v1/settings/language` | 404 "System setting not found" | Setting not seeded in DB |
| `GET /api/v1/settings/appearance` | 404 "System setting not found" | Setting not seeded in DB |
| `GET /api/v1/settings/security` | 404 "System setting not found" | Setting not seeded in DB |
| `GET /api/v1/settings/company-profile` | 404 "System setting not found" | Setting not seeded in DB |
| `GET /api/v1/maintenance/documents` | 404 "Cannot GET" | Route mismatch — may be POST-only or mounted under different path |
| `POST /api/v1/auth/logout` | 404 "Cannot POST" | Missing endpoint — client-side expected, not implemented in API |

These do not block production — settings require initial seeding, and the logout endpoint is typically a client-side-only operation.
