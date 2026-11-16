# Maintenance Tasks execution print classification

Date: 2026-11-12
Classification: `NOT_PRINTABLE`
Status: `COMPLETE` (classification only; no print surface implemented).

## Surfaces reviewed

- `/admin/maintenance/tasks` — execution workspace (list + `?executionId=` detail modal)
- `/admin/maintenance/tasks/[id]` — legacy redirect to `/admin/maintenance/tasks?executionId=<id>`
- Execution sub-routes/actions on the same workspace (start, join, leave, handoff, parts, complete, cancel, return-to-service)

## What exists

A persisted execution record does exist, so the earlier "screen-only" wording was too weak:

- `MaintenanceTask` stores `sourceType`, `scopeType`, machine/production-line/component, cost center, title/description, status, assignee, creator, started/completed/cancelled timestamps and notes.
- Child records persist real operational facts: `MaintenanceExecutionSession` (technician, start/end, work performed, remaining work, handoff), `MaintenanceExecutionPartUsage` (part/product, quantity, usage type, inventory movement, recording user, used-at) and `DowntimeLog`.
- `GET /maintenance/tasks/:id` (permission `maintenance-task:read`) returns that record with request/work-order, people, machine/line/component, sessions, part usages and downtime logs.

## Why it is still `NOT_PRINTABLE`

1. **No business document identity.** `MaintenanceTask` has no generated task number or numbering series. Its only identifier is a CUID, which operational documents must not print.
2. **No independent identity for direct work.** For `sourceType = DIRECT`, the workspace shows `-` in the source-number position. There is nothing a printed sheet could use as a document number.
3. **Sourced executions are already covered.** For `MAINTENANCE_REQUEST` and `WORK_ORDER` executions, the canonical paper is the source document. The Maintenance Request document already prints its task rows (`tasks` section), and the Work Order document prints the work-order record. A separate task sheet would duplicate the accepted/approved documents rather than add a distinct artifact.
4. **A real task sheet needs a product decision plus a schema/numbering change.** Adding `taskNumber`, a numbering scope and a document contract is explicitly out of this batch (`PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`). The stop rules in the print justification also forbid adding numbering to make a surface printable.

The workspace remains a mutation surface (start/pause/handoff/parts/complete/downtime). Printing it as-is would expose interactive state, not a stable business artifact.

## Decision

`NOT_PRINTABLE` / `REJECT` for this batch. No print action, adapter, permission, endpoint, schema, migration or test was added for Tasks.

Revisit only when all of the following are approved and implemented as a separate, tested task:

- a generated execution/task business number with a defined numbering scope;
- a read-only canonical detail contract for the printed sheet;
- a clear product decision that a task sheet does not duplicate the request/work-order document;
- a non-duplicating layout that proves what the sheet is used for on paper.

## Source evidence

- `apps/api/prisma/schema.prisma` — `MaintenanceTask` fields (no number column), `MaintenanceExecutionSession`, `MaintenanceExecutionPartUsage`.
- `apps/api/src/modules/factory/maintenance/maintenance-tasks/maintenance-tasks.controller.ts` — `GET :id` uses `maintenance-task:read`; mutation endpoints use start/update/complete/cancel/parts permissions.
- `apps/api/src/modules/factory/maintenance/maintenance-tasks/maintenance-tasks.service.ts` — `findOne`/`owned` include request/work-order, machine/line/component, sessions, part usages and downtime; scope is company + branch (or branch-null).
- `apps/web/src/app/admin/maintenance/tasks/page.tsx` — detail modal identified by `executionId`; source line prints the request/work-order number or `-`.
- `apps/web/src/app/admin/maintenance/tasks/[id]/page.tsx` — legacy redirect.
- `apps/web/src/app/admin/maintenance/requests/[id]/print/page.tsx` + `maintenanceRequestDocumentModel` — request document already includes a tasks section.

## Sentinels

`DATABASE_WRITE = 0`, `PRISMA_SCHEMA_CHANGE = NONE`, `MIGRATION = NONE`, `API_BUSINESS_MUTATION = 0`, `PERMISSION_CHANGE = 0`, `MAINTENANCE_STATUS_CHANGE = 0`, `INVENTORY_QUANTITY_DELTA = 0`, `PRODUCTION_DELTA = 0`.

## Git

No commit, push, merge, reset or branch operation was performed.
