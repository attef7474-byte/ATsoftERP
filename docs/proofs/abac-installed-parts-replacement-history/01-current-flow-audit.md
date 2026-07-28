# AB-AC Phase 1: Current Flow Audit

## Audit Date
2026-07-29

## Scope
Understanding current flow to design MachineInstalledPart + SparePartReplacementHistory

## Models Referenced

### Machine (schema.prisma:1330)
- Has components, parts, documents, maintenance requests, schedules, downtime logs, required parts, spare parts
- No installed-parts relation currently

### MachineComponent (schema.prisma:1430)
- Linked to Machine via machineId
- Has parent-component self-relation for hierarchy

### SparePart (schema.prisma)
- Linked to Product via productId
- Has conditionBalances, conditionMovements (from Z-AA)

### MaintenanceRequestRequiredPart (schema.prisma)
- Unique on [maintenanceRequestId, sparePartId]
- Tracks: status, issuedQuantity, returnedQuantity, stockIssueStatus, replacementAction, removedPartCondition, noReturnReason, warehouseId, lastIssueAt, etc.
- Has conditionMovements relation (from Z-AA)

### SparePartConditionBalance (schema.prisma:2339)
- Unique on [sparePartId, warehouseId, condition]
- quantity, availableQuantity, lastMovementAt

### SparePartConditionMovement (schema.prisma:2362)
- Links to: SparePart, Warehouse, MaintenanceRequest, MaintenanceRequestRequiredPart, InventoryMovement, User
- Tracks: movementNumber, condition, direction, quantity, sourceType, sourceId, replacementAction

## Service Flow

### MaintenanceStockIssueService.issue() (line 87)
1. Validates part line belongs to request
2. Validates replacement action (RETURNED_REMOVED_PART, NO_REMOVED_PART, NEW_INSTALLATION)
3. Validates issued stock condition
4. Validates quantity vs remaining
5. Checks product exists on spare part
6. Validates warehouse type (not PRODUCT/RAW_MATERIAL)
7. Auto-derives cost hierarchy from machine
8. Inside $transaction:
   a. Generates INVENTORY_MOVEMENT number
   b. Gets/creates InventoryBalance, deducts quantity
   c. Creates InventoryMovement with MAINTENANCE_ISSUE type
   d. Updates MaintenanceRequestRequiredPart (issuedQuantity, stockIssueStatus, cost fields)
   e. Records condition OUT movement via SparePartConditionService.recordMovementInTx
   f. If RETURNED_REMOVED_PART, records condition IN movement
9. Audit log

## Integration Point for AB-AC
After condition OUT movement is recorded (step 8e), we need to:
- Create MachineInstalledPart record with status=ACTIVE
- If replacementAction=RETURNED_REMOVED_PART, link via replacement history
- If replacementAction=NO_REMOVED_PART, mark removedNotReturned=true

On returnStock (line 280):
- No installed-part change (installed part stays on machine)
- Future enhancement: could mark as decommissioned if returned

## Data Available at Issue Time
- machineId: from part.maintenanceRequest.machine.id
- machineComponentId: from part.machineComponent?.id
- sparePartId: from part.sparePart.id
- productId: from part.sparePart.productId
- requiredPartId: lineId
- issuedQuantity: dto.issuedQuantity
- issuedCondition: dto.issuedStockCondition || 'NEW'
- replacementAction: dto.replacementAction
- userId: passed as parameter
- removedPartCondition: dto.removedPartCondition
- removedPartQuantity: dto.removedPartQuantity
- noReturnReason: dto.noReturnReason
- inventoryMovementId: movement.id (from created movement)
- conditionMovementId: from the recorded OUT movement
