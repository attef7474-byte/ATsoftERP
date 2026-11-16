# Inventory Ledger source & filter contract hardening — 2026-11-13

Read-only hardening proof. No print surface, adapter, PDF, translation namespace, endpoint, schema, migration, permission or inventory business mutation was created or changed.

## 1. Result

| Item | Value |
| --- | --- |
| Classification (unchanged) | `REGISTER` |
| Design decision (unchanged) | `INVENTORY_LEDGER_DESIGN_EXTEND_EXISTING_MOVEMENTS_REGISTER_WITH_LEDGER_FILTERS` |
| Design status (unchanged) | `DESIGN_APPROVED` |
| Hardening decision | `INVENTORY_LEDGER_SOURCE_FILTER_CONTRACT_HARDENED` |
| Register implementation readiness | `READY` (source/filter preconditions satisfied) |
| Register print implemented | `NO` |
| `IMPLEMENTATION_AUTHORIZED` | `NO` |
| `NEXT_AUTHORIZED_PHASE` | `NONE` |
| `DETERMINISTIC_COLLECTION` | `FIXED` (was `BLOCKED`) |
| `DATE_ONLY_DATE_TO` | `FIXED` (was `BLOCKED`) |
| `LEDGER_UI_FILTER_CONTRACT` | `FIXED` (was missing) |
| `LOCATION_FILTER` | `DEFERRED_READABLE_SELECTOR_UNAVAILABLE` |
| `SOURCE_ID_FILTER` | `NOT_AUTHORIZED` |
| `MIXED_UOM_HEADER_TOTAL` | `FORBIDDEN` (screen defect removed) |
| `RUNNING_BALANCE` / `OPENING_BALANCE` / `CLOSING_BALANCE` | `OUT_OF_SCOPE` |
| `VALUATION` | `OUT_OF_SCOPE` |

Zero-change sentinels: `DATABASE_WRITE = 0`, `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`, `NEW_ENDPOINT = 0`, `PERMISSION_CHANGE = 0`, `INVENTORY_BUSINESS_WRITE = 0`, `PRINT_IMPLEMENTATION = 0`.

## 2. Authorized scope and exclusions

Authorized: deterministic server-side ordering, inclusive date-only `dateTo`, and a coherent Ledger UI filter contract with readable values. Three blockers only.

Deliberately not done: print action, print/PDF buttons, adapters, shared mapper extraction, collector wiring, new translation namespace, PDF proofs, schema/migration/new endpoint, location or raw `sourceId` selectors, `countStatus` repair on the movements report.

## 3. Files created

| File | Purpose |
| --- | --- |
| `apps/api/src/common/helpers/date-range.util.ts` | Shared date-range builder/validator: date-only lower bound at start-of-day UTC, date-only upper bound as exclusive next-day, full timestamps as exact `lte`, calendar-date validation, inverted-range rejection. |
| `apps/api/src/modules/factory/inventory-ledger-reconciliation/inventory-ledger-reconciliation-ledger.spec.ts` | Ledger endpoint hardening suite (ILH-P01/P02/P05/P06/P09/P10/P11/P12/P13 + invalid-range, foreign-warehouse, payload-shape). 12 tests. |
| `apps/api/src/modules/reports/services/inventory-movements-report.spec.ts` | Movements report hardening suite (ILH-P03/P04/P07/P08/P11/P12 + invalid-range, payload/status). 7 tests. |
| `apps/web/src/app/admin/inventory/ledger/filter-contract.ts` | Explicit Ledger query whitelist, enum option lists, normalization, empty omission, page/limit sanitization. |
| `apps/web/tests/inventory-ledger-filter-contract.test.ts` | Web contract suite (ILH-W01..W15 + one extra normalization case). 16 tests. |

## 4. Files modified

| File | Change |
| --- | --- |
| `apps/api/src/modules/factory/inventory-ledger-reconciliation/inventory-ledger-reconciliation.service.ts` | Added `LEDGER_ORDER_BY = [{ movementDate: 'desc' }, { id: 'desc' }]` to every ledger movement `findMany` (5 paths); `assertValidDateRange` at entry; `buildDateRange` for `movementDate`. No permission/scope change. |
| `apps/api/src/modules/reports/services/inventory-reports.service.ts` | `getInventoryMovementsReport`: `assertValidDateRange` at entry; `orderBy: [{ movementDate: 'desc' }, { id: 'desc' }]`. No `countStatus` repair. |
| `apps/api/src/modules/reports/services/report-query-utils.ts` | `buildDateFilter` now delegates to the shared helper, so all report endpoints get the same inclusive date-only upper bound. |
| `apps/web/src/app/admin/inventory/ledger/page.tsx` | Rewritten filter UI and table: search, warehouse F9, product F9, movement type, status, direction, source type, date-from/date-to, Apply/Reset; draft vs applied state; page reset on Apply/Reset; page preserved on pagination; localized movement type/direction/status; `[code] name` warehouse; line-count column. |
| `apps/web/src/lib/i18n/locales/en/inventory.ts` | `inventoryLedger`: `search` reworded to "Search"; added `searchPlaceholder`, `dateFrom`, `dateTo`, `lines`. |
| `apps/web/src/lib/i18n/locales/ar/inventory.ts` | Matching Arabic keys. |

No other file was changed by this phase. Pre-existing dirty-worktree modifications (for example `apps/web/src/lib/i18n/locales/*/common.ts`, `core.ts`, `maintenance.ts`, `reports.ts`, `validation.ts`, `maintenance/requests/[id]/print/page.tsx`) were not touched.

## 5. Blocker 1 — deterministic pagination

Before: `orderBy: { movementDate: 'desc' }` on the ledger and on the movements report. `movementDate` is not unique, so equal timestamps had no defined order and offset pagination could duplicate or drop rows.

After: `[{ movementDate: 'desc' }, { id: 'desc' }]` on the ledger (all five movement-list reads) and on `getInventoryMovementsReport`. `id` is the stable tie-break.

Evidence: ILH-P01/P03 assert the exact `orderBy`; ILH-P02/P04 paginate four same-timestamp rows two at a time and assert `['mv-d','mv-c']` / `['mv-b','mv-a']`, a four-element union with no duplicate, and a stable page-1 re-read.

## 6. Blocker 2 — date-only `dateTo` semantics

Before: `dateTo=2026-11-13` became `new Date('2026-11-13')` → `lte 2026-11-13T00:00:00.000Z`, dropping everything later that day.

After:

| Input | Range produced |
| --- | --- |
| `dateFrom=2026-11-13` | `gte 2026-11-13T00:00:00.000Z` |
| `dateTo=2026-11-13` | `lt 2026-11-14T00:00:00.000Z` |
| `dateFrom=dateTo=2026-11-13` | `gte 2026-11-13T00:00:00.000Z`, `lt 2026-11-14T00:00:00.000Z` |
| full timestamp `dateTo` | exact `lte` (unchanged) |
| invalid date or `dateFrom > dateTo` | `BadRequestException`, no query executed |

Calendar validation is explicit: `2026-02-31` is rejected instead of rolling over. Evidence: ILH-P05/P07 (same-day `00:00`, midday, `23:59:59.999` all included; next-day midnight excluded), ILH-P06/P08, ILH-P09 (inclusive lower bound), ILH-P10 (same date both ends), and the two invalid-range tests asserting `findMany` was never called.

## 7. Blocker 3 — Ledger UI filter contract

Draft vs applied: the user edits a draft; Apply copies it to applied state and resets to page 1; Reset clears both and returns to page 1. Pagination and refresh send the applied filters, not the draft.

Whitelist (the only keys that can leave the browser): `page`, `limit`, `search`, `warehouseId`, `productId`, `movementType`, `status`, `direction`, `sourceType`, `dateFrom`, `dateTo`. Empty values are omitted. `countStatus` is never sent; the Ledger uses the real `status`. `companyId`, `branchId`, `sourceId`, raw `locationId` and display labels are never sent. A hostile draft carrying `companyId`/`branchId`/`sourceId`/`locationId`/label fields is stripped.

Server side: tenant and branch scope come only from the active operational context. A requested `warehouseId` is validated against that context before filtering and returns `NotFoundException` when foreign. `locationId` and `sourceId` remain supported by the endpoint but are not exposed by the UI.

Readable values: movement type, direction and status use the canonical translators; warehouse renders `[code] name`; dates are locale-formatted; the mixed-UOM `lines[].quantity` sum was removed and replaced by a line count. No raw id, label or code is used as a display value.

## 8. Permission architecture (unchanged)

| Surface | Endpoint | Permission |
| --- | --- | --- |
| Ledger | `GET /inventory/ledger/movements` | `inventory-ledger:read` |
| Movements report | `GET /reports/inventory/movements` | `reports.inventory:read` |

`SHARED_MODEL != SHARED_AUTHORIZATION` holds. `PERMISSION_CHANGE = 0`; no seed, guard, decorator or permission key was modified.

## 9. Test evidence

Focused:

| Suite | Tests | Result |
| --- | --- | --- |
| `inventory-ledger-reconciliation-ledger.spec.ts` | 12 | PASS |
| `inventory-movements-report.spec.ts` | 7 | PASS |
| **API focused total** | **19** | **PASS (2 suites)** |
| `inventory-ledger-filter-contract.test.ts` | 16 | PASS |
| **Web focused total** | **16** | **PASS (1 suite)** |

Required ILH coverage: ILH-P01..P13 all present and passing (P01/P02 ledger ordering+pagination, P03/P04 report ordering+pagination, P05/P06 ledger inclusive `dateTo`, P07/P08 report inclusive `dateTo`, P09 lower bound, P10 same-day range, P11 company scope, P12 branch scope, P13 warehouse validation); ILH-W01..W15 all present and passing (query mapping, `status` not `countStatus`, hostile-field stripping, Apply/Reset/page behavior, readable values).

All tests are read-only unit tests with mocked Prisma. No test writes, no test database, no skipped/empty specs.

Full regressions (re-run this phase, new specs included):

| Suite | Result |
| --- | --- |
| API full (`apps/api`) | **219 suites / 4735 tests PASS** |
| Web full (`apps/web`) | **122 suites / 2298 tests PASS** |

Delta check: API 219 suites = 217 pre-phase + 2 new specs, and 4735 tests = 4716 + 19 new. Web 122 suites = 121 + 1 new spec, and 2298 tests = 2282 + 16 new. Both new API specs and the new Web spec appear as PASS in the full-run logs.

## 10. Build and gate results

| Gate | Result |
| --- | --- |
| API typecheck (`tsc --noEmit`) | PASS |
| Web typecheck (`tsc --noEmit`) | PASS |
| Web production build | PASS; 304 page routes (`server/app/**/page.js`), 0 route handlers |
| i18n check | PASS; 7069 EN / 7069 AR keys, 22 namespaces, no empty values, 11224 literal keys resolved |
| Raw-key check | PASS |
| UI baseline check | PASS; 99 checks |
| Permission UI verification | PASS |
| API route contract | PASS; 1185 backend routes, 1059 frontend call sites, 0 mismatches / 0 malformed / 0 unresolved |
| Hardcoded credentials | PASS |
| `git diff --check` | clean (exit 0) |
| U+FFFD scan on changed/new files | 0 replacement characters; 0 trailing-whitespace lines |
| `docs/print/` (untracked) | manual U+FFFD/trailing-whitespace check clean |

## 11. Git state

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `54e3706f` |
| Staged | 0 |
| Dirty status entries | 135 (pre-existing plus this phase) |
| Git writes performed | none (no add/commit/push/merge/rebase/reset/clean/restore) |
| Build/temp artifacts | none left in the worktree; `.next/` is gitignored |

## 12. Known limitations and non-regressions

- Register print is still not implemented. No adapter, Print button, collector wiring, PDF proof or native/browser print verification exists for the Ledger.
- Location and raw `sourceId` filters remain `DEFERRED` / `NOT_AUTHORIZED`; the endpoint still accepts them for authorized API callers, but the UI never sends them.
- `docs/print/ATsoftERP-print-audit.md` still describes the ledger page as sending only `page`/`limit`. That document was outside the three authorized doc updates and is now stale; it is reported, not silently rewritten.
- The movements-report `countStatus` defect is unchanged and out of scope (`NOT APPLIED`). The Ledger sends the real `status`.
- Enum validation refactor for the ledger query remains `DEFERRED_NON_BLOCKING`. The controller still accepts `@Query() query: any`; the explicit frontend whitelist is the client contract boundary, and the service validates tenant scope and warehouse ownership.
- No runtime browser proof was performed in this phase; verification is unit, typecheck, build and static-gate level. Print was explicitly out of scope.

## 13. Decision

**`INVENTORY_LEDGER_SOURCE_FILTER_CONTRACT_HARDENED`**

- `REGISTER_IMPLEMENTATION_READINESS = READY`
- `IMPLEMENTATION_AUTHORIZED = NO`
- `NEXT_AUTHORIZED_PHASE = NONE`

The three approved blockers are fixed and verified read-only. This proof does not authorize or implement Ledger print.
