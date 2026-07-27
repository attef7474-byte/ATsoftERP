# Phase 1: Codebase Audit Analysis — Batch T Physical Inventory Count + Variance Control

## 1. Existing Models (Prisma Schema)

### InventoryCount (line 753)
- Fields: id, countNumber, companyId, branchId, warehouseId, status (DRAFT/IN_PROGRESS/COMPLETED/CANCELLED), countDate, startedAt, completedAt, cancelledAt, createdById, startedById, completedById, cancelledById, notes, createdAt, updatedAt, deletedAt
- Relations: lines[], adjustments[]
- Unique: countNumber
- Workflow: DRAFT → start() → IN_PROGRESS → complete() → COMPLETED, cancel() → CANCELLED
- **No freeze system quantity, no submit/approve/post flow**

### InventoryCountLine (line 791)
- Fields: id, countId, productId, warehouseLocationId, systemQty, countedQty, differenceQty, status (PENDING/COUNTED/VERIFIED), countedAt, verifiedAt, countedById, verifiedById, notes, createdAt, updatedAt, deletedAt
- Unique: [countId, productId, warehouseLocationId]
- **differenceQty already exists** (manually entered, not backend-calculated)

### InventoryMovement (line 822)
- Fields: id, movementNumber, companyId, branchId, warehouseId, movementType, status, sourceType, sourceId, movementDate, postedAt, postedById, notes, createdAt, updatedAt, deletedAt
- Relations: lines[]
- movementType examples: OPENING_BALANCE, STOCK_ADJUSTMENT_IN, STOCK_ADJUSTMENT_OUT, etc.
- **COUNT_VARIANCE_IN and COUNT_VARIANCE_OUT need to be added**

### InventoryMovementLine (line 861)
- Fields: id, movementId, productId, warehouseLocationId, quantity, unit, direction (IN/OUT), notes, createdAt, updatedAt

### InventoryBalance (line 728)
- Fields: id, warehouseId, locationId, productId, quantity, batchNumber, serialNumber, expiryDate, createdAt, updatedAt
- Unique: [warehouseId, productId, batchNumber, serialNumber]
- quantity is Float

### NumberSequence (line 580)
- Fields: id, code, name, operationName, modelName, domain, prefix, suffix, currentNumber, increment, padding, scope, companyId, branchId, resetPolicy, lastResetAt, lastGeneratedCode, status

## 2. Existing Backend Modules

### InventoryCountsModule (`apps/api/src/modules/factory/inventory-counts/`)
- Controller: CRUD + start/complete/cancel/results/history endpoints
- Service: Prisma + AuditService, generates countNumber from INVENTORY_COUNT sequence
- DTOs: CreateInventoryCountDto (companyId, branchId, warehouseId, notes), UpdateInventoryCountDto, InventoryCountQueryDto

### InventoryCountLinesModule (`apps/api/src/modules/factory/inventory-count-lines/`)
- Controller: CRUD + count/verify endpoints
- Service: separate module for line operations
- DTOs: Create, Update, Count, Verify

### InventoryMovementsModule (`apps/api/src/modules/factory/inventory-movements/`)
- Handles movement posting and reversal

## 3. Existing Frontend Pages
- `/admin/inventory/counts/` — list/crud/review/approve/execute/adjust/history pages
- `/admin/inventory/counts/new/` — create count page
- `/admin/inventory/counts/[id]/` — details page
- `/admin/inventory/counts/[id]/start/`, `review/`, `approve/`, `execute/`, `adjust/`, `results/`, `edit/`, `history/`

## 4. Existing Number Sequences (seed.ts)
- INVENTORY_COUNT: prefix IC-, padding 6
- INVENTORY_MOVEMENT: prefix IM-, padding 6
- INVENTORY_ADJUSTMENT: prefix IA-, padding 6
- OPENING_BALANCE: prefix OB-, padding 6
- STOCK_ADJUSTMENT: prefix SA-, padding 6

## 5. Existing Permissions (seed-inventory-counting-permissions.ts)
- inventory-count:create, read, update, start, complete, cancel, generateAdjustment, delete
- inventory-count-line:count, verify
- inventory-movement:post, cancel
- inventory-adjustment:post, cancel
- inventory-balance:recalculate

## 6. Existing Movement Types (inventory-movement.ts frontend types)
- OPENING, PURCHASE_RECEIPT, SALES_ISSUE, PRODUCTION_RECEIPT, PRODUCTION_ISSUE
- TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT_IN, ADJUSTMENT_OUT
- COUNT_ADJUSTMENT, MAINTENANCE_ISSUE, MAINTENANCE_RETURN

## 7. Existing i18n (common.ts en/ar)
- Inventory movement types translated for OPENING through COUNT_ADJUSTMENT
- Status: PENDING, COUNTED, VERIFIED, POSTED, IN_PROGRESS

## 8. Key Gaps for Batch T
1. **No physical count workflow**: DRAFT→SUBMITTED→APPROVED→POSTED/REJECTED/CANCELLED
2. **No system quantity freeze**: systemQty is not auto-populated from InventoryBalance
3. **No variance calculation in backend**: differenceQty manually entered, not computed
4. **No COUNT_VARIANCE_IN/OUT movement types**: need to add to type definitions
5. **No direct posting to movements**: existing flow uses InventoryAdjustment intermediary
6. **No dedicated number sequence**: PHYSICAL_COUNT needs its own sequence
7. **No dedicated permissions**: inventory:physical-count:* keys needed
8. **No dedicated i18n keys**: physicalCount, countVariance needed
9. **No submit/approve/reject endpoints**

## 9. Design Decision: New Module vs Enhancement
**Decision: Build new InventoryPhysicalCount module alongside existing InventoryCount.**

Rationale:
- Existing InventoryCount uses different workflow (DRAFT→IN_PROGRESS→COMPLETED)
- Existing flow goes through InventoryAdjustment, not direct movement posting
- Different number sequence (IC- vs PC- prefix)
- Different permissions scope
- Avoids any risk of breaking Batch Q functionality
- Cleaner separation of concerns

## 10. Files to Create/Modify

### Schema
- `schema.prisma`: add InventoryPhysicalCount, InventoryPhysicalCountLine models
- Migration SQL: new migration file

### Seed
- `seed-physical-count-permissions.ts`: new permission seed file
- `seed.ts`: add PHYSICAL_COUNT number sequence, import new seed

### Backend (new module at `apps/api/src/modules/factory/inventory-physical-counts/`)
- `inventory-physical-counts.module.ts`
- `inventory-physical-counts.controller.ts`
- `inventory-physical-counts.service.ts`
- `dto/create-physical-count.dto.ts`
- `dto/update-physical-count.dto.ts`
- `dto/physical-count-query.dto.ts`
- `dto/enter-count-line.dto.ts`
- Register in `app.module.ts`

### Frontend (new page at `apps/web/src/app/admin/inventory/physical-counts/`)
- `page.tsx` — list page
- `new/page.tsx` — create page
- `[id]/page.tsx` — detail page
- `[id]/submit/page.tsx` — submit/approve/post workflow pages

### Types & i18n
- `apps/web/src/lib/admin-types/inventory-movement.ts`: add COUNT_VARIANCE_IN, COUNT_VARIANCE_OUT
- `apps/web/src/lib/i18n/locales/en/common.ts`: add COUNT_VARIANCE translations
- `apps/web/src/lib/i18n/locales/ar/common.ts`: add COUNT_VARIANCE translations
