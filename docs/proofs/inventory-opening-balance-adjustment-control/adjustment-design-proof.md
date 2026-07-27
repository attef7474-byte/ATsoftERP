# Stock Adjustment Design Proof

## Status
DESIGNED — Ready for implementation.

## Model
### InventoryStockAdjustment
New model under `factory/inventory-stock-adjustments/` module.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String (cuid) | Auto | Primary key |
| code | String (unique) | Auto-generated | Prefix SA- from NumberSequence |
| companyId | String | Yes | FK to Company |
| branchId | String? | No | FK to Branch |
| warehouseId | String | Yes | FK to Warehouse |
| locationId | String? | No | FK to WarehouseLocation (nullable) |
| status | String | Default "DRAFT" | Lifecycle: DRAFT → SUBMITTED → APPROVED → POSTED; REJECTED and CANCELLED as terminal |
| documentDate | DateTime | Default now() | Adjustment document date |
| reason | String | Yes | Justification required |
| notes | String? | No | Optional notes |
| submittedAt | DateTime? | No | Set on submit |
| submittedById | String? | No | FK to User |
| approvedAt | DateTime? | No | Set on approve |
| approvedById | String? | No | FK to User |
| postedAt | DateTime? | No | Set on post |
| postedById | String? | No | FK to User |
| rejectedAt | DateTime? | No | Set on reject |
| rejectedById | String? | No | FK to User |
| cancelledAt | DateTime? | No | Set on cancel |
| cancelledById | String? | No | FK to User |
| createdById | String? | No | Set on create |
| updatedById | String? | No | Set on update |
| createdAt | DateTime | Auto | Prisma default |
| updatedAt | DateTime | Auto | @updatedAt |

### InventoryStockAdjustmentLine
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String (cuid) | Auto | Primary key |
| adjustmentId | String | Yes | FK to InventoryStockAdjustment |
| productId | String | Yes | FK to Product |
| locationId | String? | No | FK to WarehouseLocation |
| adjustmentType | String | Yes | "ADJUSTMENT_IN" or "ADJUSTMENT_OUT" — per line |
| quantity | Float | Yes | Must be > 0 |
| movementId | String? | No | Set after posting, FK to InventoryMovementLine |
| notes | String? | No | Optional |
| createdAt | DateTime | Auto | Prisma default |
| updatedAt | DateTime | Auto | @updatedAt |

## Status Lifecycle
Same as opening balance:
```
                 +---> POSTED (terminal, immutable)
                 |
DRAFT --> SUBMITTED --> APPROVED
                 |         |
                 |         +---> REJECTED (terminal)
                 |
                 +---> CANCELLED (terminal, only before POSTED)
```

## Workflow Rules
1. **Create**: DRAFT document with code, warehouse, reason, lines. Quantity > 0. adjustmentType per line.
2. **Update**: Only while DRAFT. Edit any field, lines.
3. **Submit**: DRAFT → SUBMITTED. Sets submittedAt/submittedById.
4. **Approve**: SUBMITTED → APPROVED. Sets approvedAt/approvedById.
5. **Reject**: SUBMITTED → REJECTED. Terminal.
6. **Post**: APPROVED → POSTED. For each adjustment type group:
   - ADJUSTMENT_IN lines: create STOCK_ADJUSTMENT_IN movement with direction='IN'
   - ADJUSTMENT_OUT lines: create STOCK_ADJUSTMENT_OUT movement with direction='OUT'
   Each movement line updates InventoryBalance. Transactional.
7. **Cancel**: DRAFT or SUBMITTED → CANCELLED. Terminal.
8. **Delete**: Only if DRAFT. Hard delete.
9. **Insufficient stock**: On post, if ADJUSTMENT_OUT quantity exceeds available stock for any product/warehouse, return 409 error. Rollback entire transaction.
10. **Source reconciliation link**: Optional. If a reconciliation difference is selected as source, store reference. Not required.

## Movement Creation on Post
For each adjustmentType group in lines:

### ADJUSTMENT_IN lines
- movementType: "STOCK_ADJUSTMENT_IN"
- sourceType: "STOCK_ADJUSTMENT"
- sourceId: adjustment.id
- Movement lines: direction='IN', quantity from line
- Balance: increase

### ADJUSTMENT_OUT lines
- movementType: "STOCK_ADJUSTMENT_OUT"
- sourceType: "STOCK_ADJUSTMENT"
- sourceId: adjustment.id
- Movement lines: direction='OUT', quantity from line
- Balance: decrease

## Finance Isolation
- No finance entry created
- No accounting journal created
- No cost posting
- Not an automatic reconciliation correction

## Number Sequence
- Code: STOCK_ADJUSTMENT
- Prefix: SA-
- Padding: 6
- Scope: GLOBAL
- Domain: inventory

## Permissions
- inventory:stock-adjustment:create, read, update, delete-draft
- inventory:stock-adjustment:submit, approve, reject, post, cancel

## Duplicate Policy
Opening balance duplicate: One POSTED opening balance per (productId, warehouseId, locationId) combination. If a POSTED opening balance line exists for the same product/warehouse/location, block creation.

Adjustment duplicate: No restriction. Multiple adjustments allowed.
