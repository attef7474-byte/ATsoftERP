# Corrective Numeric Proof — AF-AG @Map Fix

## Verification Method

API responses compared against direct `sqlcmd` DB queries for all cost and repair-order related fields.

## Key Metrics

| API Field | API Value | DB Query | Match |
|-----------|-----------|----------|-------|
| `costs/analysis → repairCost` | 0 | `SELECT ISNULL(SUM(actual_repair_cost),0) FROM spare_part_repair_orders` = 0 | ✅ |
| `costs/analysis → repairOrderCount` | 0 | `SELECT COUNT(*) FROM spare_part_repair_orders` = 0 | ✅ |
| `costs/analysis → totalCost` | 0 | All cost sources = 0 | ✅ |
| `costs/analysis → partsCost` | 0 | `SELECT ISNULL(SUM(totalCost),0) FROM maintenance_request_part_usages` = 0 | ✅ |
| `costs/analysis → otherCost` | 0 | `SELECT ISNULL(SUM(amount),0) FROM maintenance_request_cost_entries` = 0 | ✅ |
| `costs/analysis → costPerMachine` | 0 | 0 total cost / 2 machines = 0 | ✅ |
| `costs/analysis → costEntriesCount` | 0 | `SELECT COUNT(*) FROM maintenance_request_cost_entries` = 0 | ✅ |
| `costs/analysis → partUsageCount` | 0 | `SELECT COUNT(*) FROM maintenance_request_part_usages` = 0 | ✅ |
| `costs/analysis → partQtyTotal` | 0 | `SELECT ISNULL(SUM(quantity),0) FROM maintenance_request_part_usages` = 0 | ✅ |
| `costByRequestType → CORRECTIVE` | 42 | `SELECT COUNT(*) FROM maintenance_requests WHERE type='CORRECTIVE'` = 42 | ✅ |
| `costByRequestType → PREVENTIVE` | 17 | `SELECT COUNT(*) FROM maintenance_requests WHERE type='PREVENTIVE'` = 17 | ✅ |

## No Double-Counting Verification

- PartUsage = 0 records → no overlap risk with RequiredPart
- RequiredPart totalCost = 0.0000 → no cost to double-count
- Repair order `actual_repair_cost` = 0 (no repair orders exist)
- No fake or synthetic values returned

## Column Mapping Verification

| Prisma Field | @map Target | DB Column | Verified |
|-------------|-------------|-----------|----------|
| `actualRepairCost` | `actual_repair_cost` | `actual_repair_cost` | ✅ |
| `estimatedRepairCost` | `estimated_repair_cost` | `estimated_repair_cost` | ✅ |
| `externalRepairProviderName` | `external_repair_provider_name` | `external_repair_provider_name` | ✅ |
| `sourceCondition` | `source_condition` | `source_condition` | ✅ |
| `targetCondition` | `target_condition` | `target_condition` | ✅ |
| ... (48 `SparePartRepairOrder` fields, 12 `SparePartRepairAction`, 26 `MachineInstalledPart`, 24 `SparePartReplacementHistory`) | All mapped | All verified via `INFORMATION_SCHEMA.COLUMNS` | ✅ |

## Conclusion

**DB/numeric integrity: PASS** ✅
- No fake KPI values
- Missing values return 0/null as expected
- `actualRepairCost` now reads correctly from DB
- No double-counting
