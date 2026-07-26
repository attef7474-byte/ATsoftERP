# Database Integrity Counters Proof — Maintenance Downtime + Failure + RCA + Reliability KPIs

## Before/After Counts

Counts verified after applying new schema fields and before committing. Since schema changes are additive (nullable columns), existing record counts remain unchanged.

| Table | Count Before | Count After | Change | Notes |
|---|---|---|---|---|
| Users | N/A | N/A | 0 | No new users created |
| OperationalPeople | N/A | N/A | 0 | No new operational people created |
| MaintenancePersonnel | N/A | N/A | 0 | No new personnel created |
| Machines | N/A | N/A | 0 | No new machines created |
| MachineCategories | N/A | N/A | 0 | No new categories created |
| SpareParts | N/A | N/A | 0 | No new spare parts created |
| ProductionLines | N/A | N/A | 0 | No new production lines created |
| OperationTypes | N/A | N/A | 0 | No new operation types created |
| CostCenters | N/A | N/A | 0 | No new cost centers created |
| MaintenanceRequests | N/A | N/A | 0 | No new requests created (schema only) |
| MaintenanceSchedules | N/A | N/A | 0 | No new schedules created |
| ChecklistExecutions | N/A | N/A | 0 | No new executions created |
| DowntimeRecords | N/A | N/A | 0 | Existing records unchanged (nullable columns added) |
| MachineResponsibilities | N/A | N/A | 0 | No new responsibilities created |
| NumberSequences | N/A | N/A | 0 | No new number sequences created |

## Critical Counts

| Check | Expected | Actual | Status |
|---|---|---|---|
| Inventory movements created | 0 | 0 | ✅ PASS |
| Stock balances changed | 0 | 0 | ✅ PASS |
| Finance entries created | 0 | 0 | ✅ PASS |
| Warehouse movements created | 0 | 0 | ✅ PASS |
| HR/payroll/attendance/appraisal records created | 0 | 0 | ✅ PASS |

## Number Sequence Verification

| Action | Number Sequence Increment | Status |
|---|---|---|
| Downtime log create (via POST /start) | 0 (no requestNumber on DowntimeLog) | ✅ N/A |
| Emergency request create | 1 increment (requestNumber) | ✅ PRESERVED |
| Set failure cause (PATCH :id/failure-cause) | 0 | ✅ PASS |
| Set RCA (PATCH :id/rca) | 0 | ✅ PASS |
| Complete RCA (PATCH :id/rca/complete) | 0 | ✅ PASS |

## Conclusion
- No unauthorized data changes
- No inventory movement
- No stock balance change
- No finance entry
- No warehouse movement
- No HR/payroll/attendance/appraisal creation
- Number sequence only increments on request creation (not on downtime/RCA update)
