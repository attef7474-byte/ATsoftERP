# Production Domain Rules

## 1. Current State

Phase 1 of the production domain is implemented as incremental vertical slices with real database, backend permissions, frontend, i18n, tests, and proofs:

* 1.1 Production master data.
* 1.2 Shifts and operational assignments.
* 1.3 Product capacity standards.
* 1.4 Production orders.
* 1.5 Production execution runs and output recording.
* 1.6 Downtime and loss reasons, waste and rework.
* 1.7 Material documents, material requirements, and finished-goods receipts.
* 1.8 Quality integration.
* 1.9 OEE / performance analytics, and production cost aggregation.

Known backend defects (D1–D4) from phase 1 closeout. They must not be "fixed" inside a documentation-only change; they require a dedicated, reviewed, tested fix task:

* D1 — `PATCH production/performance-targets/:id` with a partial body returns HTTP 500 (`[DecimalError] Invalid argument: undefined`). Service reads undefined numeric fields when the update body does not contain them.
* D2a — `PATCH production/orders/:id` with a partial body returns HTTP 500 (`[DecimalError] Invalid argument: undefined`). D2 — update proxy passes undefined numeric fields to the calculation.
* D2b — `PATCH production/orders/:id` with a full body returns HTTP 500 (`DriverAdapterError: String or binary data would be truncated`) because the audit `details` column is `nvarchar(1000)` and the full-order snapshot exceeds it.
* D3 — `POST production/material-consumptions` returns HTTP 500 (`Unknown field 'recordedBy'`): the constants file lists `recordedBy` in a permitted include that does not exist on the Prisma model.
* D4 — `POST production/orders/:id/material-requirements` always returns HTTP 500 (`Argument `company` is missing`): the nested `lines.create` omits `companyId`/`branchId`. This cascades: the material-document post is blocked with `productionMaterialRequirement.missingFrozenSnapshot` (no frozen requirement can exist) and the run close-for-valuation step is blocked with `productionRunCostAggregation.pendingDocuments` while a DRAFT material document exists.

Do not retry failed backend paths from the frontend as a substitute for fixing the defect. Do not hide these defects behind silent fallbacks.

## 2. Reuse Existing Infrastructure

Production must integrate with existing, working infrastructure:

* Companies and branches (tenant isolation).
* Organizational structure.
* Production lines, machines, and machine components.
* Warehouses and inventory movements.
* Products.
* Cost centers.
* Maintenance requests and downtime records.
* Notifications.
* Audit.
* Numbering.
* Search.
* Attachments.

Reuse the existing models, services, numbering, audit, notification, and attachment behavior — never create parallel systems.

## 3. Recommended Incremental Order

1. Production master data required by execution.
2. Shifts and operational assignments.
3. Product capacity standards.
4. Production orders.
5. Production execution sessions or runs.
6. Machine and line output recording.
7. Downtime and loss reasons.
8. Waste and rework.
9. Material issue and consumption.
10. Finished-goods receipt.
11. Quality integration.
12. Cost integration.
13. OEE and performance reporting.

Complete and prove each slice before starting the next. Phase 1 slices 1.1–1.9 are implemented; any gap discovered in a slice must be closed in a dedicated task with its own proof before considering that slice final.

## 4. Shifts

* Shifts are configurable reference data, tenant-scoped.
* Do not hard-code a fixed number of shifts or fixed shift times.
* Operational assignments link employees/technicians to shifts, lines, and machines with effective dates.
* Shift numbering (`PS-`, `PST-`, `PSC-`, `PSA-`, `POA-`) is wired into the central numbering flow (numbering index 53).

## 5. Production Orders

* Production orders carry product, quantity, target rate, routing/BOM where approved, line, unit, and status.
* Selecting a production order in the UI populates product, approved routing, BOM, target quantity, target rate, line, and unit.
* Status transitions are enforced by dedicated endpoints, not generic edits.
* Order history is audited through `production_order_transitions`.
* Known defect D2 (partial update 500; full update 500 on audit truncation) must be fixed in a dedicated task.

## 6. Runs and Output Recording

* Production execution happens in sessions/runs tied to a production order, line, and shift.
* Runs are created through `POST /production/runs` which auto-starts the run (status RUNNING, prefix `RUN-`).
* Machine and line output is recorded at approved measurement points with timestamps.
* Final line output must come from an approved measurement point or defined aggregation rule.

## 7. No Double-Counting

* Production output from sequential machines must not be summed as if each machine produced separate final goods.
* Manufacturing output and packaging output must not be double-counted as the same finished product.
* Every quantity must have a clear source of truth.
* OEE analytics enforce single-source authoritative downtime, output, quality, material, and cost facts.

## 8. Waste and Rework

* Waste and rework are recorded as distinct, categorized transactions with reasons.
* They must not inflate or duplicate output totals.
* Loss quantity events support corrections (self-referencing `correctsEventId`).

## 9. Downtime and Loss Ownership

* Downtime records carry machine, line, shift, start/end, cause/ownership, and link to maintenance when relevant.
* Downtime duration derives from authoritative records.
* Loss reasons are configurable reference data (code, Arabic/English name, loss category, planned default, severity default, maintenance request policy).
* Loss-reason numbering/labels: runtime fixture codes use `P1CLOSE-`; browser-proof codes use `PLR-BR-`.

## 10. Material Consumption

* Material issue and consumption flows through authorized inventory source transactions.
* Validate available quantity; prevent negative inventory.
* Consumption is atomic with production posting where required.
* Known defect D3 blocks `POST /production/material-consumptions`; fix in a dedicated task.

## 11. Material Requirements and Finished-Goods Receipt

* Material requirements must be prepared and frozen before a material document can be posted (`productionMaterialRequirement.missingFrozenSnapshot`).
* Finished-goods receipt is an authorized inventory movement tied to the production document.
* No receipt without a valid production source document.
* Known defect D4 prevents any material requirement from being created; this cascades into material-document posting and close-for-valuation. Fix D4 before D4-dependent flows are certified.

## 12. Quality Integration

* Quality plans are scoped to production runs/output with characteristics and sampling points.
* Inspections link to production runs; results and dispositions are recorded.
* Non-conformances (NCR) carry transitions and attachments.
* Quality results may block or release output only through an approved workflow.

## 13. Maintenance Integration

* Production interruptions create maintenance requests with prefilled context (run, product, shift, line, machine, interruption start).
* Return-to-production verification is recorded when required.

## 14. Cost Integration

* Material cost is frozen at run close (frozen material cost snapshots).
* Finished goods are valued from frozen production cost (`valuedQty`/cost basis).
* Production costs aggregate from atomic source transactions with tenant scope.
* Run close/valuation requires no pending DRAFT material documents (`productionRunCostAggregation.pendingDocuments`).
* Do not create six separate cost transactions for the same physical issue.

## 15. OEE

* OEE and performance reporting is implemented after availability, performance, and quality measurement rules were defined based on authoritative records.
* Performance targets have deterministic precedence; ambiguous scope blocks with audit.
* Availability/performance/quality derivation uses production downtime, output, quality, material, and cost facts without double counting.

## 16. Phase 1 Closeout Evidence

* `docs/proofs/production-phase-1-final-closeout-2026-09-23/` contains the Phase 1 final closeout proof: runtime proof (all non-defect slices pass; D1–D4 captured as expected deterministic errors), browser proof (production pages render clean in Arabic RTL and English LTR; real UI create flows verified), balance/atomicity verification, fixture sweep, migration status, and regression gates. See the acceptance report in that folder for exact numbers and the defect reports.
* D1–D5 have dedicated, reviewed, tested fixes verified in `docs/proofs/production-phase-1-defect-repair-d1-d4-2026-09-23.md` (D1 partial performance-target PATCH, D2a/D2b partial/full production-order PATCH incl. audit `details` widening migration `20260923000000_repair_widen_audit_details`, D3 material-consumption include, D4 nested requirement-line tenancy, D5 cost ledger `refs` allowlist). All former 500s provably succeeded, all regression gates pass, and the repair left zero fixtures (`SURVIVING_REPAIR_FIXTURE_COUNT=0`). Do not regress these paths; keep their tests green.