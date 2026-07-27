# Database Integrity Counters — Operational Stock Receiving (Batch S)

## Counters

| Metric | Value | Status |
|--------|-------|--------|
| Operational Receipts (total) | 18 | PASS |
| Operational Receipts (DRAFT) | 1 | PASS |
| Operational Receipts (SUBMITTED) | 0 | PASS |
| Operational Receipts (APPROVED) | 0 | PASS |
| Operational Receipts (POSTED) | 6 | PASS |
| Operational Receipts (CANCELLED) | 6 | PASS |
| Operational Receipts (REJECTED) | 5 | PASS |
| Operational Receipt Lines | 18 | PASS |
| Stock Balance (product) | 1200 | PASS |
| Movements (total) | 54 | PASS |
| Movements (STOCK_RECEIVING) | 6 | PASS |
| Movements (linked to OPERATIONAL_RECEIPT) | 6 | PASS |
| Number Sequence (OPERATIONAL_RECEIPT) | OR- prefix, current 18 | PASS |

## Isolation Counters

| Domain | Count | Status |
|--------|-------|--------|
| Purchase Orders | 0 | PASS |
| Finance Entries | 0 | PASS |
| Accounting Journals | 0 | PASS |
| HR Employees | 0 | PASS |
| Sales Orders | 0 | PASS |

## Verifications

- StockBalance increases exactly by posted receipt quantity: **PASS**
- STOCK_RECEIVING movement count (6) matches posted receipt count (6): **PASS**
- InventoryMovements count increases only by expected receipt movement: **PASS**
- OperationalReceipt document/line counts consistent: **PASS**
- No stock balance changed without movement: **PASS**
- No movement created without posted receipt reference: **PASS**
- Purchase orders increase = 0: **PASS**
- Supplier invoices increase = 0: **PASS**
- Finance entries increase = 0: **PASS**
- Accounting journals increase = 0: **PASS**
- HR records increase = 0: **PASS**
- Sales records increase = 0: **PASS**
- Number sequences increment only for official receipt/movement numbering: **PASS**
