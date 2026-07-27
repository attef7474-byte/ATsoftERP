# Batch P — Ledger Design Proof

## Official Ledger Rules

### Movement Rules
1. Every posted inventory movement MUST have:
   - `id` (auto-generated cuid)
   - `movementNumber` (auto-generated via `INVENTORY_MOVEMENT` number sequence with prefix + padded increment)
   - `movementType` (one of defined types)
   - At least one line with `direction` IN or OUT
   - `productId` reference per line
   - `warehouseId` reference
   - `quantity > 0` per line (enforced by `@Min(0.001)` DTO validation)
   - `status` (DRAFT → POSTED / CANCELLED)
   - `sourceType`/`sourceId` when business source exists (e.g. MAINTENANCE_PART_LINE)
   - `createdById`
   - `createdAt`

2. OUT movement decreases expected balance.
3. IN movement increases expected balance.
4. DRAFT/CANCELLED movements do NOT affect expected balance.
5. Only POSTED status movements affect `InventoryBalance`.
6. `MAINTENANCE_ISSUE` is OUT (deducts stock).
7. `MAINTENANCE_RETURN` is IN (restores stock).
8. Movement quantity MUST be positive (zero/negative rejected at DTO level).
9. Negative stock is BLOCKED during posting (throws `BadRequestException`).
10. Movement deletion is FORBIDDEN after posting (`status === 'POSTED'` blocks delete/update).
11. Reversal must use a new reversal movement (not delete the original).

### Balance Rules
1. `InventoryBalance` is keyed by `(warehouseId, productId, locationId)`.
2. `locationId` can be null (no location tracking).
3. Balance is updated ONLY through movement POSTING (via `post()` or direct issue/return).
4. Balance is NEVER directly editable through any public API.
5. `POST /inventory/balances/recalculate` exists but is a bulk reset — high risk, not for regular use.

### Ledger View
The ledger is a filtered/aggregated view of all movements, providing:
- Full movement history with all filters
- Movement counts by type/direction/status
- Movement detail with full line visibility
- Movements grouped by product, warehouse, location, or source reference
