# Migration Proof: User ↔ OperationalPerson Unique Link

## Status: COMPLETE

### Migration Steps Executed
1. Created `operational_people` table with all required columns
2. Backfilled 17 rows from `maintenance_personnel` (same PKs)
3. Created indexes: code, category, userId, isActive
4. Created filtered unique index `UX_operational_people_userId_not_null`
5. Added `operationalPersonId` column to `maintenance_personnel`
6. Backfilled `operationalPersonId` = same IDs
7. Set `operationalPersonId` NOT NULL
8. Added unique constraint on `operationalPersonId`
9. Added FK to `operational_people`
10. Dropped old columns from `maintenance_personnel`: code, name, phone, email, notes, userId
11. Dropped associated constraints and indexes
12. Registered migration in `_prisma_migrations`

### Verified
- `prisma validate` ✅ PASS
- `prisma generate` ✅ PASS
- 17 OperationalPerson rows exist
- 17 MaintenancePersonnel rows preserved
- All operationalPersonId values backfilled correctly
- Foreign key operationalPersonId → operational_people.id
- Unique constraint on operationalPersonId
- Filtered unique index on operationalPeople.userId WHERE NOT NULL
