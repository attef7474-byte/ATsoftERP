# Isolation Proof — No HR, Finance, Sales, Purchasing Activation

## Domain Boundaries
The Operational Stock Receiving module operates strictly within the **inventory** domain:

| Domain | Activated? | Evidence |
|--------|-----------|----------|
| Inventory | YES | New models, movements, balances |
| Purchasing | NO | No PO reference, no supplier validation |
| Finance | NO | No GL entries, no costing |
| Sales | NO | No customer reference, no pricing |
| HR | NO | No employee/HR reference |

## Movement Type
`STOCK_RECEIVING` is an inventory-only movement type — distinct from `PURCHASE_RECEIPT`.

## No Pricing/Costing
The receipt tracks only quantities — no unit cost, total cost, or GL account fields exist.
