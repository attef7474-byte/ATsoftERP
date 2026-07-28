# Z-AA — Scope and Rules

## In-Scope

1. `SparePartConditionBalance` model (side ledger for condition-based stock)
2. `SparePartConditionMovement` model (audit trail for condition movements)
3. Manual SQL Server migration script (additive, no destructive changes)
4. `SparePartConditionModule` (service + controller + DTOs)
5. Condition balance CRUD API endpoints (query, getByKey, bySparePart, byWarehouse)
6. Condition movement recording API endpoint
7. Integration into `MaintenanceStockIssueService.issue()` — automatic condition OUT/IN
8. `SPARE_PART_CONDITION_MOVEMENT` numbering sequence
9. i18n messages for condition-specific errors

## Explicitly Out-of-Scope

- No changes to `InventoryBalance` / `InventoryMovementLine` / `InventoryMovement`
- No changes to `SparePart` / `Warehouse` / `MaintenanceRequest` / `MaintenanceRequestRequiredPart` models (only reverse relations added)
- No `app.module.ts` module activation
- No Finance, Purchasing, Sales, HR, AI, IoT, BI activation
- No placeholder pages
- No frontend stock issue form changes (existing form already has condition/replacement fields from Batch Y)
- No separate condition balance page (API endpoints provide data for frontend to consume later)

## Hard Rules Enforced

- `prisma db push` — NOT used
- `prisma migrate dev` — NOT used
- `prisma migrate reset` — NOT used
- Table drops — NOT performed
- Seed data deletion — NOT performed
- Double deduction — Guarded (same transaction, same line cannot be issued twice)
- Condition balance check — Enforces available quantity >= 0
- Warehouse type blocking — Inherited (PRODUCT/RAW_MATERIAL blocked at maintenance stock issue level)
