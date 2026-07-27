# Backend Proof — InventoryPhysicalCounts Module

## Module Structure
```
apps/api/src/modules/factory/inventory-physical-counts/
├── inventory-physical-counts.module.ts
├── inventory-physical-counts.controller.ts
├── inventory-physical-counts.service.ts
└── dto/
    ├── create-physical-count.dto.ts
    ├── update-physical-count.dto.ts
    ├── physical-count-query.dto.ts
    ├── enter-count-line.dto.ts
    └── reject-physical-count.dto.ts
```

## Controller Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | /inventory/physical-counts | inventory:physical-count:create | Create count |
| GET | /inventory/physical-counts | inventory:physical-count:read | List counts |
| GET | /inventory/physical-counts/:id | inventory:physical-count:read | Get count detail with lines |
| PATCH | /inventory/physical-counts/:id | inventory:physical-count:update | Update header |
| DELETE | /inventory/physical-counts/:id | inventory:physical-count:delete | Soft delete |
| POST | /inventory/physical-counts/:id/lines | inventory:physical-count:update | Add line |
| PATCH | /inventory/physical-counts/:id/lines/:lineId/enter | inventory:physical-count:enter-line | Enter counted quantity |
| PATCH | /inventory/physical-counts/:id/submit | inventory:physical-count:submit | Submit for approval |
| PATCH | /inventory/physical-counts/:id/approve | inventory:physical-count:approve | Approve |
| PATCH | /inventory/physical-counts/:id/reject | inventory:physical-count:reject | Reject (back to DRAFT) |
| PATCH | /inventory/physical-counts/:id/post | inventory:physical-count:post | Post (create movements) |
| PATCH | /inventory/physical-counts/:id/cancel | inventory:physical-count:cancel | Cancel |
| GET | /inventory/physical-counts/:id/results | inventory:physical-count:read | Summary results |
| GET | /inventory/physical-counts/:id/history | inventory:physical-count:read | Audit history |

## Service Key Methods

### create(dto, userId)
- Generates countNumber from PHYSICAL_COUNT number sequence (prefix PC-, 6-digit padding)
- Creates header record with status DRAFT
- Optionally creates lines with systemQty from InventoryBalance
- Audit log: CREATE

### addLine(physicalCountId, productId, warehouseLocationId, userId)
- Validates DRAFT status
- Checks for duplicate (physicalCountId, productId, warehouseLocationId)
- Queries InventoryBalance to auto-populate systemQty
- Audit log: ADD_LINE

### enterCount(physicalCountId, lineId, dto, userId)
- Validates DRAFT/SUBMITTED/REJECTED status
- Calculates varianceQty = countedQty - systemQty (backend only!)
- Updates line with countedQty and varianceQty
- Audit log: ENTER_COUNT

### post(id, userId)
- Validates APPROVED status only
- Validates all lines have countedQty
- Filters lines with non-zero variance
- Within $transaction:
  - Generates INVENTORY_MOVEMENT sequence numbers
  - Creates COUNT_VARIANCE_IN movement for positive variance lines
  - Creates COUNT_VARIANCE_OUT movement for negative variance lines
  - Updates InventoryBalance (increment for variance in, decrement for variance out)
  - Sets count status to POSTED
- Audit log: POST

## Registration
- Module registered in `app.module.ts` (line 107)
- Controller path: `inventory/physical-counts` version 1
