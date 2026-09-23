# Production Orders

## Current State (Phase 1.4, closeout 2026-09-23)

Production orders are implemented end-to-end (slice 1.4) with real API, permissions, frontend pages, and i18n.

## Behavior

* Orders carry product, quantity, target rate, routing/BOM where approved, line, unit, and status.
* Selecting a production order in the UI populates product, approved routing, BOM, target quantity, target rate, line, and unit (auto-population; no duplicated manual inputs).
* Status transitions are enforced by dedicated endpoints, not generic edits; history is recorded through `production_order_transitions`.
* Runs are created against an order through `POST /production/runs` with auto-start (status RUNNING, prefix `RUN-`).
* Numbering prefix: `PO-`.

## Permissions

`production-order` permission family with create/read/update/approve/status actions, seeded and enforced on the backend and used on the frontend.

## Known Defects (from Phase 1 closeout)

* **D2a** — `PATCH /production/orders/:id` with a partial body (e.g. `{ lockVersion, notes }`) returns HTTP 500 `[DecimalError] Invalid argument: undefined`. Requires a dedicated fix task.
* **D2b** — `PATCH /production/orders/:id` with a full body returns HTTP 500 `DriverAdapterError: String or binary data would be truncated` (audit `details` column is `nvarchar(1000)` and the full snapshot exceeds it). Requires a dedicated fix task.
* **D4** — `POST /production/orders/:id/material-requirements` returns HTTP 500 `Argument `company` is missing`; the nested `lines.create` omits `companyId`/`branchId`. This blocks material-requirement freezing, material-document posting, and run close-for-valuation. Requires a dedicated fix task.

Do not weaken the transition flow to work around D2/D4. Do not hide these failures with silent fallbacks. See `docs/agent-rules/domain-rules/production.md` and `docs/proofs/production-phase-1-final-closeout-2026-09-23/` for full defect reports.