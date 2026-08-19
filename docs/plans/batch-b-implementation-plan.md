# Batch B Implementation Plan — Maintenance Coverage + Shift Handover

**Date:** 2026-08-18
**Branch:** checkpoint/backend-lan-responsive-shell
**Starting HEAD:** 0e9c925c887777f830a5a0611660770b9a2abdd7
**Corrections Applied:** YES (24 corrections from review)

---

## Corrections Status

```
PLAN_CORRECTIONS_APPLIED = YES
SQL_SERVER_DIALECT_CORRECTED = YES
SNAPSHOT_IMMUTUTABILITY_CORRECTED = YES
NOTIFICATION_RECIPIENT_LOGIC_CORRECTED = YES
PRISMA_REVERSE_RELATIONS_ACCOUNTED_FOR = YES
TENANT_VALIDATION_CORRECTED = YES
SPARE_PART_GLOBAL_SCOPE_HANDLED = YES
F9_DEPENDENCIES_CORRECTED = YES
LIFECYCLE_CONCURRENCY_ACCOUNTED_FOR = YES
```

---

## Phase B0: Baseline Verification

- [ ] Record current branch, HEAD, modified/untracked files via `git status`
- [ ] Verify MachineResponsibilityAssignment at schema.prisma line ~2734
- [ ] Verify all 116 Batch A tests still pass
- [ ] Record baseline in proof report

---

## Phase B1: Prisma Schema Changes

### B1.1: Extend MachineResponsibilityAssignment

File: `apps/api/prisma/schema.prisma` (line ~2734)

Add fields:
```prisma
scopeType        String    @default("MACHINE")
departmentId     String?
productionLineId String?
department       Department?     @relation(fields: [departmentId], references: [id], onDelete: NoAction, onUpdate: NoAction)
productionLine   ProductionLine? @relation(fields: [productionLineId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

Change `machineId String` to `machineId String?` (nullable — SQL Server ALTER COLUMN).

Add indexes: `@@index([departmentId])`, `@@index([productionLineId])`, `@@index([scopeType])`

Add reverse relations on: Department.machineResponsibilities, ProductionLine.machineResponsibilities

### B1.2: Create ShiftHandover + ShiftHandoverItem Models

With all required reverse relations on: Company, Branch, Department, ProductionShift (outgoing/incoming), OperationalPerson (outgoing/incoming)

### B1.3: Validate

- [ ] `npx prisma validate` PASS
- [ ] `npx prisma format` PASS

---

## Phase B2: Migration (SQL Server)

### B2.1: Generate via Prisma

- [ ] `npx prisma migrate dev --name batch_b_maintenance_coverage_shift_handover`

### B2.2: Review Generated T-SQL

Do NOT hardcode ALTER syntax. Let Prisma generate SQL Server migration.

Verify:
- [ ] scopeType added with DEFAULT 'MACHINE' for existing rows
- [ ] machineId made nullable via valid SQL Server ALTER COLUMN syntax
- [ ] departmentId, productionLineId added as nullable
- [ ] shift_handovers table created with NVARCHAR(1000) for all IDs
- [ ] shift_handover_items table created with NVARCHAR(1000) for all IDs
- [ ] No data deletion, no truncation, no destructive operations
- [ ] Existing row count preserved (prove before/after)
- [ ] Existing machineId values preserved

### B2.3: Apply

- [ ] `npx prisma migrate deploy`
- [ ] `npx prisma generate`
- [ ] `npx prisma migrate status` — up to date

---

## Phase B3: Backend — MachineResponsibilityAssignment Extension

### B3.1: Update DTO

Add: scopeType (default MACHINE), departmentId?, productionLineId?, machineId optional in Create.

### B3.2: Update Service

New methods:
- `assertScopeTargetTenantOwnership(...)` — validates target entity belongs to active tenant
- `assertPersonnelHasValidAssignment(maintenancePersonnelId, ctx)` — proves MaintenancePersonnel → OperationalPerson → current OperationalPersonAssignment compatible with active company/branch
- `assertExactlyOneTarget(dto, existingRecord?)` — merges existing + incoming for PATCH, validates exactly one target
- `assertNoDuplicatePrimaryForScopeTarget(scopeType, targetId, excludeId?, ctx)` — active = status='ACTIVE' && isPrimary=true && (endDate is null or endDate > now)

Update create/update: all validations, audit, userId from @CurrentUser.

### B3.3: Update Controller

Add scopeType, departmentId, productionLineId to query params. Pass userId for audit.

### B3.4: Update Module

Import AuditModule only (NOT NotificationsModule — correction #21).

---

## Phase B4: Backend — ShiftHandover CRUD

### B4.1: DTO

CreateShiftHandoverDto: branchId?, departmentId?, handoverDate, outgoingShiftId, incomingShiftId, outgoingPersonId?, incomingPersonId?, notes?

Snapshot fields NOT in DTO — calculated server-side at creation time.

UpdateShiftHandoverDto: notes? only (snapshot fields immutable — correction #4).

### B4.2: Service

**Snapshot calculation at create time (server-side):**
- activeProductionOrders: count ProductionOrder where companyId/branchId and status not in terminal states (inspect actual statuses)
- openMaintenanceRequests: count MaintenanceRequest where machine in scope and status not COMPLETED/CANCELLED
- stoppedMachines: count Machine where companyId/branchId and status = 'DOWN' or similar (inspect actual)
- pendingMaintenance: count open maintenance items

If any count cannot be derived unambiguously, leave null and document.

**Lifecycle:** DRAFT → SUBMITTED → ACKNOWLEDGED only. Invalid transitions rejected.

**Concurrency:** Use Prisma interactive transaction for submit/acknowledge — read status + update atomically within $transaction. If status changed between read and update, reject.

**Tenant validation:**
- companyId from active context ONLY (correction #6)
- branchId: validate against active context if provided
- Shifts validated against company/branch
- Persons validated through OperationalPersonAssignment

**Same-shift rejection:** Reject if outgoingShiftId === incomingShiftId (correction #7).

**Notifications (correction #5):**
- SUBMIT: resolve incoming shift supervisor via SupervisorAssignment hierarchy, or incoming shift's shiftAssignment OperationalPerson, then find their User. If no resolvable User recipient, skip notification and document.
- ACKNOWLEDGE: resolve outgoing shift supervisor similarly.
- Notification failure does NOT fail the handover transaction.

### B4.3: Controller

Endpoints: POST, GET, GET :id, PATCH :id (DRAFT only), DELETE :id (DRAFT only), POST :id/submit, POST :id/acknowledge

### B4.4: Module + Register

Import AuditModule, NotificationsModule. Register in app.module.ts.

---

## Phase B5: Backend — ShiftHandoverItem

### B5.1: Entity Validation (corrections #12, #13, #14)

Per entityType, inspect actual model and use existing ownership patterns:
- MAINTENANCE_REQUEST: validate via machine scope
- MACHINE: validate via machine scope
- PRODUCTION_ORDER: validate via companyId/branchId
- PRODUCTION_NONCONFORMANCE: validate via companyId/branchId
- SPARE_PART: global catalog — prove existence + document as global-catalog validation (not tenant ownership). Validate through existing scoped intermediary if available (e.g., SparePart in a warehouse/maintenance context), otherwise document limitation.

### B5.2: Add/Remove Items

Only while status=DRAFT. After SUBMITTED: item add/remove blocked (correction #17).

### B5.3: Audit

CREATE and DELETE for items.

---

## Phase B6: Attachment Integration

Add `case 'SHIFT_HANDOVER':` to assertEntityOwned. Validate companyId + deletedAt null.

Tests: owned → PASS, cross-tenant → rejected, deleted handover → rejected.

---

## Phase B7: Permissions

4 keys only: shift-handover:read, create, submit, acknowledge.

Use `shift-handover:create` for DRAFT edit/delete/item mutation (correction #19).

---

## Phase B8: Tests

Extensive test suite per corrections #22. Key additions:
- Merged scope state validation for PATCH
- Snapshot immutability after create
- Notification recipient resolution + missing recipient handling
- Concurrent submit/acknowledge protection
- Submitted/Acknowledged handover edit immutability
- Migration row count preservation
- Prisma reverse relation validation
- All entity type validations for items
- SPARE_PART global catalog behavior documented

---

## Phase B9-B10: Frontend

### B9: Machine Responsibility Page

ScopeType selector, conditional F9 targets, clear-on-scope-change.

### B10: Shift Handover Pages

Reuse existing F9 adapters (correction #16):
- Branch: branchAdapter ✓
- Department: departmentAdapter ✓
- Outgoing/Incoming Shift: productionShiftAdapter ✓
- Outgoing/Incoming Person: operationalPersonAdapter ✓

Create shiftHandoverAdapter only if needed as FK elsewhere.

Item entity lookups: reuse existing adapters per entityType.

Navigation, i18n, RTL/LTR, permission visibility.

---

## Phase B11-B14: Verification + Proof

i18n parity, TypeScript clean, regression, proof report.

---

## Execution Order

1. B0 — Baseline
2. B1 — Schema
3. B2 — Migration
4. B3 — MachineResp backend
5. B4 — ShiftHandover backend
6. B5 — ShiftHandoverItem backend
7. B6 — Attachment integration
8. B7 — Permissions
9. B8 — Tests
10. B9 — MachineResp frontend
11. B10 — ShiftHandover frontend
12. B11-B14 — Verification + Proof
