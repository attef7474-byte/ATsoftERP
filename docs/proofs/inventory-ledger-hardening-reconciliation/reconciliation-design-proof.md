# Batch P — Reconciliation Design Proof

## Reconciliation Logic (Read-Only, Computed)

### Formula

```
ExpectedBalance(warehouseId, productId, locationId) =
    OpeningReference(if exists)
    + Sum(POSTED IN movements)
    - Sum(POSTED OUT movements)
```

Since no opening balance model exists yet (deferred to Batch Q):
- Current accepted baseline is the existing `InventoryBalance.quantity` as the starting point
- Reconciliation verifies: `CurrentBalance == ExpectedBalance`
- Expected balance is computed from all POSTED movements + POSTED adjustments
- For Batch O tested stock: initial stock setup through receipt + all issue/return movements

### Reconciliation Output Schema (computed, not stored)

Each reconciliation line contains:
- `productId` / `sparePartId`
- `productName` / `sparePartName`
- `warehouseId`
- `warehouseName`
- `locationId` (if applicable)
- `currentBalance` (from `InventoryBalance.quantity`)
- `expectedBalance` (computed from movements + adjustments)
- `difference` (currentBalance - expectedBalance)
- `status`: MATCHED | DIFFERENCE | NEGATIVE_BALANCE | ORPHAN_BALANCE | ORPHAN_MOVEMENT | INVALID_MOVEMENT
- `movementCount` (number of POSTED movements affecting this product+warehouse)
- `lastMovementAt`
- `lastReconciledAt`

### Status Definitions
| Status | Condition |
|---|---|
| MATCHED | currentBalance == expectedBalance |
| DIFFERENCE | currentBalance != expectedBalance |
| NEGATIVE_BALANCE | currentBalance < 0 |
| ORPHAN_BALANCE | currentBalance != 0 but no POSTED movements reference this product+warehouse |
| ORPHAN_MOVEMENT | Movement exists for a product+warehouse but no balance record exists |
| INVALID_MOVEMENT | Movement has zero/negative quantity, missing product, or missing warehouse |

### Rules
- **Read-only**: Reconciliation queries never write to `InventoryBalance` or `InventoryMovement`.
- **No auto-correction**: Differences are detected and reported only.
- **Correction deferred**: Batch Q will handle corrections through approved adjustment workflow.
- **No new tables**: All reconciliation is computed in-memory from existing data.
- **No snapshot needed**: Computed reconciliation is sufficient for this batch.
