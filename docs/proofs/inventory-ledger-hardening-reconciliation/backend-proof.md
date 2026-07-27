# Backend Proof — Inventory Ledger Hardening + Stock Balance Reconciliation

## Module Structure

```
apps/api/src/modules/factory/inventory-ledger-reconciliation/
├── inventory-ledger-reconciliation.controller.ts  (112 lines)
├── inventory-ledger-reconciliation.service.ts     (333 lines)
├── inventory-ledger-reconciliation.module.ts      (15 lines)
```

## Controller Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | inventory/ledger/movements | inventory-ledger:read | List movements with filters (page, limit, search, company, branch, warehouse, type, status, direction, product, source, location, date range) |
| GET | inventory/ledger/movements/:id | inventory-ledger:read | Get movement detail with warehouse, company, and line includes |
| GET | inventory/ledger/by-product | inventory-ledger:read | Filter movements by productId |
| GET | inventory/ledger/by-warehouse | inventory-ledger:read | Filter movements by warehouseId with summary stats |
| GET | inventory/ledger/by-location/:locationId | inventory-ledger:read | Filter movements by location |
| GET | inventory/ledger/by-source | inventory-ledger:read | Filter by sourceType + sourceId |
| GET | inventory/reconciliation/summary | inventory-reconciliation:read | Aggregated reconciliation summary |
| GET | inventory/reconciliation/details | inventory-reconciliation:read | Paginated reconciliation detail lines |
| GET | inventory/reconciliation/by-product/:productId | inventory-reconciliation:read | Per-product reconciliation |
| GET | inventory/reconciliation/by-warehouse/:warehouseId | inventory-reconciliation:read | Per-warehouse reconciliation |
| GET | inventory/reconciliation/differences | inventory-reconciliation:read | Only DIFFERENCE/NEGATIVE_BALANCE lines |
| GET | inventory/reconciliation/orphans | inventory-reconciliation:read | Orphan movements and balances |
| GET | inventory/reconciliation/negative-balances | inventory-reconciliation:read | Balances with quantity < 0 |

## Guards

- All endpoints use `JwtAuthGuard` + `PermissionsGuard`
- Permission strings: `inventory-ledger:read`, `inventory-reconciliation:read`
- Permission migration added in seed file

## Service Methods

| Method | Type | Tables Queried |
|--------|------|----------------|
| findAllLedgerMovements | Read | InventoryMovement, InventoryMovementLine, Warehouse, Company, Product |
| findLedgerMovement | Read | InventoryMovement, Warehouse, Company, InventoryMovementLine, Product, WarehouseLocation |
| findByProduct | Read | InventoryMovement, InventoryMovementLine, Warehouse, Product |
| findByWarehouse | Read | InventoryMovement, InventoryMovementLine, Product |
| findByLocation | Read | InventoryMovement, InventoryMovementLine, Product, WarehouseLocation |
| findBySource | Read | InventoryMovement, Warehouse |
| reconciliationSummary | Read | InventoryBalance, InventoryMovement, InventoryMovementLine |
| reconciliationDetails | Read | InventoryBalance, Product, Warehouse |
| reconciliationByProduct | Read | InventoryBalance, Product |
| reconciliationByWarehouse | Read | InventoryBalance, Product, Warehouse |
| reconciliationDifferences | Read | Delegates to reconciliationDetails, filtered |
| reconciliationOrphans | Read | InventoryMovement, InventoryBalance |
| reconciliationNegativeBalances | Read | InventoryBalance |

## Data Flow

1. Ledger queries read from `InventoryMovement` via Prisma with `deletedAt: null` filter
2. Reconciliation computes expected balance by summing IN/DELTA movements minus OUT movements per product/warehouse/location
3. Current balance is read directly from `InventoryBalance.quantity`
4. Difference = currentBalance - expectedBalance
5. All reconciliation endpoints are read-only composable queries

## Verified

- Build: ✅ PASS
- Typecheck: ✅ PASS
- API proof: 70/70 PASS, 6 N/A
