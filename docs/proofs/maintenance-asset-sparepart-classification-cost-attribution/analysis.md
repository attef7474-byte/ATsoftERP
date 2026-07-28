# Gap Analysis — Maintenance Asset Structure + Spare Parts Classification + Cost Attribution

## Coverage

- **Maintenance Asset Hierarchy (BOM)**: previously supported via `machine` → `machineComponent` → `componentSparePart` + `machineSparePart` — now enhanced with `technicalClassification`, `usageType`, `nature`, `importance` on `SparePart`.
- **Spare Parts Classification**: 9-class `technicalClassification`, 4-class `usageType`, 4-class `nature`, 4-level `importance` added.
- **Warehouse Type Separation**: `warehouseType` added to `Warehouse` (SPARE_PART, PRODUCT, RAW_MATERIAL, GENERAL); stock issue blocked for PRODUCT/RAW_MATERIAL.
- **Cost Attribution**: `costOwnerType`, `costOwnerAdministrationId`, `costDepartmentId`, `costProductionLineId`, `costMachineId`, `costMachineComponentId`, `unitCost`, `totalCost` added to `MaintenanceRequestRequiredPart`.
- **Receiver Tracking**: `receivedByUserId`, `receivedAt` added to `MaintenanceRequestRequiredPart`.

## Gaps Closed

| Gap | Resolution |
|-----|-----------|
| No technical classification on spare parts | Added `technicalClassification` (String, enum-like) |
| No usage type distinction | Added `usageType` (CONSUMABLE/REPLACEABLE/REPAIRABLE/ROTABLE) |
| No nature/origin tracking | Added `nature` (ORIGINAL/GENERIC/REFURBISHED/LOCAL) |
| No importance level | Added `importance` (CRITICAL/HIGH/MEDIUM/LOW) |
| Warehouse has no type | Added `warehouseType` String field |
| Stock issue doesn't validate warehouse type | Service throws `BadRequestException` for PRODUCT/RAW_MATERIAL |
| Part issue has no cost attribution | Added cost owner, department, production line, machine, unit/total cost |
| No receiver tracking on issue | Added `receivedByUserId`, `receivedAt` |

## Addendum — Part Condition + Replacement Action + Auto-Derivation

| Gap | Resolution |
|-----|-----------|
| No part condition tracking on issue | Added `issuedStockCondition` (NEW/USED_SERVICEABLE/USED_REPAIRABLE/DAMAGED_REPAIRABLE/DAMAGED_NOT_REPAIRABLE) |
| No replacement action model | Added `replacementAction` (RETURNED_REMOVED_PART/NO_REMOVED_PART/NEW_INSTALLATION) |
| No removed part tracking | Added `removedPartCondition`, `removedPartWarehouseId`, `removedPartQuantity`, `removedPartReturnedByUserId`, `removedPartReturnedAt`, `noReturnReason` |
| No auto-derivation from Machine | Backend derives `costDepartmentId`, `costProductionLineId`, `costMachineId` from machine |
| No auto-derivation from SparePart | Classification is always read from catalog, never trusted from frontend |
| Warehouse type expansion | Added REPAIRABLE_SPARE_PART and DAMAGED_SPARE_PART documentation |
| Backend validation rules | Enforced: replacementAction required; RETURNED_REMOVED_PART requires removed fields; NO_REMOVED_PART requires reason; warehouse type blocking |
| Frontend cascade UX | Dynamic form with condition dropdown, replacement action selector, conditional removed-part fields |

## Non-Goals (verified NOT activated)

- No Finance/Accounting activation
- No Purchasing/Procurement activation
- No Sales/CRM activation
- No HR/Personnel activation
- No StockBalance direct manipulation (via InventoryMovement only)
- No InventoryMovement lines creation outside stock issue/return
