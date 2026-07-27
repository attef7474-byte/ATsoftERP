# Isolation Proof — Finance / HR / Sales / Purchasing

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Finance entries created | 0 | `SELECT COUNT(*) FROM general_ledger_entries WHERE reference_type IN ('OPENING_BALANCE','STOCK_ADJUSTMENT')` → 0 |
| 2 | Accounting journals created | 0 | `SELECT COUNT(*) FROM accounting_journals WHERE source = 'INVENTORY_BATCH_Q'` → 0 |
| 3 | HR / Payroll records created | 0 | `SELECT COUNT(*) FROM payroll_records WHERE source = 'INVENTORY'` → 0 |
| 4 | Attendance / Appraisal records created | 0 | `SELECT COUNT(*) FROM attendance_records WHERE source = 'INVENTORY'` → 0; `SELECT COUNT(*) FROM appraisals WHERE source = 'INVENTORY'` → 0 |
| 5 | Sales records created | 0 | `SELECT COUNT(*) FROM sales_orders WHERE source = 'INVENTORY'` → 0 |
| 6 | Purchasing records created | 0 | `SELECT COUNT(*) FROM purchase_orders WHERE source = 'INVENTORY'` → 0 |
| 7 | No HR module activation | ✅ PASS | Configuration table `module_settings` shows `hr` → `{ active: false }`. |
| 8 | No Finance module activation | ✅ PASS | `module_settings` shows `finance` → `{ active: false }`. |
| 9 | No BI module activation | ✅ PASS | `module_settings` shows `bi` → `{ active: false }`. |
| 10 | No Sales / Purchasing activation | ✅ PASS | `module_settings` shows `sales` → `{ active: false }` and `purchasing` → `{ active: false }`. |
