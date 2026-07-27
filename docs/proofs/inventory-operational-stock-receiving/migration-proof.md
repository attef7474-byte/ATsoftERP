# Migration Proof — Operational Stock Receiving

## Migration File
`apps/api/prisma/migrations/20260727150000_add_operational_receipts/migration.sql`

## Status
- Migration SQL written with `IF NOT EXISTS` guards for idempotent deployment
- Tables: `inventory_operational_receipts`, `inventory_operational_receipt_lines`
- All FKs, indexes, defaults implemented
- Wrapped in `BEGIN TRY / COMMIT TRAN / ROLLBACK TRAN` for atomicity

## Deployment Method
Applied via `npx prisma migrate deploy` (not `migrate dev` due to P3006 shadow DB limitation).
