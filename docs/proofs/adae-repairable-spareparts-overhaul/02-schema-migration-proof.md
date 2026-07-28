# Phase 2 — Schema + Migration Proof

## Schema Changes (additive only)

### New Models

1. **SparePartRepairOrder** (48 columns)
   - Links to: SparePart, Product, Warehouse, MaintenanceRequest, MaintenanceRequestRequiredPart, Machine, MachineComponent
   - String references to: ReplacementHistory, InstalledPart, ConditionMovements
   - Fields: repairOrderNumber (unique), sourceCondition, sourceQuantity, status (string), lifecycle timestamps
   - Indexes on: repairOrderNumber, sparePartId, warehouseId, status, sourceCondition, maintenanceRequestId, replacementHistoryId, machineId

2. **SparePartRepairAction** (12 columns)
   - Links to: SparePartRepairOrder (Cascade delete)
   - Fields: actionType, actionStatus, description, result, performedBy, performedAt, durationMinutes
   - Indexes on: repairOrderId, actionType, actionStatus, performedAt

### Reverse Relations Added

- SparePart.repairOrders
- Machine.repairOrders
- MachineComponent.repairOrders
- MaintenanceRequest.repairOrders
- MaintenanceRequestRequiredPart.repairOrders
- Warehouse.repairOrders

## Migration Script

**Path**: `apps/api/prisma/migrations/adae_repairable_spareparts_overhaul.sql`

**Execution**: `sqlcmd -S 127.0.0.1,50079 -U atsofterp_app -P *** -d ATsoftERP_DB -i migration.sql`

## Table Counts

| Metric | Before | After |
|--------|--------|-------|
| Total tables | 83 | 85 |
| Columns | 1182 | ~1248 |

## Prisma

- `npx prisma validate` → PASS
- `npx prisma generate` → PASS

## Backfill Decision

No backfill. Old Z-AA/AB-AC records may be available for manual creation of repair orders, but automatic backfill is not needed since there are no existing repair orders to migrate.

## Data Loss Assessment

- No data loss — additive migration only
- No existing tables altered
- No existing columns dropped or renamed
