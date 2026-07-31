# ATsofterp Critical Permissions, Route Collision, and Regression Test Hardening — Proof Report

Date: 2026-07-31
Branch: `main` — HEAD `23f9c655b4eb63d9b61b007e8dd940837817d467` (baseline, unchanged)
Status: **COMPLETED**

---

## 1. Task Status

COMPLETED — all four permission defects fixed, both confirmed route collisions resolved,
one broken frontend endpoint repaired, and real regression tests written, executed, and passing.

## 2. Scope Completed

### 2.1 Permission defects (4/4 verified and repaired)

| # | Controller key (enforced) | Seed key (existed) | Impact before fix | Fix |
|---|---------------------------|--------------------|-------------------|-----|
| A | `installed-parts:read` (9 endpoints in `installed-parts-replacement.controller.ts` lines 17–73) | **none** — absent from every seed | 403 for all non-SUPER_ADMIN users on installed-parts list/detail/replacement endpoints | Added `installed-parts:read` to the CMMS extra permissions list |
| B | `maintenance-request:activity.view` (`GET /maintenance-requests/:id/activity`) | `maintenance-request:activity` | 403 for every non-SUPER_ADMIN | Renamed seed key to `maintenance-request:activity.view` |
| C | `maintenance-request:attachments.view` (`GET /maintenance-requests/:id/attachments`) | `maintenance-request:attachments` | 403 for every non-SUPER_ADMIN | Renamed seed key to `maintenance-request:attachments.view` |
| D | `maintenance-request:print` (`GET /maintenance-requests/:id/print`) | `maintenance-request:printData` | 403 for every non-SUPER_ADMIN | Renamed seed key to `maintenance-request:print` |

Canonical key decision: the controller-enforced keys are the source of truth (they are what the
`PermissionsGuard` actually checks at runtime). This also matches the existing dotted-action
convention in the same seed list (`maintenance-request:checklist.view`,
`maintenance-request:checklist.manage`).

Backward compatibility: `seed-cmms-permissions.ts` now contains an idempotent migration block
that, for each renamed key, re-points existing `RolePermission` rows from the old key to the new
key (upsert), then deletes the obsolete key and its assignments. Existing custom-role assignments
are preserved, no orphan keys remain, and the SUPER_ADMIN grant-all loop covers the new keys.

### 2.2 Route collisions (2 confirmed real collisions + 1 duplicate operation + 1 broken client)

| Route | Before (shadowing) | After |
|-------|--------------------|-------|
| `POST /inventory/adjustments` | Two handlers: legacy `InventoryController.adjustStock` (permission `inventory:update`, registered first via module order) shadowed the modern `InventoryAdjustmentsController.create` (permission `inventory-adjustment:create`) | Exactly one handler: modern create. Legacy `adjustStock` route + service method + orphaned `CreateStockAdjustmentDto` removed |
| `GET /inventory/balances` | Two handlers: legacy `InventoryController.getBalances` (permission `inventory:read`) shadowed `InventoryBalancesController.findAll` (permission `inventory-balance:read`) | Exactly one handler: modern balances list. Legacy `getBalances` route + service method removed |
| `POST /inventory/adjustments/from-count/:countId` | Duplicate business operation (`generateFromCount`) exposed on a second route with **no frontend consumer** | Removed. Canonical route: `POST /inventory/counts/:countId/generate-adjustment` (used by counts list and adjust pages) |
| `POST /inventory/adjustments/:id/generate-adjustment` (frontend) | `counts/[id]/page.tsx:40` called a route that **never existed** → 404 on the "Generate Adjustment" action from the count details page | Fixed to `POST /inventory/counts/:id/generate-adjustment` |

Discovery-report claim verified as **false positive**: the `InventoryAdjustmentCountsController`
(`@Controller('inventory/counts')`) does NOT collide with `InventoryCountsController` — its only
route (`POST :countId/generate-adjustment`) is unique. No change needed there.

## 3. Files Created

- `apps/api/prisma/seed/seed-cmms-permission-keys.ts` — pure-data module exporting
  `CMMS_EXTRA_PERMISSIONS` (extracted byte-exact from the seed, with the 4 key fixes).
  Imported by the seed and by the consistency regression test (no DB side effects on import).
- `apps/api/jest.config.ts` → actually `apps/api/jest.config.js` — ts-jest preset, `roots: src`,
  `testMatch: src/**/*.spec.ts`.
- `apps/api/src/modules/factory/inventory/inventory-routes.spec.ts` — 7 route-registration
  regression tests (single-handler-per-route assertions via Express 5 `app.router.stack`).
- `apps/api/src/modules/factory/maintenance/maintenance-permissions-consistency.spec.ts` —
  5 seed-consistency regression tests (every enforced key is seeded; obsolete keys absent;
  no duplicate aliases).

## 4. Files Modified

- `apps/api/prisma/seed/seed-cmms-permissions.ts` — imports the shared keys list; added the
  idempotent `PERMISSION_MIGRATIONS` block (re-points RolePermission rows, deletes obsolete keys).
- `apps/api/src/modules/factory/inventory/inventory.controller.ts` — removed legacy
  `adjustStock` and `getBalances` handlers.
- `apps/api/src/modules/factory/inventory/inventory.service.ts` — removed the now-unused
  `adjustStock` and `getBalances` methods (verified: no other references in `apps/api/src`).
- `apps/api/src/modules/factory/inventory-adjustments/inventory-adjustments.controller.ts` —
  removed `InventoryAdjustmentFromCountController`.
- `apps/api/src/modules/factory/inventory-adjustments/inventory-adjustments.module.ts` —
  removed the deleted controller from the module wiring.
- `apps/web/src/app/admin/inventory/counts/[id]/page.tsx` — one-line endpoint fix.
- `apps/api/src/modules/auth/guards/permissions.guard.spec.ts` — previously empty; now contains
  9 real unit tests (allow / deny / partial-set / inactive role / inactive permission /
  SUPER_ADMIN bypass / missing user / no-metadata / multi-role aggregation).
- `apps/api/package.json` + `package-lock.json` — added dev dependencies for the mandatory test
  tooling: `jest@^29`, `ts-jest@^29`, `@types/jest@^29`, `@nestjs/testing@^11.1.28`.
- Deleted: `apps/api/src/modules/factory/inventory/dto/create-stock-adjustment.dto.ts`
  (orphaned after removal of its only consumers; the separate `inventory-stock-adjustments`
  module has its own DTO and is untouched).

## 5. Database Models or Migrations Changed

None. No Prisma schema change, no migration. The seed script change is data-level and safe:

- Existing-data impact: only rows for the 3 obsolete keys are migrated then removed;
  `RolePermission` rows are re-pointed, never dropped.
- Default/backfill: new keys created if missing (idempotent).
- Rollback: re-running the seed is a no-op; old keys can be re-added manually if ever needed.
- Index/tenant impact: none.
- Runtime compatibility: the guard reads `Permission.status === 'ACTIVE'` and `RolePermission`
  rows — unchanged contract.

## 6. API Endpoints Added or Changed

- Removed: `POST /inventory/adjustments` (legacy shadow), `GET /inventory/balances` (legacy
  shadow), `POST /inventory/adjustments/from-count/:countId` (duplicate).
- Retained as canonical: `POST /inventory/adjustments` (modern create),
  `GET /inventory/balances` (modern list), `POST /inventory/counts/:countId/generate-adjustment`.
- No endpoint changed its DTO shape or permission requirement (frontend contracts intact:
  `AdjustmentLinesPanel.tsx` and `balances/page.tsx` still receive `{ data, meta }`).

## 7. Frontend Routes or Actions Changed

- `counts/[id]/page.tsx` "Generate Adjustment" action now calls
  `POST /inventory/counts/:id/generate-adjustment` (was a nonexistent
  `/inventory/adjustments/:id/generate-adjustment` → 404).

## 8. Permissions Added or Changed

- Added: `installed-parts:read` (module `installed-parts`, action `read`).
- Renamed (seed list + migration): `maintenance-request:activity` → `maintenance-request:activity.view`;
  `maintenance-request:attachments` → `maintenance-request:attachments.view`;
  `maintenance-request:printData` → `maintenance-request:print`.
- No controller keys changed; no permission removed that any controller still enforces.
- Frontend has zero references to any of these keys (verified by grep), so no frontend
  permission constants needed updates.

## 9. Tests Added and Results

Run: `npx jest permissions.guard inventory-routes maintenance-permissions-consistency`
→ **3 suites passed, 21 tests passed, 0 failed.**

- `permissions.guard.spec.ts` — 9 tests: allow when all keys present; deny when a key is
  missing; deny on partial set; deny inactive role; ignore INACTIVE permission records;
  SUPER_ADMIN bypass; 403 without user; allow when no metadata; multi-role aggregation.
- `inventory-routes.spec.ts` — 7 tests: exactly one `POST /inventory/adjustments`; exactly one
  `GET /inventory/balances`; zero `POST /inventory/adjustments/from-count/:countId`;
  one `POST /inventory/counts/:countId/generate-adjustment`; counts list unique; adjustment
  line/summary routes unique; balances sub-routes unique.
- `maintenance-permissions-consistency.spec.ts` — 5 tests: all installed-parts controller keys
  seeded; all non-generic maintenance-requests controller keys seeded; the 3 canonical
  maintenance-request keys present; the 3 obsolete keys absent; no duplicate seed keys.

These tests fail on the pre-fix code (e.g., `installed-parts:read` missing from seeds,
duplicate POST handler) — they are true regression guards.

## 10. Build and Validation Results

| Check | Command | Result |
|-------|---------|--------|
| Focused unit tests | `npx jest` (3 suites) | PASS — 21/21 |
| API typecheck | `npm run typecheck` (tsc --noEmit) | PASS |
| API build | `npm run build` (tsc) | PASS |
| Prisma validate | `npx prisma validate` | PASS — schema valid |
| Web typecheck | `npx tsc --noEmit` (apps/web) | PASS |
| i18n | not run — no user-facing strings changed | N/A |
| `git diff --check` | — | PASS (exit 0; only LF→CRLF warnings) |

Full-suite jest run reports 18 pre-existing empty spec suites as "must contain at least one test"
— all pre-existing files, none touched by this task (see section 14).

## 11. Runtime Proof Results

- Static wiring proof: the route-registration suite boots the real controllers in a Nest testing
  module with the real Express 5 adapter and asserts the actual router stack contents.
- Metadata proof: the consistency suite reads the real `@Permissions` metadata from the real
  controllers and compares it with the actual seed list.
- Guard behavior proof: the guard suite exercises the real `PermissionsGuard` with mocked
  PrismaService data shapes matching the production query.
- The permission seed itself was NOT executed against the database: per task constraints,
  `prisma db seed` requires explicit approval. The seed change is statically verified
  (typecheck) and its logic is covered by the seed-key regression test.
- Live HTTP round-trip against a running API was not performed (no server/database runtime was
  started for this governance batch).

## 12. Tenant-Isolation Proof

No tenant-scope behavior was changed. Removed handlers operated on the same
company-scoped tables through the same services; the surviving canonical handlers keep their
existing tenant-scoped service paths. No new cross-tenant read or write path was introduced.

## 13. Known Limitations

- The 18 pre-existing empty spec files still make a full `jest` run exit non-zero; this task
  fills only the three spec files relevant to the defects (other empty suites were out of scope).
- The seed migration block runs only when `seed-cmms-permissions.ts` is executed (manual step,
  needs approval); until then the old keys remain in existing databases (harmless: nothing
  enforces them, and the SUPER_ADMIN grant-all makes the new keys effective immediately once
  the seed runs).
- Express 5 stores routes in `app.router.stack` (not `app._router`); the route test handles both
  for portability.

## 14. Pre-existing Issues Encountered

- 18 empty `.spec.ts` files (e.g., `auth.service.spec.ts`, `business-rules.service.spec.ts`,
  `workflow-engine/*.spec.ts`) — no jest tooling was installed and `test:api` could not run at
  all before this task.
- `counts/[id]/page.tsx` called a nonexistent endpoint (404) — fixed as part of this batch.
- Discovery report's claimed `inventory/counts` controller collision is a false positive.

## 15. Git Status

Pre-existing (untouched by this task, preserved):
- ` M AGENTS.md` — permanent rules installation from the previous accepted task
- `?? opencode.json`, `?? docs/agent-rules/`,
  `?? docs/proofs/atsofterp-permanent-agent-rules-installation-report.md`,
  `?? docs/proofs/atsofterp-current-architecture-discovery-report.md`, `?? proof-token.txt`

Task changes:
- Modified: `apps/api/package.json`, `apps/api/prisma/seed/seed-cmms-permissions.ts`,
  `apps/api/src/modules/auth/guards/permissions.guard.spec.ts`,
  `apps/api/src/modules/factory/inventory-adjustments/inventory-adjustments.controller.ts`,
  `apps/api/src/modules/factory/inventory-adjustments/inventory-adjustments.module.ts`,
  `apps/api/src/modules/factory/inventory/inventory.controller.ts`,
  `apps/api/src/modules/factory/inventory/inventory.service.ts`,
  `apps/web/src/app/admin/inventory/counts/[id]/page.tsx`, `package-lock.json`
- Deleted: `apps/api/src/modules/factory/inventory/dto/create-stock-adjustment.dto.ts`
- New: `apps/api/jest.config.js`, `apps/api/prisma/seed/seed-cmms-permission-keys.ts`,
  `apps/api/src/modules/factory/inventory/inventory-routes.spec.ts`,
  `apps/api/src/modules/factory/maintenance/maintenance-permissions-consistency.spec.ts`

## 16. Commit and Tag Status

Not requested — nothing committed, no tags, no push. Baseline HEAD unchanged
(`23f9c655b4eb63d9b61b007e8dd940837817d467`).

## 17. Recommended Next Steps

1. Approve and run the updated seed: `npx ts-node prisma/seed/seed-cmms-permissions.ts`
   (permission rows + RolePermission migration).
2. Approve filling the remaining 18 empty spec suites as separate tasks.
3. Consider moving `installed-parts` into the generic `seed.ts` MODULES list if the module gains
   create/update/delete actions later.
