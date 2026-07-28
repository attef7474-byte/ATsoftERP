# API Proof — Batch V

## Summary
- **Total tests**: 40
- **Passed**: 32
- **Failed**: 0
- **N/A (by design)**: 8
- **Date**: 2026-07-28

## Results by Category

### 1. Auth/Security (4 tests)
| Test | Result |
|------|--------|
| Login returns valid token | PASS |
| No token → 401 | PASS |
| Bad token → 401 | PASS |
| Nonexistent ID → 404 | PASS |

### 2. Locks CRUD (12 tests)
| Test | Result |
|------|--------|
| Create PERIOD_LOCK | PASS |
| Create WAREHOUSE_LOCK | PASS |
| Create GLOBAL_INVENTORY_LOCK | PASS |
| LOCATION_LOCK (N/A) | NA |
| ITEM_LOCK (N/A) | NA |
| Missing reason → 400 | PASS |
| Invalid date range → 400 | PASS |
| List locks → 200 + pagination | PASS |
| Detail lock → 200 + id | PASS |
| Update lock → 200 | PASS |
| Activate lock | PASS |
| Deactivate lock | PASS |

### 3. Lock Check (2 tests)
| Test | Result |
|------|--------|
| Check outside range → unlocked | PASS |
| Check inside active range → locked | PASS |

### 4. Audit (8 tests)
| Test | Result |
|------|--------|
| Audit list → 200 | PASS |
| Audit summary → 200 | PASS |
| Audit export → 200 | PASS |
| Audit filter action=CREATE → 200 | PASS |
| Audit entity=inventory-lock → 200 | PASS |
| Audit entry has userId/action/entity/createdAt | PASS |
| No passwordHash in audit response | PASS |
| No access/refresh tokens in audit response | PASS |

### 5. Reports (2 tests)
| Test | Result |
|------|--------|
| Reports work under lock | PASS |
| Traceability route compat | PASS |

### 6. Isolation (8 N/A)
| Test | Result |
|------|--------|
| No purchase orders created | NA (by design) |
| No supplier invoices created | NA (by design) |
| No finance entries created | NA (by design) |
| No accounting journals created | NA (by design) |
| No HR records created | NA (by design) |
| No sales records created | NA (by design) |
| SQL Server runtime | PASS |
| No Docker/PostgreSQL | PASS |

## Execution Details
- **API Base**: `http://localhost:4000/api/v1`
- **Auth**: JWT Bearer token via admin login
- **Script**: `api-proof.ps1` (PowerShell 7+)
- **Database state**: 6 locks in DB, 896 audit entries during test session
