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
| Total Tests | 125 |
| Passed | 125 |
| Failed | 0 |
| Pass Rate | 100% |
| Date | 2026-07-28 |

## Test Categories
- **Auth guard**: no token / bad token reject (2 tests)
- **Dashboard cards**: 7 tests (cards, labels, values, date ranges)
- **Balance report**: 4 tests (response, cards, rows, labels)
- **Balance filters**: 2 tests (warehouse, location)
- **Pagination**: 3 tests (page=1, page=2, total field)
- **Movements report**: 3 tests (response, cards, rows)
- **Movement filters**: 7 tests (status, direction, sourceType, invalid dates)
- **Stock card**: 13 tests (opening/closing balance, running balance, date ranges, error handling, nonexistent product)
- **Movement types**: 6 tests (cards, types array, field shapes)
- **By warehouse/location**: 4 tests (response, rows)
- **By product**: 5 tests (product, balance, id, invalid id)
- **Source traceability**: 7 tests (response, movements, sourceInfo, second source, unknown source graceful)
- **Movement traceability**: 10 tests (id, movementNumber, movementType, lines, traceResolved, line fields, 404)
- **Exceptions report**: 5 tests (exceptions object, noSourceMovements, graceful empty)
- **Top moving items**: 4 tests (rows, limit)
- **Negative balances / Reconciliation**: 4 tests (response, rows)
- **Read-only integrity**: 2 tests (StockBalances unchanged, InventoryMovements unchanged)
- **Security**: 4 tests (passwordHash, POST/PUT/DELETE rejected)
- **Compatibility Batch Q-T**: 10 tests (all prior inventory modules work)
- **Dashboard date ranges**: 2 tests (2024, 2025)
- **Movements date ranges**: 1 test
- **Source types coverage**: 10 tests (all 10 movement types verified)
- **Combined filters**: 3 tests (status+direction, pagination)
- **Source trace by type**: 5 tests

## Automation
Script: `batch-u-api-proof-expanded.ps1` — 125 authenticated tests with zero data mutation.
