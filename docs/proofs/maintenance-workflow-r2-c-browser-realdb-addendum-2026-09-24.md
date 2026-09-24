# Maintenance Workflow — R2-C: Authenticated Browser + Real-DB Certification (Addendum)

Program: ATsofterp · Maintenance workflow (batch R2), maintenance-workflow-r2 branch.
Purpose: supersedes the `BROWSER_NOT_VERIFIED_ENVIRONMENT_LIMITATION` record of the R2-C closeout (`docs/proofs/maintenance-workflow-r2-c-request-work-order-integration.md`, frozen at `b816af55`) with an **authenticated browser proof running against the real API + a disposable SQL Server clone**, and documents the single authorized minimal source hotfix plus two pre-existing frontend issues the browser run surfaced (documented, not hidden).
Date: 2026-09-24.
Classification: `R2_C_BROWSER_BLOCKER_CLASSIFICATION=PRE_EXISTING_FRONTEND_DEFECT`, `R2_C_REGRESSION=NO`. No migration, no schema change, no Production-module or production-data change.

---

## 0. Verification invariants and runtime topology

- Branch `maintenance-workflow-r2`; frozen commits **not amended**: R2-C source `b8c620544d0be7aad9288e436fc6c6f5e206d1d7`, R2-C closeout `b816af5513f0233fad0ccc43206c1f6d1f0b9e7a`. This task added exactly one new repo commit: the hotfix (`ec903ff603c86dc21353921aa31768be44bc7623`). No push/merge/tag. `WORKTREE_CLEAN=YES`, `ORIGIN_MAIN_UNCHANGED=YES`.
- Runtime used for proof (all temp/disposable, all stopped after proof except the retained clone):
  - Disposable SQL clone `ATsoftERP_R2C_BROWSER_20260924` on `DESKTOP-HJALRR4\WINCC` (`localhost,50079`) — created by scripted restore from a production backup, read/write used only inside the clone.
  - Temp API on `:4010` (one `ts-node` process, PID 39632) pointed at the clone.
  - Real-repo web production build served on `:3010` (PID 32764), built from the current repo tree with `NEXT_PUBLIC_API_URL=http://localhost:4010/api/v1` injected at build time (no `.env` created anywhere; `apps/web/src/lib/api.ts` inlines the variable into the client bundle). Verified: 128 client files contain `localhost:4010`, 0 contain `localhost:4000`.
  - Production API `:4000` (PID 7724) and Production web `:3000` (PID 8160) were **never touched** during this task.
- Clone identity proven **before** any mutation: fixture machine `MCH-000012` (`QA-SYS-MACH-E2-1787574991254`) present and ACTIVE (`deletedAt` NULL), earlier R2C-series requests present. Tables verified: `machines` (code/companyId/branchId), `maintenance_requests` (requestNumber/title/status/machineId…), `maintenance_work_orders` (workOrderNumber/title/status/requestId/companyId/branchId/cancelReason/startedAt/completedAt/cancelledAt…).
- Isolated-context credentials were sourced from an out-of-tree location (`creds.ps1` in the temp dir) in the same command as the harness run; no credentials were added to the repository.

## 1. Authorized minimal hotfix (the only repo change)

- **Defect (pre-existing, from R2-B closeout audit):** `apps/web/src/app/admin/maintenance/requests/[id]/page.tsx` returned early (`if (!data)` / `if (error)` guards) **before** a `useEffect` for condition balances, leaving React hooks after conditional returns. In the React 19 hooks-order window this is a latent hook-ordering hazard.
- **Fix (one file + one regression test):** moved all hooks (including the condition-balances `useEffect`) above the early-return guards; behavior unchanged (guards remain; the effect runs unconditionally with safe internal guards). API, schema, permissions, i18n and contracts untouched.
- **Regression test** `apps/web/tests/request-detail-hook-order.test.ts` asserts every hook precedes the guarded early returns (catches the original shape; proven red-sensitive by construction). Web suite after fix: **37 suites / 1015 tests / 0 failures** (baseline 1013), 0 removed, 0 new skips.
- Committed separately: `ec903ff603c86dc21353921aa31768be44bc7623` — `fix(maintenance): correct request detail hook ordering`. `git diff --check` clean.

## 2. Authenticated browser proof (Frontend → API → Permission → Service → DB → UI)

Playwright authenticated session, 1500×980, EN (LTR) + explicit `lang`/`locale` overrides for AR (RTL), screenshots captured. Full run: **27/27 steps PASS, 0 FAIL**.

| Step | Proved contract |
|---|---|
| EN_LOGIN / EN_FORCE_LTR / EN_CONTEXT_SELECT / EN_DASHBOARD | real login (JWT), enforced LTR `html dir=${dir}` + `:en`, context selection |
| EN_REQ_CREATE | create maintenance request through the real API (form → F9 machine pick → POST) |
| EN_REQ_OPEN_DETAIL | detail loads the same record (loading → success), no hook-order runtime error |
| EN_REQ_EDIT | edit the **same** record (`PATCH /requests/:id` via `Save & View`), no duplicate record |
| EN_WO1_CREATE / EN_WO1_GO_TO_DETAIL | create-from-request (`from-request/:requestId`), auto-navigate to created WO |
| EN_WO1_PLAN | WO DRAFT → PLAN via dedicated transition endpoint |
| EN_WO1_START_BLOCKED | business guard: request OPEN blocks WO start; exact API 400 captured: `{"field":"status","code":"workOrderStartRequiresInProgressRequest"}` (asserted on the response, not the UI copy) |
| EN_REQ_START / EN_WO1_START | request OPEN → IN_PROGRESS then WO start allowed; WO started |
| EN_REQ_CANCEL_BLOCKED / EN_REQ_COMPLETE_BLOCKED | request guards render translated errors (`activeWorkOrdersBlockCancel`, `openWorkOrdersBlockCompletion`) |
| EN_WO1_COMPLETE | WO IN_PROGRESS → COMPLETED (completedAt persisted, see §3) |
| EN_WO2_CREATE / EN_WO2_PLAN | second WO on same request, DRAFT → PLANNED |
| EN_REQ_COMPLETE_BLOCKED_AGAIN | request cannot complete while WO2 PLANNED |
| EN_WO2_CANCEL | WO2 cancel **requires a reason** (UI validation + `cancelReason` payload) → CANCELLED |
| EN_REQ_COMPLETE | after both WOs terminal, request COMPLETED |
| EN_WO_BACKLINK_LIST | request detail Linked Work Orders tab lists both WOs with final statuses |
| EN_REQ2_CANCEL_OK | second request create + cancel end-to-end (dedicated `/requests/:id/cancel`) |
| AR_LOGIN / AR_CONTEXT_SELECT / AR_RTL_WO_DETAIL / AR_RTL_REQ_DETAIL | Arabic UI end-to-end with `html dir=rtl` on request + WO detail; Arabic text rendered |

Result flags: `EN_LTR=PASS`, `AR_RTL=PASS`, `UNEXPECTED_BROWSER_4XX=0`, `UNEXPECTED_BROWSER_5XX=0`, `UNEXPECTED_CONSOLE_ERRORS=0` (the only console "errors" seen were Next.js App-Router RSC-prefetch aborts `net::ERR_ABORTED` on `?_rsc=` — benign navigation prefetch cancellations, explicitly excluded and disclosed). `REQUEST_DETAIL_RENDER_LOADING→SUCCESS=PASS`, `REQUEST_DETAIL_RENDER_ERROR=PASS` (request-detail error modal path exercised by the blocked transitions); `HOOK_ORDER_RUNTIME_ERROR=0`.

## 3. Real-DB verification (read-only checks on the clone final state)

Certification-run rows (browser timestamps 14:57–14:58, created against the clone):

| Entity | Key fields (as persisted) |
|---|---|
| MR-000109 | `R2C-BROWSER-EN-REQ-20260924145709 (edited)` — status **COMPLETED**; machine `MCH-000012`; company `cmrl31uuy0000ok959hdjnca6`; branch `cmrx06a560000ng95g7d65vzh` |
| WO-000037 | `R2C-BROWSER-WO1-20260924145709` — **COMPLETED** (startedAt 14:58:05, completedAt 14:58:20, estimatedCost 150.00), `requestId` → MR-000109 |
| WO-000038 | `R2C-BROWSER-WO2-20260924145709` — **CANCELLED** (cancelledAt 14:58:33, `cancelReason` = "R2C browser cancel reason", i.e. the UI-entered reason persisted), `requestId` → MR-000109 |
| MR-000110 | `R2C-BROWSER-EN-GUARD-REQ-20260924145709` — status **CANCELLED** (14:58:36) |

Workflow-ordering invariants hold at DB level: request COMPLETED only after both linked WOs terminal; request cancel (14:58:36) only after WO cancel (14:58:33); WO `companyId`/`branchId` equal the machine/request context (tenant-safe). No other R2C rows for this run.

Production DB (`ATsoftERP_DB`, read-only SELECTs): `0 / 0 / 0` rows whose `title`/`code` matches `R2C-BROWSER%` across `maintenance_requests`, `maintenance_work_orders`, `machines`. **`PRODUCTION_DB_R2C_ROWS=0`**, `R2_C_MIGRATION_REQUIRED=NO`, `R2_C_MIGRATION_EXECUTED=NO`.

## 4. Pre-existing issues surfaced by the browser run (disclosed, outside hotfix scope)

1. **Frontend i18n gap for `workOrderStartRequiresInProgressRequest`.** The key exists only in the API (`maintenance-work-orders.service.ts:462`, asserted by spec line 1276); it is **absent from both `en` and `ar` frontend dictionaries**. The engine rule fires correctly (the authenticated run asserted the exact 400 body with this code), but the UI error modal falls back to "The requested text could not be displayed." — the R2-C closeout §5 listed this key among registered; the live run demonstrates the dictionary entry is missing. **Recommended follow-up:** register the key en+ar and re-run `i18n:check`. Not modified here (outside the authorized one-file hotfix).
2. **Next.js RSC prefetch aborts (`net::ERR_ABORTED`)** — benign navigation-prefetch cancellations observed in every navigation; excluded from the console-error count with this justification; no action required.

## 5. Validation results (post-hotfix repo tree)

- Web logic tests: **37 suites / 1015 tests / 0 failures** (`npm run test:web-logic`).
- Typecheck: **PASS** (api `tsc --noEmit` clean; web workspace has no typecheck script).
- Web production build: **PASS** — both the validation build and the `:3010`-serving build with `NEXT_PUBLIC_API_URL=http://localhost:4010/api/v1` baked in.
- Gates (unchanged tree, re-verified after hotfix): route-contract 1115 matched / 0 malformed / 0 unresolved / 0 mismatches; i18n 6137 EN == 6137 AR; raw-keys PASS; verify-permission-ui PASS; ui-baseline 99 checks PASS; `git diff --check` PASS.

## 6. Definition of Done / status

| DoD aspect | Evidence |
|---|---|
| Real, connected, production-capable flow | authenticated browser: frontend → API → permissions → service → SQL Server clone → audit-visible DB rows, create/read/update/SAME-record/status-transitions/lifecycle timestamps |
| Tenant isolation | WO companyId/branchId == machine/request context; production DB zero R2C rows; workload confined to disposable clone |
| i18n / RTL-LTR | EN LTR + AR RTL both PASS; one documented pre-existing missing AR/EN key (follow-up) |
| Tests | +1 regression test (37 suites/1015/0); no removed/skipped |
| Scope control | exactly one source file + one test committed (`ec903ff6`); frozen commits untouched |
| Status | **R2-C: CLOSED (supplemented with authenticated browser + real-DB certification). R2-D: READY** (clone `ATsoftERP_R2C_BROWSER_20260924` retained for R2-D) |

## 7. Final flag block

```
R2_C_BROWSER_AUTHENTICATED_PROOF=PASS
REQUEST_WORK_ORDER_BROWSER_FLOW=PASS
REQUEST_DETAIL_RENDER_LOADING=PASS
REQUEST_DETAIL_RENDER_SUCCESS=PASS
REQUEST_DETAIL_RENDER_ERROR=PASS
HOOK_ORDER_RUNTIME_ERROR=0
R2_C_BROWSER_BLOCKER_HOTFIX_COMMIT=ec903ff603c86dc21353921aa31768be44bc7623
R2_C_BROWSER_BLOCKER_CLASSIFICATION=PRE_EXISTING_FRONTEND_DEFECT
R2_C_REGRESSION=NO
UNEXPECTED_BROWSER_4XX=0
UNEXPECTED_BROWSER_5XX=0
UNEXPECTED_CONSOLE_ERRORS=0
TEMP_RUNTIME_DB=ATsoftERP_R2C_BROWSER_20260924 (retained for R2-D)
PRODUCTION_DB_R2C_ROWS=0
WORKTREE_CLEAN=YES
ORIGIN_MAIN_UNCHANGED=YES
R2_C_MIGRATION_REQUIRED=NO
R2_C_MIGRATION_EXECUTED=NO
```

## 8. Commit record

- Source (frozen): `feat(maintenance): canonical request-to-work-order integration (R2-C)` — `b8c620544d0be7aad9288e436fc6c6f5e206d1d7`.
- Closeout (frozen): `docs(maintenance): close R2-C request-to-work-order integration` — `b816af5513f0233fad0ccc43206c1f6d1f0b9e7a`.
- Hotfix (this task): `fix(maintenance): correct request detail hook ordering` — `ec903ff603c86dc21353921aa31768be44bc7623` (page.tsx + regression test only).
- Addendum (this task): `<R2_C_BROWSER_ADDENDUM_COMMIT>`.
- No push, no merge, no tag. This addendum reports actual results only.