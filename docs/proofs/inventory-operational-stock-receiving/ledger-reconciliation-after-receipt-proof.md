# Ledger & Reconciliation Proof — After Operational Receipt

## Movement Integration
POST creates an `InventoryMovement` with:
- `movementType: 'STOCK_RECEIVING'`
- `sourceType: 'OPERATIONAL_RECEIPT'`
- `sourceId: <receipt.id>`
- Lines with `direction: 'IN'`

## Balance Impact
- `InventoryBalance.quantity` is **incremented** by receipt line quantity
- If no balance record exists, one is created (quantity = 0) then incremented

## Ledger Visibility
Movements appear in:
- Inventory Movements list (filterable by sourceType = 'OPERATIONAL_RECEIPT')
- Inventory Ledger report
- Inventory Reconciliation (balances are updated)

## No Finance Entry
Consistent with project convention: no finance/accounting entry is created for operational stock receiving.
