# Database Integrity Proof — Counters & Constraints

## Unique Constraints
1. `inventory_physical_counts.countNumber` — ensures no duplicate count numbers
2. `inventory_physical_count_lines` — (physicalCountId, productId, warehouseLocationId) — prevents duplicate line entries

## Foreign Keys
1. inventory_physical_counts.companyId → companies(id) ON DELETE NO ACTION
2. inventory_physical_counts.branchId → branches(id) ON DELETE NO ACTION
3. inventory_physical_counts.warehouseId → warehouses(id) ON DELETE NO ACTION
4. inventory_physical_count_lines.physicalCountId → inventory_physical_counts(id) ON DELETE NO ACTION
5. inventory_physical_count_lines.productId → products(id) ON DELETE NO ACTION
6. inventory_physical_count_lines.warehouseLocationId → warehouse_locations(id) ON DELETE NO ACTION

## Transactional Integrity
1. Count creation (with lines): wrapped in $transaction — either all lines created or none
2. Post operation: wrapped in $transaction — movements + balance updates are atomic
3. Number sequence increment: inside transaction to prevent gaps under concurrent access

## Cascade Rules
- No cascade deletes (all ON DELETE NO ACTION) — prevents accidental data loss
- Soft delete via deletedAt timestamp for header records

## Indexes
- 9 indexes on inventory_physical_counts for query performance
- 4 indexes on inventory_physical_count_lines

## Data Validation
- systemQty: always populated from InventoryBalance, never from user input
- varianceQty: always computed by backend, never from user input
- countedQty: user-entered, validated as number
- status: constrained to valid transitions by backend logic

## Proof Results (2026-07-27)
| Metric | Value |
|--------|-------|
| Total checks | 29 |
| Passed | 29 |
| Failed | 0 |
| Pass rate | 100.0% |

### Verified Counters
- 11 total physical counts (0 DRAFT, 1 SUBMITTED, 4 APPROVED, 4 POSTED, 2 CANCELLED)
- 14 total count lines across all counts
- 6 StockBalance records
- 59 total InventoryMovements (5 variance-related: 4 COUNT_VARIANCE_IN, 1 COUNT_VARIANCE_OUT)
- All POSTED counts (PC-000001, PC-000008, PC-000009, PC-000013) verified with movements
- All PHYSICAL_COUNT and INVENTORY_MOVEMENT number sequences active with correct prefixes
- No orphaned data: all POSTED counts have movements, all productId FK references valid
- No negative StockBalance records
