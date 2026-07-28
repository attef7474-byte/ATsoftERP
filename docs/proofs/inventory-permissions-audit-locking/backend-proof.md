# Backend Proof — Batch V

## Modules created
- `InventoryLocksModule` — registers service + both controllers + guard
- Registered in `AppModule` at `apps/api/src/app.module.ts`

## Services
**InventoryLocksService** (`apps/api/src/modules/factory/inventory-locks/inventory-locks.service.ts`):
- create(dto, userId) — creates lock + audit log
- findAll(query) — paginated list with filters
- findOne(id) — single lock detail
- update(id, dto, userId) — edit lock + audit log
- activate(id, userId) — activate lock + audit log
- deactivate(id, userId) — deactivate lock + audit log
- remove(id, userId) — delete lock + audit log
- checkLock(dto) — check if lock applies for date/warehouse/location/product

## Controllers
**InventoryLocksController** (8 endpoints at `/api/v1/inventory/locks`):
| Method | Path | Permission |
|--------|------|------------|
| POST | / | inventory:lock:create |
| GET | / | inventory:lock:read |
| GET | /:id | inventory:lock:read |
| PATCH | /:id | inventory:lock:update |
| POST | /:id/activate | inventory:lock:activate |
| POST | /:id/deactivate | inventory:lock:deactivate |
| DELETE | /:id | inventory:lock:delete |
| POST | /check | inventory:lock:read |

**InventoryAuditController** (4 endpoints at `/api/v1/inventory/audit`):
| Method | Path | Permission |
|--------|------|------------|
| GET | / | inventory:audit:read |
| GET | /summary | inventory:audit:read |
| GET | /export | inventory:audit:export |
| GET | /:id | inventory:audit:read |

## Guard
**InventoryLockGuard** (`apps/api/src/common/guards/inventory-lock.guard.ts`):
- Applied to 6 posting controllers
- Checks request body for date/warehouseId/locationId/productId
- Queries active locks matching scope + date range
- Throws 403 Forbidden if lock found
- Returns true (pass) if no warehouse/location/product specified

## Posting controllers with lock guard
1. inventory-movements.controller.ts
2. inventory-adjustments.controller.ts
3. inventory-stock-adjustments.controller.ts
4. inventory-stock-transfers.controller.ts
5. inventory-operational-receipts.controller.ts
6. inventory-physical-counts.controller.ts
