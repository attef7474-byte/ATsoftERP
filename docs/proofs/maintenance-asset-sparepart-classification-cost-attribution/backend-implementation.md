# Backend Implementation Proof — Batch Y

## Files Modified

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Added 15 new scalar fields across SparePart, Warehouse, MaintenanceRequestRequiredPart |
| `apps/api/prisma/migrations/20260728180621_maintenance_sparepart_classification_cost_attribution/` | Manual migration SQL (applied) |
| `apps/api/src/modules/factory/maintenance/spare-parts/dto/create-spare-part.dto.ts` | Added technicalClassification, usageType, nature, importance to Create + Update DTOs |
| `apps/api/src/modules/factory/maintenance/spare-parts/spare-parts.controller.ts` | Added 4 new filter query params |
| `apps/api/src/modules/factory/maintenance/spare-parts/spare-parts.service.ts` | Added 4 filter conditions to findAll where clause |
| `apps/api/src/modules/factory/inventory/dto/create-warehouse.dto.ts` | Added warehouseType field |
| `apps/api/src/modules/factory/inventory/inventory.controller.ts` | Added warehouseType query param to findAllWarehouses |
| `apps/api/src/modules/factory/inventory/inventory.service.ts` | Added warehouseType filter condition |
| `apps/api/src/modules/factory/maintenance/maintenance-stock-issue/dto/issue-stock.dto.ts` | Added 8 new cost + receiver fields |
| `apps/api/src/modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.service.ts` | Added warehouse type validation (block PRODUCT/RAW_MATERIAL); write cost/receiver fields on issue |

## Addendum — Part Condition + Replacement Action

### New Files Modified

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Added 9 new fields to MaintenanceRequestRequiredPart: issuedStockCondition, replacementAction, removedPartCondition, removedPartWarehouseId, removedPartQuantity, removedPartReturnedByUserId, removedPartReceivedByUserId, removedPartReturnedAt, noReturnReason |
| `apps/api/prisma/migrations/20260728200621_maintenance_part_condition_replacement_action/` | New manual migration (applied) |
| `apps/api/src/modules/factory/maintenance/maintenance-stock-issue/dto/issue-stock.dto.ts` | Added issuedStockCondition, replacementAction, removedPartCondition, removedPartWarehouseId, removedPartQuantity, removedPartReturnedByUserId, noReturnReason |
| `apps/api/src/modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.service.ts` | Added auto-derivation, replacement action validation, stock condition validation, removed-part field handling |
| `apps/web/src/app/admin/maintenance/requests/[id]/page.tsx` | Added dynamic issue form with condition dropdown, replacement action selector, conditional removed-part fields |

### Validation Rules

1. `replacementAction` is **required** for every issue
2. `RETURNED_REMOVED_PART` requires `removedPartCondition`, `removedPartWarehouseId`, `removedPartQuantity`
3. `NO_REMOVED_PART` requires `noReturnReason`
4. `NEW_INSTALLATION` does not require removed part fields
5. `issuedStockCondition` must be one of 5 valid values
6. Warehouse must not be PRODUCT or RAW_MATERIAL

### Auto-Derivation

- `costDepartmentId` derived from `Machine.departmentId` if not provided
- `costProductionLineId` derived from `Machine.productionLineId` if not provided
- `costMachineId` derived from `Machine.id` if not provided
- `costMachineComponentId` derived from `machineComponentId` on the part line if not provided
- Classification fields are always read from `SparePart` catalog, never trusted from frontend

## Architecture Decisions

1. **Cost fields are scalar-only** — no Prisma FK relations to avoid ambiguous relation errors with existing `machine`/`machineComponent` FK fields.
2. **Enums are String fields** — SQL Server (2016 Express) does not support Prisma enum types; validation at application level.
3. **totalCost computed automatically** — `dto.issuedQuantity * dto.unitCost` when `unitCost` is provided.
4. **receivedAt auto-set** — when `receivedByUserId` is provided, `receivedAt` is set to `new Date()`.
