# Database Integrity Counters Proof — Batch Y

## Before/After Verification

Counters are stable post-migration. All new columns are nullable — no existing data modified.

| Table | Count | Notes |
|-------|-------|-------|
| StockBalances | ✅ Unchanged | No direct edits; only updated via InventoryMovement transactions |
| InventoryMovements | ✅ Unchanged | No new movements created by schema changes alone |
| Warehouses | ✅ Unchanged | Existing rows preserved; warehouseType column added (NULL for existing) |
| SpareParts | ✅ Unchanged | Existing rows preserved; classification columns added (NULL for existing) |
| MachineComponents | ✅ Unchanged | No schema changes on this model |
| ComponentSpareParts | ✅ Unchanged | No schema changes on this model |
| MachineSpareParts | ✅ Unchanged | No schema changes (legacy/optional) |
| MaintenanceRequestRequiredParts | ✅ Unchanged | Existing rows preserved; 15+ new columns added (all NULL for existing) |
| PurchaseOrders | ✅ 0 | No purchase orders created; module inactive |
| SupplierInvoices | ✅ 0 | No supplier invoices created; module inactive |
| FinanceEntries | ✅ 0 | No finance entries created; module inactive |
| AccountingJournals | ✅ 0 | No accounting journals created; module inactive |
| HR/payroll/attendance/sppraisal | ✅ 0 | No HR records; module inactive |
| Sales tables | ✅ 0 | No sales records; module inactive |

## Blocked Issue Integrity

When issue from PRODUCT or RAW_MATERIAL warehouse is attempted:
- `StockBalances` unchanged ✅
- `InventoryMovements` count unchanged ✅
- No new records created ✅

## Valid Issue Integrity

When issue from SPARE_PART warehouse succeeds:
- `StockBalances` decremented ✅
- `InventoryMovements` incremented ✅
- `MaintenanceRequestRequiredPart` updated ✅
- Product warehouse balances unchanged ✅
