# Frontend Proof — Maintenance Request Operational Integration

## Pages Updated

1. **List page** (`/admin/maintenance/requests`):
   - New columns: Production Line, Machine Component, Operation Type, Cost Center, Required Parts Count
   - New filters: productionLineId, machineComponentId, operationTypeId, costCenterId, sparePartId
   - API passes new filter params

2. **Create page** (`/admin/maintenance/requests/new`):
   - New "Operational Context" section with productionLine, machineComponent, operationType, costCenter F9 lookups
   - New "Required Spare Parts" section with dynamic add/remove rows
   - Each row: spare part F9 lookup, quantity, unit, usage note, isPrimary
   - Save sends requiredParts[] in API payload

3. **Detail page** (`/admin/maintenance/requests/[id]`):
   - New fields in info grid: productionLine, machineComponent, operationType, costCenter
   - New "Operational Context" card
   - New "Cost Context" card
   - New "Required Spare Parts" card with table

4. **Edit page** (`/admin/maintenance/requests/[id]/edit`):
   - Same operational context and required parts sections as create
   - Prefilled from loaded data
   - Read-only guard on completed/cancelled requests
   - Diff-based partial patch

## F9 Adapters Used

- productionLineAdapter, machineAdapter, machineComponentAdapter, operationTypeAdapter, costCenterAdapter, sparePartAdapter

## Navigation

- No new sidebar entries added
- No fake future links
- No disabled features
