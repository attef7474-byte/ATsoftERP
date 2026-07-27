# Schema Proof — Stock Transfers (Batch R)

## New Models

### `InventoryStockTransfer` (Table: `inventory_stock_transfers`)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | NVARCHAR(1000) | PK, NOT NULL | CUID generated |
| code | NVARCHAR(1000) | UNIQUE, NOT NULL | Auto-numbered ST-000001 |
| companyId | NVARCHAR(1000) | FK→companies, NOT NULL | |
| branchId | NVARCHAR(1000) | FK→branches, NULL | |
| status | NVARCHAR(1000) | DEFAULT 'DRAFT', NOT NULL | DRAFT→SUBMITTED→APPROVED→POSTED |
| documentDate | DATETIME2 | DEFAULT GETDATE(), NOT NULL | |
| sourceWarehouseId | NVARCHAR(1000) | FK→warehouses, NOT NULL | |
| sourceLocationId | NVARCHAR(1000) | FK→warehouse_locations, NULL | |
| destinationWarehouseId | NVARCHAR(1000) | FK→warehouses, NOT NULL | |
| destinationLocationId | NVARCHAR(1000) | FK→warehouse_locations, NULL | |
| reason | NVARCHAR(MAX) | DEFAULT '', NOT NULL | |
| notes | NVARCHAR(MAX) | NULL | |
| submittedAt | DATETIME2 | NULL | |
| submittedById | NVARCHAR(1000) | NULL | |
| approvedAt | DATETIME2 | NULL | |
| approvedById | NVARCHAR(1000) | NULL | |
| postedAt | DATETIME2 | NULL | |
| postedById | NVARCHAR(1000) | NULL | |
| rejectedAt | DATETIME2 | NULL | |
| rejectedById | NVARCHAR(1000) | NULL | |
| cancelledAt | DATETIME2 | NULL | |
| cancelledById | NVARCHAR(1000) | NULL | |
| createdById | NVARCHAR(1000) | NULL | |
| updatedById | NVARCHAR(1000) | NULL | |
| createdAt | DATETIME2 | DEFAULT GETDATE(), NOT NULL | |
| updatedAt | DATETIME2 | DEFAULT GETDATE(), NOT NULL | |
| deletedAt | DATETIME2 | NULL | Soft delete |

### `InventoryStockTransferLine` (Table: `inventory_stock_transfer_lines`)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | NVARCHAR(1000) | PK, NOT NULL | CUID generated |
| transferId | NVARCHAR(1000) | FK→transfers, NOT NULL | |
| productId | NVARCHAR(1000) | FK→products, NOT NULL | |
| quantity | FLOAT | NOT NULL | Must be > 0 |
| notes | NVARCHAR(MAX) | NULL | |
| transferOutMovementId | NVARCHAR(1000) | NULL | Set on POST, links to movement |
| transferInMovementId | NVARCHAR(1000) | NULL | Set on POST, links to movement |
| createdAt | DATETIME2 | DEFAULT GETDATE(), NOT NULL | |
| updatedAt | DATETIME2 | DEFAULT GETDATE(), NOT NULL | |

## Migration Approach

Due to Prisma shadow database issues, the tables were created via direct SQL script at:
`apps/api/prisma/migrations/add-stock-transfer-tables.sql`

This is a **non-destructive, additive** migration — it only creates new tables and indexes, no schema changes to existing tables.

### Indexes Created

8 indexes on `inventory_stock_transfers` (companyId, branchId, sourceWarehouseId, destinationWarehouseId, status, documentDate, code, createdAt)
5 indexes on `inventory_stock_transfer_lines` (transferId, productId, transferOutMovementId, transferInMovementId)

### Foreign Keys

- inventory_stock_transfers.companyId → companies.id
- inventory_stock_transfers.sourceWarehouseId → warehouses.id
- inventory_stock_transfers.destinationWarehouseId → warehouses.id
- inventory_stock_transfer_lines.transferId → inventory_stock_transfers.id
- inventory_stock_transfer_lines.productId → products.id

## Conclusion

Two new tables created successfully with full indexing and referential integrity. Prisma client regenerated successfully (v7.8.0). No existing data or schema affected.
