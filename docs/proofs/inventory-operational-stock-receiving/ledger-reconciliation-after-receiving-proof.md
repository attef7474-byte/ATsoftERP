# Ledger & Reconciliation After Receiving — Operational Stock Receiving (Batch S)

## Ledger Verification

| Check | Result |
|-------|--------|
| Ledger shows STOCK_RECEIVING movement | PASS |
| Movement type: STOCK_RECEIVING | PASS |
| Movement direction: IN | PASS |
| Movement status: POSTED | PASS |
| Movement references receipt sourceId | PASS |
| Movement has movementNumber | PASS |
| Movement line quantity > 0 | PASS |

## Reconciliation Verification

| Check | Result |
|-------|--------|
| Reconciliation endpoint accessible | PASS |
| Reconciliation includes receipt movement | PASS |
| Reconciliation query does not modify data | PASS |
| Current balance available | PASS |

## Stock Balance Integrity

| Check | Result |
|-------|--------|
| Balance increased after posting | PASS |
| No direct StockBalance edit endpoint | PASS |
| No auto-correction movements created | PASS |
