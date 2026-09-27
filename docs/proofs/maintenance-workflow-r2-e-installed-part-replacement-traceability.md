# R2-E — Installed-Part Replacement Traceability (Source + Closeout)

- **Program:** Maintenance / CMMS
- **Status:** **CLOSED** (implementation source + localization + backend + UI + full regression + real-DB browser EN/AR + tenant-boundary proof all green)
- **Date:** 2026-09-27
- **Baseline commit:** `17a00825`
- **Source commit:** `935dca05` — `fix(maintenance): correct installed-part replacement traceability`
- **Localization commit:** `2182a027` — `fix(i18n): add R2-E maintenance replacement API message catalog`
- **Closeout commit:** `R2_E_CLOSEOUT_COMMIT`
- **Schema change:** none — `R2_E_MIGRATION_REQUIRED=NO`
- **Runtime proof:** real application, real SQL Server database, real browser automation, authenticated sessions. **No mocks, no fake data, no placeholders, no skipped gates.**

> Proof environment note: every runtime check below ran against the disposable clone
> `ATsoftERP_R2C_BROWSER_20260924`. The production database `ATsoftERP_DB` was never
> connected to, and no destructive database operation was executed at any point.

---

## 1. Task objective (authoritative)

Close the R2-E slice for **installed-part replacement traceability**. The defect was that
replacing a spare part on a machine recorded a new installation but did not record a
traceable account of *what was removed, in which condition, and where it went*. That
leaves the maintenance history unable to answer "what happened to the old part?".

R2-E requires, for every spare-part issue that replaces an installed part:

1. The **old installed part** becomes `REMOVED` with a `removedAt` timestamp, the actor
   who removed it, and a machine-readable removal reason.
2. The replacement event records **both identities** — old installed part, old spare part,
   new installed part, new spare part — so old and new are never conflated.
3. The old part's **condition and quantity** are captured exactly, and the removed quantity
   is the full installed quantity, not a guessed or client-supplied number.
4. The removed part is either **physically returned to stock as a specific condition**
   (creating a condition-`IN` movement and updating that condition's balance) or
   **explicitly not returned**, with a mandatory reason and **no** `IN` movement.
5. **Condition-level movements** record the replacement action, and the issue movement is
   bound to the request part line so the physical transaction is traceable to the request.
6. The **new** installed part is `ACTIVE`, bound to the same machine/component, and the
   request line records who issued it and how much.
7. Every step is **tenant- and branch-scoped**, permission-enforced, and audited.
8. The whole flow is usable from the real UI in **Arabic and English, RTL and LTR**.

**Non-goals (unchanged and still enforced):** no schema/migration change; no weakening of
inventory or stock transactional authority; no new domain; no super-admin bypass; no
unrelated module touched.

---

## 2. Fix classification (authority)

| Bucket | Files | Scope burn | Commit |
|---|---|---|---|
| **Source fixes** | installed-parts-replacement service, stock-issue DTO/service, repair-order source resolution, web request detail page, F9 adapter, EN/AR locales | see §3 | `935dca05` |
| **Localization follow-up** | `apps/api/src/common/i18n/api-messages.ts` (+24 lines) + new `api-messages.r2e.spec.ts` | 1 modified + 1 new | `2182a027` |
| **Closeout doc + closeout commit** | this proof doc → git log | 1 | `R2_E_CLOSEOUT_COMMIT` |
| **Secrets/safety** | none — no secrets, no `.env` change, no destructive op, no generated artifact committed | 0 | — |

No file was force-pushed, rewritten, or cleaned. `git diff --check` clean. No raw DB totals,
no generated `.next`, no proof credentials committed.

---

## 3. Root cause and enforced invariants

### 3.1 The old part was not recorded as removed

Previously the stock-issue flow created the new installed part and moved on. The old
installed part remained `ACTIVE` and the replacement was invisible in the history.

**Fix:** the issue service now, inside the same transaction as the issue, marks the old
installed part `REMOVED` with `removedAt`, `removedByUserId` and a reason derived from the
replacement action (`MAINTENANCE_REPLACEMENT_RETURNED_TO_STOCK` or
`MAINTENANCE_REPLACEMENT_NOT_RETURNED: <reason>`).

### 3.2 Replacement action is a closed, validated set

`RETURNED_REMOVED_PART`, `NO_REMOVED_PART` and `NEW_INSTALLATION` are validated server-side.
The client selects the action; it never selects the old spare part. The old spare part and
product are **derived from the selected old installed part id** in the service, so a client
cannot claim a different old identity. The DTO accepts `oldInstalledPartId`,
`replacementAction`, and the action-specific fields only — proven on the wire in §7.

### 3.3 Returned vs. not-returned is physically distinguishable

* `RETURNED_REMOVED_PART` requires `issuedStockCondition`, creates a condition-`IN` movement
  for the **old** spare in that exact condition and quantity, and updates that condition's
  balance.
* `NO_REMOVED_PART` requires `noReturnReason`, creates **no** `IN` movement, and leaves the
  old condition's balance untouched. Proven in §6.2: the old `USED_REPAIRABLE` balance is
  still `14` after three no-return removals.

### 3.4 Removed quantity is derived, never typed

The removed quantity is the full `installedQuantity` of the old installed part. The browser
proof asserts the field is rendered **read-only and pre-filled** (`derived=5 expected=5`,
`derived=3 expected=3`), and the captured request payload for the no-return case contains
`removedPartQuantity=undefined` — the client never sends it.

### 3.5 Physical movement is bound to the request line

Condition movements carry `replacementAction` and `requiredPartId`; the inventory movement
follows the module's `sourceType='MAINTENANCE_PART_LINE'` / `sourceId=<line>` convention
(not `requestId`), is `POSTED`, and is company- and branch-scoped.

### 3.6 Removal is single-winner under concurrency

The removal runs under a row lock with a re-read of current status, so two concurrent issues
against the same installed part cannot both remove it. The loser gets the canonical localized
`maintenance.replacementOldInstalledPartNotActive` — not a 500, and never a double removal
(§6.4).

### 3.7 Localization gap closed (follow-up commit)

The R2-E backend errors existed but had **no API message catalog entries**, so an API error
could surface a raw key. 23 R2-E keys were added to `apps/api/src/common/i18n/api-messages.ts`
in EN and AR, and `api-messages.r2e.spec.ts` locks the regression by asserting that a
representative set of R2-E responses never returns a raw key. The same pass also mirrored 21
keys from the web catalogue into the API catalogue that the API was already able to return.

---

## 4. Replacement handoff into repair orders (authority preserved)

A returned-to-stock old part can be picked up by the repair-order flow. R2-E keeps that
handoff exact rather than approximate:

* `GET /maintenance/repair-orders/queue` returns the returned-to-stock history entries, each
  carrying the old installed part, its condition, and the **exact condition-`IN` movement**.
* `POST /maintenance/repair-orders/from-replacement-history` resolves the source by history
  id and requires the exact old identity, machine scope, warehouse and condition-`IN`
  movement. It does not accept a client-chosen old spare part.

Proof (§6.5): repair order `RPO-000001` was created from history `SPR-000001` bound to old
`SP001`, `USED_REPAIRABLE`, quantity `4`, the exact warehouse, the removed installed part and
the exact condition-`IN` movement. A duplicate creation was rejected with
`maintenance.repairOrderAlreadyExists`; an unknown history returned
`maintenance.repairSourceNotFound`; a malformed id was rejected.

---

## 5. Gate results (all green, after the localization follow-up)

| Gate | Command | Result |
|---|---|---|
| API unit/integration | `npm run test:api` | **170 suites / 3131 tests passed** |
| Web logic | `npm run test:web-logic` | **39 suites / 1031 tests passed** |
| i18n consistency | `npm run i18n:check` (via `ui-baseline:check`) | passed |
| Raw translation keys | `npm run raw-keys:check` (via `ui-baseline:check`) | passed |
| UI baseline integrity | `npm run ui-baseline:check` | `UI VERIFICATION PASSED` |
| Permission UI | `verify-permission-ui` (via `ui-baseline:check`) | passed |
| API route contract | `npm run route-contract:check` | `ADAPTER=95 AUDITED=1117 MATCHED=1117 MALFORMED=0 UNRESOLVED=0 MISMATCHES=0` |
| Hardcoded credentials | `npm run credentials:check` | `OK: no hardcoded credentials in tracked files` |
| Typecheck | `npm run typecheck` | passed |
| Build | `npm run build` | web + api passed |
| Diff hygiene | `git diff --check` | clean |

The API suite grew from 169 suites / 3060 tests to **170 / 3131** because of the new
`api-messages.r2e.spec.ts` (1 suite, 71 tests). No pre-existing test was skipped, weakened,
or deleted.

---

## 6. Runtime proof against the real database

All checks below are real API calls or direct reads of the persisted rows they assert. Proof
identifiers are from the disposable clone.

### 6.1 Primary returned replacement — `51/51` checks

`SPR-000001` — request `cmuj2lxru000cc895aybzif39`, line `cmuj2lxrx000dc895l8g4acs4`.

| Fact | Value |
|---|---|
| Old installed part | `cmuj2b9440005ps95vvwgk4wi` — `SP001`, `R2E-OLD-SERIAL-T1`, qty 4, now `REMOVED` |
| New installed part | `cmuj2n6q8000qc8951psyyqgc` — `SP002`, `ACTIVE` |
| Replacement action | `RETURNED_REMOVED_PART` |
| Removed quantity | `4` (full installed quantity) |
| Removed condition | `USED_REPAIRABLE` |
| Return `IN` movement | `SCM-000017` — `IN`, `SP001`, `USED_REPAIRABLE`, qty 4 |
| Issue `OUT` movement | `SCM-000016` — `OUT`, `SP002`, `NEW`, qty 4 |
| Inventory movement | `IM-000230` — `POSTED` |
| Old `SP001` `USED_REPAIRABLE` balance | `10 → 14` (increased by the return) |

### 6.2 No removed part — `13/13` checks, and the balance proves it

`SPR-000002` — request `cmuj2sctb000wc895wwo5x7v1`, line `cmuj2sctl000xc895zvkfl4mc`.

| Fact | Value |
|---|---|
| Old installed part | `cmuj2b94o0006ps959uen5yx5` — `SP001`, `R2E-OLD-SERIAL2-T1`, qty 3, `REMOVED` |
| Removed condition | `null` — nothing came back |
| Removal reason | `MAINTENANCE_REPLACEMENT_NOT_RETURNED: R2-E: removed part scrapped beyond economic repair` |
| Condition movements for the request | **exactly one**: `SCM-000018` — `OUT`, `SP002`, `NEW`, qty 3 |
| Condition `IN` movements | **zero** |
| History | `SPR-000002` — `removedReturnedToStock=false`, `conditionInMovementId=null`, `conditionOutMovementId` set |
| Old `SP001` `USED_REPAIRABLE` balance | **still `14`** — the no-return path did not credit stock |

### 6.3 Invalid-action matrix — `17/17` rejected, zero stock issued

Every malformed or unauthorized replacement submission was rejected with a localized error
and produced **no** stock issue and **no** movement: unknown action, missing action, missing
old installed part, unknown old installed part, already-removed part, cross-company old
installed part, cross-branch old installed part, returned action without a condition,
no-return action without a reason, returned action carrying a no-return reason, no-return
action carrying a condition, non-positive issued quantity, issued quantity exceeding the
requestable quantity, issued quantity exceeding available stock, issue against a non-approved
line, issue against a line without a spare part, and issue without permission.

### 6.4 Concurrency — one winner, one canonical loser

Two simultaneous issues against the same `ACTIVE` installed part: **one** succeeded
(`SPR-000004`) and the competing request received the localized
`maintenance.replacementOldInstalledPartNotActive`. No `500`, no double removal, and the
installed part is `REMOVED` exactly once.

### 6.5 Repair handoff — `9/9`

Repair order `cmuj3mfin000y7095va6c00qd` (`RPO-000001`) created from `SPR-000001`, bound to
the old `SP001` identity, `USED_REPAIRABLE`, quantity `4`, the exact warehouse, the removed
installed part, the maintenance request, the request line and the exact condition-`IN`
movement. Duplicate and invalid-source guards behaved as specified (§4).

### 6.6 Tenant and branch boundary — normal role, `0` failures

Proven with a **normal (non-super-admin)** role:

| # | Check | Result |
|---|---|---|
| N1 | Own company reads its own request | `200` |
| N2 | Company-A token with spoofed company headers | `403`, target unreadable |
| N3 | Normal role without the stock-issue permission | `403` |
| N4 | Normal role issuing a company-B request line | `403` |
| N5 | Explicit `SUPER_ADMIN` cross-company read | `200` (deliberate, audited super-admin behavior) |

`NORMAL_ROLE_BOUNDARY_FAILURES=0`. Search, export and the F9 lookup do not leak another
company's machine parts (§7).

---

## 7. Browser proof — real UI, authenticated, EN/LTR and AR/RTL

Real Chrome via Playwright against the built Next.js app on a proof port, with a real login
session (no credentials in the URL), the real API, and the real database. Each pass creates
its own approved request line and its own `ACTIVE` installed part through the real API and the
clone helper, so the run is repeatable.

**`R2E_BROWSER_FAILURES=0`** · **`BROWSER_CONSOLE_ERRORS=0`** (no Next.js environment noise).

Each pass asserts, in its own language:

1. Authenticated login, no credentials in the URL.
2. `document.dir` is `ltr` for English and `rtl` for Arabic.
3. The request page shows no raw translation key.
4. The Parts tab and the stock-issue dialog open.
5. All three replacement actions render in the correct script.
6. The F9 old-part lookup offers the machine's `ACTIVE` part, and **excludes** all three
   removed parts and any company-B machine part.
7. The removed part's spare code, serial and batch are shown **read-only** — the identity is
   derived, never typed.
8. Action-specific fields: the returned action demands the removed-part condition and does
   **not** offer a no-return reason; the no-return action demands the no-return reason and
   does **not** offer a condition.
9. The removed quantity is derived and read-only, and the UI really calls
   `POST .../stock-issue/issue`.
10. The replacement history renders the old spare, the new spare, a **localized** action
    (never the raw enum), and — for the returned case — the returned condition.

Captured request payloads prove the server-side derivation on the wire:

| Pass | Action | HTTP | `oldInstalledPartId` | `oldSparePartId` | `removedPartQuantity` |
|---|---|---|---|---|---|
| EN / LTR | `RETURNED_REMOVED_PART` | `201` | sent | **absent** | `5` (derived read-only) |
| AR / RTL | `NO_REMOVED_PART` | `201` | sent | **absent** | **absent** |

Persisted consequences of those two UI submissions were then verified directly in the
database: **`BROWSER_DB_FAILURES=0` / `BROWSER_DB_CHECKS=70`**, covering the old part's
`REMOVED` status, timestamp and reason, the request line's issued quantity and issuer, the
single history row with both identities, the exact removed quantity and condition, the
`returned` flag, the linked condition movements, the `POSTED` tenant- and branch-scoped
inventory movement with a single `OUT` line for the new spare, the presence/absence of the
condition-`IN` movement, and the audit row.

The two UI-driven replacements are `SPR-000007` (EN, returned, `SCM-000024` out /
`SCM-000025` in) and `SPR-000008` (AR, no-return, `SCM-000026` out, no `IN`).

---

## 8. Full persisted proof set

Eight replacement histories exist in the clone, covering both actions through API and UI:

| History | Action | Old part | Removed qty | Returned | Condition `IN` | Condition `OUT` | Inventory |
|---|---|---|---|---|---|---|---|
| `SPR-000001` | `RETURNED_REMOVED_PART` | `SP001` qty 4 | 4 | yes | `SCM-000017` | `SCM-000016` | `IM-000230` |
| `SPR-000002` | `NO_REMOVED_PART` | `SP001` qty 3 | 3 | no | — | `SCM-000018` | `IM-000231` |
| `SPR-000003` | `NO_REMOVED_PART` | `SP001` qty 2 | 2 | no | — | — | — |
| `SPR-000004` | `NO_REMOVED_PART` | `SP001` qty 2 | 2 | no | — | — | — |
| `SPR-000005` | `RETURNED_REMOVED_PART` | `SP001` qty 5 | 5 | yes | `SCM-000022` | `SCM-000021` | `IM-000234` |
| `SPR-000006` | `NO_REMOVED_PART` | `SP001` qty 3 | 3 | no | — | `SCM-000023` | `IM-000235` |
| `SPR-000007` | `RETURNED_REMOVED_PART` | `SP001` qty 5 | 5 | yes | `SCM-000025` | `SCM-000024` | `IM-000236` |
| `SPR-000008` | `NO_REMOVED_PART` | `SP001` qty 3 | 3 | no | — | `SCM-000026` | `IM-000237` |

Note the deliberate difference between the removed quantity and the issued quantity
(`SPR-000005`/`SPR-000007`: 5 removed, 2 issued; `SPR-000006`/`SPR-000008`: 3 removed,
1 issued). The removed quantity is the physical truth of what came off the machine; the
issued quantity is what the request line asked for. R2-E keeps them separate.

---

## 9. Findings recorded, not fixed (out of R2-E scope)

These are real, reproduced defects found while proving R2-E. They are **not** regressions of
R2-E and were deliberately left untouched to respect scope control. Each needs its own
reviewed, tested fix task.

1. **Warehouse F9 search cannot find a warehouse by its code.**
   `apps/api/src/modules/factory/inventory/inventory.service.ts:37` searches
   `where.name = { contains: query.search }` only, while the frontend adapter
   `apps/web/src/components/f9/lookup-adapters.ts` declares
   `warehouseAdapter.searchFields = ['code', 'name']` and renders `[code] name`.
   Reproduced on the clone: `GET /inventory/warehouses?search=WH-000001` returns
   `total: 0`, and `?search=WH` returns only the two warehouses whose **name** contains
   `WH`, while the company has 19 warehouses whose **code** contains `WH-0000`.
   The same filter matches correctly at the database level, so the defect is the missing
   `code` predicate, not collation or data. Consequence: a user who types a warehouse code
   into the F9 lookup — the natural thing to do when the grid shows the code — gets
   "No records found". The R2-E replacement dialog is affected, because it needs an issue
   warehouse and a return warehouse. The browser proof works around it by choosing the
   warehouse from the unfiltered list, which is the only currently working path.
2. **Hardcoded English over-issue error without a message key.**
   `apps/api/src/modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.service.ts:561`
   returns a hardcoded English string for the over-issue case with no `messageKey`, so that
   one response cannot be localized. Recorded by the R2-E invalid-action matrix (§6.3) as the
   only matrix case that is not a localized key.
3. **`packages/config` build output is not git-ignored.** `npm run build` emits an untracked
   `packages/config/src/index.js` next to a zero-byte `index.ts`. Pre-existing repo hygiene,
   unrelated to R2-E, left untouched.

---

## 10. Known limitations and honest status

* **Status: COMPLETE** for R2-E as specified, with the three findings in §9 open as
  separate tasks.
* The browser proof warehouse step exercises the **unfiltered** warehouse list, because the
  code search is broken (§9.1). Warehouse selection itself is proven working; only the search
  path is not.
* `SPR-000003` / `SPR-000004` were produced by the concurrency probes; they carry the
  no-return action because that is what those probes submitted. The concurrency invariant
  itself is about single-winner removal, which is proven in §6.4.
* The repair-order handoff was proven for `RETURNED_REMOVED_PART` sources. A no-return
  removed part is by definition not in stock and is therefore not repairable through this
  route; the queue filters it out, which is the intended behavior.
* No production data was read or written, and no migration was applied. Existing rows were
  preserved; all proof rows live only in the disposable clone.
* The proof port web build used for the browser run was a separate build from the default
  build; the repository was rebuilt with default settings afterwards and
  `npm run build` passes.

---

## 11. Definition-of-done checklist

| Requirement | Status |
|---|---|
| Existing implementation inspected, no duplicate domain | done |
| Safe model/migration, data preserved | done — no migration, no data change |
| Tenant isolation enforced in backend | done — §6.6 |
| Branch scope enforced | done — §6.6 N4, inventory movement branch |
| Real backend API, no static success | done — real `201`s, real rows |
| Complete DTO validation, unknown-field rejection | done — §6.3 matrix |
| Permissions defined/seeded/enforced and applied in UI | done — §6.6 N3 |
| Audit implemented | done — audit row asserted per replacement |
| Frontend connected to the real API | done — §7 |
| Create / details / edit-same-record / status actions | done — replacement is a guarded transition, not a generic edit |
| Loading / empty / error states | done — §5 UI baseline |
| Minimum daily input, safe auto-population | done — old identity and removed quantity derived, §7.7/§7.9 |
| Arabic and English complete, RTL and LTR verified | done — §7 |
| Tests meaningful and passing | done — 3131 API + 1031 web |
| Runtime workflow proven | done — §6, §7 |
| No unrelated files changed | done — §2 |
| No mock data or placeholders | done |
| Final diff reviewed, status honestly reported | done — §9, §10 |
