# Production Domain Rules

## 1. Current State

The production module does not currently exist as a complete operational domain.

Build it incrementally as tested vertical slices. Do not create the entire production domain in one uncontrolled batch.

Do not duplicate existing entities to make production development easier.

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

Complete and prove each slice before starting the next.

## 4. Shifts

* Shifts are configurable reference data, tenant-scoped.
* Do not hard-code a fixed number of shifts or fixed shift times.
* Operational assignments link employees/technicians to shifts, lines, and machines with effective dates.

## 5. Production Orders

* Production orders carry product, quantity, target rate, routing/BOM where approved, line, unit, and status.
* Selecting a production order in the UI populates product, approved routing, BOM, target quantity, target rate, line, and unit.
* Status transitions are enforced by dedicated endpoints, not generic edits.

## 6. Runs and Output Recording

* Production execution happens in sessions/runs tied to a production order, line, and shift.
* Machine and line output is recorded at approved measurement points with timestamps.
* Final line output must come from an approved measurement point or defined aggregation rule.

## 7. No Double-Counting

* Production output from sequential machines must not be summed as if each machine produced separate final goods.
* Manufacturing output and packaging output must not be double-counted as the same finished product.
* Every quantity must have a clear source of truth.

## 8. Waste and Rework

* Waste and rework are recorded as distinct, categorized transactions with reasons.
* They must not inflate or duplicate output totals.

## 9. Downtime and Loss Ownership

* Downtime records carry machine, line, shift, start/end, cause/ownership, and link to maintenance when relevant.
* Downtime duration derives from authoritative records.
* Loss reasons are configurable reference data.

## 10. Material Consumption

* Material issue and consumption flows through authorized inventory source transactions.
* Validate available quantity; prevent negative inventory.
* Consumption is atomic with production posting where required.

## 11. Finished-Goods Receipt

* Finished-goods receipt is an authorized inventory movement tied to the production document.
* No receipt without a valid production source document.

## 12. Quality Integration

* Quality checks attach to production runs/output as approved; quality results may block or release output only through an approved workflow.

## 13. Maintenance Integration

* Production interruptions create maintenance requests with prefilled context (run, product, shift, line, machine, interruption start).
* Return-to-production verification is recorded when required.

## 14. Cost Integration

* Production costs aggregate from atomic source transactions with tenant scope.
* Do not create six separate cost transactions for the same physical issue.

## 15. OEE

* OEE and performance reporting only after availability, performance, and quality measurement rules are defined, approved, and based on authoritative records.
