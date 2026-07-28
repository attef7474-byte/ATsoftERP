# Locking Design Proof — Batch V

## InventoryLock model
Defined in `apps/api/prisma/schema.prisma:510-537`

### Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | String (PK, cuid) | Y | Primary key |
| code | String | Y | Unique lock code |
| lockType | String | Y | PERIOD_LOCK, WAREHOUSE_LOCK, LOCATION_LOCK, ITEM_LOCK, GLOBAL_INVENTORY_LOCK |
| status | String (default ACTIVE) | Y | ACTIVE or INACTIVE |
| dateFrom | DateTime | Y | Lock start |
| dateTo | DateTime | Y | Lock end |
| warehouseId | String? | N | Scoped warehouse |
| locationId | String? | N | Scoped location |
| productId | String? | N | Scoped product |
| sparePartId | String? | N | Scoped spare part |
| reason | String | Y | Why the lock exists |
| notes | String? | N | Optional notes |
| createdByUserId | String? | N | Who created |
| createdAt | DateTime | Y | Auto timestamp |
| updatedAt | DateTime | Y | Auto timestamp |
| activatedByUserId | String? | N | Who activated |
| activatedAt | DateTime? | N | When activated |
| deactivatedByUserId | String? | N | Who deactivated |
| deactivatedAt | DateTime? | N | When deactivated |

### Indexes
- lockType, status, (dateFrom, dateTo), warehouseId, locationId, productId, sparePartId
- Composite: (status, lockType)

## Lock types
| Type | Scope | Enforcement |
|------|-------|-------------|
| PERIOD_LOCK | All inventory by date range | Blocks all posting in date range |
| WAREHOUSE_LOCK | Specific warehouse | Blocks posting for warehouse |
| LOCATION_LOCK | Specific location | Blocks posting for location |
| ITEM_LOCK | Specific product | Blocks posting for product |
| GLOBAL_INVENTORY_LOCK | Entire inventory | Blocks all inventory posting |

## InventoryLockGuard
- Applied to 6 posting controllers via `@UseGuards(InventoryLockGuard)`
- Guards movements, adjustments, stock-adjustments, stock-transfers, operational-receipts, physical-counts
- Reads operation date + warehouse/location/product from request body
- Returns 403 Forbidden if any active lock matches
- Reports, ledger, reconciliation, traceability NOT blocked
