# ATsofterp Phase 0 Proof Report — Work Orders Runtime + Tenant Isolation + Inventory Atomicity

- **Date:** 2026-08-02
- **Slice:** Phase 0 — Organizational Unit (slice 1) + Maintenance Work Order (slice 2)
- **Status:** COMPLETE

---

## 1. Issue found and fixed during runtime proof

**Bug:** `POST /api/v1/maintenance-work-orders/:id/issue-parts` returned **500 Internal server error**.

**Root cause (from server log):**
```
PrismaClientValidationError:
Invalid `this.prisma.maintenanceWorkOrderPart.findMany()` invocation ...
Unknown argument `deletedAt`.
```
The `MaintenanceWorkOrderPart` Prisma model has **no `deletedAt` column** (parts are hard-deleted via DELETE endpoint), but `issueParts()` in `maintenance-work-orders.service.ts:501` used `where: { workOrderId, deletedAt: null }`.

**Fix:** removed the non-existent `deletedAt: null` from the part query in `apps/api/src/modules/factory/maintenance/maintenance-work-orders/maintenance-work-orders.service.ts:500-501` (`where: { workOrderId }`). The `deletedAt` filter remains correct on the main `MaintenanceWorkOrder` model (lines 219, 709 — soft delete).

**Verification after fix:** 40/40 service spec tests pass; API type-check clean; runtime issue-parts succeeded.

---

## 2. Runtime proof — real path Frontend → API → Permission → Service → Database → Audit → Result

Environment: API `http://localhost:4000` (restarted from `apps/api` with the new modules), login `admin@atsofterp.com`. Active context: Test company `cmrl31uuy0000ok959hdjnca6`, branch `cmrx06a560000ng95g7d65vzh`. QA company `cmrwx8ovu0000ws955a1pqpva` / branch `cmrwx8owy0001ws95aeuyyusk` used for tenant-isolation checks.

### 2.1 Organizational unit (slice 1)
| Check | Result |
|---|---|
| Create `MAINT-DEPT` (Maintenance Department, DEPARTMENT, ACTIVE) | OK — id `cmsc6qcy90000fw95txh2t42j` |
| Read by id in same tenant | OK |
| Read by id from QA tenant | 404 (denied) |
| Read without active context | 403 |

### 2.2 Work order — full lifecycle (WO-000002)
| Check | Result |
|---|---|
| Create WO-000002 (PREVENTIVE/MEDIUM, warehouse WH-000001, part SP001 x2 @25.5) | OK — id `cmsc6rqiw0007fw955704khux`, part id `cmsc6rqj40008fw950ujpnikw`, totalCost 51, status DRAFT |
| Automatic numbering | OK — WO-000001, WO-000002 |
| Issue parts while DRAFT | 400 `validation.invalidStatusTransition` (correct: requires PLANNED/IN_PROGRESS) |
| Status plan (DRAFT→PLANNED) | OK |
| **Issue parts on PLANNED (after bug fix)** | **OK — part FULLY_ISSUED (2/2)** |
| Inventory effect | Balance decremented 44 → 42 (WH-000001) |
| Inventory movement created | IM-000076, type `MAINTENANCE_ISSUE`, sourceType `MAINTENANCE_WORK_ORDER`, sourceId = WO id, status POSTED, notes "Maintenance work order WO-000002 parts issue", 1 line: product `cmrvb4coj0001no95rd2e7kep` qty 2 |
| Add cost entry (LABOR 120.5) | OK — id `cmsc789hd0003dw95onnlfjiq` |
| Status start (PLANNED→IN_PROGRESS) | OK |
| Status complete (IN_PROGRESS→COMPLETED) | OK — **actualCost = 171.5** (= 51 parts + 120.5 labor), startedAt/completedAt set |
| Issue parts on COMPLETED | 400 `validation.invalidStatusTransition` (rejected) |
| Audit trail | CREATE, ISSUE_STOCK, STATUS_TRANSITION x2, cost-entry CREATE — all recorded under MaintenanceWorkOrder |

### 2.3 Tenant isolation (slice 2)
| Check | Result |
|---|---|
| QA tenant cannot read WO-000002 by id | 404 |
| QA tenant list shows 0 work orders (Test shows 2) | OK — list scoped |
| No-context read of WO | 403 |
| Movement line product/quantity correctness | Matches part line (qty 2) |

### 2.4 Existing WO-000001 (completed earlier round)
Status transitions plan→start→complete verified previously; final COMPLETED, actualCost 0.

---

## 3. Pre-existing issue found (NOT part of this slice)

**Tenant-isolation gap in the old `inventory-movements` module** (pre-existing, outside Phase 0 slice scope):

- `InventoryMovementsService.findOne(id)` (`apps/api/src/modules/factory/inventory-movements/inventory-movements.service.ts:106-123`) fetches by `id` only, no company/branch scope.
- Controller `GET /api/v1/inventory/movements/:id` (`inventory-movements.controller.ts:35-38`) passes no context.
- **Proof:** reading movement IM-000076 (belongs to Test company) with QA tenant headers returned 200 instead of 404.

Recommendation: fix in a dedicated maintenance task (scope `findOne`/`cancel`/`post`/`update`/line endpoints by company+branch, add regression tests). Not modified here per scope control (AGENTS.md §4) — this slice's modules (organizational-units, maintenance-work-orders) enforce tenant scope on all endpoints including the new issue-parts flow.

---

## 4. Build and validation results

| Step | Result |
|---|---|
| `npx jest maintenance-work-orders.service.spec.ts` | 40/40 passed |
| `npx jest organizational-units.service.spec.ts` | 16/16 passed |
| `npx tsc --noEmit` (apps/api) | clean |
| `npx tsc --noEmit` (apps/web) | clean |
| `npx next build` (apps/web) | success — `/admin/maintenance/work-orders` (5.96 kB), `/admin/maintenance/work-orders/[id]` (8.33 kB) |
| `prisma migrate status` | up to date (38 migrations applied) |

## 5. Files changed in this round

- `apps/api/src/modules/factory/maintenance/maintenance-work-orders/maintenance-work-orders.service.ts` — removed `deletedAt` from `maintenanceWorkOrderPart` query in `issueParts` (bug fix).
- (Server runtime logs `apps/api/.server-runtime.{out,err}.log` are temporary, git-ignored.)

## 6. Known limitations

- No browser (Playwright) proof yet for the new work-order pages — API-level proof complete; web build/types clean.
- Pre-existing tenant gap in `inventory-movements` (see §3) pending a dedicated fix task.
