# Migration Proof — Batch C Machines

## Migration File

**Name:** `20260723063756_add_machine_operational_technical_cost_fields`
**Location:** `apps/api/prisma/migrations/20260723063756_add_machine_operational_technical_cost_fields/migration.sql`

## SQL Operations

1. **ALTER TABLE `machines`** — ADD 5 nullable columns:
   - `productionLineId` NVARCHAR(1000)
   - `operationTypeId` NVARCHAR(1000)
   - `defaultCostCenterId` NVARCHAR(1000)
   - `technicalAdministrationId` NVARCHAR(1000)
   - `technicalDepartmentId` NVARCHAR(1000)

2. **CREATE INDEX** — 5 non-clustered indexes (one per new column)

3. **ADD FOREIGN KEY** — 5 constraints referencing:
   - `production_lines(id)` — NO ACTION on delete/update
   - `operation_types(id)` — NO ACTION on delete/update
   - `cost_centers(id)` — NO ACTION on delete/update
   - `administrations(id)` — NO ACTION on delete/update
   - `departments(id)` — NO ACTION on delete/update

## Safety

- All columns are nullable — existing rows unaffected
- Transaction-wrapped with ROLLBACK on error
- No existing data modified or dropped

## Status

Migration applied and recorded in `_prisma_migrations` table.
