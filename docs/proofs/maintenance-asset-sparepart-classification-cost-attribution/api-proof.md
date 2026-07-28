# API Proof — Spare Parts Classification + Cost Attribution

## Endpoints Verified

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/maintenance/spare-parts` | ✅ 200 | Create with new classification fields |
| GET | `/maintenance/spare-parts` | ✅ 200 | List with new filter params |
| GET | `/maintenance/spare-parts/:id` | ✅ 200 | Detail with new fields |
| PATCH | `/maintenance/spare-parts/:id` | ✅ 200 | Update classification fields |
| POST | `/inventory/warehouses` | ✅ 200 | Create with warehouseType |
| GET | `/inventory/warehouses` | ✅ 200 | List with warehouseType filter |
| PATCH | `/inventory/warehouses/:id` | ✅ 200 | Update warehouseType |
| GET | `/inventory/warehouses/:id` | ✅ 200 | Detail with warehouseType |
| POST | `/maintenance/requests/:id/parts/:lineId/issue` | ✅ 200 | Issue with cost attribution + receiver |
| GET | `/maintenance/requests/:id/parts/:lineId/issues` | ✅ 200 | List issue history |
| POST | `/maintenance/requests/:id/parts/:lineId/return` | ✅ 200 | Return stock |

## Validation Tests

| Test | Result |
|------|--------|
| Issue from PRODUCT warehouse | ❌ 400 — BadRequestException |
| Issue from RAW_MATERIAL warehouse | ❌ 400 — BadRequestException |
| Issue from SPARE_PART warehouse | ✅ 200 |
| Issue with costOwnerType | ✅ 200, field persisted |
| Issue with unitCost | ✅ 200, totalCost computed |
| Issue with receivedByUserId | ✅ 200, receivedAt set |
| Missing classification fields | ✅ 200 (all nullable, backward compatible) |
| Issue with issuedStockCondition=NEW | ✅ 200 |
| Issue with issuedStockCondition=USED_SERVICEABLE | ✅ 200 |
| Issue with issuedStockCondition=DAMAGED_NOT_REPAIRABLE | ✅ 200 |
| Issue with invalid issuedStockCondition | ❌ 400 |
| Issue with replacementAction=RETURNED_REMOVED_PART (complete) | ✅ 200 |
| Issue with replacementAction=RETURNED_REMOVED_PART (missing removedPartCondition) | ❌ 400 |
| Issue with replacementAction=RETURNED_REMOVED_PART (missing removedPartWarehouseId) | ❌ 400 |
| Issue with replacementAction=NO_REMOVED_PART (with noReturnReason) | ✅ 200 |
| Issue with replacementAction=NO_REMOVED_PART (missing noReturnReason) | ❌ 400 |
| Issue with replacementAction=NEW_INSTALLATION (no removed fields) | ✅ 200 |
| Issue without replacementAction | ❌ 400 |
| Auto-derived costDepartmentId from machine | ✅ derived when not provided |
| Auto-derived costProductionLineId from machine | ✅ derived when not provided |
| Auto-derived costMachineId from machine | ✅ always set |
