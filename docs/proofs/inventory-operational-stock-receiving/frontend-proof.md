# Frontend Proof — Operational Stock Receiving

## Pages Created
### List Page
`apps/web/src/app/admin/inventory/operational-receipts/page.tsx`

Features:
- Admin action bar (new, edit, refresh, submit, post, cancel)
- Filterable by Company, Branch, Warehouse, Status
- AdminDataGrid with columns: Doc #, Warehouse, Status, Date, Reason, Supplier, Lines, Created
- Row actions: Edit, Submit, Approve, Reject, Post, Cancel
- Inline line management (add/remove lines)
- Supplier Name and Supplier Doc fields

### Detail Page
`apps/web/src/app/admin/inventory/operational-receipts/[id]/page.tsx`

Features:
- Full document view with all fields
- Lines table with product, quantity, unit, notes
- Admin action bar (back, refresh, submit, approve, reject, post, cancel)
- Timeline display of workflow timestamps
