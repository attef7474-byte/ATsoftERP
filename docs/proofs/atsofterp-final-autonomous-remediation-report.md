# ATsofterp — Final Autonomous Remediation Report

Status: **ATSOFT_REMEDIATION_ALL_AUTHORIZED_WORK_COMPLETE**

Branch: `fix/final-autonomous-remediation`
Worktree: `C:\Users\attef\PycharmProjects\ATsoftERP-Worktrees\42-final-autonomous-remediation`

## 1. Identity

- Initial SHA (base): `d60ca52a0a3a8c0ef4511219fea06b4dc3d20359` (== `origin/main` at audit start).
- Final feature SHA: `26ba1b00dabb32ea250114866fb7d485c2ca19e6` (5 commits, all gates green before commit):
  - `fbc6655` fix(security): tenant-scope schema contract and migrations (S)
  - `4ea0d78` fix(security): barcode module tenant scoping, seed keys, dead-stub removal (BARCODE/R2)
  - `0bf4955` fix(security): R2 tenant isolation hardening across modules (R2/D1)
  - `c891230` fix(security): production branch-scope idempotency and global-catalog functional fixes (B/F)
  - `26ba1b0` chore: C1 route-contract tooling, D2 api smoke test, remediation docs (C1/D2/DOC)
- Changed paths audited: 186 (130 modified, 27 deleted, 29 untracked). All classified into an
  authorized track; `UNRELATED_CHANGED_PATHS=0`.

## 2. Track results (final, current-source)

| Metric | Final value |
| --- | --- |
| R2_OPEN_REMEDIABLE_DEFECTS | 0 |
| B_OPEN_REMEDIABLE_DEFECTS | 0 |
| F_OPEN_REMEDIABLE_DEFECTS | 0 |
| D1_EMPTY_ACTIVE_SPECS | 0 |
| C1_ACTIVE_ROUTE_MISMATCHES | 0 |
| FINAL_VERIFIED_VULNERABLE_SERVICES | 0 |
| FINAL_VERIFIED_VULNERABLE_METHODS | 0 |
| FINAL_CROSS_TENANT_READ_PATHS | 0 |
| FINAL_CROSS_TENANT_WRITE_PATHS | 0 |
| FINAL_BRANCH_SCOPE_GAPS | 0 |
| FINAL_RELATION_INJECTION_GAPS | 0 |
| FINAL_PARENT_CHILD_IDOR_GAPS | 0 |
| FINAL_TENANT_FIELD_TAMPERING_GAPS | 0 |
| FINAL_TOCTOU_GAPS | 0 |
| FINAL_REPORT_EXPORT_LEAKS | 0 |
| FINAL_EMPTY_ACTIVE_SPEC_FILES | 0 |
| UNRELATED_CHANGED_PATHS | 0 |
| TASK_CAUSED_TYPESCRIPT_ERRORS | 0 |

### R2 — Tenant isolation (read/CRUD/list/report)

- Re-audited every `*.service.ts` in `apps/api/src/modules` for unscoped by-id reads,
  client-controlled tenant fields, relation injection, parent-child IDOR, and report/export paths.
- **Defect found and fixed during final re-audit**: `machine-categories.service.ts`
  `categorySummary()` / `categoryMachines()` returned tenant-owned `Machine` rows filtered only by
  `categoryId` with no company/branch scope (cross-tenant read path). Fixed by threading
  `ActiveOperationalContext` from the controller and applying `machineScope(ctx)`
  (`{ companyId, deletedAt: null, OR: [{ branchId }, { branchId: null }] }`). `MachineCategory`
  itself stays a global catalog (`SAFE_GLOBAL_BY_DESIGN`). Regression spec added:
  `tenant-machine-categories.spec.ts` (3 tests).
- By-id read sweep: 4 flagged services, all dispositioned — `auth` (JWT-derived user id, SAFE),
  `messaging` (participant-scoped, SAFE), `maintenance-personnel` (no tenant columns in model or
  `OperationalPerson` chain — NOT_TENANT_RELEVANT), `machine-categories` (fixed, above).
- Client-controlled tenant fields: 24 textual matches, all triaged safe — deliberate-ignore
  (inventory, physical-counts, stock-adjustments, production-lines build `where` from `ctx` only),
  ctx-coercion validation (machines, cost-centers throw unless `dto.companyId === ctx.companyId` and
  override writes with ctx values), or legitimate within-company filter (cost-centers `query.branchId`
  while `companyId` stays pinned to `ctx.companyId`).
- Report/export: `report-export.service.ts` `getReportData()` threads `ctx` into every domain report
  service; no export endpoint bypasses a scoped report service (`FINAL_REPORT_EXPORT_LEAKS=0`).
- R2 hardening completed in branch (suites + specs): maintenance-calendar-workload and
  maintenance-bom fully scoped (were unscoped) with tenant specs; inventory list endpoints scope from
  `ctx`; in-transaction numbering (spare-part-conditions, installed-parts-replacement, work-orders,
  repair-orders, requests, schedules, preventive); maintenance-stock-issue TOCTOU closed; production
  lines and maintenance-spare-part-request-lines controllers thread `ctx`; reports scoped;
  business-partners children tenant tests.

### B — Branch scope

- `production-runs.service.ts` idempotency fully branch-scoped: `findByRequestId`, `findEventByRequestId`,
  `findDuplicateRunAction`, `writeRunTransition` all carry `companyId` + `branchId`.
- `production-orders.service.ts` same pattern (`clientRequestId`, `findDuplicateAction`, `writeTransition`).
- **Defect found and fixed**: `transition()` (pause/resume/complete/abort) had no `P2002` handling on the
  `production_run_transitions` unique key — a concurrent duplicate surfaced a raw Prisma error. Added
  `transitionWithIdempotentReplay` (outer-catch, re-read via `findDuplicateRunAction` on the root client,
  mirroring the `recordOutput`/`correctOutput` pattern). Regression test added; production-runs suite: 58 tests.
- Accepted contract items: `ProductionOrderTransition` / `ProductionNonconformanceTransition` remain
  parent-scoped uniques (parent PK belongs to one branch); `InventoryMovement` company-level movements
  (branchId null) remain visible to all branches of the company (documented contract).

### F — Functional remediation

- `production-quality.service.ts` and `production-cost.service.ts` accept global `Product` catalog
  references without a tenant check (`assertGlobalProduct`) and derive ownership for production-master
  references (`assertDerivedProductReference` via `ProductionProductDefinition`). `production-cost`
  additionally enforces `assertTenantScoped` for productionLine/machine/costCenter/shift/order/run/output
  event/standard-cost-snapshot. Specs cover global acceptance and derived-reference rejection.

### S — Schema / tenancy contract / ownership

- Reviewed the 4 task migrations (all additive, deterministic backfill, no guessed ownership, safe NULL
  legacy semantics, indexes/unique constraints aligned with service behavior):
  - `20260814120000_scope_production_output_idempotency_by_branch`: replaces the cross-tenant unique on
    `production_output_events` with `UNIQUE ([companyId],[branchId],[requestId])`.
  - `20260814121500_add_inventory_lock_tenant_ownership`: nullable `companyId`/`branchId` on
    `inventory_locks` + deterministic backfill from location/warehouse; company-wide warehouses keep NULL
    branchId; tenant-first indexes.
  - `20260814123000_scope_attachments_by_context`: nullable tenant cols on `attachments`; backfill only
    when the owning aggregate (production order / nonconformance) proves an exact company+branch.
  - `20260814130000_scope_barcode_operations_by_context`: nullable tenant cols on `barcode_labels`,
    `barcode_scan_events`, `barcode_print_jobs`; backfill via `#BarcodeEntityOwners` temp table only when a
    MACHINE/MACHINE_PART/WAREHOUSE owning aggregate proves exact company+branch. The only `DROP` is the
    temp table (`DROP TABLE [#BarcodeEntityOwners]`) — not application data.
- Schema alignment verified: `InventoryLock` (schema line 1305), `BarcodeLabel` (3161), `BarcodeScanEvent`
  (3207), `BarcodePrintJob` (3271) carry nullable tenant columns + matching indexes; `ProductionOutputEvent`
  (4076) `@@unique([companyId,branchId,requestId])` matches the migration.
- Gates: `PRISMA_SCHEMA_MIGRATION_ALIGNMENT=PASS`, `DESTRUCTIVE_MIGRATIONS=0`, `DB_PUSH_USED=NO`,
  `MIGRATE_RESET_USED=NO`, `DATABASE_RESET_USED=NO`. Only `prisma validate` and `prisma generate` were run.

### D1 — Empty/non-meaningful API specs

- 27 deleted files verified 0-byte stubs at HEAD: 10 barcode dead files (6 unregistered DTO/service/module +
  4 template/records stubs) and 17 empty specs across common guards/request-policy/workflow-engine and
  module-level stubs. All unimported. `FINAL_EMPTY_ACTIVE_SPEC_FILES=0`; 125 active API specs remain.

### D2 — API smoke script

- `scripts/api-smoke-test.js` (14,372 bytes): syntax valid (`node --check` exit 0), non-empty, meaningful,
  credential-safe (reads `ATSOFT_API_TOKEN` from environment, masks passwords), non-destructive (GET-only
  versioned endpoints `/api/v1/health`, `/auth/me`, `/auth/contexts`, `/auth/permissions`, `/dashboard/summary`),
  requires token for scoped reads, non-zero exit on failure. Unit spec `api-smoke-script.spec.ts` (220 lines)
  covers versioning, read-only endpoints, and redaction.
- Runtime smoke: **NOT_EXECUTED_ENVIRONMENT** — API and SQL Server are not running in this session; no PASS
  is claimed and no production data was touched.

### C1 — Frontend/API route contract

- `node scripts/check-api-route-contract.mjs` re-run after all final changes: `MATCHED=1049`,
  `MALFORMED=0`, `UNRESOLVED=0`, `MISMATCHES=0` → `FINAL_ACTIVE_ROUTE_MISMATCHES=0`.
- 9 web files changed (F9 lookup adapters/types + pages) are C1 contract alignment only.

## 3. Validation gates (final)

| Gate | Result |
| --- | --- |
| API typecheck (`tsc --noEmit`) | PASS (0 errors) |
| API build (`tsc`) | PASS |
| Web typecheck (`tsc --noEmit`) | PASS |
| Web build (`next build`) | PASS |
| Prisma validate | PASS |
| Prisma generate | PASS |
| Full API test suite | PASS — 104 suites, 1508 tests, 0 failed |
| Focused security/tenant suites | PASS (included above) |
| i18n | PASS |
| Raw keys | PASS |
| Credentials (`credentials:check`) | PASS |
| UI baseline (`ui-baseline:check`) | PASS |
| Route contract | PASS (1049/1049, mismatches=0) |
| `git diff --check` | PASS |

## 4. Security re-audit summary

- No service trusts client-supplied `companyId`/`branchId` for scoping; where accepted they are either
  ignored (where built from `ctx`) or validated/coerced to `ctx` values.
- No relation/where/include passthrough from client DTOs into Prisma queries.
- By-id reads enforce tenant scope either in the query (`findFirst { id, ...tenantWhere(ctx) }`) or via
  parent-context checks (e.g., inventory-adjustments line reads verify `findOne(id, ctx)` then linkage).
- No known `CONTRACT_DECISION_REQUIRED` blockers remain. Documented contract items (branch-scope unique
  keys, company-level inventory movements, global product/category catalogs) are recorded in §2.

## 5. Limitations

- Runtime smoke and live end-to-end browser proof require the API + SQL Server to be running; they were
  not executed in this branch. Verification rests on static gates + the 1508-test dynamic suite.
- SQL Server runtime migration application and seed verification still require a live database session.
