# Backend Proof — Opening Balance + Stock Adjustment

## Modules Created

| Module | Service | Controller | DTOs |
|--------|---------|------------|------|
| InventoryOpeningBalancesModule | inventory-opening-balances.service.ts | inventory-opening-balances.controller.ts | create, update, query |
| InventoryStockAdjustmentsModule | inventory-stock-adjustments.service.ts | inventory-stock-adjustments.controller.ts | create, update, query |

## Backend Behavior

| Behavior | Status |
|----------|--------|
| JwtAuthGuard active | ✅ All endpoints guarded |
| PermissionsGuard active | ✅ All endpoints permission-checked |
| No token returns 401 | ✅ |
| Bad token returns 401 | ✅ |
| Invalid id returns 400/404 | ✅ |
| Invalid transition returns 400 | ✅ |
| Post creates InventoryMovement | ✅ Transactional with balance update |
| Post updates StockBalance | ✅ Same transaction |
| Rollback on failure | ✅ Prisma $transaction |
| Posted document immutable | ✅ Edit/delete blocked after POSTED |
| Direct StockBalance edit not exposed | ✅ (only through approved posting) |
| Duplicate opening balance blocked | ✅ Checked on create |
| Insufficient stock for adjustment OUT | ✅ 409 error on post |
| Number sequence generation | ✅ OPENING_BALANCE (OB-), STOCK_ADJUSTMENT (SA-) |
| Movement type convention | OPENING_BALANCE, STOCK_ADJUSTMENT_IN, STOCK_ADJUSTMENT_OUT |
| Status workflow | DRAFT→SUBMITTED→APPROVED→POSTED; REJECTED/CANCELLED terminal |
| Audit logging | ✅ All state changes logged |

## Compatible Existing Features

| Feature | Status |
|---------|--------|
| Batch P ledger/reconciliation | ✅ Still works (new movements visible) |
| Batch O maintenance issue/return | ✅ Unchanged |
| Maintenance stock issue UI/API | ✅ Unchanged |
| Preventive/emergency flow | ✅ Unchanged |
| Checklist API | ✅ Unchanged |
| Downtime/RCA/KPIs | ✅ Unchanged |
| Spare parts workflow | ✅ Unchanged |
| Notifications/SLA | ✅ Unchanged |
| Calendar/workload | ✅ Unchanged |
