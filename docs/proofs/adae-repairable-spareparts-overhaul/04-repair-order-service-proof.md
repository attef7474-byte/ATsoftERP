# Phase 4 — Backend Repair Order Service Proof

## Module Structure

```
repair-orders/
├── dto/
│   └── repair-order.dto.ts          (10 DTOs for all operations)
├── repair-orders.controller.ts      (17 endpoints)
├── repair-orders.service.ts         (full service with all business logic)
└── repair-orders.module.ts          (registered, imports Audit + SparePartCondition)
```

## Registered in app.module.ts

`RepairOrdersModule` added to imports array.

## Service Capabilities

### READ
- `findAll(query)` — list with filters by status, sparePartId, warehouseId, sourceCondition, maintenanceRequestId, replacementHistoryId, machineId
- `findById(id)` — detail with relations + actions
- `findRepairableQueue(query)` — scan AB-AC replacement history for returned repairable parts

### CREATE
- `create(dto, userId)` — validate source, duplicate guard, generate number, create DRAFT order
- `createFromReplacementHistory(dto, userId)` — auto-fill from AB-AC replacement history

### STATUS TRANSITIONS
- `startInspection` → IN_INSPECTION
- `approveRepair` → APPROVED_FOR_REPAIR
- `startRepair` → UNDER_REPAIR
- `startTest` → UNDER_TEST

### COMPLETE/SCRAP
- `completeServiceable` — validates condition balance, records OUT/IN condition movements, updates order
- `completePartial` — splits quantity between repaired and scrapped
- `scrap` — records condition OUT, marks SCRAPPED
- `cancel` — before any stock mutation, releases reservation

### ACTIONS
- `getActions` — list actions for a repair order
- `addAction` — add inspection/repair/overhaul/test action

### INTERNAL
- `recordConditionMovementInTx` — transactional condition balance update + movement creation (replicates Z-AA pattern)

## Stock Mutation Rules Implemented

| Operation | InventoryBalance | ConditionBalance OUT | ConditionBalance IN |
|-----------|-----------------|---------------------|---------------------|
| Create repair order | NO CHANGE | NO | NO |
| Complete serviceable | NO CHANGE | YES (source) | YES (target) |
| Complete partial | NO CHANGE | YES (source) | YES (target for repaired qty) |
| Scrap | NO CHANGE (documented limitation) | YES (source) | NO |
| Cancel (before mutation) | NO CHANGE | NO | NO |

## Duplicate Prevention

- By `replacementHistoryId` — only one active repair order per replacement
- By `sourceType + sourceId` — only one active repair order per source
- By `status` — checks `notIn: ['CANCELLED', 'SCRAPPED', 'COMPLETED_*']`

## Validation

- Source condition must be USED_REPAIRABLE or DAMAGED_REPAIRABLE
- NEW condition rejected
- Source quantity must not exceed available condition balance
- Warehouse type must be SPARE_PART
- Status transitions follow strict ALLOWED_TRANSITIONS map
- Completed order cannot be transitioned again
- Cancel requires reason
