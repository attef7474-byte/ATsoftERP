# Z-AA — Implementation Map

## 1. Schema (`schema.prisma`)

| Model | Fields | Notes |
|-------|--------|-------|
| `SparePartConditionBalance` | id, sparePartId, productId?, warehouseId, condition, quantity, availableQuantity, lastMovementAt, createdAt, updatedAt | Unique: (sparePartId, warehouseId, condition) |
| `SparePartConditionMovement` | id, movementNumber (unique), sparePartId, productId?, warehouseId, condition, direction (IN/OUT), quantity, sourceType?, sourceId?, maintenanceRequestId?, requiredPartId?, inventoryMovementId?, replacementAction?, notes?, createdByUserId?, createdAt | |

**Reverse relations added to**:
- `SparePart` → `conditionBalances`, `conditionMovements`
- `Warehouse` → `conditionBalances`, `conditionMovements`
- `MaintenanceRequest` → `conditionMovements`
- `MaintenanceRequestRequiredPart` → `conditionMovements`
- `User` → `conditionMovements`

## 2. Migration (`zaa_add_sparepart_condition_balance.sql`)

- `CREATE TABLE spare_part_condition_balances` with:
  - PK on id (NVARCHAR(1000))
  - FK to spare_parts, warehouses
  - Unique constraint on (sparePartId, warehouseId, condition)
  - Indexes on sparePartId, productId, warehouseId, condition, lastMovementAt
- `CREATE TABLE spare_part_condition_movements` with:
  - PK on id (NVARCHAR(1000))
  - Unique on movementNumber
  - FK to spare_parts, warehouses, maintenance_requests, maintenance_request_required_parts, users
  - Indexes on sparePartId, productId, warehouseId, condition, direction, sourceType+sourceId, maintenanceRequestId, requiredPartId, createdAt

## 3. Backend Module

| File | Purpose |
|------|---------|
| `spare-part-conditions/spare-part-conditions.module.ts` | NestJS module, imports AuditModule |
| `spare-part-conditions/spare-part-conditions.service.ts` | All balance/movement business logic |
| `spare-part-conditions/spare-part-conditions.controller.ts` | REST API endpoints |
| `spare-part-conditions/dto/condition-movement.dto.ts` | Request/query DTOs |

### API Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/spare-part-conditions/balances` | `spare-part-conditions:read` |
| GET | `/api/v1/spare-part-conditions/balances/:id` | `spare-part-conditions:read` |
| GET | `/api/v1/spare-part-conditions/by-spare-part/:sparePartId` | `spare-part-conditions:read` |
| GET | `/api/v1/spare-part-conditions/by-warehouse/:warehouseId` | `spare-part-conditions:read` |
| POST | `/api/v1/spare-part-conditions/movements` | `spare-part-conditions:create` |
| GET | `/api/v1/spare-part-conditions/movements` | `spare-part-conditions:read` |
| GET | `/api/v1/spare-part-conditions/movements/:id` | `spare-part-conditions:read` |
| GET | `/api/v1/spare-part-conditions/by-required-part/:requiredPartId` | `spare-part-conditions:read` |

## 4. Numbering

- `numbering.constants.ts`: Added `SPARE_PART_CONDITION_MOVEMENT` entity code
- `seed.ts`: Added `SPARE_PART_CONDITION_MOVEMENT` sequence (prefix: `SCM-`, padding: 6)
- Frontend numbering page: Added filter option

## 5. Integration

In `MaintenanceStockIssueService.issue()`:
- After InventoryMovement creation and part line update, records a `SparePartConditionMovement` with direction `OUT` for issued part condition
- If `replacementAction === 'RETURNED_REMOVED_PART'`, also records a `SparePartConditionMovement` with direction `IN` for removed part
- Uses `recordConditionMovementInTx()` inline method with same transaction (`tx`)
- Updates/creates `SparePartConditionBalance` records atomically

## 6. i18n

| Key | Arabic | English |
|-----|--------|---------|
| `stock.insufficientConditionBalance` | الرصيد حسب الحالة غير كافٍ | Insufficient condition balance |
| `stock.invalidCondition` | حالة غير صالحة | Invalid condition |
| `stock.invalidDirection` | اتجاه الحركة غير صالح | Invalid movement direction |
| `stock.conditionMovementNotFound` | حركة الحالة غير موجودة | Condition movement not found |

Frontend: Added `SPARE_PART_CONDITION_MOVEMENT` to EN/AR `settings.ts` (both `operationNameMap` and `modelNameMap`).
