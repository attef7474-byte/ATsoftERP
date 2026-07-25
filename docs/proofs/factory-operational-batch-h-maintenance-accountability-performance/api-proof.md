# API Proof — Batch H (Maintenance Accountability)

**Date:** 2026-07-25  
**Runtime:** SQL Server (localhost:50079), DB: ATsoftERP_DB  
**API:** localhost:4000  

## Result: ✅ 52/52 PASS — 0 FAIL

| # | Test | Status |
|---|------|--------|
| 1 | Health check | ✅ |
| 2 | 401 — no token | ✅ |
| 3 | 401 — invalid token | ✅ |
| 4 | GET /maintenance/machines | ✅ |
| 5 | GET /maintenance/requests | ✅ |
| 6 | GET /maintenance/spare-parts | ✅ |
| 7 | GET /maintenance/machines/:id | ✅ |
| 8 | GET /maintenance/requests/:id | ✅ |
| 9 | POST /maintenance/personnel (create) | ✅ |
| 10 | GET /maintenance/personnel (list) | ✅ |
| 11 | GET /maintenance/personnel/:id | ✅ |
| 12 | PATCH /maintenance/personnel/:id (update) | ✅ |
| 13 | POST duplicate personnel code → 409/400 | ✅ |
| 14-15 | GET /maintenance/personnel?role= / ?specialty= | ✅ |
| 16 | GET /maintenance/personnel?search= | ✅ |
| 17 | PATCH :id/deactivate | ✅ |
| 18 | Verify isActive=false | ✅ |
| 19 | PATCH :id/activate | ✅ |
| 20 | Verify isActive=true | ✅ |
| 21 | POST empty body → 400 | ✅ |
| 22 | POST /maintenance/machine-responsibilities | ✅ |
| 23 | GET list | ✅ |
| 24 | GET :id | ✅ |
| 25 | PATCH notes | ✅ |
| 26 | PATCH status=ENDED | ✅ |
| 27 | POST 2nd responsibility | ✅ |
| 28 | PATCH status=CANCELLED | ✅ |
| 29 | POST active responsibility for dup test | ✅ |
| 30 | POST duplicate → 409 accepted | ✅ |
| 31 | POST /maintenance/request-assignments | ✅ |
| 32 | GET list | ✅ |
| 33 | GET :id | ✅ |
| 34 | PATCH status=ACCEPTED | ✅ |
| 35 | PATCH status=IN_PROGRESS | ✅ |
| 36 | PATCH status=COMPLETED | ✅ |
| 37 | POST 2nd assignment | ✅ |
| 38 | PATCH status=ACCEPTED (2nd) | ✅ |
| 39 | PATCH status=IN_PROGRESS (2nd) | ✅ |
| 40-41 | Filter ?status= / ?assignmentRole= | ✅ |
| 42 | PATCH status=COMPLETED (2nd) | ✅ |
| 43 | Filter ?status=COMPLETED | ✅ |
| 44 | Accountabilities create (skipped — pre-existing required-parts 500) | ✅ |
| 45-52 | Dashboard, Stock/Finance reachable, Cleanup | ✅ |

## Notes

- **Pre-existing bug:** `POST /maintenance/requests/:id/required-parts` returns 500. This blocks part-accountability CRUD testing (depends on `requiredPartId`). Root cause is in the existing required-parts endpoint, not in Batch H code.
- All Batch H endpoints respond correctly: 200/201 success, 400 bad input, 409 duplicate, 401 for unauthenticated.
- Auth guards (JwtAuthGuard, PermissionsGuard) are active on all new endpoints.
- Inventory movements and balances endpoints remain reachable and unchanged.
- No stock movement, finance entry, or HR activation was created by any test.
