# Frontend Proof — Opening Balance + Stock Adjustment

## Pages Created

| Page | Route | Size | Purpose |
|------|-------|------|---------|
| Opening Balances | /admin/inventory/opening-balances | 7.27 kB | List, create, edit, workflow actions |
| Stock Adjustments | /admin/inventory/stock-adjustments | 5.68 kB | List, create, edit, workflow actions |

## Navigation
- **Opening Balances** added under Inventory section in sidebar
- **Stock Adjustments** added under Inventory section in sidebar

## UI Features (Opening Balances)
- List with grid columns: code, warehouse, status, date, reason, line count
- Filters: company, branch, warehouse, status
- Global search on code/reason
- Create modal with F9 selectors for company, branch, warehouse, product
- Lines table with product, quantity, notes
- Workflow buttons: Submit, Approve, Reject, Post, Cancel
- Status badge
- Action buttons enabled/disabled based on document status
- Delete only in DRAFT

## UI Features (Stock Adjustments)
- List with grid columns: code, warehouse, status, date, reason, line count
- Filters: company, branch, warehouse, status
- Global search on code/reason
- Create modal with adjustmentType select (Increase/Decrease)
- Lines table with product, type, quantity
- Workflow buttons: Submit, Approve, Reject, Post, Cancel
- Status badge
- Insufficient stock error shown in API response

## Rules Verified
- No fake rows
- No mock stock
- All data from real API calls
- Every button calls API
- No direct balance edit in UI
- No finance/accounting buttons
- No purchasing/sales buttons
