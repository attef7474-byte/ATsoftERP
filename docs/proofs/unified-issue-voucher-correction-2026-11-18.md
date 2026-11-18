# Unified Issue Voucher manual-acceptance correction proof

## Baseline and authority

Task start was gated on `git fetch --prune --tags` confirming
`origin/main = HEAD = 3838c69b2945e7d9ed4faab22a73b2b13250b234`.
The working tree was clean and branch
`fix/unified-issue-voucher-manual-acceptance` was created from that exact commit.

The Engineering Constitution, Permanent Development Contract, and the relevant
architecture, tenancy, database, backend, frontend, testing, maintenance,
inventory and production rules were read before discovery.

## Discovery classification

### Standalone spare-part authority: `MISSING_ADD_MINIMAL`

No native backend authority can issue a spare part without a real
`MaintenanceRequest`/`MaintenanceRequestRequiredPart` context:

* `MaintenanceStockIssueService.issue()` requires a request id and required-part
  line id and resolves the line through the maintenance request graph.
* `MaintenanceRequestRequiredPart.maintenanceRequestId` and
  `MaintenanceRequest.machineId` are required in the Prisma schema, so using that
  model for a standalone issue would require fabricating a maintenance request
  and machine. That is explicitly forbidden.
* `ProductionMaterialDocument` requires a production order and run.
* `FinishedGoodsIssue` is product-only and requires active
  `ProductionProductDefinition` rows.
* No generic approval/issue-voucher header/line model exists.

Therefore the correction must add the minimum standalone native capability rather
than reuse an unrelated authority or fabricate maintenance data.

### Why the existing schema cannot safely represent this feature

No existing model simultaneously provides all mandatory properties:

| Required property | Existing candidate result |
| --- | --- |
| Standalone header without maintenance request/production order | Missing: all complete document authorities are domain-locked |
| Direct company and branch ownership | Missing on maintenance request and required-part rows |
| Multiple spare-part lines with stock identity and UOM snapshot | Missing on the single-line maintenance required-part path |
| Requester submission, separate warehouse decision, rejection and withdrawal lifecycle | Missing on maintenance required-part rows |
| Posting/idempotency/source-document metadata | Missing on maintenance required-part rows |
| Physical stock ledger authority | Already exists: `InventoryMovement` |

Fabricating a `MaintenanceRequest` merely to satisfy a foreign key would violate
the non-negotiable reality rule, corrupt maintenance history, and make the issue
appear to belong to a machine that was never serviced. Reusing a production
document would violate production/material requirement rules. Adding nullable
columns to an unrelated maintenance table would still leave the mandatory
`machineId` and lifecycle mismatch unresolved.

## Minimal additive schema decision

Add only:

1. `SparePartIssue` — tenant-owned header with warehouse, issue number, purpose,
   requester/submission/warehouse-decision/posting lifecycle, idempotency token,
   source type, notes, movement linkage, cancellation metadata and timestamps.
2. `SparePartIssueLine` — immutable-per-document line snapshots for canonical
   `SparePart` plus linked `Product`, quantity, unit/UOM, warehouse location and
   batch/serial/expiry identity.

The migration is additive and non-destructive: new tables, indexes and foreign
keys only. It contains no `DROP`, `TRUNCATE`, backfill of synthetic records,
destructive update, stock recalculation or edit of an applied migration.

The existing maintenance-linked spare-part workflow remains authoritative when
a real maintenance request is selected. The new authority is used only for
standalone spare-part vouchers with no maintenance request.

## Physical stock and accounting invariant

`InventoryMovement` remains the sole physical stock authority. Both linked and
standalone spare-part flows create DRAFT issue documents whose physical effect
is posted only by `InventoryMovementsService.postMovementWithinTransaction`.
No service will mutate `InventoryBalance` directly. Zero/no-balance catalog rows
may be selected into a draft, but canonical sufficiency and the atomic negative
stock guard still decide whether physical posting succeeds.

## Catalog eligibility versus stock availability

* Catalog eligibility is determined by canonical master data: active linked
  `Product` for `SparePart`; active tenant/branch
  `ProductionProductDefinition` plus active `Product` for finished goods.
* Stock availability is a display value from `InventoryBalance`. A missing
  balance row means `0`; it must not hide an eligible catalog item.
* Raw-material candidates remain constrained by the production order and
  material-requirement rules.

## Evidence baseline

The rejected behavior was verified in the current source:

* `apps/web/src/components/inventory/issue-voucher-dialog.tsx`: required
  maintenance-request F9 and save rule for `SPARE_PART`.
* `apps/web/src/components/inventory/issue-voucher-form.ts`: endpoint routed on
  `maintenanceRequestId` and `const line = form.lines[0]`.
* `apps/web/src/app/admin/inventory/finished-goods-issues/_components/lines-editor.tsx`:
  add-line hidden for `SPARE_PART`.
* `apps/api/src/modules/approvals/issue-selection.policy.ts`: catalog scope
  constrained by `balances.some`.
* `apps/api/src/modules/approvals/approvals.service.ts`: spare rows only from
  `maintenanceRequestRequiredPart` joined through a machine.

This document is a decision/proof record, not a design authority overriding the
Engineering Constitution.
