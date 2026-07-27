# Analysis — Inventory Migration Realignment Corrective

## Root Cause

The `InventoryStockTransfer` and `InventoryStockTransferLine` models were added to `schema.prisma` during Batch R development, but the corresponding tables were created via direct SQL (`apps/api/prisma/migrations/add-stock-transfer-tables.sql`) rather than through a formal Prisma migration. This was a workaround for the pre-existing Prisma shadow database issue (P3006).

As a result:
- The Prisma schema (`schema.prisma`) contained models for `inventory_stock_transfers` and `inventory_stock_transfer_lines`
- The actual SQL Server database had the tables
- But there was no migration file tracking these tables in the migration history
- Running `prisma migrate dev` would fail (P3006)
- Any future `prisma migrate deploy` from a clean database would NOT create these tables

## Audit Matrix

| Aspect | Status |
|--------|--------|
| Model exists in schema.prisma? | ✅ Yes (lines 1066-1132) |
| Table exists in SQL Server? | ✅ Yes (inventory_stock_transfers, inventory_stock_transfer_lines) |
| Migration file exists? | ❌ No — missing from prisma/migrations/ |
| Migration applied? | ❌ N/A — no migration to apply |
| Shadow DB can replay? | ❌ P3006 still blocks migrate dev |
| Risk level | Medium — blocks future migrations from clean DB |
| Corrective decision | Create official Prisma migration with idempotent SQL |

## Impact

- No data was lost or at risk
- All accepted Batch R behavior was working
- Only migration workflow was affected
- Corrective is additive only — creates migration file, no schema/schema.prisma changes
