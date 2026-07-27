# Batch P — Inventory Ledger Hardening + Stock Balance Reconciliation: Audit

## Current Schema / Models

### InventoryMovement
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| movementNumber | String (unique) | Auto-generated via `INVENTORY_MOVEMENT` number sequence |
| companyId | String | FK → Company |
| branchId | String? | FK → Branch |
| warehouseId | String | FK → Warehouse |
| movementType | String | OPENING / PURCHASE_RECEIPT / SALES_ISSUE / PRODUCTION_RECEIPT / PRODUCTION_ISSUE / TRANSFER_IN / TRANSFER_OUT / ADJUSTMENT_IN / ADJUSTMENT_OUT / COUNT_ADJUSTMENT / MAINTENANCE_ISSUE / MAINTENANCE_RETURN |
| status | String | DRAFT (default) / POSTED / CANCELLED |
| sourceType | String? | e.g. MAINTENANCE_PART_LINE |
| sourceId | String? | ID of source record |
| movementDate | DateTime | |
| postedAt | DateTime? | |
| cancelledAt | DateTime? | |
| createdById | String? | |
| postedById | String? | |
| cancelledById | String? | |
| notes | String? | |
| deletedAt | DateTime? | Soft delete |

### InventoryMovementLine
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| movementId | String | FK → InventoryMovement |
| productId | String | FK → Product |
| warehouseLocationId | String? | FK → WarehouseLocation |
| quantity | Float | Always positive |
| unit | String? | |
| direction | String | IN / OUT |

### InventoryBalance
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| warehouseId | String | FK → Warehouse |
| locationId | String? | FK → WarehouseLocation |
| productId | String | FK → Product |
| quantity | Float | Updated by POSTED movements and adjustments |
| batchNumber | String? | |
| serialNumber | String? | |
| expiryDate | DateTime? | |

### SparePart → Product link
- `SparePart.productId` (String?, FK → Product)

### MaintenanceRequestRequiredPart (Batch O fields)
- `issuedQuantity` (Float?, default 0)
- `returnedQuantity` (Float?, default 0)
- `stockIssueStatus` (String?, default NOT_ISSUED)
- `warehouseId` (String?, FK → Warehouse)
- `lastIssueAt` (DateTime?)
- `lastIssueByUserId` (String?, FK → User)

## Current API Endpoints

### Inventory Module (warehouses / locations / adjustments / balances)
- `POST /inventory/warehouses` — create warehouse
- `GET /inventory/warehouses` — list warehouses
- `GET /inventory/warehouses/:id` — warehouse detail
- `PATCH /inventory/warehouses/:id` — update warehouse
- `DELETE /inventory/warehouses/:id` — soft delete warehouse
- `PATCH /inventory/warehouses/:id/activate` — activate
- `PATCH /inventory/warehouses/:id/deactivate` — deactivate
- `GET /inventory/warehouses/:id/summary` — warehouse summary
- `GET /inventory/warehouses/:warehouseId/locations` — locations by warehouse
- `POST /inventory/locations` — create location
- `GET /inventory/locations` — list locations
- `GET /inventory/locations/:id` — location detail
- `PATCH /inventory/locations/:id` — update location
- `DELETE /inventory/locations/:id` — deactivate location
- `PATCH /inventory/locations/:id/activate` — activate
- `GET /inventory/locations/:id/balances` — location balances
- `POST /inventory/adjustments` — stock adjustment
- `GET /inventory/balances` — list balances

### Inventory Balances Module (summary + balance queries)
- `GET /inventory/summary/balances` — balance summary
- `GET /inventory/summary/counts` — count summary
- `GET /inventory/summary/movements` — movement summary
- `GET /inventory/summary/adjustments` — adjustment summary
- `GET /inventory/balances` — list with filters (warehouseId, productId, search, page)
- `GET /inventory/balances/:id` — balance by ID
- `GET /inventory/balances/product/:productId` — by product
- `GET /inventory/balances/by-location/:locationId` — by location
- `POST /inventory/balances/recalculate` — full recalculate (writes to DB)

### Inventory Movements Module
- `POST /inventory/movements` — create movement (DRAFT)
- `GET /inventory/movements` — list with filters (movementType, status, warehouseId, dateRange, search)
- `GET /inventory/movements/:id` — movement detail with lines
- `PATCH /inventory/movements/:id` — update notes
- `PATCH /inventory/movements/:id/post` — post movement (updates balance)
- `PATCH /inventory/movements/:id/cancel` — cancel movement
- `POST /inventory/movements/:id/lines` — add line
- `PATCH /inventory/movements/:id/lines/:lineId` — update line
- `DELETE /inventory/movements/:id/lines/:lineId` — remove line
- `GET /inventory/movements/:id/summary` — movement totals

### Maintenance Stock Issue Module (Batch O)
- `POST /maintenance/requests/:id/parts/:lineId/stock-issue/issue` — issue stock (creates POSTED MAINTENANCE_ISSUE)
- `POST /maintenance/requests/:id/parts/:lineId/stock-issue/return` — return stock (creates POSTED MAINTENANCE_RETURN)

## Current Frontend Pages

### Inventory Pages (42 files)
- `/admin/inventory/warehouses/` — CRUD
- `/admin/inventory/product-categories/` — CRUD
- `/admin/inventory/products/` — CRUD with balances/qr/label
- `/admin/inventory/counts/` — full workflow
- `/admin/inventory/movements/` — list/detail/new/edit/lines
- `/admin/inventory/adjustments/` — list/detail/new/edit/lines
- `/admin/inventory/balances/` — list/detail
- `/admin/inventory/locations/` — CRUD

### Reports (5 inventory reports)
- `/admin/reports/inventory` — overview
- `/admin/reports/inventory/balances` — balances report
- `/admin/reports/inventory/movements` — movements report
- `/admin/reports/inventory/adjustments` — adjustments report
- `/admin/reports/inventory/count-variance` — count variance

## Current Permissions (inventory)
- `inventory:create`, `inventory:read`, `inventory:update`, `inventory:delete`
- `inventory-count:*` — various count actions
- `inventory-movement:create`, `inventory-movement:read`, `inventory-movement:update`, `inventory-movement:post`, `inventory-movement:cancel`
- `inventory-adjustment:post`, `inventory-adjustment:cancel`
- `inventory-balance:read`, `inventory-balance:recalculate`
- `warehouse:activate`, `warehouse:deactivate`
- `warehouse-location:activate`, `warehouse-location:deactivate`
- `product:activate`, `product:deactivate`
- `product-category:activate`, `product-category:deactivate`
- `maintenance-stock-issue:create`, `maintenance-stock-issue:read`

## Balance Update Mechanism
1. Movement created as DRAFT with lines (no balance impact)
2. `POST /inventory/movements/:id/post` transitions to POSTED:
   - For each line, find-or-create `InventoryBalance(warehouseId, productId, locationId)`
   - Delta = `+quantity` for IN, `-quantity` for OUT
   - Negative stock check (throws BadRequest if insufficient)
   - Update balance row
   - Set status=POSTED, postedAt, postedById
3. Maintenance issue/return bypass DRAFT→POSTED: creates movement directly in POSTED status, applies balance delta in same transaction

## Audit Mechanism
- AuditService logs `POST`, `ISSUE_STOCK`, `RETURN_STOCK`, `RECALCULATE` actions
- Audit entries in `audit_log` table

## Risks / Gaps
- No dedicated ledger view (movements visible only through `/inventory/movements`)
- No reconciliation between current balances and movement-calculated expected balances
- Posting a movement with zero/negative quantity is prevented at DTO level (`@Min(0.001)`)
- `recalculate()` deletes all balances and re-creates from movements — high risk operation
- No visibility into maintenance issue/return movements from inventory reports
- No difference/orphan/negative-balance detection
- `POST /inventory/balances/recalculate` is the only "reconciliation" — but it mutates data

## Audit Matrix

| Area | Model/Table | Page | API | Current behavior | Missing behavior | Needs migration | Needs backend | Needs frontend | Integrity risk | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Movement list | InventoryMovement | `/admin/inventory/movements` | `GET /inventory/movements` | Lists with filters | No dedicated "ledger" view | No | No | Yes (ledger page) | Low | Add ledger page reusing existing endpoint |
| Movement detail | InventoryMovement | `/admin/inventory/movements/[id]` | `GET /inventory/movements/:id` | Shows movement with lines | No link to ledger context | No | No | No | Low | Existing page sufficient |
| Movement by product | InventoryMovementLine | — | `GET /inventory/balances/product/:id` | Shows balance only | No movement detail by product | No | Yes | No | Medium | Add ledger by-product endpoint |
| Movement by warehouse | InventoryMovement | — | `GET /inventory/movements?warehouseId=` | Filters by warehouse | No aggregated view | No | Yes | No | Medium | Add ledger by-warehouse endpoint |
| Movement by source | InventoryMovement | — | — | Source tracking exists but no dedicated endpoint | No way to query by sourceType/sourceId | No | Yes | No | Low | Add ledger by-source endpoint |
| Reconciliation summary | Computed | — | — | `POST /recalculate` mutates data | No read-only reconciliation | No | Yes | Yes | HIGH | Add read-only reconciliation API |
| Reconciliation details | Computed | — | — | No reconciliation at all | No difference/orphan/negative detection | No | Yes | Yes | HIGH | Add reconciliation detail endpoints |
| Negative balance detection | Computed | — | — | Prevented during post | No report of negative balances | No | Yes | Yes | Medium | Add negative-balance detection endpoint |
| Orphan movement detection | Computed | — | — | No detection | Movements without product/warehouse/source reference | No | Yes | Yes | Medium | Add orphan detection endpoint |
| Maintenance issue visibility | InventoryMovement | — | `GET /inventory/movements?movementType=MAINTENANCE_ISSUE` | Visible through filter only | No dedicated maintenance view | No | Yes | Yes | Medium | Include in reconciliation |
| i18n | — | — | — | Existing inventory i18n (242 keys) | No ledger/reconciliation keys | No | No | Yes | Low | Add 25+ new i18n keys |
| Permissions | — | — | — | Existing inventory permissions | No ledger/reconciliation-specific permissions | No | No | No | Low | Add permission keys |

## Decision

- **No schema changes** — reconciliation is computed entirely from existing `InventoryMovement`, `InventoryMovementLine`, and `InventoryBalance` tables
- **New module**: `InventoryLedgerReconciliationModule` under `apps/api/src/modules/factory/inventory-ledger-reconciliation/`
- **Ledger endpoints** provide filtered/aggregated movement views
- **Reconciliation endpoints** provide computed read-only reconciliation
- **No auto-correction** — reconciliation only detects and reports differences
- **No stock balance mutation** — all reconciliation APIs are read-only
- **Corrections deferred to Batch Q** (opening balance + stock adjustment workflow)
