# API Proof: Inventory Reports & Traceability (Batch U)

## Endpoints

| Category | Method | Endpoint | Description |
|---|---|---|---|
| Dashboard | GET | `/reports/inventory/dashboard-cards` | Aggregated KPI cards |
| Balances | GET | `/reports/inventory/balances` | Stock balance summary |
| Movements | GET | `/reports/inventory/movements` | Movement listing with filters |
| Stock Card | GET | `/reports/inventory/stock-card` | Item ledger (opening/closing balance) |
| Movement Types | GET | `/reports/inventory/movement-types` | Movement type breakdown |
| By Warehouse | GET | `/reports/inventory/by-warehouse` | Warehouse-level summary |
| By Location | GET | `/reports/inventory/by-location` | Location-level summary |
| By Product | GET | `/reports/inventory/by-product/:productId` | Product detail with current balance |
| By Source | GET | `/reports/inventory/by-source/:sourceType/:sourceId` | Source traceability |
| Traceability | GET | `/reports/inventory/traceability/:movementId` | Movement trace detail |
| Exceptions | GET | `/reports/inventory/exceptions` | Orphan/no-source movements |
| Top Moving | GET | `/reports/inventory/top-moving-items` | Top moving products |
| Negative Balances | GET | `/reports/inventory/negative-balances` | Products with negative stock |
| Reconciliation Diff | GET | `/reports/inventory/reconciliation-differences` | Balance discrepancies |

## Proof Results

| Metric | Value |
|---|---|
| Total Tests | 54 |
| Passed | 54 |
| Failed | 0 |
| Pass Rate | 100% |
| Date | 2026-07-28 |

## Test Categories
- **Auth guard**: no token / bad token reject (2 tests)
- **Dashboard cards**: 5 cards verified (4 tests)
- **Balance/Movements**: basic report integrity (4 tests)
- **Stock card**: product lookup, opening/closing balance, missing productId (5 tests)
- **Movement types**: types array, cards (3 tests)
- **Warehouse/Location summaries**: 200 OK (2 tests)
- **By product**: detail, balance, invalid id (4 tests)
- **Source traceability**: movements array (2 tests)
- **Movement traceability**: lines, traceResolved, invalid id (4 tests)
- **Exceptions**: object, noSourceMovements (3 tests)
- **Top moving / Negative / Reconciliation**: 200 OK (3 tests)
- **Filters**: status filter, invalid date (2 tests)
- **Pagination**: page=1, page=2 (2 tests)
- **Read-only integrity**: StockBalances/Movements unchanged (2 tests)
- **Security**: passwordHash not exposed (1 test)
- **Compatibility**: Batch Q–T endpoints still work (5 tests)
- **Summaries / Empty state** (3 tests)

## Automation
Script: `batch-u-api-proof.ps1` — 54 authenticated tests with zero data mutation.
