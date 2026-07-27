# Stock Reconciliation Proof

## Inventory Ledger Hardening + Stock Balance Reconciliation

### Reconciliation Behavior Summary

| Property | Status | Detail |
|----------|--------|--------|
| Reconciliation is read-only | ✅ Confirmed | All reconciliation endpoints are `@Get()` — no mutations |
| Expected balance calculated from posted movements | ✅ Confirmed | `computeExpectedBalance()` sums IN movements minus OUT movements by product/warehouse/location |
| Current balance from StockBalances table | ✅ Confirmed | Direct read from `inventoryBalance.quantity` |
| Difference = Current - Expected | ✅ Confirmed | Calculated per product/warehouse/location |
| MATCHED status when diff === 0 | ✅ Confirmed | Shown in reconciliation details |
| DIFFERENCE status when diff !== 0 | ✅ Confirmed | Shown in reconciliation details |
| NEGATIVE_BALANCE status when quantity < 0 | ✅ Confirmed | Shown in reconciliation details |
| Orphan movements detected | ✅ Confirmed | Movements without corresponding balance records |
| Orphan balances detected | ✅ Confirmed | Balance records without corresponding movements |
| No auto-correction | ✅ Confirmed | No POST/PUT/PATCH/DELETE endpoints exist |
| Corrections deferred to Batch Q | ✅ Confirmed | Read-only by design |
| Batch O issue movements included in expected balance | ✅ Confirmed | IN/OUT movements via `computeExpectedBalance` |
| Batch O return movements included in expected balance | ✅ Confirmed | IN/OUT movements via `computeExpectedBalance` |
| No stock balance changed by reconciliation query | ✅ Confirmed | All queries are read-only |

### API Proof Excerpt

```
R01  reconciliation summary returns 200          ✅ PASS
R02  reconciliation details returns 200           ✅ PASS
R09  expected balance calculated                  ✅ PASS
R10  current balance returned                     ✅ PASS
R11  difference calculated                        ✅ PASS
R12  matched status returned for valid stock      ✅ PASS
R17  no auto-fix occurs during reconciliation     ✅ PASS
R18  no stock balance is changed by reconciliation ✅ PASS
```

### Reconciliation Data (from API)

Summary response:
```json
{
  "summary": {
    "totalBalances": 2,
    "totalMovements": 19,
    "matched": 1,
    "differences": 1,
    "negativeBalances": 0,
    "totalCurrentQty": 219,
    "totalExpectedQty": 204,
    "totalDifference": 15
  }
}
```

Detail response (sample):
```json
[
  {
    "productId": "cmrlb2yfj0002m0950hk8v7a2",
    "productName": "AT7 Test Product",
    "warehouseName": "AT7 Test Warehouse",
    "currentBalance": 15,
    "expectedBalance": 0,
    "difference": 15,
    "status": "DIFFERENCE"
  },
  {
    "productId": "cmrvb4coj0001no95rd2e7kep",
    "productName": "Runtime Product",
    "warehouseName": "مخزن قطع الغيار",
    "currentBalance": 204,
    "expectedBalance": 204,
    "difference": 0,
    "status": "MATCHED"
  }
]
```

### Conclusion

Stock reconciliation is fully functional, read-only, and correctly calculates expected balances, current balances, and differences. No auto-correction occurs.
