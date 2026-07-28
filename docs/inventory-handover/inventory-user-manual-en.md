# Inventory Module User Manual — English

## 1. Introduction
The Inventory Module handles stock movements across the organization including maintenance stock, warehouse transfers, physical counts, and operational receiving. This module covers Batches O through W.

**What this module covers:**
- Opening balances, stock adjustments, warehouse transfers
- Operational receiving (without purchasing)
- Maintenance spare part issue and return
- Physical count and variance control
- Inventory ledger and reconciliation
- Reports, traceability, and exceptions
- Inventory locks, audit, and permissions

**What this module does NOT cover:**
- Finance (not activated)
- Purchasing (not activated)
- Sales (not activated)
- HR (not activated)

## 2. User Roles
- **Warehouse Officer**: Creates transfers, adjustments, physical counts, operational receipts
- **Maintenance User**: Issues spare parts to maintenance requests, returns unused parts
- **Maintenance Supervisor**: Approves maintenance stock transactions
- **Inventory Supervisor**: Approves adjustments, physical counts, manages locks
- **Administrator**: Assigns permissions, manages system configuration
- **Auditor/Viewer**: Reads reports, ledger, reconciliation, audit logs (no write access)

## 3. Navigation
Inventory pages are under `/admin/inventory/`. Key routes:
- Reports: `/admin/inventory/reports`
- Stock card: `/admin/inventory/reports/stock-card`
- Traceability: `/admin/inventory/reports/traceability`
- Ledger: `/admin/inventory/ledger`
- Reconciliation: `/admin/inventory/reconciliation`
- Opening balances: `/admin/inventory/opening-balances`
- Stock adjustments: `/admin/inventory/stock-adjustments`
- Transfers: `/admin/inventory/transfers`
- Operational receipts: `/admin/inventory/operational-receipts`
- Physical counts: `/admin/inventory/physical-counts`
- Locks: `/admin/inventory/locks`
- Governance audit: `/admin/inventory/governance-audit`

## 4. Master Data Prerequisites
Before using inventory operations, the following must exist:
- Products or spare parts
- Warehouses (e.g., wh1, wh2)
- Locations (optional, per warehouse)
- Users with assigned permissions
- Production lines, machines, components (for maintenance context)

## 5. Opening Balance
**When to use:** When first setting up inventory or introducing a new product.
1. Navigate to Opening Balances
2. Click Create
3. Select warehouse, enter reason
4. Add lines (product, quantity)
5. Submit for approval
6. Post the document
**Stock effect:** Increases stock balance by the line quantities. Movement type: OPENING_BALANCE.
**Common errors:** Forgetting to post, missing reason.

## 6. Stock Adjustment
### Adjustment IN
1. Navigate to Stock Adjustments
2. Click Create, select IN direction
3. Enter reason (required)
4. Add lines with product and quantity
5. Submit, approve, then post
### Adjustment OUT
Same steps but select OUT direction. Stock decreases. Reason is required.
**Movement types:** STOCK_ADJUSTMENT_IN, STOCK_ADJUSTMENT_OUT
**Important:** After posting, adjustments cannot be edited or deleted.

## 7. Warehouse Transfer
1. Navigate to Transfers
2. Click Create
3. Select source and destination warehouses
4. Add lines with quantities
5. Post
**Effect:** Stock decreases at source (STOCK_TRANSFER_OUT) and increases at destination (STOCK_TRANSFER_IN).
**Limitations:** Source and destination must be different warehouses.

## 8. Operational Receiving (Without Purchasing)
1. Navigate to Operational Receipts
2. Click Create
3. Select warehouse, enter reason
4. Add lines
5. Post
**Important:** This does NOT create a purchase order or supplier invoice. It is for operational receipts only (e.g., returns from production, found stock).
**Movement type:** STOCK_RECEIVING

## 9. Maintenance Issue & Return
### Issue Spare Part to Maintenance
1. Open a maintenance request that needs parts
2. Add spare part lines to the request
3. Issue the stock from the request
**Effect:** Stock decreases. Movement type: MAINTENANCE_ISSUE.
### Return Spare Part
1. Open the request with the issued part
2. Return the unused quantity
**Effect:** Stock increases. Movement type: MAINTENANCE_RETURN.

## 10. Physical Count and Variance
1. Navigate to Physical Counts
2. Create a new count for a warehouse
3. System quantity is frozen at creation time
4. Enter the counted quantity for each item
5. System calculates variance (counted - system)
6. Explain significant variances
7. Submit for approval
8. Post the count
**Stock effect:** If variance exists, posting creates COUNT_VARIANCE_IN or COUNT_VARIANCE_OUT movements.
**Zero variance:** If counted equals system, no movement is created.

## 11. Ledger and Reconciliation
### Ledger
Shows all inventory movements in chronological order. Filter by movement type, warehouse, or date.
### Reconciliation
Compares current stock balance (from StockBalance table) against expected balance (calculated from ledger movements). Differences appear when manual edits occur or data is inconsistent.
**What to do if mismatch appears:** Investigate the source documents. Do NOT edit StockBalance directly. Create a stock adjustment to fix if needed.
**What must NOT be done:** Do NOT edit StockBalance directly. Do NOT delete InventoryMovement records.

## 12. Reports and Traceability
Reports are read-only. They include:
- **Balance summary:** Current stock by warehouse
- **Stock card:** Opening balance, all movements, closing balance for one product
- **Movement register:** All movements with filters
- **Traceability:** Shows which source document created each movement
- **Exceptions:** Highlights unusual situations

## 13. Locks and Audit
### Locks
Create locks to prevent stock-affecting postings during specific periods or for specific warehouses.
- **PERIOD_LOCK:** Blocks all warehouses in a date range
- **WAREHOUSE_LOCK:** Blocks one warehouse in a date range
- **GLOBAL_INVENTORY_LOCK:** Blocks everywhere
- Locks auto-activate on creation. They can be deactivated.
- When locked, posting returns a 403 Forbidden response.
- Reports remain accessible under lock.
### Audit
All lock mutations are logged. View in Governance Audit page. Sensitive fields (passwords, tokens) are not exposed.

## 14. Permissions
Each inventory operation requires a specific permission. If a button is hidden or disabled, your role does not include the required permission. Contact your administrator.

## 15. Troubleshooting
See the inventory-troubleshooting-en.md guide.

## 16. Limitations
See inventory-limitations-and-controls-en.md for full details.
