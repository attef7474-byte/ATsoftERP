# Database Integrity & Counters Proof — Opening Balances & Stock Adjustments

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Tables confirmed via Prisma Migrate | ✅ PASS | `prisma migrate status` confirms migrations applied. Tables present in SQL Server: `inventory_opening_balances`, `inventory_opening_balance_lines`, `inventory_stock_adjustments`, `inventory_stock_adjustment_lines`. |
| 2 | `InventoryBalance` count increased by posted quantities | ✅ PASS | After posting an opening-balance document, the `quantity_on_hand` in `inventory_balances` increased by exactly the sum of line quantities. Atomic `UPDATE ... SET quantity_on_hand = quantity_on_hand + @qty` used. |
| 3 | No balance change without movement | ✅ PASS | Every `inventory_balances` update is preceded by an `INSERT` into `inventory_movements`. Query: `SELECT COUNT(*) FROM inventory_movements WHERE ...` matches `inventory_balances` delta. |
| 4 | No movement without document reference | ✅ PASS | Every `inventory_movements` row has a non-null `opening_balance_id` or `stock_adjustment_id` foreign key. Zero orphan movements found. |
| 5 | Finance / HR / Sales / Purchasing tables unchanged | ✅ PASS | `SELECT COUNT(*)` on `general_ledger_entries`, `payroll_records`, `sales_orders`, `purchase_orders` before and after the batch — zero new rows. |
| 6 | Number sequences `OPENING_BALANCE` and `STOCK_ADJUSTMENT` seeded | ✅ PASS | Rows exist in `number_sequences` table: `{ code: 'OPENING_BALANCE', next_value: 1001 }` and `{ code: 'STOCK_ADJUSTMENT', next_value: 1001 }`. |
