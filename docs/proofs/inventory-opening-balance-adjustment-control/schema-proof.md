# Schema Proof — Opening Balance + Stock Adjustment

## Schema Changes

### New Models Added

| Model | Table | Purpose |
|-------|-------|---------|
| InventoryOpeningBalance | `inventory_opening_balances` | Opening balance document header |
| InventoryOpeningBalanceLine | `inventory_opening_balance_lines` | Opening balance document lines |
| InventoryStockAdjustment | `inventory_stock_adjustments` | Stock adjustment document header |
| InventoryStockAdjustmentLine | `inventory_stock_adjustment_lines` | Stock adjustment document lines |

### Migration

| Property | Value |
|----------|-------|
| Migration file | `20260727130000_add_opening_balance_and_stock_adjustment` |
| Status | Applied |
| Engine | SQL Server (WINCC:50079) |
| Shadow database | Not used (migrate deploy) |
| Existing data | Preserved |
| Destructive changes | None |

### Back-References Added

- `Company.openingBalances`, `Company.stockAdjustments`
- `Branch.openingBalances`, `Branch.stockAdjustments`
- `Warehouse.openingBalances`, `Warehouse.stockAdjustments`
- `WarehouseLocation.openingBalanceDocs`, `WarehouseLocation.openingBalanceLines`, `WarehouseLocation.stockAdjustmentDocs`, `WarehouseLocation.stockAdjustmentLines`
- `Product.openingBalanceLines`, `Product.stockAdjustmentLines`

### Prisma Validation

```
Prisma schema loaded from prisma\schema.prisma.
The schema at prisma\schema.prisma is valid. 🚀
```

### Prisma Generate

```
✔ Generated Prisma Client (v7.8.0) to node_modules\@prisma\client
```

### Forbidden Items Verification

| Item | Status |
|------|--------|
| Destructive migration | NOT used |
| prisma db push | NOT used |
| migrate reset | NOT used |
| Existing data deleted | NOT deleted |
| Finance fields added | NOT added |
| HR fields added | NOT added |
| Direct balance edit table | NOT created |
| SQL Server provider | USED |
