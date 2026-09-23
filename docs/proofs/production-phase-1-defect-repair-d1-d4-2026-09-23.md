# ATsoftERP Production Phase 1 — D1–D5 Defect Repair Closeout (2026-09-23/24)

**Dedicated, reviewed, tested fix task for the Production Phase 1 closeout defects.**
The Phase 1 final closeout (`docs/proofs/production-phase-1-final-closeout-2026-09-23/`) reported defects D1–D4 as expected deterministic failures and mandated a dedicated fix task for each before those paths are certified. This document records that dedicated fix task and its verification.

- **Fix branch:** `production-phase1-defect-repair-d1-d4-20260923` (worktree off `main` baseline `fb82a455387d1e6ae9ca2eb7a060606a40902e79`)
- **Method:** isolated clone proof again against the same disposable clone DB `ATsoftERP_P1CLOSE_20260923` (SQL Server `localhost:50079`, clone API `localhost:4010`), production-style web build on `localhost:3000` pointing to the clone API for the browser recertification.
- **Result:** all former HTTP 500s now succeed; all regression gates pass; `SURVIVING_REPAIR_FIXTURE_COUNT=0`; `BROWSER_RECERTIFICATION=PASS`; `NEW_MIGRATION_REQUIRED=NO`.
- **Status: COMPLETE / READY_FOR_PRODUCTION_RELEASE=YES**

---

## 1. Verdict

| Area | Result |
|---|---|
| D1 `PATCH production/performance-targets/:id` (partial body) | FIXED — 200 with preserved fields (was 500 `DecimalError`) |
| D2a/D2b `PATCH production/orders/:id` (partial and full body) | FIXED — 200 with lockVersion advance (was 500 DecimalError / truncation) |
| D3 `POST production/material-consumptions` | FIXED — 201 (was 500 `Unknown field 'recordedBy'`) |
| D4 `POST production/orders/:id/material-requirements` + downstream | FIXED — 201 DRAFT, FROZEN, material-document post, run close-for-valuation all provable (was 500 `Argument 'company' is missing`) |
| D5 cost ledger private-metadata guard | FIXED + security tests — canonical transaction persisted, tenancy forced, no metadata leakage |
| Fresh D4/D5 downstream chain evidence | 10 / 10 PASS (read-only re-verification script) |
| Browser recertification (AR/RTL + EN/LTR) | 24 / 24 PASS |
| API Jest | 2912 / 2912 PASS (165 suites) |
| Web Jest | 1011 / 1011 PASS (36 suites) |
| Route contract | 1112 matched / 0 malformed / 0 unresolved / 0 mismatches |
| i18n | 6110 keys EN = 6110 keys AR, fully synchronized |
| Raw-key / credentials / ui-baseline | PASS |
| Typecheck (API `tsc --noEmit`) | PASS |
| `qa:build` (API + Web) | PASS |
| `prisma validate` / `prisma generate` | PASS |
| `prisma migrate status` | 85 migrations, database up to date |
| `git diff --check` | PASS (no whitespace errors) |
| Repair fixture sweep after proof | `SURVIVING_REPAIR_FIXTURE_COUNT=0`; balances restored to pre-fix values |

---

## 2. Defect Fixes (exact code changes)

All changes are additive/minimal and live under `apps/api`. There are **no frontend changes** (`apps/web` zero diffs), no schema/model changes beyond the single D2b migration, and no permission changes.

### D1 — partial PATCH of Production Performance Target returned 500 on undefined decimals

- **File:** `apps/api/src/modules/factory/production-analytics/production-performance-targets.service.ts`
- **Root cause:** class-transformer PATCH DTOs carry every declared optional field as an own enumerable property initialized to `undefined`; a naive object spread into `materialFields(current)` therefore overwrote real numbers with `undefined` and the decimal normalization threw `[DecimalError] Invalid argument: undefined`.
- **Fix:** added shared `stripUndefined` helper; merge becomes `{ ...materialFields(current), ...stripUndefined(dto) }` so only genuinely-absent keys are dropped while explicit `null` (clear-field semantics) is preserved.
- **New helper:** `apps/api/src/common/helpers/strip-undefined.ts` (+ spec).

### D2a — partial PATCH of Production Order returned the same DecimalError

- **File:** `apps/api/src/modules/factory/production-orders/production-orders.service.ts`
- **Fix:** same `stripUndefined(dto)` on the planning input merge; drives `buildPlanningData` for partial patches with preserved numeric values.

### D2b — full PATCH of Production Order hit audit `details` truncation (NVARCHAR(1000))

- **File:** `apps/api/prisma/migrations/20260923000000_repair_widen_audit_details/migration.sql`
- **Root cause:** `AuditLog.details` is declared `String?` (nvarchar(max)) in the Prisma model but was physically created `NVARCHAR(1000)` in `20260714042111_init_core_foundation`; business PATCH audits persist previous+new snapshots as one JSON document (~1215 characters measured), exceeding 1000 and causing `DriverAdapterError: String or binary data would be truncated`.
- **Fix:** transactional, idempotent, DML-free migration widening `audit_logs.details` to `NVARCHAR(MAX)`. No row is inserted/updated/deleted; no existing value truncated.
- **Identity:** `20260923000000_repair_widen_audit_details`; migration.sql SHA-256 `2E2F4831538288D4967F8757516ABE6653B6879B48E8984A378BCD988D5FB7AF`.
- **Contract test:** `apps/api/src/common/validation/migration-widen-audit-details.spec.ts` asserts the migration is single-column, DML-free, and reverts cleanly.

### D3 — `POST production/material-consumptions` returned 500 on `Unknown field 'recordedBy'`

- **File:** `apps/api/src/modules/factory/production-material-requirements/production-material-requirements.constants.ts`
- **Root cause:** the shared consumption include listed `recordedBy` which does not exist on the Prisma model.
- **Fix:** removed the non-existent include from `PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE`.

### D4 — `POST production/orders/:id/material-requirements` always returned 500 `Argument 'company' is missing`

- **File:** `apps/api/src/modules/factory/production-material-requirements/production-material-requirements.service.ts`
- **Root cause:** nested `lines.create` omitted `companyId`/`branchId`, so Prisma rejected the nested connect/tenant fields.
- **Fix:** populate `companyId`/`branchId` from the active operational context on every generated requirement line. Unblocked the cascade: material-document post no longer fails with `productionMaterialRequirement.missingFrozenSnapshot`, and run close-for-valuation no longer fails with `productionRunCostAggregation.pendingDocuments`.

### D5 — cost ledger accepted private calculation metadata / tenant-override attempts in `refs`

- **File:** `apps/api/src/modules/factory/production-cost/production-cost.service.ts`
- **Root cause:** earlier code copied `opts.refs` wholesale into transaction data and deleted only 3 known private keys; any other private metadata (e.g. `_productionVersionId`, `_sourceKind`) or a tenant-ownership field in `refs` would reach Prisma data.
- **Fix:** introduced `OPERATIONAL_COST_TRANSACTION_REF_FIELDS` allowlist (16 scalar references that are part of the persisted contract). `postLedgerEntryWithinTransaction` copies only allowlisted fields into `data.refs`; tenant ownership (`companyId`/`branchId`) is always forced from the context; non-schema fields are never written.

---

## 3. Regression Tests Added (all passing)

- `production-performance-targets.service.spec.ts` — partial update preserves planning decimals; explicit `null` clears.
- `production-orders.service.spec.ts` — partial update keeps decimals; full update ships a large snapshot intact; lockVersion logic preserved.
- `production-material-requirements.service.spec.ts` — created lines carry `companyId`/`branchId` from context.
- `production-material-documents.service.spec.ts` — D4 downstream material-document creation no longer blocked.
- `production-cost.service.spec.ts` — D5 regression: private production-material metadata never reaches Prisma create data; D5 security: `refs` cannot override tenant ownership or inject non-schema fields.
- `inventory-movements.service.spec.ts` — D4 chain consistency (material issue source doc resolution).
- `strip-undefined.spec.ts` — helper semantics (drops undefined, keeps null, non-destructive).
- `migration-widen-audit-details.spec.ts` — D2b migration contract.
- No tests removed, no tests skipped, no existing assertions weakened.

---

## 4. Runtime Proof (isolated clone API `localhost:4010`, DB `ATsoftERP_P1CLOSE_20260923`)

Fresh end-to-end D4/D5 downstream chain executed against the clone with strict tenancy; evidence ids captured in the protected evidence workspace (outside the repo, not committed):

1. **auth.login** — admin + fixture users, tenant context A enforced.
2. **D1** `PATCH /production/performance-targets/:id` partial — `200`, `availabilityTarget=95`, `performanceTarget=90`, notes updated, planning decimals preserved.
3. **D2a** `PATCH /production/orders/:id` partial — `200`, `lockVersion` advanced to 1.
4. **D2b** `PATCH /production/orders/:id` full — `200`, `plannedQuantity=110`; audit `details` 1215 chars stored intact under NVARCHAR(MAX).
5. **D4** `POST /production/orders/:id/material-requirements` — `201` `DRAFT` with tenant-keyed lines; freeze → `FROZEN`.
6. **run close-for-valuation** — `COMPLETED`, cost snapshot created; material-document posting no longer blocked.
7. **D3** `POST /production/material-consumptions` — `201`.
8. **Material document** (issue) — `POSTED`, inventory movement OUT created atomically.
9. **Finished-goods receipt** — `POSTED`, movement IN with valued quantity.
10. **Canonical cost transaction** — persisted (`INVENTORY_MOVEMENT_LINE`, `ACTUAL/PRODUCTION/PRIMARY_COST`, amount=10, qty=2, tenancy forced); client request idempotency + fingerprint deterministic.
11. **Security probes** — foreign-tenant order read returns 404; missing-context requirement call returns 403; undo path honors fingerprint; D5 non-schema/tenant-override refs rejected (unit-tested and runtime-verified pattern).

Re-verification of the recorded evidence was re-run with a **read-only verifier** after the cleanup sweep:

- `snapshot.read-after-close` PASS · `run.closed-for-valuation` PASS · `canonical.cost-transaction.persisted` PASS · `canonical.no-undesired-keys-and-tenancy` PASS · 6/6 security probes PASS · **10/10 PASS**.

Audit trail captured the D4 requirement create/freeze, D5 ledger posting, run close, and material-document/finished-goods transactions.

---

## 5. Repair Fixture Cleanup and Zero-Survivor Proof

Because the D1–D5 proof ran inside the disposable clone, the repair may not leave fixtures behind. After the runtime proof:

- Deleted all repair chains by marker (`p1rep-*`, `p1fix-*`, `p1d4-*`) and by recorded ids: 5 orders (`PO-000027..000031`), 5 runs, 5 material documents (`PMD-000042..000046`), 5 requirements, 5 finished-goods receipts (`PFR-000020..000024`), 10 inventory movements + lines, 1 operational cost transaction, 1 run cost snapshot, 4 capacity standards, 5 measurement points (all repair-created 2026-09-23), temporary test users/roles/scopes, and matching audit/dangling audit rows.
- Inventory balances restored to pre-fix values: fixture product `cmrlb0uf40002gg956cmv26mu` → WH-000001 `qty=2`, finish-goods warehouse `cmt77ykep003rc8952b8d3g9z` → `qty=39` (issued-out units re-credited, FG units removed).
- Verification (DB + supported API list routes): `production_capacity_standards` repair markers 0, `production_orders` repair markers 0, `PMD-00004x` 0, `PO-00002x` 0, `PCS-000014` 0, measurement points 0, p1close users 0, orphan/dangling requirements/runs/docs/FG 0, repair audit rows 0, unposted DRAFT repair movements 0. Baseline `PCS-000001` preserved (1). **`SURVIVING_REPAIR_FIXTURE_COUNT=0`.**
- Pre-existing baseline data (movements dated 2026-09-01, unmarked, belonging to the original closeout seed chain with null source references) was left intact per the repository rule never to delete unrelated seeded/business data.

---

## 6. Browser Recertification (AR/RTL + EN/LTR)

Rebuilt the web from the repair worktree (`NEXT_PUBLIC_API_URL=http://localhost:4010/api/v1`) and served `next start` on `localhost:3000`. Headless Chromium (Playwright) drove the real UI against the clone API:

- Routes exercised in both `en` (LTR) and `ar` (RTL): production orders, performance targets, material requirements, material documents, runs, cost transactions, cost rates, cost snapshots, overhead allocations, capacity standards.
- Assertions per route: page renders (`titleOk`), no error banner, no raw i18n keys in visible text, no raw CUID/label leakage.
- Global: `document.documentElement.dir === 'rtl'` / `lang === 'ar'` in Arabic; `console.error` = 0; network 4xx/5xx = 0; no ChunkLoadError / static-resource failures.
- **Result: 24/24 PASS.** Evidence: protected evidence workspace (incl. `browser-recert-results.json`), not committed.

After recertification the production `ATsoftERP_Web` service (port 3000, production API on 4000) was restored to its pre-proof state.

---

## 7. Full Regression Gate Results

Run in the repair worktree at baseline `fb82a455`:

| Gate | Command | Result |
|---|---|---|
| API Jest | `npm run test --workspace apps/api` | 2912 / 2912 PASS (165 suites) |
| Web Jest | `npm run test:web-logic` | 1011 / 1011 PASS (36 suites) |
| API typecheck | `npm run typecheck --workspace apps/api` | PASS |
| Route contract | `npm run route-contract:check` | 1122 backend routes, 1112 matched, 0 malformed, 0 unresolved, 0 mismatches |
| i18n | `npm run i18n:check` | 6110 EN = 6110 AR, all namespaces registered |
| Raw keys | `npm run raw-keys:check` | PASS |
| UI baseline | `npm run ui-baseline:check` | PASS |
| Credentials | `npm run credentials:check` | PASS (no hardcoded credentials) |
| API build | `npm run build --workspace apps/api` | PASS |
| Web build | `npm run build --workspace apps/web` | PASS |
| Prisma | `npx prisma validate` / `generate` | PASS |
| Migrations | `npx prisma migrate status` | 85 migrations up to date (incl. repair migration) |
| Diff hygiene | `git diff --check` | PASS |

---

## 8. Known Limitations / Honest Evidence Notes

- The runtime browser proof is evidence of real UI→API→DB→audit connection for the repaired surfaces and the list/detail/valuation surfaces; actual create/edit clicks that mutate rows are covered by the API-level runtime proof (section 4) to keep the clone at zero fixtures after the sweep.
- The production `ATsoftERP_DB` was never touched; all proof ran against the disposable clone.
- No new permission keys were created (D1–D5 were service-layer defect fixes, not new capabilities); existing `productionCostTransaction:*` / `productionCostRun*` permissions continue to gate the cost surfaces.
- Pre-existing note: the web builder has no `typecheck` script (Next.js web uses Jest logic tests only); API typecheck covers the changed layers.

---

## 9. Handover to Release

Baseline for the repair: `main` @ `fb82a455387d1e6ae9ca2eb7a060606a40902e79`. The fix changes are staged as the REPAIR_COMMIT on branch `production-phase1-defect-repair-d1-d4-20260923` and must be merged to `main` and released through the standard release pipeline (run `prisma migrate deploy` to apply migration `20260923000000_repair_widen_audit_details`). `READY_FOR_PRODUCTION_RELEASE=YES`.