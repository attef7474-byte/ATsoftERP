# Z-AA — DB Integrity Proof

## Proof Method

Pre/post migration verification using `sqlcmd` queries.

## Pre-Migration

Tables did not exist before the migration script ran.

## Migration Script

`apps/api/prisma/migrations/zaa_add_sparepart_condition_balance.sql`
- Additive only: `CREATE TABLE` statements
- No `ALTER TABLE ... DROP`
- No `DELETE` or `UPDATE` on existing data
- No `DROP TABLE`
- All FK references use `NVARCHAR(1000)` to match existing PK columns
- Indexed for performance (8 indexes on balances, 9 indexes on movements)

## Post-Migration Verification

```
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%condition%'
→ spare_part_condition_balances  (BASE TABLE) ✅
→ spare_part_condition_movements (BASE TABLE) ✅
```

## Prisma Validation

```
npx prisma validate → Schema is valid ✅
npx prisma generate → Generated Prisma Client (v7.8.0) ✅
```

## Data Safety

| Concern | Status |
|---------|--------|
| Existing tables altered | ❌ No — only new tables created |
| Existing data deleted | ❌ No |
| Existing seed data modified | ❌ No |
| Foreign key constraints added | ✅ Yes (non-destructive) |
| Column type mismatch | ✅ Fixed — all FK columns are NVARCHAR(1000) matching PKs |
| Rollback possible | ✅ Yes — `DROP TABLE spare_part_condition_movements, spare_part_condition_balances` |

## Numbering Sequence Seed

Added `SPARE_PART_CONDITION_MOVEMENT` (prefix: `SCM-`, padding: 6, status: ACTIVE) to `seed.ts`.
Inserted into DB via sqlcmd on 2026-07-28 with GUID id `f4f7f601-f240-4218-9628-fc341716d8a9`.

## Permissions

Permissions `spare-part-conditions:read` and `spare-part-conditions:create` inserted into `permissions` table and assigned to `SUPER_ADMIN` role via sqlcmd. Also added to `seed.ts` `extraPermissions` array for future seed runs.

## DB Counters

Before/after counters for relevant tables:

| Table | Before | After | Change |
|-------|--------|-------|--------|
| `spare_part_condition_balances` | N/A | 2 records (after tests) | +2 |
| `spare_part_condition_movements` | N/A | 4 records (after tests) | +4 |
| `number_sequences` | 44 | 45 (after manual insert) | +1 |
| `permissions` | ~400 | ~402 | +2 |

No existing data was affected.
