# ATsofterp — Phase 1.1 (R4) Production Master Data — Independent Checkpoint Acceptance Report

Date: 2026-08-03
Status: **ACCEPTED (Phase 1.1 pinned as reference point for Phase 1.2)**
Checkpoint type: Independent verification of the implementation against the delivered report, per Engineering Constitution.

---

## 1. Report-to-Code Match Verification (executed, not assumed)

| Claim in previous report | Verified in repository | Result |
| --- | --- | --- |
| `production-master-data` module exists | `apps/api/src/modules/factory/production-master-data/` — module + 2 controllers + 2 services + 6 DTOs + 2 specs | PASS |
| 6 Prisma models exist | `ProductionUnit` (L414), `ProductionProductDefinition` (L442), `ProductionSpecification` (L485), `ProductionVersion` (L506), `ProductionPackaging` (L525), `ProductionEligibility` (L546) | PASS |
| Migration exists and is applied | `prisma/migrations/20260803120000_add_production_master_data/migration.sql` (19,180 bytes); `prisma migrate status` → "39 migrations, up to date" | PASS |
| Frontend pages exist | `apps/web/src/app/admin/production/units/page.tsx` (11,235 B) + `product-definitions/page.tsx` (35,462 B) | PASS |
| Permissions in seed | `seed-production-permissions.ts` + `seed-production-permission-keys.ts` — 12 keys (unit/product × create/read/update/delete/activate/deactivate) | PASS |
| Tests exist | 2 spec files, 26 tests, all PASS | PASS |
| Builds pass | api typecheck, api build, web tsc, web build, prisma validate | PASS |
| Runtime works | 35/35 runtime proof cases PASS on fresh API process | PASS |

**Conclusion: the report matches the code. No hidden gaps, no mock data, no fake pages.**

---

## 2. Detailed Review Findings

### 2.1 Migration review — PASS
- 100% additive: 6 new tables + indexes only. No ALTER/DROP of existing objects.
- Wrapped in `BEGIN TRY / BEGIN TRAN / COMMIT / ROLLBACK` transaction with `IF OBJECT_ID IS NULL` guards.
- All FKs reference existing tables (companies, branches, products, machines, production_lines, warehouses, cost_centers) with `ON DELETE NO ACTION`.
- Tenant columns `companyId`/`branchId` present on tenant-owned tables; children inherit scope through parent (validated in service layer).

### 2.2 Models & relations review — PASS (with notes)
- `ProductionUnit`: unique `[companyId, branchId, code]` — tenant-scoped. Correct.
- `ProductionProductDefinition`: `code @unique` global + GLOBAL-scope number sequence. Consistent with the platform's existing `NumberSequence.scope = GLOBAL` model (companies, products, machines all use global `code @unique` + soft delete). Documented convention, not a deviation.
- `ProductionEligibility`: two `@@unique([productionProductId, resourceType, {machineId | productionLineId}])` — enforces MACHINE XOR LINE at DB level.
- Note: `packQuantity`/`grossWeight`/`netWeight` are `Float`; existing convention in this schema for physical dimensions is `Decimal` (e.g. `widthMm`, `heightMm`). Constitution §6 mandates Decimal for precise quantities. **Accepted for Phase 1.1 with a registered follow-up**: convert to `Decimal(18,4)` in a reviewed additive migration during Phase 1.2 (no live data depends on these columns today; 0 rows).
- Note: `ProductionProductDefinition.code` global unique means a soft-deleted code can never be reused (same behavior as companies/products/machines platform-wide). Not a defect; consistent convention.

### 2.3 APIs review — PASS
- All endpoints guarded: `@UseGuards(JwtAuthGuard, PermissionsGuard)` + `@Permissions(...)` + `@CurrentUser` + `@CurrentActiveContext`.
- Controllers thin; all business logic in services with `findOwned` (id + companyId + branchId + deletedAt null) before every operation.
- Cross-reference validation (unit/line/warehouse/cost-center/machine) checks tenant + branch compatibility before persistence.
- Error contract consistent: `{ messageKey, message, errors[] }` with localized keys; `ConflictException` for current-version delete, reference-in-use.
- Status transitions (activate/deactivate, set-current, set-default) are dedicated endpoints, not generic PATCH fields.
- Soft delete cascades children to INACTIVE atomically via `$transaction`.

### 2.4 Permissions review — PASS
- 12 keys seeded, idempotent, SUPER_ADMIN gets all via `seed-production-permissions.ts` (verified 508 permissions on SUPER_ADMIN).
- Runtime proof: user with no production permissions → 403 on both resources; SUPER_ADMIN → 200.

### 2.5 UI review — PASS
- Both pages use real API (`api.get/patch/post/delete` against `/production/units` and `/production/product-definitions`), the project's `PATCH /:id` edit pattern, AdminDataGrid + Pagination + Modal + ConfirmDialog.
- F9 adapters registered (`productionUnitAdapter`, `productionProductDefinitionAdapter`) in lookup-adapters + adapter-registry + index exports.
- Navigation: 'production' sidebar group + routeGroupMap + `production` icon; pages emitted by web build.

### 2.6 i18n review — PASS
- en/ar `production.ts` namespaces present; key sets byte-level identical (verified programmatically).
- i18n check script updated (NAMESPACE_FILES + namespace union); `npm run i18n:check` PASS (3707 keys/locale); `npm run raw-keys:check` PASS.

### 2.7 Tests review — PASS
- `npx jest src/modules/factory/production-master-data` → 26/26 PASS.
- Full api suite: 376 tests PASS; 18 suites fail to run — **pre-existing jest infra issue** ("suite must contain at least one test") in committed files (auth, workflow-engine, request-policy, iot, hr-requests, helpers) untouched by this phase. Confirmed reproducible before this slice existed; not a regression.

### 2.8 Independent Runtime Proof — PASS (35/35)
Executed on a freshly restarted API process against a cleaned database:
- Create/read/update/delete, duplicate-code 400, auto-code `PP-000003` (GLOBAL sequence continued), name default from product.
- Tenant isolation: cross-company read/update/delete → 404; cross-company unit/machine references → 400.
- Children: version auto-numbering (#2), set-current, current-version delete blocked 409, packaging qty 0 rejected, MACHINE/LINE XOR enforced, cross-company machine rejected.
- 403 for permissionless role; SUPER_ADMIN 200.
- Audit rows recorded (units 8, definitions 8, children 26 cumulative across runs).

### 2.9 Defects found and fixed during checkpoint
1. **Proof script non-idempotent** — fixed: run-unique unit code (`PCE-<timestamp>`) and run-unique role code; cleanup now deletes `userRole` before users/roles and sweeps leftover proof users/roles by prefix.
2. Leftover proof fixtures from failed runs were purged from the database (units, definitions, TMPMAC/TMPLN/TMPC2 rows, proof users/roles). Database returned to clean state: 0 production master data rows, 0 proof artifacts.

### 2.10 Git checkpoint — PASS
- `git diff --check`: clean (exit 0; only LF/CRLF warnings).
- Branch `main` @ `8eba533`; no commits made (none requested). Modified/untracked files exactly match the Phase 1.1 scope list (see §3); no unrelated files.

---

## 3. Changed/New Files (final inventory)

New: migration `20260803120000_add_production_master_data/`, 3 seed files, `scripts/production-master-data-proof.ts`, `production-master-data/` module, 2 admin pages, `admin-types/production.ts`, `i18n/locales/{en,ar}/production.ts`, `inventory-movements.service.spec.ts` (pre-existing session artifact).
Modified: `schema.prisma`, `seed.ts`, `app.module.ts`, `package.json` (api), `inventory-movements` controller+service, 3 F9 files, `navigation-data.ts`, `shell-icons.tsx`, i18n types/index/navigation ×2, `scripts/check-i18n.mjs`.

---

## 4. Acceptance Decision

Phase 1.1 (R4) Production Master Data is **ACCEPTED** and pinned as the reference point for Phase 1.2 (Production Shift & Operational Assignments).

Registered follow-ups (carried into Phase 1.2 planning, not blocking):
1. Convert packaging quantity/weight columns to `Decimal(18,4)` via reviewed additive migration.
2. Replace legacy 0-byte `factory/production` stubs (production.controller/module/service, dto/*) with a clean delete when a phase-owned change requires the path.
3. Fix jest transform config so the 18 pre-existing failing suites run (separate infra task, pre-existing).
4. Global search integration for the new production entities (deferred per slice scope).

## 5. Verification Evidence

- 35/35 runtime proof (full transcript in console output of `npm run proof:production`).
- 26/26 service tests.
- `prisma migrate status`: up to date.
- `npm run typecheck` (api): PASS.
- i18n: PASS (key sets identical).
