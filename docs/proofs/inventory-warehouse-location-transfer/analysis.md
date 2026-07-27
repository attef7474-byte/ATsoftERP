# Phase 1 — Audit Current Transfer State

## Schema Audit

### Models

| Area | Model/Table | Existing | Transfer-Ready |
|------|------------|----------|----------------|
| Warehouse | `warehouses` | ✅ Full CRUD | ✅ Source/destination references supported |
| Location | `warehouse_locations` | ✅ Full CRUD | ✅ Source/destination references supported |
| Stock Balance | `inventory_balances` | ✅ `warehouseId`,`locationId`,`productId`,`quantity` | ✅ Supports transfer in/out via balance +/- |
| Movement | `inventory_movements` | ✅ `movementType`,`sourceType`,`sourceId` | ⚠️ Single warehouse only; needs paired OUT+IN |
| Movement Line | `inventory_movement_lines` | ✅ `productId`,`direction`,`quantity` | ✅ Direction IN/OUT supports transfer moves |
| Opening Balance | `inventory_opening_balances` | ✅ Full workflow | N/A — separate domain |
| Stock Adjustment | `inventory_stock_adjustments` | ✅ Full workflow | N/A — separate domain |
| Transfer | `inventory_stock_transfers` | ❌ **Missing** | ❌ New model required |
| Transfer Line | `inventory_stock_transfer_lines` | ❌ **Missing** | ❌ New model required |

### Movement Types Currently Used

| Type | Purpose |
|------|---------|
| `OPENING_BALANCE` | Opening balance posting |
| `STOCK_ADJUSTMENT_IN` | Stock adjustment increase |
| `STOCK_ADJUSTMENT_OUT` | Stock adjustment decrease |
| `MAINTENANCE_ISSUE` | Maintenance stock issue |
| `MAINTENANCE_RETURN` | Maintenance stock return |

**New types needed:** `STOCK_TRANSFER_OUT`, `STOCK_TRANSFER_IN`

### Frontend Movement Types (already defined)

```typescript
export type InventoryMovementType = 'OPENING' | 'PURCHASE_RECEIPT' | 'SALES_ISSUE' |
  'PRODUCTION_RECEIPT' | 'PRODUCTION_ISSUE' | 'TRANSFER_IN' | 'TRANSFER_OUT' |
  'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'COUNT_ADJUSTMENT' | 'MAINTENANCE_ISSUE' | 'MAINTENANCE_RETURN';
```

`TRANSFER_IN` and `TRANSFER_OUT` exist in frontend types and i18n — no frontend changes needed for these strings.

---

## Audit Matrix

| Area | Current Behavior | Missing Behavior | Needs Migration | Needs Backend | Needs Frontend | Stock Risk | Finance Risk | Decision | Status |
|------|-----------------|------------------|-----------------|---------------|----------------|------------|--------------|----------|--------|
| Transfer Document | Does not exist | Full document workflow (DRAFT→SUBMITTED→APPROVED→POSTED) | No | Yes | Yes | N/A | N/A | Create new module | 🔴 PENDING |
| Transfer Lines | Does not exist | Lines with product, quantity | No | Yes | Yes | N/A | N/A | Create new model | 🔴 PENDING |
| Paired Movement (OUT) | Does not exist | Movement OUT from source warehouse | No | Yes | No (API auto) | Low — transactional | None | Reuse InventoryMovement | 🔴 PENDING |
| Paired Movement (IN) | Does not exist | Movement IN to destination warehouse | No | Yes | No (API auto) | Low — transactional | None | Reuse InventoryMovement | 🔴 PENDING |
| Source Stock Decrease | InventoryBalance update works for adjustments | Same balance update for transfer OUT | No | Yes | No | Medium — tx rollback on fail | None | Reuse balance service | 🔴 PENDING |
| Destination Stock Increase | InventoryBalance update works for adjustments | Same balance update for transfer IN | No | Yes | No | Low | None | Reuse balance service | 🔴 PENDING |
| Stock Availability Check | Not exposed for transfers | GET available stock before transfer | No | Yes | Yes | Low | None | New endpoint | 🔴 PENDING |
| Same Source/Dest Validation | Does not exist | Block if sourceWarehouseId == destWarehouseId | No | Yes | Yes | Low | None | DTO validation | 🔴 PENDING |
| Number Sequence | OPENING_BALANCE, STOCK_ADJUSTMENT, INVENTORY_MOVEMENT | STOCK_TRANSFER sequence | No | Yes | No | None | None | Add sequence | 🔴 PENDING |
| Permissions | inventory:*, inventory:opening-balance:*, inventory:stock-adjustment:* | inventory:stock-transfer:* | No | Yes | No | None | None | 10 new permissions | 🔴 PENDING |
| Frontend Pages | opening-balances/, stock-adjustments/ | transfers/ page | No | No | Yes | None | None | New page | 🔴 PENDING |
| i18n | TRANSFER_IN/TRANSFER_OUT exist in movement type | Transfer-specific labels (تحويل مخزني, etc.) | No | No | Yes | None | None | Add labels | 🔴 PENDING |
| Reports | N/A | Transfer document counts, pending transfers | No | Yes | No | None | None | Add queries | 🔴 PENDING |
| Ledger/Reconciliation | Batch P ledger includes all movement types | Transfer OUT/IN visible in ledger | No | Yes (auto) | No (auto) | None | None | Auto-included | 🟢 N/A |
| Finance/Accounting | Not active | N/A | No | No | No | None | None | Explicitly excluded | 🟢 N/A |
| HR/Sales/Purchasing | Not active | N/A | No | No | No | None | None | Explicitly excluded | 🟢 N/A |

## Summary

**16 new items required**, 3 existing (ledger, i18n movement types, permissions framework), 3 N/A (finance, HR, sales/purchasing).

New module at: `apps/api/src/modules/factory/inventory-stock-transfers/`
New frontend at: `apps/web/src/app/admin/inventory/transfers/`
