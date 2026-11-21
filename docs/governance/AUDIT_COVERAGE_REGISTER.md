# AUDIT_COVERAGE_REGISTER — Phase 6

Status: `RESOLVED` — Phase 6 confirmed direct-write gaps closed and verified by focused Jest, API typecheck/build, and audit-spec sweep on 2026-11-21.
Baseline: `origin/main` `1fce7f1e2a00fe16200e27f0a1cadb1500048c2e`.
Created: 2026-11-21.
Rule: one audit unit (`audit-logs` / `AuditService`); sensitive actions record actor, employee where available, company, branch, entity, action, timestamp, previous/new values, and reason where required.

## 1. Audit authority

| Item | Evidence | Finding |
| --- | --- | --- |
| Model | `apps/api/prisma/schema.prisma:1361-1382` | `AuditLog` has `userId`, `action`, `entity`, `entityId`, `details`, `ip`, `userAgent`, `createdAt`; no direct company/branch/employee/previous/new/reason columns. |
| Metadata carrier | Existing service conventions | `details` JSON carries `companyId`, `branchId`, `from`, `to`, `previous`, `next`, `reason`. |
| Transactional writer | `audit.service.ts:9-22` | `logWithClient(client, ...)` reuses caller transaction. |
| Normal writer | `audit.service.ts:24-31` | `log(...)` uses default Prisma client; permits empty action/entity via fallback. |
| Read tenancy | `audit.service.ts:117-130` | Derives tenant from actor user company/branch; actorless rows hidden. |
| Sanitization | `audit.service.ts:103-115` | Read-time only; writer-side sanitization absent. |
| Audit export | `audit.controller.ts:40-52`, `audit.service.ts:87-101` | Tenant scoped, capped at 10,000 rows, but export itself is not audited. |
| Empty artifacts | `dto/audit-log-query.dto.ts`, `audit-monitoring.service.ts` | Empty and unreferenced; out of scope unless cleanup is approved. |

## 2. Writer inventory

| Metric | Count |
| --- | ---: |
| Non-spec writer-call lines | 436 |
| Non-spec files with writer calls | 87 |
| Action-extraction rows | 438 |
| Module service files scanned | 188 |
| Confirmed Phase-6-owned direct-write gaps | 0 (18 closed; 10 closed in this final task) |
| Parallel-owned deferrals | 5 (unchanged; ownership-proof scope) |
| Unverified delegation paths | 4 (unchanged; not confirmed direct-write gaps) |
| Dedicated audit-focused specs passing | 21 suites / 112 tests |

Literal action keys observed include `CREATE`, `UPDATE`, `DELETE`, `ACTIVATE`, `DEACTIVATE`, `POST`, `REVERSE`, `APPROVE`, `REJECT`, `CANCEL`, `STATUS_TRANSITION`, `EXCEL_IMPORT`, `COST_PURPOSE_OVERRIDE`, `LOGIN`, `LOGOUT`, `PASSWORD_CHANGE`, and `BRANCH_FIRST_BOOTSTRAP`. Caller-supplied/helper keys include `EXPORT`, `PRINT`, `SCAN*`, `GENERAL_INVENTORY_ISSUE*`, `PRODUCTION_FG_RECEIPT*`, `TRANSACTION_POST`, `TRANSACTION_REVERSE`, and cost/quality lifecycle families.

## 3. Critical-action status matrix

| Critical action | Status | Evidence |
| --- | --- | --- |
| Company create/update/remove | COVERED | `companies.service.ts` + `companies.service.audit.spec.ts` |
| Department create/update/remove | COVERED | `departments.service.ts` + `departments.service.audit.spec.ts` |
| Administration create/update/remove | COVERED | `administrations.service.ts` + `administrations.service.audit.spec.ts` |
| Product category/unit/factory inventory master data | COVERED | `product-categories.service.ts`, `units.service.ts`, `inventory.service.ts` + matching `*.audit.spec.ts` |
| Inventory valuation engine writes | COVERED | `inventory-valuation-engine.service.ts` + expanded `inventory-valuation-engine.service.spec.ts` (`logWithClient(tx, ...)`) |
| Notification rules | COVERED | `notification-rules.service.ts` + `notification-rules.service.audit.spec.ts` |
| Security settings | COVERED | `security.service.ts` + `security.service.audit.spec.ts` |
| System settings | COVERED | `system-settings.service.ts` + `system-settings.service.audit.spec.ts` |
| Language/appearance settings | COVERED | `language.service.ts`, `appearance.service.ts` + matching `*.audit.spec.ts` |
| Numbering sequences | COVERED | `numbering.service.ts` + `numbering.service.audit.spec.ts` |
| Attachments/documents | COVERED | `attachments.service.ts` + `attachments.service.audit.spec.ts` |
| Messaging | COVERED | `messaging.service.ts` + `messaging.service.audit.spec.ts` |
| Maintenance SLA | COVERED | `maintenance-sla.service.ts` + `maintenance-sla.service.audit.spec.ts` |
| Maintenance part accountability | COVERED | `maintenance-part-accountability.service.ts` + `maintenance-part-accountability.service.audit.spec.ts` |
| Generic report CSV/Excel export | COVERED | `report-export.service.ts` + `report-export.service.spec.ts` |
| Audit CSV export | COVERED | `audit.service.ts`, `audit.controller.ts` + `audit.service.spec.ts` |
| Master-data Excel import | COVERED | `master-data-excel.service.ts:132` |
| Role CRUD/role permission assignment | COVERED | `roles.service.ts:40,138,163,215` |
| Branch first bootstrap | COVERED | `branches.service.ts:137` |
| Login/logout/password change | COVERED | `auth.service.ts:48,269,289` |
| Work-order status transitions | COVERED | `maintenance-work-orders.service.ts:751-883` |
| Spare-part issue/stock return | COVERED | `maintenance-stock-issue.service.ts` |
| Installed-part lifecycle | COVERED | `installed-parts-replacement.service.ts:987` |
| Repair-order lifecycle | COVERED | `repair-orders.service.ts` (90 transition audit events in Phase 4 proof) |
| Inventory movement/post/reverse/approve/cancel | COVERED | `inventory-stock-adjustments.service.ts`, `inventory-movements.service.ts` |
| Barcode print/scan | COVERED | `barcode-labels.service.ts`, `barcode-scans.service.ts` |
| Production output/downtime/cost/NCR | COVERED | production services |
| Approvals/unified receipts/ledger reconciliation/production monitoring | UNVERIFIED_DELEGATION | downstream writer not conclusively proved in static pass |

## 4. Deferred to parallel personnel-maintenance agent

Classification: `DEFERRED_TO_PARALLEL_PERSONNEL_MAINTENANCE_AGENT`. Ownership proof: `fix/personnel-maintenance-integrity-r1-integrated:docs/proofs/personnel-maintenance-integrity-r1/ownership-proof.json`, baseline `1fce7f1e...`.

* `employees.service.ts` — direct writes at `116,128,173,181,189,214`; 0 audit writers.
* `maintenance-personnel.service.ts` — direct writes at `23,36,126,138,164,165,186,187`; 0 audit writers.
* `users.service.ts` — partial audit at `199,361`.
* `person-assignments.service.ts` — partial audit at `162,281,304,414,427,454,491,522`.
* `person-registrations.service.ts` — partial audit at `342,362,380,615,621,751`.

No Phase 6 edit is proposed for these files.

## 5. Phase 6-safe implementation target

1. Harden `audit.service.ts` with a normalized business-audit helper: stable non-empty action/entity, company/branch, previous/next/reason, optional employee, writer-side redaction, transactional path preserved.
2. Emit `EXPORT` audit events from generic report export, audit CSV export, production analytics export, and reliability export.
3. Inject `AuditService` into the 18 confirmed direct-write services and emit stable CRUD/status events with authoritative tenant scope.
4. Add focused specs for the helper, export audit events, and representative CRUD services; preserve transaction rollback behavior.
5. Do not change the `AuditLog` schema; use the existing `details` JSON contract.

## 6. Closeout criteria

`critical backend actions without guard = 0`, confirmed Phase-6-owned direct-write gaps = 0, audit export emits an auditable event, tenant-denial proof passes, and every new audit event includes actor/company/branch/entity/action/timestamp in tests or runtime proof.

## 7. Phase 6 closeout evidence (2026-11-21)

Final task scope — ten previously unguarded services:

| Service | Actor source | Tenant/scope source | Audit writer |
| --- | --- | --- | --- |
| `product-categories.service.ts` | `@CurrentUser('id')` in controller, optional trailing service param | `GLOBAL_PRODUCT_CATEGORY_CATALOG`, `companyId: null`, `branchId: null` | `AuditService.log` |
| `units.service.ts` | `@CurrentUser('id')` in controller, optional trailing service param | `GLOBAL_UNIT_CATALOG`, `companyId: null`, `branchId: null` | `AuditService.log` |
| `inventory.service.ts` | `@CurrentUser('id')` in controller, optional trailing service param | Authoritative `ActiveOperationalContext` (`companyId`, `branchId`), `OPERATIONAL_INVENTORY_MASTER` | `AuditService.log` |
| `inventory-valuation-engine.service.ts` | Authoritative `InventoryMovement.postedById ?? createdById ?? cancelledById` inside `tx` | Same movement row's `companyId`/`branchId`, `VALUATION_WEIGHTED_AVERAGE` | `AuditService.logWithClient(tx, ...)` |
| `maintenance-sla.service.ts` | `@CurrentUser('id')` in controller, optional trailing service param | Authoritative `ActiveOperationalContext`, `MAINTENANCE_SLA` | `AuditService.log` |
| `maintenance-part-accountability.service.ts` | `@CurrentUser('id')` in controller, optional trailing service param | Authoritative `ActiveOperationalContext`, `MAINTENANCE_PART_ACCOUNTABILITY` | `AuditService.log` |
| `notifications.service.ts` | `@CurrentUser('id')` in controller, optional actor params on service writes | Authoritative target `User.companyId`/`User.branchId`, `USER_NOTIFICATIONS` | `AuditService.log` |
| `language.service.ts` | `@CurrentUser('id')` in controller, optional trailing service param | `GLOBAL_LANGUAGE_SETTINGS`, `companyId: null`, `branchId: null` | `AuditService.log` |
| `appearance.service.ts` | `@CurrentUser('id')` in controller, optional trailing service param | `GLOBAL_APPEARANCE_SETTINGS`, `companyId: null`, `branchId: null` | `AuditService.log` |
| `messaging.service.ts` | Authenticated controller already supplied `req.user?.id` | Authoritative actor `User.companyId`/`User.branchId`, `INTERNAL_MESSAGING` | `AuditService.log` |

Safety invariants verified in focused specs:

* No actor means no audit row (`if (!userId) return` / equivalent guard in every new path); no `userId = undefined` writes.
* Client DTO company/branch values are never used for audit scope; notification/messaging scope is read from the authoritative `User` row, valuation scope from the authoritative `InventoryMovement` row, and operational writes from validated active context.
* `previous`, `next`, stable action/reason and `schemaVersion: 1` are asserted in audit specs.
* Valuation audit writes use `logWithClient(tx, ...)`; dedicated spec asserts one row per posting side and rollback-compatible client identity.
* Existing direct-construction specs continue to work through `@Optional() AuditService` injection; no business behavior was changed.

Validation evidence:

* Focused Jest: 16 suites / 121 tests passed (ten owned services plus related tenant/legacy specs).
* Audit sweep: 21 suites / 112 tests passed.
* `npx tsc --noEmit -p apps/api/tsconfig.json`: passed.
* `npm run build --workspace apps/api`: passed.
* No migration, schema, permission, route, or i18n/baseline changes were made in this task.

Environment note: in this `.tmp` worktree path, the checked-in `apps/api/jest.config.js` `testMatch` pattern resolves with an escaped dot and discovers 0 tests under Jest 29. Focused runs used the equivalent explicit CLI override `--testMatch="**/*.spec.ts"`; this is an environment/path discovery quirk, not a test failure.
