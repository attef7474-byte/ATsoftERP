# Backend Proof: Inventory Reports & Traceability (Batch U)

## Service Implementation

### InventoryReportsService (`inventory-reports.service.ts`)
- 12 new read-only methods added:
  1. `getStockCard()` — item ledger with opening/closing balance
  2. `getMovementTypes()` — movement type summary cards
  3. `getByWarehouse()` — warehouse-level balance aggregation
  4. `getByLocation()` — location-level balance aggregation
  5. `getByProduct()` — product detail + current balance
  6. `getBySource()` — source traceability (PO, transfer, etc.)
  7. `getMovementTraceability()` — single movement trace + source resolution
  8. `getExceptions()` — orphan/no-source movements
  9. `getTopMovingItems()` — top products by movement count
  10. `getDashboardCards()` — aggregated KPI cards
  11. `getNegativeBalances()` — products with negative stock
  12. `getReconciliationDifferences()` — balance discrepancies
- All methods use `SELECT`-only Prisma queries; no writes.

### Reports Controller (`reports.controller.ts`)
- 14 new `@Get('inventory/...')` endpoints added.
- DTO (`report-filter.dto.ts`) extended with optional `direction`, `sourceType`, `status` fields.

### Delegation (`reports.service.ts`)
- 14 new methods delegating to `InventoryReportsService`.

### Permissions (`seed-inventory-reports-permissions.ts`)
- 15 new `inventory:reports:*` permissions created and assigned to SUPER_ADMIN.

## Proof
- All endpoints return 200 with correct shapes.
- Auth guard blocks unauthenticated requests.
- Read-only integrity verified: StockBalance and InventoryMovement counts unchanged after report queries.
