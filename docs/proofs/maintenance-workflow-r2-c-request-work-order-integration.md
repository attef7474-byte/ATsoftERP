# Maintenance Workflow — R2-C: Request → Work Order Canonical Integration (Evidence)

Program: ATsofterp · Maintenance workflow (batch R2)
Phase this document closes: **R2-C — REQUEST → WORK ORDER CANONICAL INTEGRATION (implementation evidence, status CLOSED)**.
Date: 2026-09-24.
Supersedes-by contract: R2-A (`docs/proofs/maintenance-workflow-r2-a-current-state-and-canonical-contract.md`, frozen at `330accfb`) and R2-B (`docs/proofs/maintenance-workflow-r2-b-request-workflow-hardening.md`).
Evidence basis: direct source diffs, focused and full test regression, service-level integration proofs through the real service code, API/web builds, and every static gate (route-contract, i18n, raw-key, UI baseline, credentials).

---

## 0. Verification invariants

- Branch `maintenance-workflow-r2`; R2-B frozen at `b519bdfbe219564fa1572307c26b36fcec68da10`. No push/merge performed. origin/main untouched.
- No migration, no DB/data mutation, no Production module change, no `prisma` schema change. `R2_C_MIGRATION_REQUIRED=NO`.
- `PrismaService` remains a plain PrismaClient (no tenant middleware) — tenant enforcement is per-service (this task) and the global `ValidationPipe` (`whitelist + forbidNonWhitelisted`) rejects unknown body fields; `requestId`/`machineId` are derived or validated server-side, never trusted from the `from-request` path.
- The live API was reachable (`GET /api/v1/health` = 200) but authenticated reads were skipped because `ATSOFT_API_TOKEN` is not available in this environment. This is an **environment limitation**, not a product defect.

## 1. Evidence classification legend

- **PROVEN_BY_SOURCE** — verified by direct review of committed source (no runtime execution).
- **PROVEN_BY_TEST** — verified by focused or full automated tests through the real service/DTO code (mocked Prisma adapter, real business logic).
- **PROVEN_BY_SERVICE_RUNTIME** — verified by running the actual invoked code paths in the test runtime (the service class, DTO validation pipe, and controller wiring execute for real; only the Prisma client is the test double).
- **BROWSER_NOT_VERIFIED_ENVIRONMENT_LIMITATION** — requires a live authenticated browser session; cannot be executed here because no token/credentials are available. Recorded honestly, not manufactured.

## 2. Backend authority and request link contract

`/maintenance-work-orders/from-request/:requestId` (`createFromRequest`) is the canonical request→work-order authority. When a WO is linked to a request, the request is the source of truth for machine, component, company and branch.

| §25 contract point | Status | Evidence class |
|---|---|---|
| Create a work order from a valid request; `requestId`/`machineId` server-derived and absent from the DTO | PASS | PROVEN_BY_SERVICE_RUNTIME — `createFromRequest` + `CreateWorkOrderFromRequestDto` (no `requestId`/`machineId` fields); service derives both from the fetched request; spec `creates a work order from a request (requestId/machineId derived, ctx authority)` |
| Company/branch taken from the operational context, never from the client | PASS | PROVEN_BY_SERVICE_RUNTIME — derived `companyId`/`branchId` from request company/branch, asserted against `ctx`; spec asserts c1/b1 authority |
| Terminal request (COMPLETED/CANCELLED/CLOSED) cannot create WOs | PASS | PROVEN_BY_SERVICE_RUNTIME — `it.each` over the three terminal states → `workOrderRequestTerminal` |
| Generic create with `requestId` runs the identical canonical validation | PASS | PROVEN_BY_SERVICE_RUNTIME — generic create `requestId` + `machineId`/`componentId` mismatch tests (`workOrderMachineRequestMismatch`, `workOrderComponentRequestMismatch`, `workOrderComponentMachineMismatch`), derive-on-absent, terminal rejection, valid link pass |
| Request/machine mismatch rejected | PASS | PROVEN_BY_SERVICE_RUNTIME — `workOrderMachineRequestMismatch` (from-request + generic + update test `rejects a machine change that contradicts the linked request`) |
| Request/component mismatch rejected | PASS | PROVEN_BY_SERVICE_RUNTIME — `workOrderComponentRequestMismatch` (create + update + `component override that contradicts the request component`) |
| Foreign request/machine/component/warehouse/assigned user/supervisor rejected | PASS | PROVEN_BY_SERVICE_RUNTIME — spec lines: foreign machine (152), request-machine foreign (161), cross-tenant machine attribution (528), request machine foreign create (1054), component belongs to another machine (1086, 1164), foreign warehouse (872, 1173), supervisor other branch (1095), inactive assigned user (1105), foreign part line (929) |
| Link immutable after execution begins | PASS | PROVEN_BY_SERVICE_RUNTIME — `preventRequestReassignmentAfterExecutionBegins` (PLANNED state) → `workOrderRequestLinkImmutable` |
| Completed WO request link immutable | PASS | PROVEN_BY_SERVICE_RUNTIME — `requestLinkImmutableAfterCompletion` |
| Multiple WOs per request supported | PASS | PROVEN_BY_SERVICE_RUNTIME — `creates multiple work orders for the same request` (open orders do not block additional WO creation) |
| WO list scoped by request, tenant-safe | PASS | PROVEN_BY_SERVICE_RUNTIME — `findAll` filters by `requestId`, WO lookup owned by company/branch; `andWhere` scope asserted |

## 3. Workflow state coordination (Request ↔ WO)

| §25 contract point | Status | Evidence class |
|---|---|---|
| WO `start` obeys request state | PASS | PROVEN_BY_SERVICE_RUNTIME — OPEN request blocks start (`workOrderStartRequiresInProgressRequest`); IN_PROGRESS request allows; terminal request blocks |
| Request completion rejects active linked WOs | PASS | PROVEN_BY_SERVICE_RUNTIME — request `complete()` fails on linked DRAFT/PLANNED/IN_PROGRESS WOs (`openWorkOrdersBlockCompletion`); R2-B test retained |
| Request cancellation rejects orphaning WOs | PASS | PROVEN_BY_SERVICE_RUNTIME — `cancel()` blocked while linked WO PLANNED or IN_PROGRESS (`maintenance.activeWorkOrdersBlockCancel` with `params.count`); no cascade-cancel |
| Request reopen history-safe | PASS | PROVEN_BY_SERVICE_RUNTIME — `reopen()` never mutates linked WOs and audits `linkedWorkOrders`; CLOSED→OPEN remains the only entry point; `reopen` WO counters unchanged |

## 4. Frontend integration (Request detail ↔ WO)

| §25 contract point | Status | Evidence class |
|---|---|---|
| Request detail loads its work orders | PASS | PROVEN_BY_SOURCE — `requests/[id]/page.tsx` fetches `/maintenance-work-orders?requestId=&limit=50` into the `workOrders` tab table with StatusBadge |
| Create-WO action obeys permission and request state | PASS | PROVEN_BY_SOURCE — action gated on `maintenance-work-order:create` permission and `!requestIsTerminal`; hidden on COMPLETED/CANCELLED/CLOSED |
| Create-from-request form (prefill, F9, modifiers) | PASS | PROVEN_BY_SOURCE + PROVEN_BY_TEST — modal posts `from-request/:id`; DTO spec validates whitelist/rejections; title/description/priority prefilled; supervisor/assignedTo/warehouse F9 lookups; planned-start/end + estimatedCost fields |
| Submit navigates to the created work order | PASS | PROVEN_BY_SOURCE — on success `router.push(/admin/maintenance/work-orders/<createdId>)` |
| WO detail shows the originating request backlink | PASS | PROVEN_BY_SOURCE — `work-orders/[id]/page.tsx` renders route-link `[requestNumber] title` to `/admin/maintenance/requests/<id>` + request StatusBadge |
| WO list shows the request link column/filter | PASS | PROVEN_BY_SOURCE — `work-orders/page.tsx` `requestId` column `[requestNumber] title` with `filterable` |
| No raw request row IDs rendered | PASS | PROVEN_BY_SOURCE — displays `requestNumber`/`title`; IDs only in hrefs |
| Arabic UI RTL / English UI LTR | NOT_VERIFIED | BROWSER_NOT_VERIFIED_ENVIRONMENT_LIMITATION — i18n keys for every R2-C string are registered in both `en/maintenance.ts` and `ar/maintenance.ts` (synchronized, 6137 == 6137, `i18n:check` PASS); visual RTL/LTR confirmation requires the authenticated browser session |

## 5. Error contract and i18n

- New canonical message keys (flat `maintenance` namespace, registered en+ar): `workOrderRequestInvalidReference`, `workOrderRequestTerminal`, `workOrderMachineRequestMismatch`, `workOrderComponentRequestMismatch`, `workOrderComponentMachineMismatch`, `workOrderRequestLinkImmutable`, `workOrderRequestTerminalBlocksTransition`, `workOrderStartRequiresInProgressRequest`, `workOrderRequestCancelledBlocksCompletion`; flat `maintenance.activeWorkOrdersBlockCancel` (with `{count}` param).
- Frontend error path upgraded to carry structured `messageKey` + `params`: `api.ts` copies `json.params` onto the error; `error-utils.ts` `normalizeApiError` passes `body.params` into the translator (`t(body.messageKey, undefined, body.params)`); the shared error modal therefore renders the interpolated `{count}` message (e.g. "2 work orders …").  **PROVEN_BY_TEST** — new `error-utils.test.ts` cases assert (a) the translator receives `[key, undefined, { count }]` and (b) the server message wins when present (17/17 focused web tests).
- `raw-keys / verify-permission-ui / i18n` gates all PASS; no raw permission keys in affected pages; no raw key rendered to users.

## 6. Tests and proof

### Focused (affected modules)
- API focused: **4 suites / 175 tests / 0 failures** (`maintenance-work-orders.service.spec.ts`, `maintenance-work-orders.r1e.spec.ts`, `create-work-order-from-request.dto.spec.ts`, `maintenance-requests.service.spec.ts`) — PROVEN_BY_SERVICE_RUNTIME for every §25 backend contract in sections 2–3.
- Web focused: **17/17** `error-utils.test.ts` (params propagation + interpolation contract).

### Full regression
- API: **166 suites / 2982 tests / 0 failures / 0 skipped** (`npm run test` in `apps/api`). (+41 over R2-B baseline 2941.)
- Web: **36 suites / 1013 tests / 0 failures** (`npm run test:web-logic`). (+2 over prior baseline.)
- API production build: **PASS** (`npm run build --workspace apps/api`).
- Web production build: **PASS** (`npm run build --workspace apps/web`).

### Gates
- `route-contract:check`: BACKENDROUTES=1123, MATCHED=1115, MALFORMED=0, UNRESOLVED=0, MISMATCHES=0.
- `i18n:check`: PASS (6137 en == 6137 ar, all namespaces registered, all 9754 literal `t()` keys resolve).
- `raw-keys:check`: PASS.
- `verify-permission-ui.mjs`: PASS.
- `check-ui-baseline.mjs` (`ui-baseline:check`): PASS (raw-key safety, denial-text parity, error-dialog structure, loading/error/empty states).
- `credentials:check`: PASS (no hardcoded credentials).
- `git diff --check`: PASS.
- Smoke: `GET /api/v1/health` 200; authenticated endpoints skipped (`ATSOFT_API_TOKEN_NOT_PROVIDED`).

## 7. Tenant-isolation proof

- Backend-only enforcement. Every create/update/transition validates the linked request, machine, component, warehouse, supervisor and assigned user against `ctx.companyId`/`ctx.branchId` (+ machine ownership for components); ID-only lookups are never trusted (spec: foreign machine 152, foreign request-machine 161/1054, foreign component 1086/1164, foreign warehouse 295/872/1173, foreign supervisor 1095, inactive assignee 1105, foreign WO/branch read 243/248, foreign WO update 290, foreign delete 1005, foreign part line 929).
- `findOne`/list/search remain scoped by company/branch; `findAll` `requestId` filter adds no cross-tenant leakage (spec `findAll` requestId scoping + tenant assertions).

## 8. Permission and audit

- Permission `maintenance-work-order:create` (existing seeded key) guards `POST from-request/:requestId` in the controller; frontend create action gates on the same key; permission-UI consistency suite passed in full regression. **PROVEN_BY_SOURCE + PROVEN_BY_TEST**.
- Audit: WO create-from-request, transitions, start and request cancel/reopen paths write audit with prior/new values; request `reopen` records `linkedWorkOrders`; dedicated status transitions still bypass the generic edit endpoint.

## 9. Known limitations (environment, not defects)

- **`R2_C_BROWSER_AUTHENTICATED_PROOF=NOT_VERIFIED`** — no authenticated browser session available (`ATSOFT_API_TOKEN_NOT_PROVIDED`). All R2-C functional, security and regression contracts are proven by source, focused tests, full regression and service-runtime proofs; no contract depends solely on browser execution. `R2_C_BROWSER_BLOCKER_CLASSIFICATION=ENVIRONMENT_LIMITATION`; `PRODUCT_DEFECT_FROM_BROWSER_LIMITATION=NO`. The one item whose final confirmation needs the browser is visual AR RTL / EN LTR rendering (section 4, recorded NOT_VERIFIED).
- No migration required (optional request link is additive and backward compatible; R2-B already enforced the request-side guards).

## 10. Definition-of-Done checklist

| Aspect | Evidence |
|---|---|
| No junk/mock/unrelated scope | diff limited to request↔work-order integration layer + its frontend/i18n; no schema, no migration, no Production |
| DTO validation + unknown-field rejection | `from-request` DTO omits deriveable/tenant fields; global `forbidNonWhitelisted`; DTO spec green |
| Permissions | `maintenance-work-order:create` enforced in controller, gated in UI, consistency suite green |
| Audit | create/start/transition/cancel/reopen audited; reopen records linked WOs |
| Tenant isolation | per-reference backend validation, tested for every foreign reference type (section 7) |
| i18n | en+ar synchronized (6137==6137); error `params` interpolated end-to-end; gates PASS |
| Tests meaningful | +41 API / +2 web focused-regression tests, all asserting real business rules; 0 removed, 0 skipped-new |
| Runtime proof | service-runtime proofs through real service code; health 200; browser proof honestly NOT_VERIFIED (environment) |
| Status | **R2-C: CLOSED. R2-D: READY** |

## 11. Commit record

- Source commit: `feat(maintenance): canonical request-to-work-order integration (R2-C)` — `b8c620544d0be7aad9288e436fc6c6f5e206d1d7`.
- Closeout commit: `docs(maintenance): close R2-C request-to-work-order integration` — `<R2_C_CLOSEOUT_COMMIT>`.
- No push, no merge, no tag. This document reports actual results only.