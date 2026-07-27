# Opening Balance Design Proof

## Status
DESIGNED — Ready for implementation.

## Model
### InventoryOpeningBalance
New model under `factory/inventory-opening-balances/` module.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String (cuid) | Auto | Primary key |
| code | String (unique) | Auto-generated | Prefix OB- from NumberSequence |
| companyId | String | Yes | FK to Company |
| branchId | String? | No | FK to Branch |
| warehouseId | String | Yes | FK to Warehouse |
| locationId | String? | No | FK to WarehouseLocation (nullable, location not required) |
| status | String | Default "DRAFT" | Lifecycle: DRAFT → SUBMITTED → APPROVED → POSTED; REJECTED and CANCELLED as terminal |
| documentDate | DateTime | Default now() | Opening balance document date |
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
| deletedAt | DateTime? | No | Soft delete |

### InventoryOpeningBalanceLine
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String (cuid) | Auto | Primary key |
| openingBalanceId | String | Yes | FK to InventoryOpeningBalance |
| productId | String | Yes | FK to Product |
| locationId | String? | No | FK to WarehouseLocation |
| quantity | Float | Yes | Must be >= 0 |
| movementId | String? | No | Set after posting, FK to InventoryMovementLine |
| notes | String? | No | Optional |
| createdAt | DateTime | Auto | Prisma default |
| updatedAt | DateTime | Auto | @updatedAt |

## Status Lifecycle
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
1. **Create**: DRAFT document with code, warehouse, reason, lines. Quantity >= 0.
2. **Update**: Only while DRAFT. Edit code, warehouse, reason, notes, lines.
3. **Submit**: DRAFT → SUBMITTED. Sets submittedAt/submittedById.
4. **Approve**: SUBMITTED → APPROVED. Sets approvedAt/approvedById.
5. **Reject**: SUBMITTED → REJECTED. Terminal. No further action.
6. **Post**: APPROVED → POSTED. Creates InventoryMovement with movementType='OPENING_BALANCE'. Creates movement lines with direction='IN'. Updates InventoryBalance. Sets movementId on each opening balance line. Transactional.
7. **Cancel**: DRAFT or SUBMITTED → CANCELLED. Terminal.
8. **Delete**: Only if DRAFT. Hard delete (no movement posted).
9. **Duplicate policy**: Opening balance for same product/warehouse/location is blocked if a POSTED opening balance already exists for that combination. Policy: one-time baseline per product/warehouse.

## Movement Creation on Post
- movementType: "OPENING_BALANCE"
- sourceType: "OPENING_BALANCE"
- sourceId: openingBalance.id
- Lines: one InventoryMovementLine per opening balance line
  - direction: "IN"
  - quantity: opening balance line quantity
  - productId, warehouseLocationId from line
- Balance update: same transaction, increase InventoryBalance.quantity by line quantity

## Finance Isolation
- No finance entry created
- No accounting journal created
- No cost posting
- Not a purchase receipt
- Not a goods receipt

## Number Sequence
- Code: OPENING_BALANCE
- Prefix: OB-
- Padding: 6
- Scope: GLOBAL
- Domain: inventory

## Permissions
- inventory:opening-balance:create, read, update, delete-draft
- inventory:opening-balance:submit, approve, reject, post, cancel
