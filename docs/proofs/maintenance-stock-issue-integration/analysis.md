# Batch O — Maintenance Stock Issue Integration: Phase 1 Audit

## Audit Summary

### Existing Inventory Models
| Model | Purpose | Key Fields | Status |
|-------|---------|------------|--------|
| `InventoryMovement` | Stock movement header | id, movementNumber, companyId, branchId?, warehouseId, movementType, status, sourceType?, sourceId?, movementDate, postedAt, createdById, postedById, notes | FULLY REUSABLE |
| `InventoryMovementLine` | Movement product lines | id, movementId, productId, warehouseLocationId?, quantity, direction (IN/OUT), unit, notes | FULLY REUSABLE |
| `InventoryBalance` | Current stock per warehouse+product | id, warehouseId, locationId?, productId, quantity (Float), batchNumber?, serialNumber?, expiryDate? | UPDATED BY MOVEMENT POST |
| `Warehouse` | Warehouse master | id, companyId, branchId?, code, name, status | EXISTING |
| `WarehouseLocation` | Warehouse bin/location | id, warehouseId, code, status, aisle?, rack?, bin? | EXISTING |
| `Product` | Product master | id, companyId, code, name, type, unitOfMeasure, active | EXISTING |

### Existing Maintenance Part Models
| Model | Purpose | Key Fields | Status |
|-------|---------|------------|--------|
| `MaintenanceRequestRequiredPart` | Spare part line on a request | id, maintenanceRequestId, sparePartId, quantity, status, requestedQuantity, approvedQuantity, reservedQuantity, usedQuantity, warehouseId? | NEEDS EXTENSION for stock issue |
| `SparePart` | Spare part master | id, companyId, productId?, code, name | HAS productId LINK TO INVENTORY |

### Inventory Movement Flow
1. `POST /inventory/movements` → Creates DRAFT with lines (IN direction = inbound, OUT direction = outbound)
2. `POST /inventory/movements/:id/post` → Validates stock sufficiency (OUT lines), updates `InventoryBalance.quantity`, sets status=POSTED
3. `sourceType`/`sourceId` already support polymorphic linking (e.g., sourceType="MAINTENANCE_PART_LINE")

### Decision: Reuse Existing Infrastructure
- **DO NOT** create a separate stock issue table — reuse `InventoryMovement` with `movementType="MAINTENANCE_ISSUE"` and `sourceType="MAINTENANCE_PART_LINE"`
- **DO NOT** duplicate balance update logic — reuse the existing post() flow
- **Minimal schema change**: add `issuedQuantity`, `stockIssueStatus`, `warehouseId`, `lastIssueAt`, `lastIssueByUserId` to `MaintenanceRequestRequiredPart`
- **New module**: `maintenance-stock-issue` with its own controller/service imported into maintenance module
- **Number sequence**: Add `MAINTENANCE_ISSUE` to seed (prefix: `MSI-`)

### Permissions Needed
- `maintenance-stock-issue:create` — issue stock from a part line
- `maintenance-stock-issue:read` — view stock issue movements for a part line

### Gap: No Stock Issue Hint in UI
The current parts tab shows "Stock is not deducted in this phase" and "No inventory movement". After Batch O, APPROVED/RESERVED part lines will have an "Issue Stock" action button.
