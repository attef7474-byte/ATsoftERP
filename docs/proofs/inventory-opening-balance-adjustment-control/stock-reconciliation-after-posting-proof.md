# Stock Reconciliation After Posting Proof

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Batch P reconciliation shows new movements after posting | ✅ PASS | The reconciliation report (`GET /inventory/reconcile`) includes line items created after the opening-balance / stock-adjustment postings. Movement timestamps match posting timestamps. |
| 2 | Movement types `OPENING_BALANCE`, `STOCK_ADJUSTMENT_IN`, `STOCK_ADJUSTMENT_OUT` appear in ledger | ✅ PASS | `SELECT DISTINCT movement_type FROM inventory_movements WHERE movement_type IN ('OPENING_BALANCE','STOCK_ADJUSTMENT_IN','STOCK_ADJUSTMENT_OUT')` returns all three types. |
| 3 | Reconciliation compares current balances with expected | ✅ PASS | Report logic: `expected_qty = previous_qty + Σ(IN) - Σ(OUT)`; variance column shows `current_qty - expected_qty`. |
| 4 | No auto-correction occurs | ✅ PASS | Reconciliation is read-only. No `UPDATE` or `INSERT` statements are executed during the report generation. Zero entries in `inventory_corrections` table. |
