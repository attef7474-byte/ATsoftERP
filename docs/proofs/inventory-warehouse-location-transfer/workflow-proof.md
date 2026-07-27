# Workflow Proof — Stock Transfers (Batch R)

## State Machine

```
                    ┌─────────┐
                    │  DRAFT  │
                    └────┬────┘
                    │
              submit│
                    ▼
              ┌───────────┐
              │ SUBMITTED │
              └─────┬─────┘
               │         │
         approve│         │reject
               ▼          ▼
         ┌──────────┐ ┌──────────┐
         │ APPROVED │ │ REJECTED │
         └─────┬────┘ └──────────┘
               │
          post │
               ▼
         ┌──────────┐
         │  POSTED  │
         └──────────┘

Cancel: DRAFT → CANCELLED, SUBMITTED → CANCELLED
Delete: DRAFT only (soft delete, sets deletedAt)
```

## Transition Guard Logic

| From → To | Condition | Action |
|-----------|-----------|--------|
| DRAFT → SUBMITTED | status=DRAFT | Sets submittedAt, submittedById |
| SUBMITTED → APPROVED | status=SUBMITTED | Sets approvedAt, approvedById |
| SUBMITTED → REJECTED | status=SUBMITTED | Sets rejectedAt, rejectedById |
| APPROVED → POSTED | status=APPROVED | Creates OUT+IN movements, updates balances |
| DRAFT → CANCELLED | status=DRAFT | Sets cancelledAt, cancelledById |
| SUBMITTED → CANCELLED | status=SUBMITTED | Sets cancelledAt, cancelledById |

## Posting Transaction (Atomic)

When `post` is called:
1. BEGIN TRANSACTION
2. For each line:
   a. Query inventory_balance for product+source warehouse/location
   b. If insufficient stock → ROLLBACK → 409
   c. Create STOCK_TRANSFER_OUT movement (deduct from source)
   d. Create STOCK_TRANSFER_IN movement (add to destination)
   e. Update source inventory_balance (decrease)
   f. Update destination inventory_balance (increase)
   g. Link movement IDs to transfer line
3. Set transfer status = POSTED
4. COMMIT TRANSACTION

## Immutable States

- POSTED: Cannot be edited, deleted, cancelled, or re-posted
- POSTED transfer's movements cannot be reversed (would require separate adjustment)
- APPROVED: Cannot be edited (can only be posted or cancelled via workaround)

## Workflow Invalid Transitions (All Blocked)

| Attempt | Status | Result |
|---------|--------|--------|
| Submit again | SUBMITTED | ❌ 400 |
| Approve | DRAFT | ❌ 400 |
| Post | DRAFT | ❌ 400 |
| Post | SUBMITTED | ❌ 400 |
| Post | POSTED | ❌ 400 |
| Approve | APPROVED | ❌ 400 |
| Reject | DRAFT | ❌ 400 |
| Submit | POSTED | ❌ 400 |

## Conclusion

Full workflow DRAFT→SUBMITTED→APPROVED→REJECTED→POSTED→CANCELLED implemented with atomic posting, stock validation, and immutability enforcement. All invalid transitions properly blocked.
