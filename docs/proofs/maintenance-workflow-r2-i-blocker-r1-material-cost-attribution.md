# R2I-BLOCKER-R1 — material cost request attribution: REPAIRED AND PROVEN

Date: 2026-09-28. Program: MAINTENANCE-WORKFLOW-R2.

**Status: COMPLETE for the blocker scope. R2-I recertification still REQUIRED.**

This document closes the single defect recorded as a strict stop in
`docs/proofs/maintenance-workflow-r2-i-end-to-end-certification.md`. That failed
checkpoint document is immutable and is NOT edited, rewritten, or reinterpreted.
A fresh R2-I certification is still mandatory and is not claimed here.

---

## 1. The defect

Issuing a maintenance material line produced a correct physical inventory
movement and a correct canonical operational cost row, but the cost row carried
no `maintenanceRequestId`. Because the request cost summary aggregates strictly
by request id, the request read a material cost of `0` while the ledger and the
inventory movement both held the money. The ledger and the request therefore
disagreed, and the operator could not see material cost on the request.

The attribution was also structurally guessable: the writer was being handed the
route's request id rather than the request that actually owns the issued part.

## 2. Root cause and the fix

`postMaintenanceMaterialLedgerEntry` in
`apps/api/src/modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.service.ts`
did not receive, and therefore did not persist, the originating request id.

The repair passes the authoritative owner of the part to the writer:

- `MaintenanceRequestRequiredPart` is the record that actually owns the
  maintenance request for an issued line.
- Its `maintenanceRequestId` is read on the part that was validated for the
  route, so the value written is the request that owns the part, not the request
  that happened to be in the URL.
- The value is placed in `refs`, which the canonical writer already allowlists as
  `maintenanceRequestId`, so the ledger row and the movement line stay in one
  transaction with the inventory effect.

Exact source change, three additions, no other production behaviour touched:

```text
opts:   + maintenanceRequestId: string;
refs:   + maintenanceRequestId: opts.maintenanceRequestId,
call:   + maintenanceRequestId: part.maintenanceRequestId,
```

## 3. Rejected alternatives, and why

| Rejected approach | Reason |
| --- | --- |
| Accept a client-supplied `maintenanceRequestId` | A client could attribute cost to any request. Rejected on tenancy grounds. |
| Accept a client-supplied `maintenanceWorkOrderId` | Same, plus there is no per-issue allocation to a work order. |
| Derive the request from the route | That is the original defect: the route proves intent, the RequiredPart proves ownership. |
| Pick the first linked work order | Linked work orders carry no per-issue allocation. Choosing one is a guess. |
| Keep a work-order query and ignore the result | Dead code. The lookup was removed entirely. |
| Write to `maintenance_request_cost_entries` | Legacy table, retired in R2-H, and explicitly read-only in the UI. |
| A schema migration | Not required. The column, index and FK already exist. |
| A summary-side fallback or recomputation | Hides the missing write instead of fixing it. |

## 4. Attribution contract, enforced server-side

- `IssueStockDto` exposes no `maintenanceRequestId`, no `maintenanceWorkOrderId`,
  no `companyId`, and no `branchId`.
- The global `ValidationPipe` runs with `whitelist: true` and
  `forbidNonWhitelisted: true`, so sending any of those fields is rejected at the
  real DTO boundary, verified per field in the focused suite.
- The service re-reads the part through the request-scoped, tenant-scoped lookup
  and rejects a part whose request does not match the route.
- Company and branch on the ledger row come from the validated operational
  context, never from the client.

## 5. MaintenanceWorkOrder attribution

`maintenanceWorkOrderId` is `null` on the resulting row.

**`NOT_APPLICABLE_NO_UNAMBIGUOUS_SOURCE`**

A maintenance request may have several linked work orders, and an issue line has
no allocation of quantity or value to any one of them. The tested fixture
deliberately gives `req1` two linked work orders (`wo-first`, `wo-second`) and
proves the service neither queries nor selects one. Guessing would be worse than
declaring the attribution inapplicable.

## 6. Focused automated coverage

`maintenance-stock-issue.r1e.spec.ts`, new `R2I-BLOCKER-R1` block. Only
persistence and unrelated side effects are doubled; the real valuation engine,
the real issue path, the real canonical idempotency and reference projection, and
the real summary aggregation all run unchanged.

Twelve cases, all required behaviours covered:

1. Positive valuation-derived material persists with authoritative request,
   tenant, source, event type, cost purpose, entry role, currency and
   `clientRequestId`, and its exact subtotal reconciles in the summary.
2. Injected attribution at service level is ignored; the row still carries the
   authoritative request, `maintenanceWorkOrderId: null`, and context company and
   branch.
3. Each of `maintenanceRequestId`, `maintenanceWorkOrderId`, `companyId`,
   `branchId` is rejected by a real `ValidationPipe` over the real DTO.
4. Canonical replay of the same issue source does not create a second cost row.
5. A whole-transaction retry preserves exactly one physical issue and one
   attributed cost row.
6. An unrelated request never includes the material amount.
7. A foreign company context cannot read or attribute the issue.
8. A foreign branch context cannot read or attribute the issue.
9. A mismatched route request is rejected instead of attributing the part to it.
10. No legacy `maintenance_request_cost_entries` row is ever created.
11. The work-order query is never called.
12. The ledger row is skipped entirely for the legacy unvalued no-policy flow.

Results: **stock-issue suites 3/3, 83/83 PASS**; broader stock-issue plus
production-cost selection **10/10 suites, 310/310 PASS**.

## 7. Real SQL Server focused proof

Environment: SQL Server `DESKTOP-HJALRR4\WINCC`, Windows native, no Docker.
Certification clone `ATsoftERP_R2I_CERT_20260928`, created for this blocker
proof. `DB_NAME()` was asserted on the same connection parameters the API uses,
and the running API was confirmed to be bound to that exact database before any
write.

Fixture, all in one tenant `cmrl31uuy0000ok959hdjnca6`, branch
`cmrx06a560000ng95g7d65vzh`:

| Entity | Identifier | Value |
| --- | --- | --- |
| Company | `cmrl31uuy0000ok959hdjnca6` | Test |
| Branch | `cmrx06a560000ng95g7d65vzh` | Headquarters |
| Machine | `cmt77yjto003pc8952pkokq34` | `MCH-000011` |
| Spare part | `cmrxm2vhv00002g95v483by3p` | `SP001` |
| Product | `cmrvb4coj0001no95rd2e7kep` | linked product |
| Warehouse | `cmrthklz1000s3g952oj9owti` | `WH-MAIN` |

Executed through the real HTTP API as the authenticated user, with the real
operational context, never by writing to the database directly.

| Step | Result |
| --- | --- |
| Create request | `cmukk576t0001k095m2v01fq4`, `MR-000077`, `OPEN` then `IN_PROGRESS` |
| Start request | `IN_PROGRESS` |
| Add required part | `cmukk57md0006k095ggiw9izj`, `DRAFT` → `REQUESTED` → `APPROVED` |
| Issue 2 units | movement `cmukk57wb000ck095zjltxv4i` = `IM-000231`, type `MAINTENANCE_ISSUE` |
| Movement line | `cmukk57wo000dk095soydpixv`, quantity 2, unit cost 12.5, total 25, `USD`, `WEIGHTED_AVERAGE` |
| Canonical cost row | `cmukk57ys000ek09575ve202i`, MATERIAL, MAINTENANCE, PRIMARY_COST, POSTED, amount 25 `USD`, quantity 2, source `INVENTORY_MOVEMENT_LINE` |
| Request attribution | `maintenanceRequestId = cmukk576t0001k095m2v01fq4` |
| Work-order attribution | `maintenanceWorkOrderId = null`, per section 5 |
| Company / branch on row | tenant and branch of the validated context |
| Summary before / after | `0` → `25`, MATERIAL bucket 25, posted entries 1, reversals 0 |
| Legacy table | `maintenance_request_cost_entries` total `0` |
| Canonical rows for the request | exactly `1` |
| Duplicate retry | HTTP `400`, summary still `25`, posted still `1` |
| Foreign context summary | HTTP `404` |

## 8. Independent read-only SQL reconciliation

Read-only queries against the same clone, after the HTTP proof:

- Required part `cmukk57md0006k095ggiw9izj` points at request
  `cmukk576t0001k095m2v01fq4`, approved quantity 2, issued quantity 2.
- `InventoryMovement` `IM-000231` exists with type `MAINTENANCE_ISSUE`, the
  required part as source, and the correct tenant.
- Exactly one `OperationalCostTransaction` references the request, amount
  `25.00`, currency `USD`.
- `maintenance_request_cost_entries` contains `0` rows.

Inventory and money close exactly, with no rounding gap:

| Measure | Before | Movement | After |
| --- | --- | --- | --- |
| Spare part quantity, NEW, `WH-MAIN` | 3 | −2 | **1** |
| Average unit cost | 12.5 | — | 12.5 |
| Inventory value | 37.5 | −25 | **12.5** |

`37.5 − 25 = 12.5`, and the canonical cost row and the request summary both
report `25`. The physical movement, the valuation, the ledger and the request
summary agree on the same single amount.

## 9. Request-scoped, not company-scoped

The material amount is attributed to the issuing request only, proven against a
second request in the same tenant and the same branch:

| Request | Cost summary | Contains `25` |
| --- | --- | --- |
| `cmukk576t0001k095m2v01fq4` (`MR-000077`) | `netCost 25 USD`, MATERIAL 25, posted 1 | yes, correctly |
| `cmukj6zfm000ats95xixf6qik` (`MR-000076`) | `netCost 12.5`, posted 1 | **no** |

The unrelated request keeps its own independent pre-existing cost and does not
absorb the issued material. Attribution follows the part's owning request, not
the company or the branch.

## 10. Tenancy enforcement observed at runtime

- The backend rejects a cost-summary or issue call that omits the operational
  context, with `403 operationalContext.headersRequired`. Scope is enforced in
  the backend and is not a frontend filter.
- A foreign company context and a foreign branch context each fail to read or
  attribute the issue in the focused suite, with `0` rows written.
- A foreign-context summary read returns `404`, so record existence is not
  disclosed across tenants.
- Production `ATsoftERP_DB` was never mutated. Read-only verification shows `0`
  rows for the proof request, `0` canonical cost rows for it, `0` canonical cost
  rows in total, and `0` rows matching the synthetic proof markers.

## 11. Browser proof

Isolated stack built and started for this proof only, from this worktree: web
production build with the API base pointing at the isolated API, web standalone
on port 3100, API on port 4030 bound to the certification clone.

| Check | Result |
| --- | --- |
| Login as existing DEVELOPMENT admin | success, `201` |
| Request cost page, EN | `dir="ltr"`, renders `25 USD`, MATERIAL 25, posted 1, reversals 0 |
| Request cost page, AR | `dir="rtl"`, renders `25 USD`, MATERIAL 25, posted 1 |
| Legacy panel | correctly reports no data, both locales |
| Unposted-source warning | correctly absent, nothing unposted |
| Refresh control | real handler, re-fetches the summary |
| Required Parts on request detail | table rendered, quantity 2, approved/issued status, AR |
| Raw translation keys | none in EN, none in AR, none on the detail page |
| Page errors | 0 |
| Console errors | 0, excluding the one browser-generated line for the intentional `400` duplicate retry |
| Unsuccessful responses | only the intentional `400`; zero `5xx` |
| Real network failures | 0; `ERR_ABORTED` entries are client-side navigation cancellations, classified separately |

Rendered canonical cost block, both locales, with no raw keys:

```text
EN  Canonical Net Cost 25 USD | Posted entries 1 | Reversal entries 0
EN  Breakdown: MATERIAL 25 1
AR  صافي التكلفة المعتمدة 25 USD | الإدخالات المرحّلة 1 | إدخالات العكس 0
AR  MATERIAL 25 1
```

**Visual review disclosure.** Screenshots were captured and are retained:

```text
C:\Users\attef\AppData\Local\Temp\opencode\browser2\02-cost-en.png
C:\Users\attef\AppData\Local\Temp\opencode\browser2\03-cost-ar.png
C:\Users\attef\AppData\Local\Temp\opencode\browser2\01-detail-ar.png
C:\Users\attef\AppData\Local\Temp\opencode\browser2\cost-rendered-text.txt
C:\Users\attef\AppData\Local\Temp\opencode\browser2\report.json
```

Pixel-level inspection was performed by the repository owner against these
captures. Agent-side visual inspection was tool-blocked: the coding model in use
cannot read images. The agent-side evidence is therefore the extracted rendered
text, the `dir`/`lang` attributes, the raw-key scan, the console and network
logs, and the zero-`5xx` result, all of which are recorded above. No visual
appearance claim beyond the owner's review is made here.

## 12. Regression and static gates

| Gate | Command | Result |
| --- | --- | --- |
| Focused, stock issue | `npx jest --silent .../maintenance-stock-issue` | 3 suites, **83/83 PASS** |
| Focused, stock issue + cost | `npx jest --silent .../maintenance-stock-issue .../production-cost` | 10 suites, **310/310 PASS** |
| API unit and integration | `npm run test` in `apps/api` | 173 suites, **3449/3449 PASS**, 0 failed, no skips |
| Web logic | `npm run test:web-logic` | 44 suites, **1113/1113 PASS**, 0 failed, no skips |
| API typecheck | `npm run typecheck` in `apps/api` | PASS |
| API build | `npm run build:api` | PASS |
| Web typecheck | `npx tsc --noEmit -p apps/web/tsconfig.json` | PASS |
| Web build | `npm run build:web` | PASS |
| Prisma validate | `prisma validate` | schema valid |
| Prisma generate | `prisma generate` | client generated, v7.8.0 |
| Prisma migrate status | `prisma migrate status` on the clone | 85 migrations, schema up to date, **0 pending** |
| i18n consistency | `node scripts/check-i18n.mjs` | 6301 EN and 6301 AR keys synchronized, all namespaces registered, no empty values, 9924 literal keys resolve |
| Raw keys | `node scripts/check-raw-keys.mjs` | PASS |
| Route contract | `node scripts/check-api-route-contract.mjs` | 124 controllers, 1134 backend routes, 1015 call sites, 1120 matched, 0 malformed, 0 unresolved, 0 mismatches |
| Credentials | `node scripts/check-hardcoded-credentials.mjs` | PASS, no hardcoded credentials in tracked files |
| Permission UI | `node scripts/verify-permission-ui.mjs` | PASS |
| UI baseline integrity | `node scripts/check-ui-baseline.mjs` | PASS, 99 checks |
| Whitespace | `git diff --check` | clean |

Test counts meet or exceed the required baselines of 3436 API and 1113 web. No
test was deleted, skipped, weakened, or disabled, and no business rule under
test was mocked away. No console suppression and no silent catch was introduced;
the repair adds no error handling at all.

The web workspace defines no `typecheck` script, so web type checking was run
explicitly with `tsc --noEmit`.

## 13. Schema, API, frontend, permissions, audit

- **Prisma models / migrations changed:** none. No migration was authored or
  applied, and `prisma migrate status` reports the schema up to date.
- **API endpoints added or changed:** none. The repair changes an internal
  argument of an existing internal writer, so no route, DTO, or contract change
  and no route-contract or permission impact.
- **Frontend routes added or changed:** none. The existing request cost page
  already reads the canonical summary and already displays the value; it was
  wrong only because the server wrote nothing.
- **Permissions added or changed:** none. The existing permission keys already
  govern the affected endpoints.
- **Audit logging:** unchanged. The existing audit behaviour of the issue
  transaction is preserved; the repair adds a field to the same canonical row
  inside the same transaction.
- **i18n:** no new user-facing string was introduced, so no translation change
  was required. The i18n gate remains green.

## 14. Scope and git state

Only the two authorized files were modified, and nothing else:

```text
apps/api/src/modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.service.ts
apps/api/src/modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.r1e.spec.ts
```

Source commit, two files, 123 insertions, 1 deletion:

```text
232f70428d2269f27fb41541a011206eaba2e91e
fix(cost): preserve maintenance request attribution for material issues
```

Parent, the immutable failed checkpoint, is unchanged:

```text
3a6e16946e75eb9198bf1eaab8ceaa540ec4a0b6
docs(maintenance): record R2-I strict-stop attribution defect
```

`git status` after the source commit is clean. Branch is
`maintenance-workflow-r2`. `origin/main` remains
`f14fbe13cf76e871b03a9029933a53e9ced950aa` and was not modified. The historical
stash `stash@{0}` is retained untouched. No push, merge, tag, deploy, reset, or
rebase was performed. Files were staged selectively by path; `git add .` was
never used.

## 15. Deviations and honest limitations

1. **Clone-only development-admin password reset.** Certification access
   required an authenticated session, and the credential previously held was
   rejected with `401 invalidCredentials` by the running API while the account
   itself was `ACTIVE` with two-factor authentication disabled. With explicit
   owner authorization, the password hash of the **same existing** development
   administrator was set **inside the disposable certification clone only**,
   using the application's own bcrypt cost, immediately after asserting
   `DB_NAME()` was the clone and refusing to run against `ATsoftERP_DB`. One row
   and one column were written; `id`, `email`, `status`, `deletedAt`,
   `authVersion`, two-factor state, `companyId`, `branchId`, `departmentId` and
   role count were captured before and after and confirmed unchanged; the user
   count was confirmed not to have increased; exactly one row matches the
   account. No new administrator was created, no username, role, permission,
   tenant membership or account status was changed, and no authentication
   control was disabled or weakened. The password is not recorded here and
   appears in no repository file, proof document, log or report. This was QA
   infrastructure setup for certification access only and is not business proof
   data; the proved amounts in sections 7 to 9 are unrelated to it.
2. **Agent-side pixel inspection not performed**, for the tool reason given in
   section 11. Owner-performed visual review of the retained captures stands in
   its place and is disclosed rather than presented as agent verification.
3. **`maintenanceWorkOrderId` remains `null`** by design, per section 5. This is
   a declared `NOT_APPLICABLE` outcome, not an unfinished step.
4. The certification clone retains this proof's data. It is disposable and must
   not be reused as a fresh R2-I certification environment; section 16 requires a
   new clone.
5. The blocker scope only is closed here. R2-I end-to-end recertification,
   including the previously reported labor-entity runtime gap and the visual
   page review, remains outstanding and is not claimed.

## 16. What remains, and the honest verdict

| Item | Verdict |
| --- | --- |
| Defect repaired in source | **COMPLETE**, commit `232f7042` |
| Focused automated coverage of the 12 required behaviours | **COMPLETE** |
| Real SQL Server focused proof | **COMPLETE** |
| Request cost summary reads the ledger amount | **COMPLETE** |
| Physical inventory, valuation, ledger and summary reconcile | **COMPLETE** |
| Attribution is request-scoped, not company-scoped | **COMPLETE** |
| Tenancy and branch scope enforced in the backend | **COMPLETE** |
| Idempotent retry does not double-post | **COMPLETE** |
| No legacy cost write | **COMPLETE** |
| No schema migration | **COMPLETE** |
| No API, frontend, permission or i18n surface change | **COMPLETE** |
| Full regression and static gates | **COMPLETE** |
| Agent-side pixel-level visual review | **NOT_VERIFIED**, tool-blocked, owner review substituted and disclosed |
| R2-I end-to-end recertification on a fresh environment | **NOT_STARTED**, required next |

**Blocker verdict: COMPLETE.** The single defect that caused the R2-I strict
stop is repaired, committed, and proven end to end against a real database with
no double counting, no guesswork, no legacy write and no migration.

**R2-I verdict: NOT CERTIFIED.** This document does not certify R2-I. The
historical failed checkpoint stands, and a fresh source-frozen R2-I
certification on a new clone is the only remaining work.
