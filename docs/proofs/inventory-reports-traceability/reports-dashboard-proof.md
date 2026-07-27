# Reports Dashboard Proof: Inventory Reports & Traceability (Batch U)

## Dashboard Cards
The main reports dashboard at `/admin/inventory/reports` displays KPI cards from the `dashboard-cards` endpoint:

| Card | Description |
|---|---|
| totalProducts | Total products in inventory |
| totalStockQty | Total stock quantity across warehouses |
| postedMovements | Count of posted inventory movements |
| negativeBalances | Count of products with negative balance |

## Endpoint Verification
- `GET /reports/inventory/dashboard-cards` — returns cards array with labels and values
- All 4 cards present in API proof response
- Cards render in browser without raw i18n keys

## Read-Only Compliance
- Dashboard uses only aggregate queries (`count`, `sum`)
- No data modification
