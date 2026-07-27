# Workflow Proof — Operational Stock Receiving

## State Machine
```
                  +--→ REJECTED
                  |
DRAFT → SUBMITTED →→ APPROVED → POSTED
  |         |           |
  +--→ CANCELLED ←------+--→ (no further actions)
```

## State Transition Rules
| From | To | Action | Validation |
|------|----|--------|------------|
| DRAFT | SUBMITTED | submit | Must have lines |
| DRAFT | CANCELLED | cancel | Always allowed |
| DRAFT | (deleted) | remove | Soft delete |
| SUBMITTED | APPROVED | approve | Must be SUBMITTED |
| SUBMITTED | REJECTED | reject | Must be SUBMITTED |
| SUBMITTED | CANCELLED | cancel | Always allowed |
| APPROVED | POSTED | post | Creates movement, updates balance |
| POSTED | (none) | — | Terminal state, immutable |

## POST Action Details
1. Generates `INVENTORY_MOVEMENT` with type `STOCK_RECEIVING`
2. Creates `InventoryMovementLine` per receipt line (direction: IN)
3. Increments `InventoryBalance.quantity` for each product/warehouse/location
4. Sets receipt status to POSTED
5. Audit log records the transition
