# Workflow Proof — Opening Balance + Stock Adjustment Workflow

## Opening Balance Status Lifecycle
```
                 +---> POSTED (terminal, immutable)
                 |
DRAFT --> SUBMITTED --> APPROVED
                 |         |
                 |         +---> REJECTED (terminal)
                 |
                 +---> CANCELLED (terminal)
```

## Stock Adjustment Status Lifecycle
```
                 +---> POSTED (terminal, immutable)
                 |
DRAFT --> SUBMITTED --> APPROVED
                 |         |
                 |         +---> REJECTED (terminal)
                 |
                 +---> CANCELLED (terminal)
```

## Workflow Transition Rules

| Current Status | Action | Next Status | Conditions |
|---------------|--------|-------------|------------|
| DRAFT | Submit | SUBMITTED | Lines must exist, reason required |
| SUBMITTED | Approve | APPROVED | - |
| SUBMITTED | Reject | REJECTED | Terminal |
| APPROVED | Post | POSTED | Creates movement, updates balance. Transactional. |
| DRAFT | Cancel | CANCELLED | - |
| SUBMITTED | Cancel | CANCELLED | - |
| DRAFT | Edit | DRAFT | Only DRAFT documents editable |
| DRAFT | Delete | - | Hard delete with lines |
| POSTED | Edit | BLOCKED | Returns 400 |
| POSTED | Delete | BLOCKED | Returns 400 |

## Posting Flow (Opening Balance)
1. Validate status = APPROVED
2. Generate movement number from INVENTORY_MOVEMENT sequence
3. Create InventoryMovement (movementType: 'OPENING_BALANCE', status: 'POSTED')
4. Create InventoryMovementLine for each opening balance line (direction: 'IN')
5. For each line: getOrCreateBalance, update quantity += line.quantity
6. Set movementId on each opening balance line
7. Set opening balance status = POSTED
8. All in single Prisma transaction

## Posting Flow (Stock Adjustment)
1. Validate status = APPROVED
2. Separate lines by adjustmentType (ADJUSTMENT_IN vs ADJUSTMENT_OUT)
3. For OUT lines: validate sufficient stock, throw 409 if insufficient
4. Generate movement number(s) from INVENTORY_MOVEMENT sequence
5. Create InventoryMovement(s): STOCK_ADJUSTMENT_IN and/or STOCK_ADJUSTMENT_OUT
6. Create InventoryMovementLine for each adjustment line
7. For each line: getOrCreateBalance, update quantity += (in) or -= (out)
8. Set movementId on each adjustment line
9. Set adjustment status = POSTED
10. All in single Prisma transaction

## Duplicate Prevention
- Opening balance: Same product/warehouse/location cannot have multiple POSTED opening balance lines. Blocked on creation if a POSTED opening balance line already exists for the same combination.
- Stock adjustment: No duplicate restriction. Multiple adjustments allowed.

## Immutability
- Posted documents (status = POSTED) cannot be edited or deleted
- API returns 400 BadRequestException for edit/delete attempts on POSTED documents
- Movement is already POSTED at creation time (no DRAFT state for the movement)
