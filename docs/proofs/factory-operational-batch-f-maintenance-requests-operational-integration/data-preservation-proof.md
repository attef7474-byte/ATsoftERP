# Data Preservation Proof — Batch F

## Pre-Migration / Post-Migration Comparison

| Metric | Value |
|--------|-------|
| MaintenanceRequests total | 1 |
| MaintenanceRequests with machineId | 1 |
| MaintenanceRequests with productionLineId | 0 (no machine had productionLineId) |
| MaintenanceRequests without productionLineId | 1 |
| MaintenanceRequests with operationTypeId | 0 |
| MaintenanceRequests without operationTypeId | 1 |
| MaintenanceRequests with costCenterId | 0 |
| MaintenanceRequests without costCenterId | 1 |
| MaintenanceRequestRequiredPart before | 0 (table created fresh) |
| MaintenanceRequestRequiredPart after | 0 |
| Existing requests deleted | **0** |
| Existing machines deleted | **0** (count: 2) |
| Existing components deleted | **0** (count: 8) |
| Existing spare parts deleted | **0** (count: 2) |
| Inventory movements created | **0** |
| Stock balances changed | **0** |
| Finance entries created | **0** |

## Backfill Rule

Backfill from Machine:
- productionLineId ← Machine.productionLineId (if Machine has it)
- operationTypeId ← Machine.operationTypeId (if Machine has it)
- costCenterId ← Machine.defaultCostCenterId (if Machine has it)
- machineComponentId ← NOT backfilled (cannot infer safely)

## Remaining Limitations

- 1 maintenance request without productionLineId, operationTypeId, costCenterId
- Reason: The linked machine record does not have productionLineId, operationTypeId, or defaultCostCenterId set. This is expected for existing data where operational context was not captured at machine setup. New requests will capture these fields explicitly.
