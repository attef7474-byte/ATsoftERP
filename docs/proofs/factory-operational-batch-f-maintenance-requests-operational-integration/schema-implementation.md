# Schema Implementation — Maintenance Request Operational Integration

## MaintenanceRequest Added Fields

| Field | Type | Nullable | Default | Relation |
|-------|------|----------|---------|----------|
| productionLineId | String? | Yes | null | → ProductionLine |
| machineComponentId | String? | Yes | null | → MachineComponent |
| operationTypeId | String? | Yes | null | → OperationType |
| costCenterId | String? | Yes | null | → CostCenter |

All nullable for migration safety — existing records backfilled where possible.

## Indexes Added

- @@index([productionLineId])
- @@index([machineComponentId])
- @@index([operationTypeId])
- @@index([costCenterId])

## MaintenanceRequestRequiredPart

| Field | Type | Nullable | Default | Relation |
|-------|------|----------|---------|----------|
| id | String (cuid) | No | auto | — |
| maintenanceRequestId | String | No | — | → MaintenanceRequest |
| sparePartId | String | No | — | → SparePart |
| machineComponentId | String? | Yes | null | → MachineComponent |
| machineId | String? | Yes | null | → Machine |
| quantity | Float | No | — | — |
| unit | String? | Yes | null | — |
| usageNote | String? | Yes | null | — |
| isPrimary | Boolean | No | false | — |
| status | String | No | "REQUESTED" | REQUESTED/PLANNED/CANCELLED |

## Status Enum

Only REQUESTED, PLANNED, CANCELLED. No ISSUED, CONSUMED, POSTED, INVENTORY_MOVED, FINANCE_POSTED.

## Unique Rules

- @@unique([maintenanceRequestId, sparePartId]) — one spare part per request, prevents duplicates

## Indexes

- @@index([maintenanceRequestId])
- @@index([sparePartId])
- @@index([machineComponentId])
- @@index([machineId])
- @@index([status])

## DB Nullability

- Existing maintenance requests must not break migration — all new fields are nullable
- Backfill: productionLineId from Machine.productionLineId, operationTypeId from Machine.operationTypeId, costCenterId from Machine.defaultCostCenterId
- machineComponentId left null for existing records (cannot infer safely)

## No Stock/Finance

- RequiredPart is planning-only with REQUESTED/PLANNED/CANCELLED statuses
- No inventory movement created
- No finance entry created
- No stock balance changed
