# Warehouse Type Proof — Batch Y

## Field: warehouseType on Warehouse model

| Type | Description | Spare Part Issue Allowed |
|------|-------------|--------------------------|
| SPARE_PART | Spare parts storage | ✅ Allowed |
| PRODUCT | Finished goods | ❌ Blocked (400 error) |
| RAW_MATERIAL | Raw materials | ❌ Blocked (400 error) |
| GENERAL | General-purpose | ⚠️ Allowed (no product/raw-material restrictions) |

## Implementation

- Field type: `String?` (nullable, backward compatible)
- Added to `CreateWarehouseDto`, `UpdateWarehouseDto` (via PartialType)
- Controller: `warehouseType` query param for filtering warehouses
- Service: Filter condition added to `findAllWarehouses`
- Frontend: warehouseType column in grid, dropdown in create/edit/new forms, badge in detail page
- Frontend filter: `warehouseType` query param

## Stock Issue Warehouse Validation

During stock issue (`POST /maintenance/requests/:id/parts/:lineId/stock-issue/issue`):

1. Warehouse is looked up by ID
2. If `warehouseType` is `PRODUCT` → 400 BadRequestException
3. If `warehouseType` is `RAW_MATERIAL` → 400 BadRequestException
4. `SPARE_PART` and `GENERAL` types are allowed
5. No InventoryMovement is created on blocked attempts
6. No StockBalance change on blocked attempts

## Future Types

`REPAIRABLE_SPARE_PART` and `DAMAGED_SPARE_PART` are documented for future use.
Current flow uses `issuedStockCondition` + `removedPartCondition` fields on `MaintenanceRequestRequiredPart` to track part condition.
