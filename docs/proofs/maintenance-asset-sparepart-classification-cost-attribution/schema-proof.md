# Schema Proof — Batch Y: Maintenance Asset Structure + Spare Parts Classification + Cost Attribution

## Implementation Notes

SQL Server (2016 Express) does not support Prisma `enum` types. All enum-like fields are implemented as `String` with documented valid values, validated at the application level.

## Application-Level Enums (String fields with defined values)

### SparePartTechnicalClassification
Values: `MECHANICAL`, `ELECTRICAL`, `ELECTRONIC`, `HYDRAULIC`, `PNEUMATIC`, `LUBRICANT`, `CHEMICAL`, `SAFETY`, `GENERAL`

### SparePartUsageType
Values: `CONSUMABLE`, `REPLACEABLE`, `REPAIRABLE`, `ROTABLE`

### SparePartNature
Values: `ORIGINAL`, `GENERIC`, `REFURBISHED`, `LOCAL`

### SparePartImportance
Values: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`

### WarehouseType
Values: `SPARE_PART`, `PRODUCT`, `RAW_MATERIAL`, `GENERAL`
(Note: `REPAIRABLE_SPARE_PART` and `DAMAGED_SPARE_PART` are documented as future expansion; current flow uses `issuedStockCondition` + `removedPartCondition` to track condition)

### CostOwnerType
Values: `MAINTENANCE`, `OPERATION`, `PROJECT`, `QUALITY`, `SERVICES`, `GENERAL`

### SparePartStockCondition
Values: `NEW`, `USED_SERVICEABLE`, `USED_REPAIRABLE`, `DAMAGED_REPAIRABLE`, `DAMAGED_NOT_REPAIRABLE`

### SparePartReplacementAction
Values: `RETURNED_REMOVED_PART`, `NO_REMOVED_PART`, `NEW_INSTALLATION`

## Model: SparePart (new fields)

| Field | Type | Notes |
|-------|------|-------|
| technicalClassification | String? | Application-level enum |
| usageType | String? | Application-level enum |
| nature | String? | Application-level enum |
| importance | String? | Application-level enum |

## Model: Warehouse (new field)

| Field | Type | Notes |
|-------|------|-------|
| warehouseType | String? | Application-level enum |

## Model: MaintenanceRequestRequiredPart (new fields)

### Cost attribution (Batch Y original)
| Field | Type | Notes |
|-------|------|-------|
| costOwnerType | String? | Application-level enum |
| costOwnerAdministrationId | String? | Scalar reference |
| costDepartmentId | String? | Derived from Machine |
| costProductionLineId | String? | Derived from Machine |
| costMachineId | String? | Derived from Machine |
| costMachineComponentId | String? | Derived from part line |
| unitCost | Decimal? | User-provided |
| totalCost | Decimal? | Computed: unitCost × issuedQuantity |
| receivedByUserId | String? | Receiver tracking |
| receivedAt | DateTime? | Auto-set when receivedByUserId provided |

### Condition / Replacement Action (Batch Y addendum)
| Field | Type | Notes |
|-------|------|-------|
| issuedStockCondition | String? | Application-level enum |
| replacementAction | String? | Application-level enum, required |
| removedPartCondition | String? | Required if RETURNED_REMOVED_PART |
| removedPartWarehouseId | String? | Required if RETURNED_REMOVED_PART |
| removedPartQuantity | Float? | Required if RETURNED_REMOVED_PART |
| removedPartReturnedByUserId | String? | Who returned the removed part |
| removedPartReceivedByUserId | String? | Who received the removed part |
| removedPartReturnedAt | DateTime? | When removed part was returned |
| noReturnReason | String? | Required if NO_REMOVED_PART |

## All fields are nullable — backward compatible with existing data
