# Batch Q — Audit Analysis: Opening Balance + Stock Adjustment Control

## Audit Date
2026-07-27

## Scope
Audit current inventory schema, code, pages, and endpoints for opening balance and stock adjustment readiness.

## Audit Matrix

| Area | Model/Table | Page | API | Current behavior | Missing behavior | Needs migration | Needs backend | Needs frontend | Stock risk | Finance risk | Decision | Status |
|------|------------|------|-----|-----------------|-----------------|---------------|--------------|--------------|-----------|-------------|----------|--------|
| Opening balance | None | None | None | Does not exist | Create model, lines, workflow, posting, movement | Yes | Yes | Yes | Low (no existing impact) | None | Build new | PENDING |
| Stock adjustment (control) | None | None | None | Does not exist | Create model, lines, IN/OUT, workflow, posting, movement | Yes | Yes | Yes | Low (no existing impact) | None | Build new | PENDING |
| Stock adjustment (legacy) | InventoryAdjustment | /admin/inventory/adjustments | POST /v1/inventory/adjustments | Count-based variance settlement (systemQty/countedQty/differenceQty) | Not an approval-controlled adjustment | No | No | No | Low (separate use case) | None | Keep existing for counting | EXISTS |
| Direct balance edit | InventoryBalance | None | POST /v1/inventory/adjustments (adjustStock) | `adjustStock()` directly updates `InventoryBalance.quantity` without movement or approval | No document, no movement, no approval | No change | No change | No change | HIGH | None | Document as risk, do not use | EXISTS_RISK |
| InventoryMovement | InventoryMovement | /admin/inventory/movements | POST /v1/inventory/movements | DRAFT → POSTED → CANCELLED, creates `InventoryMovementLine`, updates balance | No SUBMITTED/APPROVED/REJECTED workflow | No | No change | No change | Low | None | Reuse movement creation for posting | EXISTS |
| StockBalance | InventoryBalance | /admin/inventory/balances | GET /v1/inventory/balances | Read-only queries, auto-created on movement/adjustment posting | No direct edit exposed in UI | No | No change | No change | Low | None | Read-only, update only through movement | EXISTS |
| Movement types | string field | N/A | N/A | `MAINTENANCE_ISSUE`, `MAINTENANCE_RETURN`; free-text string | No `OPENING_BALANCE`, `STOCK_ADJUSTMENT_IN`, `STOCK_ADJUSTMENT_OUT` | No | Add new types | No | Low | None | Add new movement type strings | PENDING |
| Status workflow | string field | Various | Various | DRAFT/POSTED/CANCELLED for movements; DRAFT/POSTED/CANCELLED for adjustments | No SUBMITTED/APPROVED/REJECTED workflow exists in inventory | No | New status strings for new models | New status badges | Low | None | Use DRAFT→SUBMITTED→APPROVED→POSTED for new models | PENDING |
| Number sequence | NumberSequence | /admin/settings/numbering | Various | Prefix-based: IM-, IA-, IC-, etc. | No OPENING_BALANCE or STOCK_ADJUSTMENT sequence | Yes (add seeds) | No new service needed | No | Low | None | Add sequences for new documents | PENDING |
| Permissions | Permission | /admin/access/permissions | Various | Pattern: `module:action` (e.g., `inventory-ledger:read`) | No `opening-balance:*` or `stock-adjustment:*` permissions | Yes (seed) | No | No | Low | None | Add permission seeds | PENDING |
| Warehouse | Warehouse | /admin/inventory/warehouses | CRUD | Supports code, name, status, company/branch | No change needed | No | No | No | None | None | Reuse | EXISTS |
| WarehouseLocation | WarehouseLocation | /admin/inventory/locations | CRUD | Supports code, name, warehouse FK | No change needed | No | No | No | None | None | Reuse | EXISTS |
| Product | Product | /admin/inventory/products | CRUD | Supports code, name, unit, min/max stock | No change needed | No | No | No | None | None | Reuse | EXISTS |
| i18n | Translation files | All pages | N/A | Namespaces: inventory, inventoryCounting, inventoryCountWorkflow, inventoryLedger, inventoryReconciliation | No opening balance or stock adjustment labels | Yes (add to inventory namespace or new namespace) | No | Yes | Low | None | Add i18n keys | PENDING |
| Navigation | navigation-data.ts | Sidebar | N/A | Inventory section has warehouses, products, counts, movements, adjustments, balances, locations, ledger, reconciliation | No opening balance or stock adjustment entries | No | No | Yes | Low | None | Add nav entries | PENDING |
| Reports | Reports module | /admin/reports/inventory | Reports API | Overview, balances, movements, adjustments, count-variance reports | No opening balance or stock adjustment reports | No | If needed | If needed | Low | None | Add reports if dashboard requires | PENDING |

## Existing Model Details

### InventoryMovement (schema.prisma:797)
- Fields: id, movementNumber (unique), companyId, branchId?, warehouseId, movementType (string), status (string, default "DRAFT"), sourceType?, sourceId?, movementDate, postedAt?, cancelledAt?, createdById?, postedById?, cancelledById?, notes?, createdAt, updatedAt, deletedAt?
- Lines: InventoryMovementLine[] (productId, warehouseLocationId?, quantity, unit?, direction IN/OUT, notes)
- Statuses: "DRAFT", "POSTED", "CANCELLED"

### InventoryBalance (schema.prisma:703)
- Fields: id, warehouseId, locationId?, productId, quantity (Float, default 0), batchNumber?, serialNumber?, expiryDate?, createdAt, updatedAt
- Unique: [warehouseId, productId, batchNumber, serialNumber]

### InventoryAdjustment (schema.prisma:858) — Existing count-based
- Fields: id, adjustmentNumber (unique), companyId, branchId?, warehouseId, inventoryCountId?, status, reason?, adjustmentDate, postedAt?, cancelledAt?, createdById?, postedById?, cancelledById?, notes?, createdAt, updatedAt, deletedAt?
- Lines: InventoryAdjustmentLine[] (productId, warehouseLocationId?, systemQty, countedQty, differenceQty, notes)
- Statuses: "DRAFT", "POSTED", "CANCELLED"

### NumberSequence (schema.prisma:571)
- Fields: id, code (unique), name, operationName, modelName, domain, prefix, suffix?, currentNumber (Int, default 0), increment (Int, default 1), padding (Int, default 6), scope ("GLOBAL"), companyId?, branchId?, resetPolicy ("NEVER"), lastResetAt?, lastGeneratedCode?, status
- Existing inventory codes: INVENTORY_MOVEMENT (IM-), INVENTORY_ADJUSTMENT (IA-), INVENTORY_COUNT (IC-), WAREHOUSE (WH-), WAREHOUSE_LOCATION (WL-), PRODUCT (PRD-)

### Permission Pattern
- Format: `{module}:{action}` (lowercase, hyphenated)
- Seed: Idempotent upsert in seed-cmms-permissions.ts
- Assignment: All permissions linked to SUPER_ADMIN role

## Dangerous Existing Endpoint
- `POST /v1/inventory/adjustments` (InventoryController.adjustStock): Directly updates `InventoryBalance.quantity` WITHOUT creating any movement, document, or approval. This bypasses all inventory control. It is documented as a risk but will NOT be modified in this batch.

## Design Recommendations
1. Create `InventoryOpeningBalance` and `InventoryOpeningBalanceLine` models
2. Create `InventoryStockAdjustment` and `InventoryStockAdjustmentLine` models
3. Use DRAFT→SUBMITTED→APPROVED→POSTED workflow (new pattern for inventory)
4. Reuse existing `InventoryMovement` and `InventoryMovementLine` for posting
5. Use `sourceType`/`sourceId` to link movements to opening/adjustment documents
6. Add number sequences: OPENING_BALANCE (OB-), STOCK_ADJUSTMENT (SA-)
7. Add permission seeds for both new modules
8. Add i18n keys
9. Add navigation entries
10. Add reports/dashboard counts

## Forbidden Items Checklist
- Direct StockBalance edit: NOT implemented (existing legacy adjustStock is documented risk)
- Finance entry: NOT created
- Accounting journal: NOT created
- HR activation: NOT done
- Sales/Purchasing activation: NOT done
- Warehouse transfer: NOT done
- Stock receiving: NOT done
- Inventory counting: NOT done (separate existing module)
