# Migration Proof — Stock Transfers (Batch R)

## Approach

Due to Prisma shadow database infrastructure issues (P3006 from prior migration state), the standard `prisma migrate dev` workflow was not available. Instead, a direct SQL migration script was used.

## Migration Script

**File:** `apps/api/prisma/migrations/add-stock-transfer-tables.sql`

### Script Content
- CREATE TABLE `inventory_stock_transfers` (26 columns, 3 FK, 8 indexes)
- CREATE TABLE `inventory_stock_transfer_lines` (8 columns, 2 FK, 5 indexes)
- All DDL wrapped in `IF NOT EXISTS` guards for idempotency

### Execution
```bash
sqlcmd -S "localhost,50079" -d "ATsoftERP_DB" -U "atsofterp_app" -P "****" \
  -i "apps/api/prisma/migrations/add-stock-transfer-tables.sql"
```

## Schema Alignment

The script matches the models defined in `apps/api/prisma/schema.prisma`:
- `schema.prisma` lines 1059-1125 for `InventoryStockTransfer` and `InventoryStockTransferLine`
- All column names use snake_case (Prisma standard naming)
- All FK constraints match Prisma relation names

## Post-Migration Steps

| Step | Command | Status |
|------|---------|--------|
| Prisma generate | `npx prisma generate --schema prisma/schema.prisma` | ✅ Done |
| API build | `npm run build:api` | ✅ Passes |
| Seed number sequence | INSERT INTO number_sequences (STOCK_TRANSFER) | ✅ Done |

## Prisma Config

**File:** `apps/api/prisma.config.ts`
- Schema: `prisma/schema.prisma`
- Migration path: `prisma/migrations`
- Datasource: `DATABASE_URL` env variable
- No shadowDatabaseUrl (removed to avoid blocking `prisma generate`)

## Future Migration Unblocking

To restore `prisma migrate dev` in the future:
1. Configure `shadowDatabaseUrl` in prisma.config.ts pointing to a test database
2. Run `prisma migrate resolve --applied add-stock-transfer-tables` to mark the SQL migration as applied
3. Resume using `prisma migrate dev` for subsequent schema changes

## Conclusion

Migration completed successfully using SQL script. Prisma client regenerated. All post-migration steps verified. A clear path exists to restore the full Prisma migration workflow.
