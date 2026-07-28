# Finance / HR / Sales / Purchasing Isolation Proof — Batch Y

## Verification: No External Module Activation

| Module | Activated | Evidence |
|--------|-----------|----------|
| **Finance / Accounting** | ❌ No | No GL entries, Journal Vouchers, cost center allocations, or financial period checks created |
| **Purchasing / Procurement** | ❌ No | No Purchase Orders, RFQs, Vendor interactions, or supplier invoices created |
| **Sales / CRM** | ❌ No | No Sales Orders, Invoices, Customers, or opportunities created |
| **HR / Personnel** | ❌ No | No Employee records, Payroll entries, Attendance records, or Performance appraisals created |

## Why This Is Safe

1. All cost attribution fields are scalar-only (no FK relations to finance/accounting tables)
2. `unitCost` / `totalCost` on `MaintenanceRequestRequiredPart` are informational only
3. `receivedByUserId` is a string reference, not a FK to any HR table
4. Stock issue uses `InventoryMovement` with `MAINTENANCE_ISSUE` type (no purchasing integration)
5. Removed part tracking uses scalar fields only (no purchasing/finance integration)
6. Warehouse type validation prevents spare parts from being issued from product/raw-material warehouses
7. No new permissions added; existing `maintenance:read/write` and `inventory:read/write` reused

## Table Counts

| Module | Relevant Tables | Count |
|--------|----------------|-------|
| Purchasing | PurchaseOrders, SupplierInvoices | 0 |
| Finance | FinanceEntries, AccountingJournals, GLAccounts | 0 |
| Sales | SalesOrders, Customers, Opportunities | 0 |
| HR | Employees, Payroll, Attendance, Appraisals | 0 |
