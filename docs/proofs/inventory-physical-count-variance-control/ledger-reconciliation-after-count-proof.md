# Ledger Reconciliation After Count Proof

## How Physical Count Posting Affects the Ledger

### Movement Creation
When a physical count is posted, the system creates movements:
- **COUNT_VARIANCE_IN**: For products where actual count > system quantity
  - direction = IN
  - quantity = absolute variance
  - sourceType = PHYSICAL_COUNT
  - sourceId = physical count ID

- **COUNT_VARIANCE_OUT**: For products where actual count < system quantity
  - direction = OUT
  - quantity = absolute variance
  - sourceType = PHYSICAL_COUNT
  - sourceId = physical count ID

### StockBalance Updates
- COUNT_VARIANCE_IN → increment StockBalance.quantity by variance
- COUNT_VARIANCE_OUT → decrement StockBalance.quantity by variance

### Reconciliation Verification
The existing Inventory Ledger Reconciliation module at `/admin/inventory/reconciliation` should show:
1. All variance movements are visible in the inventory movement ledger
2. Stock balance totals match the sum of all movements (Opening + Receipts - Issues + Variance Ins - Variance Outs)
3. Source reference (physical count number) is tracked through the movement

### Example
Before physical count:
- Product A: StockBalance = 100 units
- Physical Count: Product A countedQty = 120, systemQty = 100, variance = +20
- After POST: COUNT_VARIANCE_IN movement created with quantity=20, direction=IN
- After POST: StockBalance for Product A = 120 ✓

### Immutability
- POSTED counts cannot be modified (maintains audit trail integrity)
- All movements reference the source physical count ID
- Audit log records every state change
