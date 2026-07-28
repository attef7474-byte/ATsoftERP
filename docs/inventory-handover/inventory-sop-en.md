# Inventory Standard Operating Procedures — English

## SOP-01: Opening Balance Entry
- **Purpose:** Enter initial stock quantities for a new warehouse or new product
- **Responsible:** Warehouse Officer, Inventory Supervisor
- **Prerequisites:** Products exist, warehouse exists
- **Steps:**
  1. Go to Opening Balances → Create
  2. Select warehouse, enter reason (min 5 chars)
  3. Add lines with product and quantity
  4. Submit for approval
  5. Approve (Inventory Supervisor)
  6. Post
- **Checks after posting:** Verify stock card shows the opening balance
- **Records produced:** OpeningBalance document, OPENING_BALANCE movement
- **Mistakes to avoid:** Do not post without approval. Do not use opening balance for corrections (use stock adjustment instead).

## SOP-02: Stock Adjustment IN/OUT
- **Purpose:** Correct stock when physical count, damage, or discrepancy requires manual adjustment
- **Allowed reasons:** Physical count correction, damage write-off, found surplus, system correction
- **Approval path:** Creator → Inventory Supervisor approve → Post
- **Steps:**
  1. Go to Stock Adjustments → Create
  2. Select IN (increase) or OUT (decrease)
  3. Enter reason
  4. Add lines
  5. Submit → Approve → Post
- **Reconciliation check:** After posting, verify reconciliation shows difference resolved
- **Restrictions:** Cannot edit after posting. Minimum reason length 5 chars.

## SOP-03: Warehouse Transfer
- **Purpose:** Move stock between warehouses
- **Responsible:** Warehouse Officer
- **Conditions:** Source and destination warehouses must be different
- **Steps:**
  1. Go to Transfers → Create
  2. Select source and destination
  3. Add lines
  4. Post
- **Effect:** STOCK_TRANSFER_OUT at source, STOCK_TRANSFER_IN at destination
- **Traceability check:** Use traceability report to verify both movements exist

## SOP-04: Operational Receiving Without Purchasing
- **Purpose:** Receive stock without a purchase order
- **When allowed:** Production returns, found stock, donations, samples
- **Steps:**
  1. Go to Operational Receipts → Create
  2. Select warehouse, enter reason
  3. Add lines
  4. Post
- **Important:** This does NOT create a purchase order or supplier invoice.
- **Reports check:** Verify stock increased in balance summary.

## SOP-05: Maintenance Spare Part Issue
- **Purpose:** Issue spare parts from inventory to a maintenance request
- **Responsible:** Maintenance User or Supervisor
- **Prerequisites:** Maintenance request exists with spare part lines
- **Steps:**
  1. Open maintenance request
  2. Add spare part line items
  3. Issue stock from the request
- **Effect:** Stock decreases (MAINTENANCE_ISSUE)
- **Return option:** If part is not used, use SOP-06.

## SOP-06: Maintenance Spare Part Return
- **Purpose:** Return unused spare parts to inventory
- **Steps:**
  1. Open the maintenance request with the issued part
  2. Return the unused quantity
- **Effect:** Stock increases (MAINTENANCE_RETURN)

## SOP-07: Physical Inventory Count
- **Purpose:** Count actual stock and post variance
- **Responsible:** Warehouse Officer, Inventory Supervisor
- **Steps:**
  1. Go to Physical Counts → Create
  2. System quantity frozen automatically
  3. Enter counted quantity for each item
  4. Explain variances > threshold
  5. Submit for approval
  6. Approve
  7. Post
- **Zero variance:** No movement created if counted = system
- **Post-count reconciliation:** Verify reconciliation after posting

## SOP-08: Inventory Reconciliation Review
- **Purpose:** Review and resolve reconciliation differences
- **Frequency:** Monthly or after significant stock activity
- **Steps:**
  1. Go to Reconciliation
  2. Review current vs expected quantity
  3. Investigate any differences
  4. If legitimate: create stock adjustment (SOP-02)
  5. If data corruption: escalate to administrator
- **Important:** Do NOT edit StockBalance directly. Do NOT delete movements.

## SOP-09: Inventory Reports and Traceability
- **Purpose:** Review stock position and trace movements
- **Reports:**
  - Balance summary: Current quantities by warehouse
  - Stock card: Full history for one product
  - Movement register: All movements with filters
  - Traceability: Source document for each movement
  - Exceptions: Unusual patterns
- **All reports are read-only.** No stock is changed by viewing a report.

## SOP-10: Inventory Locking
- **Purpose:** Prevent stock-affecting postings during freeze periods
- **Steps:**
  1. Go to Locks → Create
  2. Select lock type (PERIOD_LOCK, WAREHOUSE_LOCK, GLOBAL_INVENTORY_LOCK)
  3. Set date range (min 1 day)
  4. Enter reason
  5. Lock auto-activates
  6. To end lock early: Deactivate
- **Blocked:** All stock-affecting POST/PATCH/DELETE
- **NOT blocked:** All GET/read operations including reports

## SOP-11: Inventory Audit Review
- **Purpose:** Review audit trail of lock operations
- **Filters:** Action (CREATE, ACTIVATE, DEACTIVATE), Entity, Date range
- **Sensitive data:** Audit does NOT expose passwords or tokens

## SOP-12: Month-End Inventory Control Checklist
1. Verify no open draft documents older than current month
2. Review reconciliation
3. Investigate and resolve differences
4. Create lock for physical count if needed
5. Post all approved counts
6. Run stock card for high-value items
7. Export final reports
8. Sign off
