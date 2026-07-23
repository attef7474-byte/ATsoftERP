# Migration Proof — Maintenance Request Operational Links

## Migration

Name: `20260723154650_add_maintenance_request_operational_links_required_parts`
Type: Prisma migrate (safe, additive only)
Applied: 2026-07-23

## Changes

1. Added `productionLineId` (nullable) + FK → production_lines
2. Added `machineComponentId` (nullable) + FK → machine_components
3. Added `operationTypeId` (nullable) + FK → operation_types
4. Added `costCenterId` (nullable) + FK → cost_centers
5. Created `maintenance_request_required_parts` table with FKs to maintenance_requests, spare_parts, machine_components, machines
6. Added indexes on all new FK columns
7. All new columns are nullable — existing data preserved

## No Destructive Operations

- No ALTER COLUMN (all new nullable)
- No DROP TABLE
- No DROP COLUMN
- No DELETE
- No prisma db push
- No migrate reset
- No data loss

## Backfill

Backfill rule: For existing requests, set productionLineId from Machine.productionLineId, operationTypeId from Machine.operationTypeId, costCenterId from Machine.defaultCostCenterId where available.

Result: 0 backfilled (machine records lack these optional fields)
