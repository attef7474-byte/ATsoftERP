# Workflow Proof — Physical Count Lifecycle

## State Machine

```
                  ┌──────────┐
                  │  DRAFT   │
                  └────┬─────┘
                       │ submit (all lines must have countedQty)
                       ▼
                  ┌──────────┐
            ┌─────│ SUBMITTED│─────┐
            │     └──────────┘     │
            │ approve              │ reject
            ▼                      ▼
      ┌──────────┐          ┌──────────┐
      │ APPROVED │          │  DRAFT   │ (back to editing)
      └────┬─────┘          └──────────┘
           │ post (creates movements)
           ▼
      ┌──────────┐
      │  POSTED  │  (terminal - immutable)
      └──────────┘

  DRAFT ──cancel──▶ CANCELLED
  APPROVED ──cancel──▶ CANCELLED
```

## Validation Rules per Transition

| Transition | Validations |
|------------|-------------|
| DRAFT → SUBMITTED | Count must have at least 1 line; all lines must have countedQty |
| SUBMITTED → APPROVED | Count must be in SUBMITTED status |
| SUBMITTED → DRAFT (reject) | Reason must be provided |
| APPROVED → POSTED | All lines must have countedQty; at least 1 line must have non-zero variance |
| DRAFT → CANCELLED | — |
| APPROVED → CANCELLED | — |

## What Happens on POST

1. Validate all preconditions
2. Within $transaction:
   - Generate INVENTORY_MOVEMENT number
   - For positive variance lines: create COUNT_VARIANCE_IN movement (direction IN), increment InventoryBalance
   - For negative variance lines: create COUNT_VARIANCE_OUT movement (direction OUT), decrement InventoryBalance
   - If no existing balance record for a positive variance, create one
   - Set count status = POSTED, postedAt = now(), postedById = userId
3. Zero-variance lines generate no movement

## Immutable State
- POSTED counts cannot be deleted, edited, or reversed
- Corrections require creating a new physical count
