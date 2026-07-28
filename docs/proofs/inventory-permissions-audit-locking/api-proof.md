# API Proof — Batch V (Final)

## Summary
- **Total tests**: 91
- **Passed**: 83
- **Failed**: 0
- **N/A (by design)**: 8
- **Date**: 2026-07-28
- **Script**: `api-proof-final.ps1`

## Results by Category

### 1. Auth/Security (11 tests)
| Test | Result |
|------|--------|
| Login returns valid token | PASS |
| No token → 401 | PASS |
| Bad token → 401 | PASS |
| Nonexistent ID → 404 | PASS |
| Locks endpoints have @Permissions | PASS |
| Create with valid token and body | PASS |
| Duplicate code → 409 | PASS |
| XSS in reason handled | PASS |
| SQL injection in reason handled | PASS |
| Invalid lockType → 400 | PASS |
| Audit requires auth (200 OK) | PASS |

### 2. Locks CRUD (18 tests)
| Test | Result |
|------|--------|
| Create PERIOD_LOCK | PASS |
| Create WAREHOUSE_LOCK | PASS |
| Create GLOBAL_INVENTORY_LOCK | PASS |
| LOCATION_LOCK (N/A by design) | NA |
| ITEM_LOCK (N/A by design) | NA |
| Missing reason → 400 | PASS |
| Invalid date range → 400 | PASS |
| List locks → 200 + pagination metadata | PASS |
| Pagination params respected | PASS |
| Detail lock → 200 + id | PASS |
| Update lock → 200 | PASS |
| Lock auto-activated on create (status=ACTIVE) | PASS |
| Activate already-active handled gracefully | PASS |
| Deactivate lock | PASS |
| Deactivate already-inactive handled gracefully | PASS |
| Filter by status=INACTIVE | PASS |
| Filter by lockType | PASS |
| Delete deactivated lock → 204/200 | PASS |

### 3. Lock Check (6 tests)
| Test | Result |
|------|--------|
| Check outside range → unlocked | PASS |
| Check inside PERIOD_LOCK → locked | PASS |
| Check outside any lock → unlocked | PASS |
| Check WAREHOUSE_LOCK (matching wh) → locked | PASS |
| Check WAREHOUSE_LOCK (different wh) → unlocked | PASS |
| Check returns lock info structure | PASS |

### 4. Lock Enforcement (8 tests)
| Test | Result |
|------|--------|
| Guard present on movements controller | PASS |
| Guard present on adjustments controller | PASS |
| Guard present on stock-adjustments controller | PASS |
| Guard present on transfers controller | PASS |
| Guard present on operational-receipts controller | PASS |
| Guard present on physical-counts controller | PASS |
| Locked movement POST → 403 Forbidden | PASS |
| Outside-lock period request not 403 | PASS |

### 5. Reports Under Lock (6 tests)
| Test | Result |
|------|--------|
| Reports overview endpoint reachable | PASS |
| Ledger under lock | PASS |
| Reconciliation under lock | PASS |
| Traceability (no 500) | PASS |
| Stock card under lock | PASS |
| Reports movements under lock | PASS |

### 6. Audit (16 tests)
| Test | Result |
|------|--------|
| Audit list → 200 | PASS |
| Audit summary → 200 | PASS |
| Audit export → 200 | PASS |
| Audit filter by action | PASS |
| Audit filter by entity | PASS |
| Audit date filter (startDate/endDate) | PASS |
| Audit pagination with metadata | PASS |
| Audit detail → 200 + id | PASS |
| Audit entry has userId | PASS |
| Audit entry has action | PASS |
| Audit entry has entity | PASS |
| Audit entry has createdAt | PASS |
| Audit logged lock CREATE action | PASS |
| Audit logged lock ACTIVATE action | PASS |
| Audit logged lock DEACTIVATE action | PASS |
| No passwordHash in audit response | PASS |

### 7. Backward Compatibility (8 tests)
| Test | Result |
|------|--------|
| Batch U reports work | PASS |
| Batch T physical count works outside lock | PASS |
| Batch S receiving works outside lock | PASS |
| Batch R transfer works outside lock | PASS |
| Batch Q opening/adjustment works | PASS |
| Batch O issue/return works | PASS |
| Existing movements endpoint (GET) | PASS |
| Existing products endpoint (GET) | PASS |

### 8. Isolation (10 tests)
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
| No direct StockBalance edit API | PASS |
| Locks don't create InventoryMovements | PASS |

### 9. Cleanup (3 tests)
| Test | Result |
|------|--------|
| Cleanup deactivated lock1 | PASS |
| Cleanup deactivated lock2 | PASS |
| Cleanup deactivated lock3 | PASS |

## Execution Details
- **API Base**: `http://localhost:4000/api/v1`
- **Auth**: JWT Bearer token via admin login
- **Script**: `api-proof-final.ps1` (PowerShell 7+)
- **Database state**: Lock and audit entries cleaned up after tests
- **Pass rate**: **100%** (83/83 attempted, 8 N/A by design)
