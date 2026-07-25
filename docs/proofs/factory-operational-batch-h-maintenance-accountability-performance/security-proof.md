# Security Proof — Batch H

**Date:** 2026-07-25  

## Result: ✅ PASSED — Auth guards verified on all new endpoints

### No token → 401

| Endpoint | Status |
|----------|--------|
| `GET /personnel` | 401 |
| `GET /machine-responsibilities` | 401 |
| `GET /request-assignments` | 401 |
| `GET /dashboard/accountability-kpis` | 401 |

### Invalid token → 401

| Endpoint | Status |
|----------|--------|
| `GET /personnel` | 401 |
| `GET /machine-responsibilities` | 401 |
| `GET /request-assignments` | 401 |
| `GET /dashboard/accountability-kpis` | 401 |

### Valid token → 200

| Endpoint | Status |
|----------|--------|
| `GET /personnel` | 200 |
| `GET /machine-responsibilities` | 200 |
| `GET /request-assignments` | 200 |
| `GET /dashboard/accountability-kpis` | 200 |

All endpoints are protected by `JwtAuthGuard` + `PermissionsGuard`. Permissions seeded: 28 new keys linked to SUPER_ADMIN role.
