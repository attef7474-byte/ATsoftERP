# T17B-01 — Inventory Stock Adjustments: Tenant Isolation

Module: `apps/api/src/modules/factory/inventory-stock-adjustments`

- BASE_SHA: `8f992b4df319ac947ae3d63c8638a36000d8a826`
- Branch: `fix/t17b01-stock-adjustments-tenant-isolation`
- Scope: inventory stock adjustments ONLY. No schema changes, no migrations, no UI redesign, no other modules.

Authoritative scope: `request.activeContext` (`ActiveOperationalContext`) resolved by the global `ActiveContextInterceptor`
from the `x-active-company-id` / `x-active-branch-id` headers and validated against the authenticated user's grants.
Client-supplied `companyId` / `branchId` in body or query are never trusted by the service.

---

## 1. Ownership map (Prisma models touched)

| Model | Ownership | Notes |
|---|---|---|
| `InventoryStockAdjustment` | DIRECT_TENANT_OWNERSHIP | row carries `companyId` + nullable `branchId` |
| `InventoryStockAdjustmentLine` | DERIVED | belongs to an adjustment via `adjustmentId` |
| `InventoryMovement` (created at post) | DERIVED | created from the adjustment; must carry the adjustment tenant |
| `InventoryBalance` | DERIVED | via `warehouseId → Warehouse.companyId` |
| `Warehouse` | DIRECT_TENANT_OWNERSHIP | `companyId` + nullable `branchId`; cross-tenant relation target |
| `WarehouseLocation` | DERIVED | via `warehouseId → Warehouse` |
| `Product` | GLOBAL_REFERENCE | `Product` has no `companyId`; global catalog |
| `Company`, `Branch` | GLOBAL identity | read for context/validation only |

---

## 2. Pre-change matrix (current code, BASE_SHA)

`CURRENT_PUBLIC_METHOD_COUNT = 14` (matches Task17A candidate list).

| # | METHOD_OR_ENDPOINT | HTTP | SERVICE_METHOD | PERMISSION | CURRENT_CONTEXT_PARAMETER | CURRENT_SCOPE_STATUS | DB_MODELS_TOUCHED | MUTATES_INVENTORY | VULNERABLE | WHY |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /inventory/stock-adjustments` | POST | `create` | `inventory:stock-adjustment:create` | none (only `userId`) | UNBOUNDED — trusts `dto.companyId`, `dto.branchId`, `dto.warehouseId` | Company, Warehouse, Branch, Product, InventoryStockAdjustment, InventoryStockAdjustmentLine, AuditLog | no (DRAFT doc only) | YES | Stores client `companyId`/`branchId`; warehouse checked for existence only, not company/branch membership; document `locationId` and line `locationId` never validated against the warehouse |
| 2 | `GET /inventory/stock-adjustments` | GET | `findAll` | `inventory:stock-adjustment:read` | none | UNBOUNDED — filters only when `query.companyId`/`query.branchId` provided; no forced scope | InventoryStockAdjustment, Company, Warehouse | no | YES | Absent filters list every company's rows; any supplied filters are honored verbatim |
| 3 | `GET /inventory/stock-adjustments/:id` | GET | `findOne` | `inventory:stock-adjustment:read` | none | UNBOUNDED — id-only lookup | InventoryStockAdjustment, Company, Branch, Warehouse, Product | no | YES | Cross-company / cross-branch read by id |
| 4 | `PATCH /inventory/stock-adjustments/:id` | PATCH | `update` | `inventory:stock-adjustment:update` | none | UNBOUNDED — id-only; `rest` may rewrite `companyId`/`branchId`/`warehouseId` | InventoryStockAdjustment, AuditLog | no | YES | Can update another company's doc by id; can move a doc into another tenant by changing tenant fields |
| 5 | `POST /:id/submit` | POST | `submit` | `inventory:stock-adjustment:submit` | none | UNBOUNDED — id-only | InventoryStockAdjustment, AuditLog | no | YES | Cross-tenant status transition |
| 6 | `POST /:id/approve` | POST | `approve` | `inventory:stock-adjustment:approve` | none | UNBOUNDED — id-only | InventoryStockAdjustment, AuditLog | no | YES | Cross-tenant approval |
| 7 | `POST /:id/reject` | POST | `reject` | `inventory:stock-adjustment:reject` | none | UNBOUNDED — id-only | InventoryStockAdjustment, AuditLog | no | YES | Cross-tenant rejection |
| 8 | `POST /:id/post` | POST | `post` | `inventory:stock-adjustment:post` | none | UNBOUNDED — id-only; movement derived from doc fields | InventoryStockAdjustment, InventoryStockAdjustmentLine, InventoryMovement, InventoryMovementLine, InventoryBalance, Product, AuditLog | YES | YES | Cross-tenant posting mutates another company's movements and balances |
| 9 | `POST /:id/cancel` | POST | `cancel` | `inventory:stock-adjustment:cancel` | none | UNBOUNDED — id-only | InventoryStockAdjustment, AuditLog | no | YES | Cross-tenant cancellation |
| 10 | `DELETE /:id` | DELETE | `remove` | `inventory:stock-adjustment:delete-draft` | none | UNBOUNDED — id-only | InventoryStockAdjustment, InventoryStockAdjustmentLine, AuditLog | no | YES | Cross-tenant delete of doc + lines |
| 11 | `POST /:id/lines` | POST | `addLine` | `inventory:stock-adjustment:update` | none | UNBOUNDED — doc id-only; `locationId` not validated | InventoryStockAdjustment, InventoryStockAdjustmentLine, Product, AuditLog | no | YES | Adds a line to another company's doc; crafted `locationId` from another warehouse |
| 12 | `PATCH /:id/lines/:lineId` | PATCH | `updateLine` | `inventory:stock-adjustment:update` | none | UNBOUNDED — line checked against doc id only, doc tenant unverified | InventoryStockAdjustment, InventoryStockAdjustmentLine, Product, AuditLog | no | YES | Cross-tenant line edit; `locationId` not validated |
| 13 | `DELETE /:id/lines/:lineId` | DELETE | `removeLine` | `inventory:stock-adjustment:update` | none | UNBOUNDED — line checked against doc id only | InventoryStockAdjustmentLine, AuditLog | no | YES | Cross-tenant line removal |
| 14 | `GET /:id/summary` | GET | `summary` | `inventory:stock-adjustment:read` | none | UNBOUNDED — id-only | InventoryStockAdjustment, InventoryStockAdjustmentLine | no | YES | Cross-tenant summary disclosure |

`TENANT_UNSAFE_AFTER = 0` is the acceptance requirement.

Existing HTTP-layer mitigation (NOT a substitute): the global `ActiveContextInterceptor`
(`active-context.interceptor.ts`) requires the active headers and, via `ActiveContextService.assertRequestMatches`,
rejects top-level body/query `companyId`/`branchId` that mismatch the active context. It does not scope `findAll`,
does not verify relations (warehouse/location), and does not protect non-HTTP callers — the service must be
authoritative.

---

## 3. Design decisions

1. **Client tenant fields: REJECT at HTTP layer (interceptor, unchanged), IGNORE at service layer (this change).**
   `create` destructures `companyId`/`branchId` out and writes `ctx.companyId` / `ctx.branchId`. DTO files are unchanged
   to preserve the API contract (the frontend sends both fields).
2. **Strict branch semantics (deviation from `inventory-movements`)**: stock adjustments are branch-owned documents —
   the `ActiveContextInterceptor` always requires the active headers, and `create` always stores `ctx.branchId`. A doc
   with `branchId = null` (company-level / legacy) has no owning branch and is therefore not visible, readable, or
   mutable through any branch-scoped API. `findAll` scopes `branchId: ctx.branchId` (exact match) and `isInContext`
   requires `branchId === ctx.branchId`. This is intentionally stricter than `inventory-movements`
   (`branchId: { in: [ctx.branchId, null] }`); the stricter rule was chosen because no legitimate flow creates a
   company-level adjustment through the API, so strict matching cannot hide real records while it eliminates the
   cross-branch visibility class entirely.
3. **Relations**: warehouse must belong to `ctx.companyId` and, when branch-scoped, to `ctx.branchId`. Location (document
   and per-line) must belong to the document warehouse. Product is global (no tenant check).
4. **Post**: ownership re-verified inside the transaction (TOCTOU defense) with `Serializable` isolation; movement rows
   inherit the adjustment tenant; balances are updated with `Prisma.Decimal` on `quantityBase` (mirroring
   `inventory-movements`) so adjustment postings stay precision-consistent; posting an already-POSTED doc is rejected
   (`inventory.stockAdjustmentOnlyApprovedCanPost`) before any movement/balance side effect can occur. No foreign
   movement or balance is ever touched.
5. **Audit**: mutation operations (`create`, `post`, `cancel`) audit inside the transaction via `AuditService.logWithClient`
   (same as `inventory-movements`); non-mutation transitions keep `audit.log` after the write. Error responses use
   messageKey objects (`inventory.stockAdjustmentNotFound`, `inventory.stockAdjustmentOnly*`) matching the movements
   contract; no new i18n keys required (frontend falls back to localized status text, same as movements today).
6. **Permissions**: unchanged — `AUTHORIZED_PERMISSION AND ACTIVE_TENANT_OWNERSHIP`.

---

## 4. Post-change matrix (to be filled after implementation + review)

| # | METHOD_OR_ENDPOINT | HTTP | SERVICE_METHOD | PERMISSION | CURRENT_CONTEXT_PARAMETER | CURRENT_SCOPE_STATUS | DB_MODELS_TOUCHED | MUTATES_INVENTORY | VULNERABLE | WHY |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /inventory/stock-adjustments` | POST | `create` | `inventory:stock-adjustment:create` | `ctx: ActiveOperationalContext` | TENANT-SCOPED | Company, Warehouse, Branch, Product, InventoryStockAdjustment, InventoryStockAdjustmentLine, AuditLog | no (DRAFT doc only) | NO | client `companyId`/`branchId` ignored, ctx stored; warehouse/location validated in-tenant; audit in-tx |
| 2 | `GET /inventory/stock-adjustments` | GET | `findAll` | `inventory:stock-adjustment:read` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, Company, Warehouse | no | NO | `where.companyId = ctx.companyId`, `branchId = ctx.branchId` (exact); client filters ignored |
| 3 | `GET /inventory/stock-adjustments/:id` | GET | `findOne` | `inventory:stock-adjustment:read` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, Company, Branch, Warehouse, Product | no | NO | `findOwned` |
| 4 | `PATCH /inventory/stock-adjustments/:id` | PATCH | `update` | `inventory:stock-adjustment:update` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, AuditLog | no | NO | `findOwned`; tenant fields ignored; warehouse/location validated in-tenant |
| 5 | `POST /:id/submit` | POST | `submit` | `inventory:stock-adjustment:submit` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, AuditLog | no | NO | `findOwned` |
| 6 | `POST /:id/approve` | POST | `approve` | `inventory:stock-adjustment:approve` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, AuditLog | no | NO | `findOwned` |
| 7 | `POST /:id/reject` | POST | `reject` | `inventory:stock-adjustment:reject` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, AuditLog | no | NO | `findOwned` |
| 8 | `POST /:id/post` | POST | `post` | `inventory:stock-adjustment:post` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, InventoryStockAdjustmentLine, InventoryMovement, InventoryMovementLine, InventoryBalance, Product, AuditLog | YES | NO | `findOwned` + in-tx ownership re-check; movement inherits doc tenant; Decimal balance; Serializable; second post rejected before side effects |
| 9 | `POST /:id/cancel` | POST | `cancel` | `inventory:stock-adjustment:cancel` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, AuditLog | no | NO | `findOwned`; audit in-tx |
| 10 | `DELETE /:id` | DELETE | `remove` | `inventory:stock-adjustment:delete-draft` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, InventoryStockAdjustmentLine, AuditLog | no | NO | `findOwned` |
| 11 | `POST /:id/lines` | POST | `addLine` | `inventory:stock-adjustment:update` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, InventoryStockAdjustmentLine, Product, WarehouseLocation, AuditLog | no | NO | `findOwned`; location validated against doc warehouse |
| 12 | `PATCH /:id/lines/:lineId` | PATCH | `updateLine` | `inventory:stock-adjustment:update` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, InventoryStockAdjustmentLine, Product, WarehouseLocation, AuditLog | no | NO | `findOwned`; line belongs to doc; location validated |
| 13 | `DELETE /:id/lines/:lineId` | DELETE | `removeLine` | `inventory:stock-adjustment:update` | `ctx` | TENANT-SCOPED | InventoryStockAdjustmentLine, AuditLog | no | NO | `findOwned`; line belongs to doc |
| 14 | `GET /:id/summary` | GET | `summary` | `inventory:stock-adjustment:read` | `ctx` | TENANT-SCOPED | InventoryStockAdjustment, InventoryStockAdjustmentLine | no | NO | `findOwned` |

`TENANT_UNSAFE_AFTER = 0`.

---

## 5. Final implementation — local correction (review closure)

Correction commit on top of `f9d3cea` (`fix(inventory): close stock adjustment posting isolation gaps`).
Scope: `inventory-stock-adjustments.service.ts`, its spec, and this document only. No schema, no migration,
no UI, no permissions, no `.env`.

### A. UPDATE (`PATCH /inventory/stock-adjustments/:id`)

`update` is now fully transactional. The previous version validated ownership and DRAFT status outside the
transaction and validated the warehouse via the global client, so a raced tenant change could be combined with
stale validation. Final behavior, all inside ONE `prisma.$transaction`:

- ownership re-check (`tx.inventoryStockAdjustment.findUnique` + `isInContext`) — inside tx;
- DRAFT status re-check — inside tx;
- target warehouse validation — `assertWarehouseInContextWithClient(tx, targetWarehouseId, ctx)`
  (target = `warehouseId ?? current.warehouseId`), rejecting foreign / other-branch / soft-deleted / inactive
  warehouses;
- existing document-location validation — when the warehouse changes, the current document `locationId` must
  belong to the target warehouse (`assertLocationInWarehouseWithClient(tx, current.locationId, targetWarehouseId, ...)`),
  otherwise the warehouse change is rejected (no silent migration);
- existing line-location validation — when the warehouse changes, every existing line `locationId` must belong
  to the target warehouse, otherwise the warehouse change is rejected;
- mutation + audit — `tx.inventoryStockAdjustment.update` and `audit.logWithClient(tx, { action: 'UPDATE', ... })`
  in the same transaction.

Client `companyId` / `branchId` remain destructured out and never written.

### B. POST (`POST /:id/post`)

`post` re-reads the adjustment inside a `Serializable` transaction (unchanged) and now revalidates the COMPLETE
relation graph through `assertAdjustmentRelationsWithClient(tx, current, ctx)` BEFORE any number generation,
movement creation, or balance mutation:

- adjustment ownership re-read in the Serializable transaction — unchanged, still first;
- warehouse revalidated inside tx — foreign / other-branch / soft-deleted / inactive warehouse is rejected;
- document location revalidated inside tx — must belong to the adjustment warehouse;
- every line location revalidated inside tx — must belong to the adjustment warehouse;
- products revalidated — every line `productId` must still exist and not be soft-deleted;
- all relation validation occurs BEFORE number generation or stock mutation, so hostile legacy rows
  (created before relation validation existed) are rejected with no side effects.

### C. NUMBERING

All document/movement numbers now participate in the same transaction as their mutation:

- `create` uses `generateNumberAtomicWithClient('STOCK_ADJUSTMENT', tx)`;
- `post` IN movement uses `generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx)`;
- `post` OUT movement uses `generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx)`;
- no bare `generateNumberAtomic(...)` (own-transaction variant) remains for this module's document or movement
  number generation — counters roll back with the rest of the transaction on failure.

Verified in source: `generateNumberAtomic('...')` bare occurrences = 0;
`generateNumberAtomicWithClient('STOCK_ADJUSTMENT', tx)` = 1; `generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx)` = 2.

### D. Previous live proof — number-sequence mutation correction

- `PREVIOUS_LIVE_PROOF_NUMBER_SEQUENCE_MUTATED=YES`
- The previous live proof was run against the OLD implementation where `generateNumberAtomic()` opened its own
  transaction, so the successful/failed post proof operations consumed/changed shared `INVENTORY_MOVEMENT`
  NumberSequence state that cleanup did not restore.
- `PREVIOUS_LIVE_PROOF_PREEXISTING_DATA_MODIFIED_CLAIM=CORRECTED` — the earlier claim that no pre-existing data
  was modified is corrected: shared NumberSequence counters were advanced and not restored.
- `NUMBER_SEQUENCE_MANUAL_ROLLBACK_PERFORMED=NO` — sequence counters were NOT manually decremented or rewritten.
- `PREVIOUS_SEQUENCE_NET_DELTA_VERIFIABLE=NO` — the exact before/after counter values were not recorded, so the
  net delta cannot be reconstructed. No guesses are made; no manual counter adjustment is performed.

### E. Period lock

- `PF-TEST-001` remained unchanged.
- `create` / `addLine` positive HTTP paths remain blocked by the pre-existing period lock.

### F. Post-correction DB state

- No successful shared-DB `POST /:id/post` was rerun after the transaction correction, and no further
  NumberSequence values were consumed by this branch.
- The correction's runtime-sensitive behavior is established by the previous live isolation proof, the focused
  regression suite, and the same-client transaction design (`generateNumberAtomicWithClient(..., tx)`).
