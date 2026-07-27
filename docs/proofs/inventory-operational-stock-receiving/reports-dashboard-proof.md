# Reports Dashboard Proof — Operational Stock Receiving

## Dashboard Integration
The operational receipt data feeds into existing inventory reports:

### Inventory Movements Report
- Filter by `sourceType: 'OPERATIONAL_RECEIPT'`
- Movement type: `STOCK_RECEIVING`

### Inventory Ledger
- Receipt movements appear in ledger with direction IN
- Source reference links back to receipt code

### Inventory Reconciliation
- POST updates balances that reconciliation checks against

## No New Dashboard Widget
Operational receipts reuse existing inventory reports infrastructure. No new dashboard widget was added.
