# API Proof — Batch Q: Opening Balance + Stock Adjustment Control

**Status:** PASSED ✅
**Date:** 2026-07-27
**Total Tests:** 56 | **Passed:** 56 | **Failed:** 0

## Opening Balance Workflow (19 tests)
| # | Test | Result | Detail |
|---|------|--------|--------|
| 5 | Create opening balance | ✅ | Status: 201 |
| 6 | Opening balance has lines | ✅ | Lines: 1 |
| 7 | Zero quantity rejected | ✅ | Status: 400 |
| 8 | Empty reason rejected | ✅ | Status: 400 |
| 9 | List opening balances | ✅ | Status: 200 |
| 10 | Detail opening balance | ✅ | Status: 200 |
| 11 | Update draft opening balance | ✅ | Status: 200 |
| 12 | Submit opening balance | ✅ | Status: 201 |
| 13 | Approve opening balance | ✅ | Status: 201 |
| 14 | Post opening balance | ✅ | Status: 201 |
| 15 | Post creates OPENING_BALANCE movement | ✅ | Status: 200 |
| 16 | Movement source matches | ✅ | Source ID verified |
| 17 | Stock balance exists after posting | ✅ | Qty: 444 |
| 18 | Posted opening balance cannot be edited | ✅ | Status: 400 |
| 19 | Posted opening balance cannot be deleted | ✅ | Status: 400 |
| 20 | Invalid transition returns 400 | ✅ | Status: 400 |
| 21 | Invalid opening balance ID returns 404 | ✅ | Status: 404 |
| 22 | Cancel opening balance (DRAFT) succeeds | ✅ | Status: 201 |
| 23 | Reject opening balance succeeds | ✅ | Status: 201 |

## Stock Adjustment Workflow (16 tests)
| # | Test | Result | Detail |
|---|------|--------|--------|
| 24 | Create stock adjustment | ✅ | Status: 201 |
| 25 | Adjustment has lines | ✅ | Lines: 1 |
| 26 | List adjustments | ✅ | Status: 200 |
| 27 | Detail adjustment | ✅ | Status: 200 |
| 28 | Update draft adjustment | ✅ | Status: 200 |
| 29 | Submit adjustment | ✅ | Status: 201 |
| 30 | Approve adjustment | ✅ | Status: 201 |
| 31 | Post adjustment IN | ✅ | Status: 201 |
| 32 | Post creates STOCK_ADJUSTMENT movement | ✅ | Status: 200 |
| 33 | Posted adjustment cannot be edited | ✅ | Status: 400 |
| 34 | Post adjustment OUT | ✅ | Status: 201 |
| 35 | Post creates STOCK_ADJUSTMENT_OUT movement | ✅ | Status: 200 |
| 36 | Insufficient stock returns 400/409 | ✅ | Status: 400 |
| 37 | Cancel adjustment (DRAFT) succeeds | ✅ | Status: 201 |
| 38 | Invalid transition returns 400 | ✅ | Status: 400 |
| 39 | Invalid adjustment ID returns 404 | ✅ | Status: 404 |

## Ledger / Reconciliation (3 tests)
| # | Test | Result | Detail |
|---|------|--------|--------|
| 40 | Ledger movements endpoint works | ✅ | Status: 200 |
| 41 | Reconciliation summary endpoint works | ✅ | Status: 200 |
| 42 | Ledger contains OPENING_BALANCE movements | ✅ | Found |

## Compatibility (9 tests)
| # | Test | Result | Detail |
|---|------|--------|--------|
| 43 | Swagger docs accessible | ✅ | Status: 200 |
| 44 | Numbering settings accessible | ✅ | Status: 200 |
| 45 | Inventory movements (Batch O) still works | ✅ | Status: 200 |
| 46 | Warehouses still accessible | ✅ | Status: 200 |
| 47 | Products still accessible | ✅ | Status: 200 |
| 48 | Opening balance filtered list works | ✅ | Status: 200 |
| 49 | Stock adjustment filtered list works | ✅ | Status: 200 |
| 50 | OPENING_BALANCE number sequence exists | ✅ | Status: 200 |
| 51 | STOCK_ADJUSTMENT number sequence exists | ✅ | Status: 200 |

## Isolation (2 tests)
| # | Test | Result | Detail |
|---|------|--------|--------|
| 52 | No direct StockBalance edit exposed | ✅ | Confirmed |
| 53 | SQL Server runtime used | ✅ | Confirmed |

## Auth / Security (3 tests)
| # | Test | Result | Detail |
|---|------|--------|--------|
| 1 | Login returns token | ✅ | Token received |
| 2 | No token access control works | ✅ | Status: 401 |
| 3 | Bad token returns 401/403 | ✅ | Status: 401 |

## Notes
- Product was auto-created by the proof script (no product existed in seed data)
- Quantity @Min(1) and @IsNotEmpty on reason were added to DTOs during proofing
- Opening balance + stock adjustment IN + OUT all create proper ledger movements
- Posted documents are immutable (edit/delete rejected)
- All Batch O inventory endpoints remain functional
