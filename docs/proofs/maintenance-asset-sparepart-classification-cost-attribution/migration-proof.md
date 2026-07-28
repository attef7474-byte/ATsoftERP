# Migration Proof — Spare Parts Classification + Cost Attribution

## Migration Applied

**Migration ID:** `20260728180621_maintenance_sparepart_classification_cost_attribution`

## Schema Changes Verified

| Table | Change | Type |
|-------|--------|------|
| `SparePart` | `technicalClassification` | String (nullable) |
| `SparePart` | `usageType` | String (nullable) |
| `SparePart` | `nature` | String (nullable) |
| `SparePart` | `importance` | String (nullable) |
| `Warehouse` | `warehouseType` | String (nullable) |
| `MaintenanceRequestRequiredPart` | `costOwnerType` | String (nullable) |
| `MaintenanceRequestRequiredPart` | `costOwnerAdministrationId` | String (nullable) |
| `MaintenanceRequestRequiredPart` | `costDepartmentId` | String (nullable) |
| `MaintenanceRequestRequiredPart` | `costProductionLineId` | String (nullable) |
| `MaintenanceRequestRequiredPart` | `costMachineId` | String (nullable) |
| `MaintenanceRequestRequiredPart` | `costMachineComponentId` | String (nullable) |
| `MaintenanceRequestRequiredPart` | `unitCost` | Decimal(18,4) |
| `MaintenanceRequestRequiredPart` | `totalCost` | Decimal(18,4) |
| `MaintenanceRequestRequiredPart` | `receivedByUserId` | String (nullable) |
| `MaintenanceRequestRequiredPart` | `receivedAt` | DateTime (nullable) |

## Indexes Added

- `maintenance_request_required_parts_costOwnerType_idx`
- `maintenance_request_required_parts_costProductionLineId_idx`
- `maintenance_request_required_parts_costMachineId_idx`
- `maintenance_request_required_parts_costMachineComponentId_idx`
- `maintenance_request_required_parts_receivedByUserId_idx`

## Migration 2 — Part Condition + Replacement Action

**Migration ID:** `20260728200621_maintenance_part_condition_replacement_action`

| Table | Column | Type |
|-------|--------|------|
| MaintenanceRequestRequiredPart | `issuedStockCondition` | NVARCHAR(1000) |
| MaintenanceRequestRequiredPart | `replacementAction` | NVARCHAR(1000) |
| MaintenanceRequestRequiredPart | `removedPartCondition` | NVARCHAR(1000) |
| MaintenanceRequestRequiredPart | `removedPartWarehouseId` | NVARCHAR(1000) |
| MaintenanceRequestRequiredPart | `removedPartQuantity` | FLOAT |
| MaintenanceRequestRequiredPart | `removedPartReturnedByUserId` | NVARCHAR(1000) |
| MaintenanceRequestRequiredPart | `removedPartReceivedByUserId` | NVARCHAR(1000) |
| MaintenanceRequestRequiredPart | `removedPartReturnedAt` | DATETIME2 |
| MaintenanceRequestRequiredPart | `noReturnReason` | NVARCHAR(4000) |

### Indexes Added

- `maintenance_request_required_parts_issuedStockCondition_idx`
- `maintenance_request_required_parts_replacementAction_idx`
- `maintenance_request_required_parts_removedPartCondition_idx`
- `maintenance_request_required_parts_removedPartWarehouseId_idx`

## Status

- `prisma migrate status` → Database schema is up to date
- `prisma validate` → ✅ Pass
- `prisma generate` → ✅ Pass
- Existing data preserved (all columns nullable, backward compatible)
