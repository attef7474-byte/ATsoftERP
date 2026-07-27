# Schema Proof — InventoryPhysicalCount + InventoryPhysicalCountLine

## New Models Added

### InventoryPhysicalCount
- Table: `inventory_physical_counts`
- 25 columns: id, countNumber (unique), companyId, branchId, warehouseId, status, countDate, frozenAt, submittedAt, submittedById, approvedAt, approvedById, rejectedAt, rejectedById, rejectedReason, postedAt, postedById, cancelledAt, cancelledById, notes, createdById, createdAt, updatedAt, deletedAt
- 9 indexes on companyId, branchId, warehouseId, status, countDate, countNumber, createdAt, (warehouseId, status), (status, createdAt)
- Statuses: DRAFT, SUBMITTED, APPROVED, POSTED, REJECTED, CANCELLED
- Foreign keys: ->companies, ->branches, ->warehouses

### InventoryPhysicalCountLine
- Table: `inventory_physical_count_lines`
- 13 columns: id, physicalCountId, productId, warehouseLocationId, systemQty, countedQty, varianceQty, notes, createdAt, updatedAt
- 4 indexes: physicalCountId, productId, warehouseLocationId, (physicalCountId, productId)
- Unique constraint: (physicalCountId, productId, warehouseLocationId)
- Foreign keys: ->inventory_physical_counts, ->products, ->warehouse_locations

### Existing Models Used
- InventoryBalance: used for systemQty freeze
- InventoryMovement: COUNT_VARIANCE_IN, COUNT_VARIANCE_OUT movement types
- InventoryMovementLine: associated with variance movements
- NumberSequence: PHYSICAL_COUNT and INVENTORY_MOVEMENT sequences

## Migration File
- `apps/api/prisma/migrations/20260727160000_add_physical_count_variance_control/migration.sql`
- Applied successfully via `prisma migrate deploy`
- Wrapped in BEGIN TRY/BEGIN TRAN with rollback on error
- IF NOT EXISTS guards on table creation

## Key Design Decisions
1. **Backend-calculated variance**: varianceQty is never sent from frontend; always computed as countedQty - systemQty
2. **System quantity freeze**: systemQty is populated from InventoryBalance at line creation time (or at count creation for batch line imports)
3. **No direct StockBalance edit**: all StockBalance changes happen through movement posting only
4. **Transactional posting**: movements and balance updates happen in a single $transaction
