# Phase 1 — Current Repairable Flow Audit

## Existing Repairable Stock Sources

1. **Z-AA SparePartConditionBalance**: Tracks quantities by condition (NEW, USED_SERVICEABLE, USED_REPAIRABLE, DAMAGED_REPAIRABLE, DAMAGED_NOT_REPAIRABLE)
2. **Z-AA SparePartConditionMovement**: Records IN/OUT movements with sourceType/sourceId
3. **AB-AC SparePartReplacementHistory**: Records removed parts with `removedReturnedToStock` flag and `removedCondition`

## Current Returned Removed Part Flow

- MaintenanceStockIssueService.issue() records condition OUT for issued part
- If replacementAction=RETURNED_REMOVED_PART, records condition IN for removed part
- Creates MachineInstalledPart and SparePartReplacementHistory
- Removed part goes to condition balance with the removedPartCondition

## Current Gaps

1. **No repair order lifecycle**: No model to track inspection → repair → test → complete
2. **No overhaul tracking**: No repair action/step records
3. **No integration**: Returned repairable parts sit in condition balance with no workflow to process them back to serviceable
4. **No scrap workflow**: If a removed part is not repairable, there's no structured process to scrap it
5. **No condition conversion**: No structured process to convert USED_REPAIRABLE → USED_SERVICEABLE

## DB Counters (pre-migration)

| Table | Count |
|-------|-------|
| spare_part_condition_balances | 2 |
| spare_part_condition_movements | 4 |
| spare_part_replacement_histories | 0 |
| machine_installed_parts | 0 |
| spare_part_repair_orders | 0 (table did not exist) |
| spare_part_repair_actions | 0 (table did not exist) |

## Schema Decisions

1. String-based statuses (no Prisma enums) — matches project convention
2. SparePartRepairOrder links to existing models via FK strings where applicable
3. SparePartRepairAction as child of repair order for overhaul/action tracking
4. No separate SparePartRepairTest model — tests stored as actions with type=TEST
5. Additive schema only — no existing table changes

## Status Lifecycle

```
DRAFT → OPEN → IN_INSPECTION → APPROVED_FOR_REPAIR → UNDER_REPAIR → UNDER_TEST → COMPLETED_SERVICEABLE
                                                        ↘ WAITING_PARTS ↗
                              INSPECTION_FAILED → SCRAPPED
CANCELLED at any point before completion/scrap
```

## Stock Mutation Rules

1. Creating repair order: NO InventoryBalance change, NO condition movement
2. Completing serviceable: OUT from source condition, IN to target condition
3. Scrapping: OUT from source condition only
4. Product InventoryBalance unchanged for condition conversion

## Risk Assessment

- LOW — additive schema only, no existing data affected
- LOW — no Finance/Purchasing/Sales/HR activation
- MEDIUM — stock mutation in complete/scrap must be transactional and idempotent
- Duplicate guard by replacementHistoryId/sourceType+sourceId prevents double processing
