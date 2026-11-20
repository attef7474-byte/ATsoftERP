# Unified Issue Voucher — Phase 5 Discovery and Gap Analysis (2026-11-20)

## Baseline

Worktree: `C:\Users\attef\PycharmProjects\Trae\ATsofterp\.tmp\unified-issue-voucher-phase-5-release-worktree`. Branch: `feat/unified-issue-voucher-phase-5`. `HEAD == origin/main == 7e1dc6d7d150f9ae5285c2025287c81b8c50f87a`, ahead/behind `0/0`, working tree clean at entry. `git fetch origin --prune` was completed before worktree creation. The dirty shared root and branch `fix/personnel-maintenance-integrity-r1` were not touched.

The Engineering Constitution, Development Contract, UI baseline protection manifest, inspection-pitfalls register, and relevant architecture/backend/frontend/database/testing/inventory/maintenance/production rules were read before implementation.

## Classification legend

- `EXISTS — REUSE`: complete current implementation; extend only its orchestration.
- `PARTIAL — EXTEND`: exists but must be widened for the exact Phase 5 contract.
- `MISSING — ADD`: no real authority exists; additive implementation required.
- `LEGACY — PRESERVE`: distinct older path that must remain intact.
- `NOT REQUIRED`: no new artifact is justified.

## Discovery result

| # | Requested capability | Classification | Evidence / decision |
| --- | --- | --- | --- |
| 1 | Canonical route `/admin/inventory/issues`, title `إذن صرف` / `Issue Voucher`, action `إذن صرف جديد` / `New Issue Voucher` | `EXISTS — REUSE` | Route page, navigation label, panel action keys and legacy FG redirect already exist. |
| 2 | Existing unified read orchestration `/api/v1/inventory/issues` | `PARTIAL — EXTEND` | Controller is GET-only over three native families; extend to six canonical types and normalize legacy `FINISHED_GOODS` alias to `FINISHED_GOOD`. |
| 3 | Exact six issue types `SPARE_PART`, `RAW_MATERIAL`, `FINISHED_GOOD`, `PACKAGING_MATERIAL`, `CONSUMABLE`, `GENERAL` | `PARTIAL — EXTEND` | Current `IssueType` and DTO allow-lists contain only three values and use legacy plural `FINISHED_GOODS`. |
| 4 | First field `نوع الصرف`, second `مستودع الصرف`, later fields context-dependent | `EXISTS — REUSE` | Dialog already renders type then warehouse; dependency clearing exists and is strengthened for all downstream fields. |
| 5 | Strict issue-type → warehouse → candidate → stock scoping | `PARTIAL — EXTEND` | Current warehouse and product scope are incomplete for the general types. Backend will derive allowed warehouses from eligible product/definition relations and enforce item-type equality. |
| 6 | Finished-goods OUT authority with post and reversal | `EXISTS — REUSE` | `finished-goods-issues` module, canonical movement posting, lifecycle, permissions, and reverse endpoint already exist. |
| 7 | Raw-material authority with requirement snapshot and production costing | `EXISTS — REUSE` | `production-material-documents` module, `componentRole` roles, frozen requirements, valuation and cost projection already exist. |
| 8 | Spare-part request/issue authority | `EXISTS — REUSE` | Native maintenance required-part lines, standalone `SparePartIssue`, reservation scalar fields, and stock-issue desk are real and must remain authoritative. |
| 9 | Legacy maintenance stock-issue direct-POSTED path | `LEGACY — PRESERVE` | Distinct from flat authorities; do not silently merge or rewrite it. |
| 10 | `PACKAGING_MATERIAL`, `CONSUMABLE`, `GENERAL` OUT authority | `MISSING — ADD` | These values exist only as IN receipt types and as a PMD `componentRole`. No canonical generic OUT document exists. Add one minimum additive authority. |
| 11 | Warehouse approvals inbox | `PARTIAL — EXTEND` | Existing aggregation covers three types but has no warehouse filter and no general-family rows. Add warehouse filter, six labels, count cards, and native routing. |
| 12 | Approval separation and native action routing | `EXISTS — REUSE` | Native lifecycles already enforce requester/warehouse separation; approval UI routes to native endpoints and will not gain a fake generic approve. |
| 13 | Inventory movements, balances, valuation, costing | `EXISTS — REUSE` | `InventoryMovementsService` owns atomic posting, negative-stock guards, valuation, and production cost projection. No second posting engine. |
| 14 | Permission model | `PARTIAL — EXTEND` | Reuse native families; add only the new `general-inventory-issue:*` family required by the genuinely missing authority. No umbrella issue permission. |
| 15 | Auditing, numbering, idempotency | `EXISTS — REUSE` / `PARTIAL — EXTEND` | Existing patterns are reused; add numbering and audit for the new general authority only. |
| 16 | Schema for the unified UI layer itself | `NOT REQUIRED` | Orchestration remains read-only aggregation plus native write routing. Schema delta is only for the missing general OUT authority. |
| 17 | Old FG-only route compatibility | `EXISTS — REUSE` | `/admin/inventory/finished-goods-issues` already redirects to the unified route; preserve and assert. |
| 18 | EN/AR and RTL/LTR | `EXISTS — REUSE` / `PARTIAL — EXTEND` | Existing synchronized dictionaries and direction handling are reused; add labels for the three new types and canonical singular FG label. |
| 19 | Browser proof | `PARTIAL — EXTEND` | Previous proof was authenticated read-only and recorded browser proof as `NOT_VERIFIED`; Phase 5 requires real runtime proof including stock posting and reversal. |
| 20 | Phase 1–4 closure | `EXISTS — REUSE` | Phase 1 deployment proof, Phase 2/3 closeouts and Phase 4 commit evidence are present. No Phase 5 work existed at entry SHA. |

## Architecture decision

The user-facing issue voucher is unified; stock and document authority are not. Writes and transitions continue to go to:

- `SPARE_PART` → `maintenance/requests/:id/parts` when linked, otherwise `inventory/spare-part-issues`.
- `RAW_MATERIAL` → `production/material-documents`.
- `FINISHED_GOOD` → `inventory/finished-goods-issues`.
- `PACKAGING_MATERIAL`, `CONSUMABLE`, `GENERAL` → new `inventory/general-issues`.

The new authority is additive, tenant/branch scoped, status-guarded, audited, numbered, idempotent, and posts exclusively through `InventoryMovementsService.postMovementWithinTransaction`. No `UnifiedIssue` persistence table is created.

## Applied register checks

Applied from `docs/governance/inspection-pitfalls-register.md`: P01 scoped first-field selectors, P02 `act`/unmount discipline in web tests, P03 no double skip, P04 no `_sum` in `findMany select`, P05 known route-contract baseline, P06 stale `.next` cache only if encountered, P07 reviewed additive migration or sysadmin path, P08 listener check before service recycle, P09 same-origin `/api/v1`, P10 scoped selectors, P11 API restart before repeated login proof, P12 env-only secrets with `REDACTED`, P13 Swagger expected absence, P14 legacy NULL-branch behavior, P15 honest deep-link limitation, P16 pre-existing warnings classification, P17/P18 `sqlcmd` normalization and semantic checks, P19 schema/migration alignment, P20 env-derived JWT only with redaction, P21 provenance kept out of titles, P22 explicit linked-query tenant scope, P23 test-quality assertions, P24 instance-correct evidence, P25 no implicit downtime side effect. New findings will be appended during implementation if encountered.
