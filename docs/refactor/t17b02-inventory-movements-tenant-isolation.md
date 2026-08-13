# T17B-02 — Inventory Movements: Tenant Isolation

Module: `apps/api/src/modules/factory/inventory-movements`

- BASE_SHA: `4976b7765eb6dc0ecbadb026a49cfe66badd030b`
- Branch: `fix/t17b02-inventory-movements-tenant-isolation`
- Scope: inventory movements ONLY. No schema changes, no migrations, no UI, no permissions, no other modules.

Authoritative scope: `request.activeContext` (`ActiveOperationalContext`) resolved by the global `ActiveContextInterceptor`
from the `x-active-company-id` / `x-active-branch-id` headers and validated against the authenticated user's grants.
Client-supplied `companyId` / `branchId` in body or query are never trusted by the service.

Companion document: `docs/refactor/t17b01-stock-adjustments-tenant-isolation.md` (same hardening patterns applied to the
sibling Stock Adjustments module, completed at BASE_SHA).

---

## 1. Ownership map (Prisma models touched)

| Model | Ownership | Notes |
|---|---|---|
| `InventoryMovement` | DIRECT_TENANT_OWNERSHIP | row carries `companyId` + nullable `branchId`; `reversesMovementId` self-relation |
| `InventoryMovementLine` | DERIVED | belongs to a movement via `movementId` |
| `InventoryBalance` | DERIVED | via `warehouseId → Warehouse.companyId`; transactional truth, never edited directly |
| `Warehouse` | DIRECT_TENANT_OWNERSHIP | `companyId` + nullable `branchId`; cross-tenant relation target |
| `WarehouseLocation` | DERIVED | via `warehouseId → Warehouse` |
| `Product` | GLOBAL_REFERENCE | `Product` has no `companyId`; global catalog |
| `Company`, `Branch` | GLOBAL identity | read for context/validation only |

Existing DB-level constraint (no change): filtered unique index
`inventory_movements_companyId_branchId_requestId_key` on `(companyId, branchId, requestId)
WHERE requestId IS NOT NULL` (migration `20260806200000_add_inventory_movement_hardening`).

---

## 2. Pre-change matrix (current code, BASE_SHA)

`CURRENT_PUBLIC_METHOD_COUNT = 12` (11 controller endpoints + the `postMovementWithinTransaction` primitive called by
the production module callers).

| # | METHOD_OR_ENDPOINT | HTTP | SERVICE_METHOD | PERMISSION | CONTEXT_PARAMETER | CURRENT_SCOPE_STATUS | DB_MODELS_TOUCHED | MUTATES_INVENTORY | VULNERABLE | WHY |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /inventory/movements` | POST | `create` | `inventory-movement:create` | `ctx` (already passed) | PARTIAL — ctx stored, but client `dto.branchId` stored unvalidated; validations run on the ROOT client while the mutation runs on the TX client; numbering outside the transaction | Company, Branch, Warehouse, Product, InventoryMovement, InventoryMovementLine, AuditLog | no (DRAFT doc only) | YES | `dto.branchId` (and `dto.companyId`) accepted and stored verbatim — a client can create a movement whose branch/company is NOT the active context; foreign warehouse validated for existence only, not company/branch membership; number consumed even if the tx later fails (counter not rolled back with the mutation) |
| 2 | `GET /inventory/movements` | GET | `findAll` | `inventory-movement:read` | `ctx` | TENANT-SCOPED | InventoryMovement, Company, Warehouse | no | NO | scoped `companyId` + `branchId IN (ctx.branchId, null)` |
| 3 | `GET /inventory/movements/:id` | GET | `findOne` | `inventory-movement:read` | `ctx` | TENANT-SCOPED | InventoryMovement, Company, Branch, Warehouse, Product | no | NO | `findOwned` |
| 4 | `PATCH /inventory/movements/:id` | PATCH | `update` | `inventory-movement:update` | `ctx` | PARTIAL — ownership checked via root-client `findOwned`, then update by id (TOCTOU: a raced tenant change can be combined with stale validation) | InventoryMovement, AuditLog | no | YES | find-then-update gap |
| 5 | `PATCH /:id/post` | PATCH | `post` | `inventory-movement:post` | `ctx` | PARTIAL — ownership pre-check, then final `update({where:{id}})` with no atomic status claim; double-post prevented only by Serializable deadlock, not by a claim | InventoryMovement, InventoryMovementLine, InventoryBalance, Product, AuditLog | YES | YES | two concurrent posts can both pass the pre-check and race the balance loop; loser not guaranteed clean rejection |
| 6 | (primitive) | — | `postMovementWithinTransaction` | — | `ctx` | PARTIAL — no relation revalidation (hostile legacy rows / foreign warehouse / foreign location / deleted product pass through); no atomic DRAFT→POSTED claim; audit lives only in the endpoint wrapper | InventoryMovement, InventoryMovementLine, InventoryBalance, Product | YES | YES | production callers get no relation validation and no double-post claim |
| 7 | `PATCH /:id/reverse` | PATCH | `reverse` | `inventory-movement:reverse` | `ctx` | PARTIAL — ownership checked; compensating movement created with a random `requestId`; concurrent double reversal possible; numbering outside the transaction | InventoryMovement, InventoryMovementLine, NumberSequence, AuditLog | no (creates DRAFT) | YES | two concurrent reverses both create compensating DRAFTs; no idempotency token at DB level; counter not rolled back on failure |
| 8 | `PATCH /:id/cancel` | PATCH | `cancel` | `inventory-movement:cancel` | `ctx` | PARTIAL — ownership pre-check then `update` by id (TOCTOU + no status claim); a concurrent post can be overwritten by a cancel | InventoryMovement, AuditLog | no | YES | cancel-vs-post race |
| 9 | `POST /:id/lines` | POST | `addLine` | `inventory-movement:update` | `ctx` | PARTIAL — ownership pre-check then line create (TOCTOU); location not validated against the movement warehouse | InventoryMovement, InventoryMovementLine, Product, WarehouseLocation, AuditLog | no | YES | stale-validation + cross-warehouse location storable |
| 10 | `PATCH /:id/lines/:lineId` | PATCH | `updateLine` | `inventory-movement:update` | `ctx` | PARTIAL — ownership pre-check; line checked against doc id; **raw `dto` passed through to the DB** — direction/quantity/productId/locationId never re-validated; invalid values storable | InventoryMovement, InventoryMovementLine, Product, WarehouseLocation, AuditLog | no | YES | raw DTO passthrough + TOCTOU |
| 11 | `DELETE /:id/lines/:lineId` | DELETE | `removeLine` | `inventory-movement:update` | `ctx` | PARTIAL — ownership pre-check then line delete (TOCTOU) | InventoryMovementLine, AuditLog | no | YES | stale-validation |
| 12 | `GET /:id/summary` | GET | `summary` | `inventory-movement:read` | `ctx` | TENANT-SCOPED | InventoryMovement, InventoryMovementLine | no | NO | `findOwned` |

`TENANT_UNSAFE_AFTER = 0` is the acceptance requirement.

Existing HTTP-layer mitigation (NOT a substitute): the global `ActiveContextInterceptor` requires the active headers and
rejects top-level body/query `companyId`/`branchId` that mismatch the active context. It does not verify relations
(warehouse/location), does not protect non-HTTP callers (production module callers invoke
`postMovementWithinTransaction` directly), and the service must be authoritative.

---

## 3. Design decisions

1. **Client tenant fields: REMOVED from the DTO** (stronger than the interceptor). `CreateInventoryMovementDto` no
   longer accepts `companyId` / `branchId` at all. The global `ValidationPipe` (`whitelist: true,
   forbidNonWhitelisted: true`) rejects any client-supplied tenant field with 400 before the service runs. The service
   additionally overrides with `ctx.companyId` / `ctx.branchId` (defense in depth for non-HTTP callers). This is a
   strict API contract tightening: `apps/web` never calls `inventory/movements` directly (verified — the surface is
   backend-orchestrated), so no frontend sends these fields.
2. **`MOVEMENT_NULL_BRANCH_SEMANTIC = COMPANY_WIDE`** (established supported relation, distinct from the stricter
   Stock Adjustment rule): a movement with `branchId = null` belongs to the whole company and is visible/usable from
   every branch (`isInContext` = `companyId === ctx.companyId && (branchId === null || branchId === ctx.branchId)`;
   `findAll` scopes `branchId IN (ctx.branchId, null)`; `findMovementByRequestId` resolves `branchId IN (ctx.branchId,
   null)`). Writes always store `ctx.branchId`. Kept as-is because legitimate flows create company-level movements and
   the movements surface never depended on strict branch matching.
3. **Relation validation runs on the SAME transaction client as the mutation.** New helpers
   `assertWarehouseInContextWithClient`, `assertLocationInWarehouseWithClient`, `assertProductActiveWithClient`,
   `assertMovementRelationsWithClient` (warehouse → company match, branch null-or-equal, status ACTIVE, not soft-deleted;
   line location must belong to the movement warehouse and be ACTIVE; product must exist and not be soft-deleted).
   `create`, `post` (and the primitive), and the line operations all re-validate in-transaction so a tenant-owned row
   can never become authority for a foreign/deleted/inactive warehouse, location, or product.
4. **Atomic status claims replace find-then-update.** Post and cancel perform `updateMany({ where: { id, status:
   <expected>, deletedAt: null } })` and inspect `count`. A lost claim re-reads the row and either returns the committed
   state idempotently (POSTED for post, CANCELLED for cancel) or rejects cleanly — the loser never mutates inventory.
   `postMovementWithinTransaction` performs the DRAFT→POSTED claim BEFORE the balance loop, so a concurrent double post
   cannot re-apply balance effects.
5. **Deterministic reversal token — DB-enforced single reversal, no schema change.** The compensating movement always
   stores `requestId = 'REVERSAL:' + <originalMovementId>`. The existing filtered unique index on
   `(companyId, branchId, requestId) WHERE requestId IS NOT NULL` therefore permits at most ONE reversal per original
   per tenant. Concurrent double reversal is impossible at the database level; a retry (with or without a client
   `requestId`) resolves idempotently via the token lookup (`findMovementByRequestId(reversalToken, ctx, tx)`), and a
   P2002 on the unique index re-checks the token and returns the committed reversal.
6. **Numbering joins the mutation transaction.** `create` and `reverse` call
   `generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx)` AFTER every validation passes; counters roll back with the
   rest of the transaction on failure (no bare `generateNumberAtomic` remains for this module).
7. **POST audit moves into the posting primitive.** The DRAFT→POSTED transition audits once via
   `audit.logWithClient(tx, ...)` immediately after the claim succeeds, inside the transaction. This makes the audit
   precise (idempotent re-entry does not re-audit) and covers the production-module callers too, which previously had
   no InventoryMovement POST audit.
8. **`updateLine` never passes the raw DTO to Prisma.** Only an explicit whitelist of fields is written
   (`productId`, `quantity`, `quantityBase`, `direction`, `warehouseLocationId`, `batchNumber`, `serialNumber`,
   `expiryDate`, `unit`, `notes`), each re-validated in-transaction (quantity > 0, direction IN|OUT, product active,
   location belongs to the movement warehouse, date parseable). Unknown fields are ignored at the service layer and
   rejected at the HTTP layer by the ValidationPipe.
9. **Audit** every mutation inside the transaction via `AuditService.logWithClient`: CREATE, UPDATE, POST, REVERSE,
   CANCEL, ADD_LINE, UPDATE_LINE, REMOVE_LINE. Two new i18n keys
   (`inventory.movementOnlyDraftCanUpdate`, `inventory.movementOnlyDraftCanModify`) added in ar+en; all other messageKeys
   already exist.
10. **Permissions**: unchanged — `AUTHORIZED_PERMISSION AND ACTIVE_TENANT_OWNERSHIP`. Controller unchanged (all 11
    endpoints already pass `@CurrentActiveContext() ctx` and carry `@Permissions` + `InventoryLockGuard`).

---

## 4. Post-change matrix

| # | METHOD_OR_ENDPOINT | HTTP | SERVICE_METHOD | PERMISSION | CONTEXT_PARAMETER | CURRENT_SCOPE_STATUS | DB_MODELS_TOUCHED | MUTATES_INVENTORY | VULNERABLE | WHY |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /inventory/movements` | POST | `create` | `inventory-movement:create` | `ctx` | TENANT-SCOPED | Company, Warehouse, WarehouseLocation, Product, InventoryMovement, InventoryMovementLine, AuditLog | no (DRAFT doc only) | NO | client `companyId`/`branchId` removed from DTO and overridden by ctx; all validation + numbering + insert + audit in ONE Serializable tx (`generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx)`) |
| 2 | `GET /inventory/movements` | GET | `findAll` | `inventory-movement:read` | `ctx` | TENANT-SCOPED | InventoryMovement, Company, Warehouse | no | NO | `companyId` + `branchId IN (ctx.branchId, null)` + `deletedAt: null` |
| 3 | `GET /inventory/movements/:id` | GET | `findOne` | `inventory-movement:read` | `ctx` | TENANT-SCOPED | InventoryMovement, Company, Branch, Warehouse, Product | no | NO | `findOwned` |
| 4 | `PATCH /inventory/movements/:id` | PATCH | `update` | `inventory-movement:update` | `ctx` | TENANT-SCOPED | InventoryMovement, AuditLog | no | NO | in-tx ownership + DRAFT re-read + update + audit |
| 5 | `PATCH /:id/post` | PATCH | `post` | `inventory-movement:post` | `ctx` | TENANT-SCOPED | InventoryMovement, InventoryMovementLine, InventoryBalance, Product, Warehouse, WarehouseLocation, AuditLog | YES | NO | Serializable tx; full relation revalidation in-tx; atomic DRAFT→POSTED `updateMany` claim BEFORE balance loop; idempotent POSTED return; audit in-tx exactly once |
| 6 | (primitive) | — | `postMovementWithinTransaction` | — | `ctx` | TENANT-SCOPED | InventoryMovement, InventoryMovementLine, InventoryBalance, Product, Warehouse, WarehouseLocation, AuditLog | YES | NO | same guarantees for production callers; signature unchanged |
| 7 | `PATCH /:id/reverse` | PATCH | `reverse` | `inventory-movement:reverse` | `ctx` | TENANT-SCOPED | InventoryMovement, InventoryMovementLine, AuditLog | no (creates DRAFT) | NO | deterministic `requestId = REVERSAL:<id>` + filtered unique index = DB-enforced single reversal; token/user requestId idempotent re-lookups (pre-tx, in-tx, P2002); numbering in-tx |
| 8 | `PATCH /:id/cancel` | PATCH | `cancel` | `inventory-movement:cancel` | `ctx` | TENANT-SCOPED | InventoryMovement, AuditLog | no | NO | in-tx ownership re-read + atomic DRAFT→CANCELLED claim + idempotent CANCELLED return + audit in-tx |
| 9 | `POST /:id/lines` | POST | `addLine` | `inventory-movement:update` | `ctx` | TENANT-SCOPED | InventoryMovement, InventoryMovementLine, Product, WarehouseLocation, AuditLog | no | NO | in-tx ownership/DRAFT re-read; qty>0; direction IN|OUT; product active; location validated against movement warehouse |
| 10 | `PATCH /:id/lines/:lineId` | PATCH | `updateLine` | `inventory-movement:update` | `ctx` | TENANT-SCOPED | InventoryMovement, InventoryMovementLine, Product, WarehouseLocation, AuditLog | no | NO | in-tx ownership/DRAFT re-read; line must belong to doc; whitelisted re-validated fields only; raw DTO never passed through |
| 11 | `DELETE /:id/lines/:lineId` | DELETE | `removeLine` | `inventory-movement:update` | `ctx` | TENANT-SCOPED | InventoryMovementLine, AuditLog | no | NO | in-tx ownership/DRAFT re-read; line must belong to doc; delete + audit in-tx |
| 12 | `GET /:id/summary` | GET | `summary` | `inventory-movement:read` | `ctx` | TENANT-SCOPED | InventoryMovement, InventoryMovementLine | no | NO | `findOwned` before any line aggregation |

`TENANT_UNSAFE_AFTER = 0`.

---

## 5. Transaction boundaries

- `create`, `reverse`: `Serializable` transaction containing idempotency re-checks, relation validation, number
  generation, insert, and audit.
- `post`: `Serializable` transaction containing ownership/status re-read, relation revalidation, atomic claim, audit,
  and the balance loop (Decimal arithmetic on `quantityBase`; negative-stock guard).
- `postMovementWithinTransaction`: consumed by `production-material-documents.service.ts` and
  `production-finished-goods-receipts.service.ts` inside THEIR OWN `Serializable` transactions — signature and
  contract unchanged, now with relation revalidation + atomic claim + in-tx audit.
- `update`, `cancel`, `addLine`, `updateLine`, `removeLine`: default isolation (owner of a row is the only writer in
  normal flows); ownership/status re-read + claim + mutation + audit all in one transaction.
- `findMovementByRequestId(client)` accepts the optional transaction client so idempotency re-checks join the mutation
  transaction (no cross-transaction reads).

---

## 6. Adversarial review findings

Review iterated on the changed source before the closeout gates:

| # | FINDING | SEVERITY | RESOLUTION | COVERAGE |
|---|---|---|---|---|
| 1 | `post()` audited POST even when the primitive returned idempotently (claim lost to a concurrent post) — a no-op would still be recorded | MEDIUM (audit accuracy) | POST audit moved into `postMovementWithinTransaction`, executed only after the claim succeeds; `post()` no longer audits separately | primitive + endpoint POST audit tests |
| 2 | Raw `dto` passthrough in `updateLine` could persist invalid direction/quantity/product/location values and any unknown fields | HIGH (data integrity) | whitelisted re-validated field set; unknown fields dropped | whitelist test asserts exact persisted `data` and absence of injected `evil` field |
| 3 | Unvalidated date strings (`expiryDate`, reverse `movementDate`) could store `Invalid Date` | MEDIUM (data integrity) | new `toDateOrThrow` helper applied to create/addLine/updateLine/reverse | create + updateLine invalid-date regression tests |
| 4 | create's pre-change form validated relations on the root client and consumed a number outside the tx; the P2002 catch re-checked only the user `requestId`, not any token | MEDIUM (TOCTOU + rollback) | all validation + numbering moved in-tx; reversal catch re-checks the deterministic token | in-tx ordering tests (number never generated on validation failure) |

`FINAL_ADVERSARIAL_FINDINGS_OPEN = 0`.

---

## 7. Test and validation state

- Focused module spec: `inventory-movements.service.spec.ts` — **73 tests, all passing** (create 14 incl. tenant-spoof
  rejection, foreign/inactive warehouse, foreign location, deleted product, invalid qty/direction/date, requestId
  idempotency + canonical conflict + P2002 race; findOne 5; findAll 3; update 4; cancel 5 incl. atomic claim loss and
  idempotent return; post 8 incl. relation revalidation, claim loss, negative balance; reverse 8 incl. deterministic
  token, double-reversal resolution, P2002 token resolution; lines 14 incl. whitelist + service-level validation;
  summary 2; primitive 8 incl. idempotent POSTED re-entry and CANCELLED rejection).
- Sibling module `inventory-stock-adjustments.service.spec.ts`: **95 tests, all passing** (T17B-01 regression-free).
- Production callers `production-material-documents` + `production-finished-goods-receipts`: **72 tests, all passing**
  (postMovementWithinTransaction contract intact).
- Full `npm run test:api`: **1227 tests passed, 0 failed assertions**; the only suite failures are the 18 pre-existing
  empty spec files (iot/mqtt, hr-requests, numbering.helpers, auth guards/roles, business-rules, workflow-engine,
  request-policy, request-notifications, helpers) — unrelated, none touched by this change set
  (`FAILURE_DUE_TO_PREEXISTING_EMPTY_SUITES_ONLY`).
- `npm run build:api` (tsc): PASS. `prisma validate`: PASS. `npm run i18n:check`: PASS (5388 EN = 5388 AR).
  `npm run raw-keys:check`: PASS. `git diff --check`: PASS.
- ESLint is not installed (absent from root and `apps/api` package.json) — `ESLINT=NOT_RUN_PREEXISTING_TOOLING_MISSING`.
- No schema, migration, permission, seed, or frontend change is part of this branch.

---

## 8. Runtime proof

`POST /inventory/movements` create/post/reverse/cancel endpoints are blocked at the HTTP layer by the pre-existing
period lock (`PF-TEST-001`) on the shared database, exactly as recorded in T17B-01 §5.E — no live shared-DB movement
was created, posted, reversed, or cancelled by this branch, and no NumberSequence or business data was modified.
`NUMBER_SEQUENCE_MANUAL_ROLLBACK_PERFORMED=NO`. The correctness of the change set is established by the focused
regression suites (unit-level with in-transaction hostile re-reads), the full API suite, the type build, and the
schema validation above. Any live proof requires an approved PF-TEST-001 exception and is out of scope for this
branch. Status: `PARTIAL` (automated proof complete; live-DB proof intentionally not performed).
