# R2-H — Close Policy Convergence & Legacy Cost Authority (Source + Closeout)

- **Program:** Maintenance / CMMS
- **Status:** **CLOSED** (implementation + localization + backend + UI + full regression + real-DB API proof + real-browser EN/AR proof + permission/tenant proof + reconciliation proof + production read-only verification all green)
- **Date:** 2026-09-28
- **Branch:** `maintenance-workflow-r2`
- **Baseline commit:** `09e44184` — `fix(ui): harden confirm dialog keyboard accessibility`
- **Source commit:** `22bedb60` — `R2-H close policy + cost/legacy convergence.`
- **Tenant-isolation fix commit:** `8eb8a2f6` — `fix(maintenance): close the cost-summary tenant-isolation gap`
- **Proof-driven fix commit:** `a1f19018` — `fix(maintenance): surface work-order cost authority and localize auth throttle`
- **Closeout commit:** `R2_H_CLOSEOUT_COMMIT` — `docs(maintenance): close R2-H cost and legacy convergence`
- **Schema change:** none — `R2_H_MIGRATION_REQUIRED=NO` (§7.3)
- **Permission change:** none — `R2_H_PERMISSION_CHANGES_EXPECTED=NONE` (§4.2)
- **Runtime proof:** real application, real SQL Server database, real Chromium browser automation, authenticated sessions. **No mocks, no fake data, no placeholders, no skipped gates.**

> Proof environment note: every runtime check below ran against the disposable clone
> `ATsoftERP_R2H_BROWSER_20260927_094012`, restored from a copy-only backup and
> identity-proven. The production database `ATsoftERP_DB` was only ever **read**
> (§7.3). No destructive database operation was executed at any point.

> **Commit-subject deviation (disclosed).** The task specified the source commit subject
> `fix(maintenance): converge close policy and legacy cost authority`. The actual subject of
> `22bedb60` is `R2-H close policy + cost/legacy convergence.` — the subject line was omitted
> from the commit invocation and the body was used as the subject. Amending is prohibited for this
> task, so the history is left intact and the deviation is recorded here. The implementation
> content of that commit is exactly the specified change.

---

## 1. Task objective

Converge the R2-H slice for **close policy and legacy cost authority**. Two defects existed:

1. **Close policy was not single-sourced.** Completion and close each evaluated blockers
   independently, so the UI could report a request as closeable while the close call rejected it,
   or completion could succeed on a record that close then refused.
2. **Cost authority was ambiguous.** Legacy `MaintenanceRequestPartUsage` and
   `MaintenanceRequestCostEntry` remained writable alongside the canonical
   `MaintenanceRequestRequiredPart` and `OperationalCostTransaction`, so the same cost could be
   recorded twice and the ledger total could disagree with the asserted cost.

## 2. Canonical authority model (unchanged by this slice)

| Concern | Canonical authority | Legacy status |
|---|---|---|
| Part demand | `MaintenanceRequestRequiredPart` | — |
| Part movement / balance | inventory movement + balance | — |
| Cost total | `OperationalCostTransaction` ledger | — |
| Request lifecycle | `MaintenanceRequest` | — |
| Work-order lifecycle | `MaintenanceWorkOrder` | — |
| Repaired-part lifecycle | `SparePartRepairOrder` (independent) | — |

**Ledger arithmetic:** only `entryRole = PRIMARY_COST` and `REVERSAL` rows are summed.
Reversals are stored already-negated, so they are summed as-is and not negated again. Money uses
`Prisma.Decimal` and is serialized as strings. Legacy and non-`MAINTENANCE`-purpose rows are
counted in the reconciliation block but never added to the total.

**Repair orders are non-blocking (policy C).** A `SparePartRepairOrder` owns an independent asset
lifecycle and can never block request completion or closure. This is proven structurally (§6.4) and
at runtime on a real database (§5.3).

## 3. What was implemented

### 3.1 Single canonical close-readiness evaluator

`maintenance-request-close-policy.ts` owns one evaluator. `complete()`, `close()` and
`getCloseReadiness()` all consume it, so the UI and the transitions can never disagree.

Blocker codes, in canonical throw order:

1. `OPEN_TASKS`
2. `UNRESOLVED_REQUIRED_PART_STATUSES` → `UNRESOLVED_REQUIRED_PARTS` (`DRAFT`, `REQUESTED`, `APPROVED`, `RESERVED`)
3. `ACTIVE_WORK_ORDERS` (`DRAFT`, `PLANNED`, `IN_PROGRESS` — planned work is outstanding execution)
4. `MANDATORY_CHECKLIST_PENDING`
5. `REQUEST_NOT_COMPLETED` (close only; source status for close is `COMPLETED`)

`close()` fails closed on the same blocker set `complete()` uses, so a record that became
inconsistent after completion can never be closed.

### 3.2 Legacy cost and part paths are read-only

`MaintenanceRequestPartUsage` and `MaintenanceRequestCostEntry` create/update/delete now fail
closed with localized deprecation keys. Historical reads stay available and tenant-scoped, and both
are excluded from every canonical total. The deprecation text names the correct destination:
required-part lifecycle and the stock-issue flow for parts, the operational cost ledger for cost.

### 3.3 Canonical cost summary and reconciliation

`MaintenanceCostSummaryService` returns net cost, posted/reversal counts, a per-event-type
breakdown, and a `sourceReconciliation` block that reports asserted-but-unposted source entries
with a next action.

### 3.4 Web

Read-only legacy part and cost pages, the canonical cost card, and a close-readiness panel on the
request detail page.

## 4. Defects found by real-browser proof and fixed in `a1f19018`

Unit tests did not reach these; only real-browser and real-database proof exposed them.

### 4.1 Work-order canonical cost had no UI callsite

`GET /maintenance-cost/work-orders/:id/cost-summary` existed and was tested, but **nothing in the
web app called it**. The request cost page rendered the card; the work-order cost tab did not. An
operator inspecting a work order could not see the canonical ledger total or the unposted-source
gap — the exact information the reconciliation exists to deliver.

Fix: the summary now renders on the work-order cost tab, reusing the request page pattern and the
same translation keys.

### 4.2 `auth.tooManyAttempts` existed in no catalog

The login rate-limit guard throws `messageKey: 'auth.tooManyAttempts'`, but the key was defined in
neither the API catalog nor the web catalog. `normalizeApiError` fell through to a
"cannot display the requested text" placeholder, so a user who tripped the login throttle saw **no
usable message in either language**. Found because the proof harness exhausted the 5-attempt
throttle and a real 429 was rendered in a real browser.

Fix: added to `api-messages.ts` and to `en/common.ts` + `ar/common.ts` with identical wording on
both layers. Verified 6/6 against a live 429 in both languages (§5.4).

### 4.3 Three message keys were defined but unreachable

`maintenance.requestClosedImmutable`, `maintenance.requestCancelledImmutable` and
`maintenance.closeRequiresCompleted` were catalogued but never thrown. `close()` and `update()` used
generic terminal-request keys, so an operator was never told which terminal state applied or what
the current status was.

Fix, giving each key its exact described behaviour:

- `close()` on a non-`COMPLETED` request → `closeRequiresCompleted` with the `{status}` param.
- `update()` on `CLOSED` → `requestClosedImmutable` (an authorized reopen is required first).
- `update()` on `CANCELLED` → `requestCancelledImmutable` (no operational or cost change).
- `update()` on `COMPLETED` → `cannotUpdateTerminalRequest` (unchanged).

### 4.4 The repair-order close test was vacuous

The test asserted that an active repair order does not block closure, but the readiness evaluator
never reads the repair-order table, so the assertion held regardless of whether any repair order
existed. It proved nothing.

Fix: the test now proves the property structurally — the repair-order model is never queried, and
an injected active order cannot change the blocker set or leak into the response. Paired with the
real-database runtime proof (§5.3), which drives a genuine `IN_REPAIR` row through
`start → complete → close`.

### 4.5 Tenant-isolation defect found earlier in this slice (`8eb8a2f6`)

A foreign-tenant request or work order id returned **HTTP 200 with a zeroed summary that echoed the
caller-supplied id**, instead of 404. That confirmed existence-by-response to an unauthorized
caller. Fixed with localized `maintenance.requestNotFound` / `maintenance.workOrderNotFound`; the
unused `notFoundSummary` helper was removed. Three regression tests added.

## 5. Runtime proof results

### 5.1 Real-browser proof — 31/31, EN/LTR and AR/RTL

Real Chromium against the real Next.js app (port 3020) and the real NestJS API (port 4020).

| Area | Result |
|---|---|
| Authenticated through the real login form (EN + AR) | PASS |
| Document direction LTR in English, RTL in Arabic | PASS |
| Legacy cost page renders, zero write forms | PASS |
| Legacy parts page renders, zero write forms | PASS |
| Canonical ledger-authoritative cost card visible | PASS |
| Legacy cost explicitly marked read-only and excluded | PASS |
| No add/edit control offered on legacy cost | PASS |
| Work-order cost tab shows canonical cost + posting gap | PASS |
| Terminal work order offers no cost-entry write action | PASS |
| Detail tabs localized in both languages, no raw keys | PASS |
| No raw translation keys shown to the user | PASS |
| No mojibake (U+FFFD) in rendered Arabic | PASS |
| No unexpected browser console errors | PASS |

Locale was applied through the app's own `localStorage.locale` key before first load, and the
operational context through the app's own storage format, so the proof drives the real code path
rather than a test-only shortcut. Screenshots: `r2h-en-workorder-cost.png`, `r2h-ar-workorder-cost.png`.

### 5.2 Real authenticated API proof — 26/26

Context headers mandatory; legacy POST/PATCH/DELETE fail closed with correct keys; historical GETs
available; close readiness; closed terminal state; work-order posting gap and next action; legacy
rows excluded from canonical totals; cross-tenant 404 with no id echo; canonical report exposes no
home-tenant totals; EN/AR deprecation localization. Re-run green against the final build.

### 5.3 Real-database runtime proof — 12/12 (policy C on a real table)

Ran against the clone with a **genuine `SparePartRepairOrder` row** (`status = IN_REPAIR`) linked
to a live request:

- A real active repair order row exists on the real table.
- Close readiness is **byte-identical before and after** the active repair order exists.
- No repair-order blocker code appears; the repair order id is never echoed into readiness.
- The request `start → complete → close` succeeds through the real API while the repair order is
  active, reaching `CLOSED`.
- Closing the request did not silently mutate the repair order — it kept its own lifecycle.

### 5.4 Auth throttle localization proof — 6/6

Drove a live 429 in both languages: no raw key leaked, `messageKey` correct, Arabic returns Arabic
(not the untranslated server English string), English returns the English translation.

## 6. Test results

| Suite | Result |
|---|---|
| Focused R2-H spec | 34/34 |
| Full API regression | 173 suites / 3436 tests, all pass |
| Full web regression | 44 suites / 1113 tests, all pass |
| API typecheck + build | pass |
| Web typecheck + build | pass |
| Prisma validate | pass |
| i18n consistency | 6301 EN / 6301 AR, fully synchronized, 9924 literal keys resolve |
| Route contract | 1120 matched / 0 malformed / 0 unresolved / 0 mismatches |
| UI baseline | pass |
| Raw-key safety | pass |
| Hardcoded credentials | pass |
| `git diff --check` | pass |

Two pre-existing assertions in `maintenance-requests.service.spec.ts` expected the old generic
terminal keys; they were updated to the new precise keys and expanded to cover all three terminal
states. No assertion was weakened or deleted.

## 7. Tenant isolation, permissions, audit

### 7.1 Tenant isolation

Every new read is scoped server-side. Cross-tenant probes confirm 404 with **no id echo** for
request cost summary, work-order cost summary and close readiness, and that the canonical report
exposes no home-tenant totals. The ledger query is scoped to company, branch and `MAINTENANCE`
purpose. Operational context headers are mandatory (`operationalContext.headersRequired`).

Request tenancy is derived through the request's machine (`machineOwns`), so a request cannot be
read or mutated by a foreign company, and a request whose company does not own the machine is
invisible. Soft-deleted requests return 404 — verified against a soft-deleted record in the clone.

### 7.2 Permissions

No new permission was added. Existing seeded keys were reused; `close-readiness` is intentionally
readable without a write permission so the UI can explain why an action is blocked.

### 7.3 Production read-only verification — 12/12, unchanged

| Table | Pre-work audit | Post-proof |
|---|---|---|
| `maintenance_request_part_usages` | 0 | 0 |
| `maintenance_request_cost_entries` | 0 | 0 |
| `maintenance_request_required_parts` | 0 | 0 |
| `maintenance_work_order_cost_entries` | 1 | 1 |
| `operational_cost_transactions` | 0 | 0 |
| `spare_part_repair_orders` | 0 | 0 |
| live `maintenance_requests` | 7 | 7 |

The known production cost entry `cmsc789hd0003dw95onnlfjiq` (`LABOR 120.50`, work order
`cmsc6rqiw0007fw955704khux`, `COMPLETED`) is still present, unmodified, and **still has no ledger
row**. Classified `POSTING_GAP_AFTER_COMPLETION`. **No ledger row was fabricated or backfilled for
it** — reconciling it is a separate, authorized decision, not a side effect of this slice. No proof
identity exists in production.

## 8. Audit and status transitions

`close()` audits with old and new status. Completion, close, cancel, assign and part/cost
transitions continue to audit. Terminal states refuse all further operational change with precise
errors, and no rejected attempt performs a write (§6 tests assert `update` is never called).

## 9. Honest limitations

1. **Production posting gap is reported, not repaired.** One work order asserts a cost that never
   reached the ledger. The system now surfaces it with a next action; resolving the data requires a
   separate authorized decision.
2. **The canonical maintenance report has no frontend page.** `GET
   /reports/maintenance/costs/canonical` is backend-only and proven by API. No operator UI was added,
   because that is a separate reporting scope.
3. **DOM-level accessibility automation is unavailable** in the existing `node` web Jest environment.
   The ConfirmDialog keyboard/focus behaviour is covered by pure focus-helper tests, not by
   end-to-end a11y assertions.
4. **Browser proof cannot assert rendered visual fidelity.** Evidence is DOM text, direction,
   control counts, absence of raw keys/mojibake, and zero console errors. Screenshots are saved
   for human review.
5. **Clone carries proof residue.** 4 `R2HPROOF` repair-order rows and one CLOSED request remain in
   the disposable clone from proof runs. They exist only in the clone and are listed in §7.3 as
   zero in production.

## 10. Conclusion

**COMPLETE.** The close policy is single-sourced and its terminal states fail closed with precise,
localized, actionable errors. Legacy cost and part records are read-only and excluded from every
canonical total. Canonical cost and reconciliation are visible to operators for both requests and
work orders. Repair orders are proven non-blocking on a real database. The work-order UI gap, the
untranslated 429, the three unreachable message keys, the vacuous repair-order test, and the
cost-summary tenant-isolation defect were all found by real proof and fixed. Production is
verified unchanged.
