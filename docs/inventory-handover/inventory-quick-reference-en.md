# Inventory Quick Reference — English

| Operation | When to Use | Required Permission | Stock Effect | Movement Type | Source Document | Report to Verify | Common Error |
|-----------|-------------|-------------------|--------------|---------------|----------------|------------------|-------------|
| Opening Balance | First setup or new product | inventory:opening-balance:create/post | Increase | OPENING_BALANCE | OpeningBalance | Stock card | Missing reason |
| Adjustment IN | Correct stock up | inventory:stock-adjustment:create/post | Increase | STOCK_ADJUSTMENT_IN | StockAdjustment | Reconciliation | No approval |
| Adjustment OUT | Correct stock down | inventory:stock-adjustment:create/post | Decrease | STOCK_ADJUSTMENT_OUT | StockAdjustment | Reconciliation | Insufficient stock |
| Transfer OUT | Move stock | inventory:transfer:create/post | Decrease | STOCK_TRANSFER_OUT | InventoryTransfer | Ledger/stock card | Same warehouse |
| Transfer IN | Receive moved stock | inventory:transfer:create/post | Increase | STOCK_TRANSFER_IN | InventoryTransfer | Ledger/stock card | Missing destination |
| Operational Receiving | Receive without PO | inventory:operational-receipt:create/post | Increase | STOCK_RECEIVING | OperationalReceipt | Balance summary | Expecting PO |
| Maintenance Issue | Issue to maintenance | maintenance-stock-issue:create | Decrease | MAINTENANCE_ISSUE | MaintenancePartLine | Traceability | No request |
| Maintenance Return | Return unused part | maintenance-stock-issue:create | Increase | MAINTENANCE_RETURN | MaintenancePartLine | Traceability | No prior issue |
| Count Variance IN | Physical count surplus | inventory:physical-count:create/post | Increase | COUNT_VARIANCE_IN | PhysicalCount | Reconciliation | Unexplained variance |
| Count Variance OUT | Physical count deficit | inventory:physical-count:create/post | Decrease | COUNT_VARIANCE_OUT | PhysicalCount | Reconciliation | Unexplained variance |
| Ledger View | View movements | inventory:ledger:read | None | — | — | — | No filter applied |
| Reconciliation View | Compare balances | inventory:reconciliation:read | None | — | — | — | Expecting zero |
| Stock Card View | Product history | inventory:reports:* | None | — | — | — | Wrong product |
| Traceability View | Find source doc | inventory:reports:* | None | — | — | — | Missing source |
| Lock Create | Freeze posting | inventory:lock:create | None | — | — | Lock list | Date range error |
| Lock Activate | Activate freeze | inventory:lock:activate | None | — | — | Lock list | Already active |
| Lock Deactivate | End freeze | inventory:lock:deactivate | None | — | — | Lock list | Already inactive |
| Audit View | Review log | inventory:audit:read | None | — | — | Audit page | No filters |
