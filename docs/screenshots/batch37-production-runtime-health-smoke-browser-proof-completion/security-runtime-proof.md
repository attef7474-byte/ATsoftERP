# Security Runtime Proof

> Batch 37 — Verification that all protected endpoints require authentication

## Method

For each protected endpoint, an unauthenticated GET request was sent. The expected response is 401 (Unauthorized).

## Endpoints Tested

| # | Endpoint | Unauthenticated Response | Result |
|---|----------|-------------------------|--------|
| 1 | /api/v1/dashboard/summary | 401 | PASS |
| 2 | /api/v1/inventory/warehouses | 401 | PASS |
| 3 | /api/v1/products | 401 | PASS |
| 4 | /api/v1/maintenance/machines | 401 | PASS |
| 5 | /api/v1/users | 401 | PASS |
| 6 | /api/v1/roles | 401 | PASS |
| 7 | /api/v1/permissions | 401 | PASS |
| 8 | /api/v1/companies | 401 | PASS |
| 9 | /api/v1/alerts | 401 | PASS |
| 10 | /api/v1/barcodes/templates | 401 | PASS |
| 11 | /api/v1/search | 401 | PASS |
| 12 | /api/v1/reports/assets | 401 | PASS |
| 13 | /api/v1/audit-logs | 401 | PASS |
| 14 | /api/v1/settings/language | 401 | PASS |
| 15 | /api/v1/numbering | 401 | PASS |

## Result: 15/15 PASS

All 15 protected endpoints correctly return 401 when accessed without a valid JWT token. Only the login endpoint (POST /api/v1/auth/login) is intentionally public.
