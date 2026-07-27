# Defect Register — Inventory Migration Realignment Corrective

## Open Defects

| # | Severity | Description | Status | Workaround |
|---|----------|-------------|--------|------------|
| DEF-001 | Low | SQL Server key length warnings on NVARCHAR(1000) indexes (cosmetic only) | **ACCEPTED** | CUID values (25 chars) are well under limits. Carried forward from Batch R. |
| DEF-002 | Medium | Prisma `migrate dev` fails with shadow database error (P3006) | **ACCEPTED** | `prisma migrate deploy` works for applying migrations. Shadow DB fix needed only for `migrate dev` workflow. |

## Resolved During Corrective

| # | Description | Resolution |
|---|-------------|------------|
| 1 | Missing Prisma migration for inventory_stock_transfer tables | Created `20260727140000_add_inventory_stock_transfers` with idempotent SQL |
| 2 | Future migrations from empty DB would not create transfer tables | New migration replays correctly from fresh database |

## Summary

No new defects introduced. Both existing defects (DEF-001, DEF-002) are documented with workarounds and do not block acceptance.
