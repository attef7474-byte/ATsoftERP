# Transfer Design Proof — Batch R

## Design Decisions

### Workflow
DRAFT → SUBMITTED → APPROVED → POSTED

Same workflow pattern as Opening Balances (Batch Q) and Stock Adjustments. Reject returns to REJECTED terminal state. Cancel works from DRAFT or SUBMITTED. Post only from APPROVED.

### Posting Model — Paired Movements
Each transfer line creates two inventory movements:
1. **STOCK_TRANSFER_OUT** — Deducts from source warehouse/location
2. **STOCK_TRANSFER_IN** — Adds to destination warehouse/location

Both movements share the same transfer reference (`sourceId` = transfer ID) for traceability.

### Stock Balance Impact
- Source: `inventory_balances.quantity -= transfer_line.quantity`
- Destination: `inventory_balances.quantity += transfer_line.quantity`
- Line-level (warehouseLocationId): locationId honored if provided
- Total product quantity across both warehouses = preserved

### Same Source/Dest Prevention
DTO and service validate `sourceWarehouseId !== destinationWarehouseId`. Returns 400 if violated.

### Number Sequence
`STOCK_TRANSFER` with prefix `ST-`, 6-digit padding, starting at 1.

### Permissions
9 granular permissions: `inventory:stock-transfer:{read,create,update,submit,approve,reject,post,cancel,delete-draft}`

### Finance/Accounting
Explicitly excluded. No GL entries, no account codes, no monetary values. Pure inventory movement.

## UI Design

### List Page
- AdminDataGrid with columns: Doc #, From, To, Status, Date, Reason, Lines, Created
- Filters: Company, Branch, Source Warehouse, Destination Warehouse, Status
- Actions: Edit, Submit, Approve, Reject, Post, Cancel (contextual)

### Create/Edit Modal
- Source Warehouse (F9) + optional Source Location (F9)
- Destination Warehouse (F9) + optional Destination Location (F9)
- Reason (required), Notes (optional)
- Lines table with inline Add Line form (Product F9, Quantity, Notes)

### Detail Page
- Description list with all fields
- Lines DataTable
- Action bar with contextual workflow buttons

## Ledger Integration
Transfer movements appear in the existing Inventory Ledger automatically via the movement_type filter. No dedicated ledger changes needed.

## Reconciliation
Reconciliation reads balances and movements. Transfer movements are included since they create actual StockBalance changes. Reconciliation remains read-only.
