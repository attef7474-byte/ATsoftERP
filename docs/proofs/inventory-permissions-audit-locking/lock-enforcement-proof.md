# Lock Enforcement Proof — Batch V

## Guard design
- `InventoryLockGuard` is a NestJS CanActivate guard
- Reads operation date + warehouse/location/product IDs from request.body
- Queries `inventory_locks` table for active locks matching scope + date range
- Returns 403 Forbidden if any lock matches
- Reports, ledger, reconciliation, traceability are NOT guarded (GET requests pass through)

## Protected posting endpoints
| Module | Operations guarded |
|--------|-------------------|
| Inventory movements | POST (create), PATCH (update), DELETE |
| Inventory adjustments | POST, PATCH, DELETE |
| Stock adjustments | POST, PATCH, DELETE, POST submit/approve/post/cancel |
| Stock transfers | POST, PATCH, DELETE, POST submit/approve/post/cancel |
| Operational receipts | POST, PATCH, DELETE, POST submit/approve/post/cancel |
| Physical counts | POST, PATCH, DELETE, PATCH submit/approve/post/cancel |

## Lock scope matching logic
- PERIOD_LOCK: matches any warehouse/location/product in date range
- WAREHOUSE_LOCK: matches if warehouseId matches
- LOCATION_LOCK: matches if locationId matches
- ITEM_LOCK: matches if productId matches
- GLOBAL_INVENTORY_LOCK: matches all operations in date range

## Blocked posting guarantees
- When guard throws ForbiddenException, the controller method never executes
- No StockBalance change occurs
- No InventoryMovement is created
- Source document status remains unchanged
