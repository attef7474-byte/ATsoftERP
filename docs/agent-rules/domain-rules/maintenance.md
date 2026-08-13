# Maintenance Domain Rules

## 1. Preserve the Existing Implementation

The maintenance module contains significant implemented work. Do not rebuild or replace it. Extend it safely, preserving:

* Request history (create, assignment, status transitions, downtime records).
* Assignments and responsibility groups.
* Downtime records and ownership.
* Parts accountability.
* Installed-part and replacement history.
* Preventive schedules and checklists.
* Numbering behavior.
* Stock issue transactions.

Trace the current frontend-to-database path, permissions, status transitions, numbering, audit, and integrations before changing anything.

## 2. Maintenance Concepts

Maintenance spans requests, tasks, schedules, checklists, downtime, SLA, responsibility, required parts, stock issues, installed parts, replacements, repair orders, BOMs, and preventive plans. These integrate as follows:

* Requests and tasks must reference the correct company, branch, machine, component, line, area, section, and responsible group.
* Preventive plans generate requests/tasks through approved workflows, not through ad-hoc duplication.
* Checklists attach to schedules and execution and must record actual completion data.

## 3. Maintenance Types and Behavior

Support and preserve the established behavior for:

* Emergency maintenance.
* Corrective maintenance.
* Preventive maintenance.
* Periodic maintenance.
* Inspection.
* Planned stops.

The type must drive the allowed workflow, required data, and status transitions. Do not weaken type-specific rules with a generic edit.

## 4. Production-Requested Maintenance

* Requests opened from production interruptions must prefill the active production run, product, shift, line, machine, and interruption start time.
* The requesting production context must be preserved in the request history.
* Return-to-production verification must be recorded when the workflow requires it.

## 5. Technician and Line Responsibility

* Preserve technician assignment and line responsibility rules.
* A technician's work must be tracked per request/task with audit metadata.
* Changing an assignment is a sensitive action: record user, previous value, new value, and reason.

## 6. Part Accountability and Installation Traceability

For every spare-part issue, installation, and replacement:

* Validate compatible tenant, warehouse, machine, component, and work order.
* Validate available quantity; prevent negative inventory.
* Create the inventory movement and update the balance in the same transaction.
* Record requester, approver, issuer, receiver, installer, machine, component, and source document as applicable.
* Record the installed part and the replaced part (removal).
* Record cost ownership.
* Never edit an inventory balance directly without an authorized source transaction.

## 7. Downtime Ownership and Return to Production

* Downtime records must have a clear owner (machine, line, shift, cause) and timestamps.
* Downtime duration derives from authoritative start/end records.
* Closing a request after repairs must verify return-to-production status before the workflow proceeds.

## 8. Expected-Life Tracking Principles

* Installed parts carry installation date and expected life/usage limits where defined.
* Replacement history preserves the removed part's actual service duration.
* Preventive planning may use expected-life data to schedule replacements — only with an approved, documented rule.

## 9. Maintenance Cost Ownership

* Spare-part cost transactions are recorded once at the atomic transaction and aggregated in reports.
* The same physical issue must not produce multiple independent cost transactions.
* Report by machine, line, section, area, branch, and maintenance administration from the single source transaction.

## 10. No Direct Balance Manipulation

Never directly edit an inventory balance from maintenance code. All quantity changes flow through authorized inventory source transactions with atomic updates.

## 11. Tenant-Write Hardening for Stock Issue and Preventive Spare Part Plans

Tenant scope is enforced in the backend on every write for `maintenance-stock-issue` and `preventive-spare-part-plan`:

* **Revalidation inside the transaction**: the same guard that validated the warehouse/machine before the write must revalidate on the transaction client (TOCTOU protection). Use `assertWarehouseInContext(tx, ...)` / `assertMachineInContext(tx, ...)` inside `$transaction`.
* **Update never trusts client tenant fields**: `update` strips `companyId`/`branchId` from the DTO; re-pointing references (warehouse, machine, schedule, source/destination warehouse, locations) is validated against the active context before the write.
* **Machine/schedule consistency**: a plan update that changes `machineId` or `scheduleId` must re-run `validateScheduleAndMachine` with the effective values; a machine-only update still validates the machine is in-context and matches the plan's schedule.
* **Location membership**: any warehouse-location supplied on create/update/line operations must belong to the effective document warehouse; otherwise reject with a localized error.
* **In-transaction numbering**: document numbers and movement numbers are generated with `generateNumberAtomicWithClient(<KEY>, tx)` inside the transaction.
* **Referenced records**: spare parts, machines, warehouses, schedules, and requests referenced by a write must belong to the active company/branch context; never fetch tenant-owned rows by `id` alone.

Cover these guarantees with mocked-Prisma unit tests asserting cross-company denial for both the direct write and the re-pointing paths.
