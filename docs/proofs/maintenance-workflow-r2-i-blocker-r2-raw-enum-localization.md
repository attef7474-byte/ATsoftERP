# R2I-BLOCKER-R2 — raw enum leakage in EN/AR maintenance UI: REPAIRED AND PROVEN

- Date: 2026-09-28
- Branch: `maintenance-workflow-r2`
- Source fix commit: `721edb3e86b3ef782c3b31bb395af34611ccea57` (`fix(i18n): eliminate maintenance raw enum leakage in EN and AR`)
- Baseline: `origin/main=f14fbe13cf76e871b03a9029933a53e9ced950aa`
- Clone for runtime proof: `ATsoftERP_R2I_CERT_20260928` (identity record in `C:\Users\attef\AppData\Local\Temp\ATsofterp-R2I-CERT-20260928\ancestry.txt`)
- Status: `CLOSED` for the raw-enum leakage scope; pixel-level owner review still required (section 13).

---

## 1. The defect

Owner pixel-level review recorded in `R2I-BLOCKER-R1` section 17 found raw,
unlocalized enum values rendered verbatim inside the Arabic maintenance UI. The
three concrete sites observed were:

| Observed raw value | Surface | Render site |
| --- | --- | --- |
| `MATERIAL` | Request cost summary, canonical breakdown table | `apps/web/src/app/admin/maintenance/requests/[id]/cost/page.tsx:86` |
| `APPROVED` | Request detail, Required Parts status column | `apps/web/src/app/admin/maintenance/requests/[id]/page.tsx:559` |
| `ON_TRACK` | Request detail, SLA status badge | `apps/web/src/app/admin/maintenance/requests/[id]/page.tsx:491` |

The same `MATERIAL` pattern existed at
`apps/web/src/app/admin/maintenance/work-orders/[id]/page.tsx:727`.

This is a localization defect: backend enum values leaked to the UI, and the
Arabic UI additionally showed English-only SCREAMING_SNAKE tokens. The blocker
was that the fixtures (and the four SLA-status render sites) could produce these
statuses again as soon as a request carried them, with no localization safety net.

## 2. Canonical value surfaces included in this repair

Requirement: use the already-established canonical status rendering used
elsewhere on the same page (`StatusBadge` / the existing `partStatusBadge`
helper) rather than inventing a parallel status UI.

Repaired surfaces:

| Surface | Repair |
| --- | --- |
| `requests/[id]/cost/page.tsx:86` | `canonicalCostEventLabel(entry.eventType, t)` with color kept |
| `requests/[id]/cost/page.tsx:81` | Same helper for the plot/total breakdown line |
| `work-orders/[id]/page.tsx:727` | `canonicalCostEventLabel(entry.eventType, t)` |
| `requests/[id]/page.tsx:559` | Route Required Parts status through the existing `partStatusBadge` helper |
| `requests/[id]/page.tsx:491` | `maintenanceSlaStatusLabel(slaStatus, t)`; the existing green/red SLA span colors are preserved |
| `requests/[id]/page.tsx` | `maintenanceEscalationLevelLabel(escalationLevel, t)` |
| `dashboard/sla-escalated/page.tsx:38`, `dashboard/sla-overdue/page.tsx:39` | `maintenanceEscalationLevelLabel(escalationLevel, t)` on the escalation column |

## 3. Canonical value sets and the localization keys

The repair adds a shared helper module plus canonical translation keys; fallback
paths never echo a raw enum value.

`apps/web/src/lib/maintenance-labels.ts` exposes `CANONICAL_COST_EVENT_TYPES`,
`isCanonicalCostEventType`, `canonicalCostEventLabel`, `maintenanceSlaStatusLabel`,
`maintenanceEscalationLevelLabel`.

Cost event types are the six values closed by the database check constraint
`operational_cost_transactions_event_type_ck` (verified against the migration SQL
in `prisma/migrations/`; the constraint allows exactly
`MATERIAL, LABOR, EXTERNAL_SERVICE, MACHINE, OVERHEAD, DOWNTIME`):

| Canonical value | EN | AR | Key |
| --- | --- | --- | --- |
| `MATERIAL` | Material | مواد | `maintenanceWorkflow.costMaterial` (pre-existing) |
| `LABOR` | Labor | أجور | `maintenanceWorkflow.costLabor` (pre-existing) |
| `EXTERNAL_SERVICE` | External Service | خدمة خارجية | `maintenanceWorkflow.costExternalService` (new) |
| `MACHINE` | Machine | الماكينة | `maintenanceWorkflow.costMachine` (new) |
| `OVERHEAD` | Overhead | تكاليف عامة | `maintenanceWorkflow.costOverhead` (new) |
| `DOWNTIME` | Downtime | التوقف | `maintenanceWorkflow.costDowntime` (new) |
| unknown value | Other | أخرى | `maintenanceWorkflow.costOther` (pre-existing fallback) |

SLA status (`MaintenanceRequest.slaStatus`), respecting the requirement that the
SLA badge keep its existing green/red color semantics (the shared `StatusBadge`
is grey for every status and would erase that distinction):

| Canonical value | EN | AR | Key |
| --- | --- | --- | --- |
| `ON_TRACK` | On Track | ضمن الوقت | `status.onTrack` (shared, pre-existing) |
| `OVERDUE` | Overdue | متأخر | `status.overdue` (pre-existing, used here) |
| unknown value | SLA Status (fallback) | حالة مستوى الخدمة (fallback) | `maintenance.slaStatus` |

Required-part status is fully redressed through the canonical `partStatusBadge`.
The AR wording for `APPROVED` is the shared `status.APPROVED` value `موافق عليه`
(already present in the `status` namespace — not the `sparePartRequest` wording
`معتمد`, which belongs to the spare-part request flow). `REQUESTED`, `RESERVED`
and `USED` were added to the shared `status` namespace so the same helper renders
them localized everywhere:

| Canonical value | EN | AR | Key |
| --- | --- | --- | --- |
| `REQUESTED` | Requested | مطلوب | `status.requested` (new, shared) |
| `RESERVED` | Reserved | محجوز | `status.reserved` (new, shared) |
| `USED` | Used | مستخدم | `status.used` (new, shared) |

Escalation level is an open-ended value (`NONE` and `LEVEL_1..LEVEL_n` where `n`
comes from `MaintenanceSlaRule.escalationLevels`), so it deliberately does NOT
live in the shared `status` namespace. It is parametrized under the `maintenance`
namespace with a strict `/^LEVEL_(\d+)$/` matcher:

| Canonical value | EN | AR | Key |
| --- | --- | --- | --- |
| `NONE` | No escalation | بدون تصعيد | `maintenance.escalationLevelNone` (new) |
| `LEVEL_<n>` | Level `<n>` | المستوى `<n>` | `maintenance.escalationLevelNumber` (new, parametrized) |
| unknown | Escalation level | مستوى التصعيد | `maintenance.escalationLevelUnknown` (new fallback) |

## 4. Rejected alternatives

- **StatusBadge for SLA status.** Rejected: it is grey for every status and would
  erase the established green (`ON_TRACK`) / red (`OVERDUE`) fixed-color span.
- **Escalation under the shared `status` namespace.** Rejected: escalation is an
  open-ended `LEVEL_<n>` value set, not a status; placing it there would pollute
  every shared StatusBadge. It gets a parametrized key in the maintenance domain.
- **Client-side reverse mapping from raw value to the key the API derives.**
  Rejected: duplicates the server-side derivation and adds a fake coupling.
- **Hard-coded fallback strings in components.** Rejected: violates i18n rules.

## 5. Focused automated coverage

`apps/web/tests/maintenance-raw-enum-localization-r2.test.ts` (52 assertions):

- EN and AR mapping for all six canonical cost event types + unknown fallback.
- EN/AR `maintenanceSlaStatusLabel` for `ON_TRACK`, `OVERDUE` and unknown.
- `partStatusBadge` routes Required Part statuses through `StatusBadge`/shared
  `status.*` keys including the newly added `REQUESTED`, `RESERVED`, `USED`.
- `maintenanceEscalationLevelLabel` for `NONE`, `LEVEL_1` … `LEVEL_250`
  (open-ended proof), lowercase/whitespace-suffixed defense, unknown fallback.
- Arabic-range checks for every Arabic value.
- Source invariant: no render branches in the helper module return a raw enum value.
- Locale-file invariant: the new EN/AR keys exist in both files.

Results: `52 passed`.

## 6. Runtime proof on the disposable clone

Proof harness: clone DB `ATsoftERP_R2I_CERT_20260928`; API on `:4030`
(ts-node from the repo `apps/api`); web build = a disposable copy of the repaired
`apps/web` with `NEXT_PUBLIC_API_URL=http://localhost:4030/api/v1` inlined at
build time, served with `next start -p 3100`. The main-repo `apps/web/.next`
artifacts target production `:4000` and were not used for proof. Credentials were
read locally at runtime and never printed, persisted or committed.

Two Playwright runs (both fully green):

- Run A — `r2i-r2-proof.cjs`, 28/28 steps: request detail EN `ltr` and AR `rtl`
  for the R2I fixture `MR-000076` (slaStatus `ON_TRACK`, escalationLevel `NONE`,
  required part `APPROVED`, one canonical `MATERIAL` cost row amount `12.5`);
  request cost EN/AR; both SLA dashboards.
- Run B — `r2i-r2-escalation-proof.cjs`, 27/27 steps: the two remaining paths
  that have no data in the clone (`OVERDUE`, `LEVEL_2`) after select render
  staging (see section 7).

Exact rendered strings captured from `document.body.innerText`:

EN request detail (Run A): `On Track`; Required Parts row `Bearing SKF 6205  1  -  Approved  -`.
EN request cost (Run A): `12.5 USD`, row `Material  12.5  1`.
AR request detail (Run A): `ضمن الوقت`; Required Parts row `Bearing SKF 6205  1  -  موافق عليه  -`.
AR request cost (Run A): `مواد  12.5  1`.
EN detail (Run B): `Overdue`, `Level 2`.
AR detail (Run B): `متأخر`, `المستوى 2`.
Both SLA dashboards (Run B, EN and AR): list the staged request with
`Level 2` / `المستوى 2` and no raw token.

Assertions applied per step:
- documented page `dir` (`ltr` / `rtl`);
- no SCREAMING_SNAKE enum tokens in the rendered text;
- no dotted translation keys in the rendered text;
- EN/AR target tokens present and their raw equivalents absent;
- canonical amount still rendered (`12.5`);
- `count=0` for console errors, page errors, real network failures and non-2xx
  API responses (the only non-2xx in the earlier draft run, a `GET /api/v1/health`
  probe against the web origin, was removed before this run; Next.js prefetch
  aborts are recorded as expected noise, not failures).

Screenshots are retained for owner review:
`C:\Users\attef\AppData\Local\Temp\opencode\r2i-r2\` (`01-detail-*`, `02-cost-*`,
`03-sla-*-ar`, `04-escalation-detail-*`, `05-sla-*-*`, plus `report.json` and
`escalation-report.json`). Pre-fix raw-enum captures (`MATERIAL`, `APPROVED`,
`ON_TRACK`) are retained in `C:\Users\attef\AppData\Local\Temp\opencode\browser2\`.

## 7. Render staging for OVERDUE / LEVEL_2

The clone has zero `MaintenanceSlaRule` rows, so the real SLA service cannot
produce `OVERDUE` or `LEVEL_2`. To visually prove the two remaining repaired
paths (the detail escalation badge and both SLA-dashboard escalation columns),
the fixture request `MR-000076` was set directly to `OVERDUE` / `LEVEL_2` on the
**clone only**, Run B was executed, and the row was then restored to
`ON_TRACK` / `NONE`. The non-fixture SLA requests were queried for suitability
but none shares the machine scope of the fixture. This is **render evidence
only, not business-flow evidence**; the business-flow escalation behavior itself
remains covered by the existing API/notification tests. Production
`ATsoftERP_DB` was never touched (the harness refuses to connect outside the
proven clone).

## 8. Regression and static gates

| Gate | Result |
| --- | --- |
| `tsc` web typecheck | clean |
| Web test suite | 45 suites, `1165/1165` (was 1113; +52 new) |
| API test suite | 173 suites, `3449/3449` (unchanged) |
| i18n keys EN / AR | `6313` / `6313`, synchronized (+12 new shared/domain keys) |
| raw-keys scan | pass |
| ui-baseline check | pass |
| route-contract | `MATCHED=1120`, `MISMATCHES=0` |
| credentials scan | pass |
| Web production build | compiles against `:4000` (unused for proof) |
| `git diff --check` | clean |

## 9. Schema, API, permissions, audit

- No Prisma migration; no schema change.
- No API endpoint or DTO change.
- No permission or audit change.
- Tenancy/branch invariants untouched (pure frontend localization + tests).

## 10. Scope and git state

- Now on `maintenance-workflow-r2`; latest commit on branch: `721edb3e`.
- Source changes confined to: `apps/web/src/lib/maintenance-labels.ts` (new),
  the four locale files (EN/AR `common`, `maintenance`), the five repaired pages,
  and one new test file.
- The escalation keys were initially placed in the `sparePartRequest` namespace
  during drafting and deliberately relocated to the `maintenance` namespace
  before commit (pages render via `maintenance.escalated`).
- Worktree clean; only the proof document (this file) added after the source
  commit.
- No push, merge, tag, rebase, amend or force done. Production was not mutated.
  No credentials were committed or printed.

## 11. Known out-of-scope raw-render leftovers (not part of this blocker)

A full sweep of `apps/web/src/app/admin/maintenance` for raw value renders found
three additional sites outside the R2-I report surfaces. They were left untouched
in this task and are recommended for a dedicated, budgeted follow-up:

| Site | Renders |
| --- | --- |
| `requests/[id]/print/page.tsx:117` | task rows print `task.status` verbatim |
| `cost-centers/page.tsx:421` | operational-cost-center assignment `priority` verbatim |
| `spare-parts/page.tsx:149` | spare-part list `status` verbatim |

Other `status === 'X'` hits in the sweep are comparisons or action guards, not
value renders.

## 12. Deviations and honest limitations

1. **Agent pixel review was not performed.** The agent-side evidence is rendered
   text, DOM invariants and screenshots; it is not a human pixel inspection.
   All twelve screenshots are retained for owner or image-capable review. This
   document claims no visual correctness beyond the retained captures.
2. The `APPROVED` Arabic value rendered is the shared `status.APPROVED` wording
   `موافق عليه` (catalog-aligned). If the business wishes `معتمد` on this precise
   cell, that is a one-key theme decision, not a leak.
3. `ON_TRACK` renders `ضمن الوقت` (shared `status.onTrack`), aligned with the
   SLA span shown on the same page; the `sparePartRequest` wording `ضمن الخطة`
   belongs to the spare-part request flow and was not reused.
4. `OVERDUE`/`LEVEL_2` were proven by staged clone data (section 7), not by the
   business SLA service, because the clone has no SLA rules. Rate of raw leak for
   those paths is nonetheless zero because the same helper renders them.
5. The remaining out-of-scope leftovers in section 11 may still show raw values
   on those particular surfaces; none is a maintenance work-order/report surface
   covered by the R2-I blocker evidence set.

## 13. Status

`R2I-BLOCKER-R2` is `CLOSED` for the raw-enum leakage scope:

- the three observed defect surfaces render localized EN/AR values with zero raw
  tokens at runtime;
- the same protection is extended to the two further canonical cost sites, the
  SLA dashboards, and the open-ended escalation path;
- coverage was added (52 new assertions) and full web/API regression is green;
- static gates (i18n sync, raw-keys, ui-baseline, route-contract, credentials)
  pass; no migration was required.

**Mandatory before the full R2-I certification restarts:** an owner or
image-capable tool review of the retained screenshots in
`C:\Users\attef\AppData\Local\Temp\opencode\r2i-r2\`, per the correction made
after R2I-BLOCKER-R1. The R2-I certification itself remains `NOT CERTIFIED` and
is resumed on a fresh, verified disposable clone in a separate task.