# Phase 6 — Z-AA + AB-AC Integration Proof

## Z-AA Integration

### Condition Balance
- Repair service uses `SparePartConditionService.getBalanceByKey()` to validate available balance before operations
- Repair service has its own `recordConditionMovementInTx()` (same pattern as Z-AA's `SparePartConditionService.recordMovement()`)
- On complete serviceable: condition OUT from source, condition IN to target
- On scrap: condition OUT from source only

### Condition Movements Created by Repair Service

| Operation | OUT Movement | IN Movement | SourceType |
|-----------|-------------|-------------|------------|
| Complete serviceable | YES (source) | YES (target) | REPAIR_COMPLETE |
| Complete partial | YES (partial qty to target + scrapped) | YES (repaired qty) | REPAIR_COMPLETE_PARTIAL |
| Scrap | YES (scrapped qty) | NO | REPAIR_SCRAPPED |

### No InventoryBalance mutation
- Product-level InventoryBalance is unchanged during condition conversion
- This follows the same convention as Z-AA condition movements

### No double mutation
- Movements created only once per complete/scrap
- Status guard prevents re-completing or re-scrapping
- Same `recordConditionMovementInTx` transactional pattern

## AB-AC Integration

### Repairable Queue
- Query scans `SparePartReplacementHistory` where `removedReturnedToStock = true`
- Filters by `removedCondition` in `[USED_REPAIRABLE, DAMAGED_REPAIRABLE]`
- Shows existing repair order status if one already exists for this replacement history
- Shows available condition balances for the spare part

### Create from Replacement History
- `POST /api/maintenance/repair-orders/from-replacement-history` auto-fills:
  - sparePartId, productId from history
  - sourceCondition from removedCondition
  - sourceQuantity from removedQuantity/available balance
  - machineId, machineComponentId from history
  - maintenanceRequestId, requiredPartId
  - conditionInMovementId if available

### Duplicate Guard
- Same replacementHistoryId cannot create multiple active repair orders
- Returns `maintenance.repairOrderAlreadyExists` localized error

### AB-AC Regression
- Z-AA condition balances/movements still work unchanged
- AB-AC installed parts/replacement history still work unchanged
- No destructive changes to Z-AA or AB-AC models
