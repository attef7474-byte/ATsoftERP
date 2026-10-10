# COMPLETE MAINTENANCE WORKFLOW REDESIGN REPORT

## 1. Final Decision

READY_FOR_PRODUCTION_DEPLOYMENT — implementation and isolated validation complete. Production deployment is a separate, unexecuted task.

Evidence: [validation summary](validation-summary.json), [migration proof](migration-proof.json), [real HTTP/SQL proof](runtime-proof.json), [browser proof](browser-proof.json), [production SELECT-only observations](production-readonly.json).

## 2. Git Baseline

- Branch: main.
- Starting HEAD and origin/main: 5d150fd9f5fa4967f455cd21e9f238685f61a10f.
- Initial working tree: clean.
- Origin refreshed before finalization: unchanged; ahead/behind 0/0 before this implementation commit.
- Existing work was preserved. No reset, clean, stash, force push, historical migration edit, or production deployment was used.

## 3. Architecture Implemented

The existing MaintenanceTask is the execution aggregate. MaintenanceRequest records a machine problem; MaintenanceWorkOrder independently plans work; execution performs work against either source or directly. Sessions record engineer participation. Actual-part usages link to canonical inventory movements. Downtime remains a separate machine fact. Source completion and dependent execution changes share one transaction.

No fourth top-level maintenance form or parallel inventory authority was introduced.

## 4. Maintenance Request Changes

The new form displays generated code and authenticated creator, selects line before machine and component, accepts requests without required parts, and defaults machine-stopped to NO. YES requires a description and creates/reuses canonical downtime. The server derives creator/title and checks machine/component/line relationships. Existing part and history APIs remain compatible.

Source-context fields become immutable once execution, stock requirements or downtime evidence exists. Update locks/rereads the owned source and audits within the same transaction. Canonical start/completion and post-commit notifications are reused.

## 5. Work Order Changes

New normal work orders are independent and support MACHINE, PRODUCTION_LINE and GENERAL. The UI contains no request source selector. Historical request links remain immutable and readable. The from-request compatibility endpoint remains explicitly deprecated and is absent from redesigned UI flows.

Planned parts and estimated prices remain planning facts. Actual material cost comes from posted, valued inventory OUT lines; completion does not require issuing every planned item. Legacy part issue now reuses the shared stock authority, validates every submitted line, rereads inside a serializable transaction and audits there.

## 6. Execute & Complete Work

The existing tasks route now supplies one execution workspace: create/start now, register historical work, list/filter, details, edit same ID, participants, sessions, handoff, actual parts, return to service, completion and cancellation. Old task detail/edit/assign/complete routes redirect to that workspace.

Creation derives tenant/creator/source context. A failed start retries the already-created pending execution. Terminal executions cannot be edited or restarted. Cancellation preserves history.

## 7. Source Contract

| Source | Request ID | Work-order ID | Operational context |
| --- | --- | --- | --- |
| MAINTENANCE_REQUEST | Required | Absent | Derived from owned request/machine |
| WORK_ORDER | Absent | Required | Derived from owned work order |
| DIRECT | Absent | Absent | Authorized selected scope |

Mixed, missing or foreign source identities are rejected. Closed/cancelled/completed sources cannot start new execution. Source identity/scope is checked again under lock before transitions.

## 8. Scope Contract

| Scope | Machine | Line | Component |
| --- | --- | --- | --- |
| MACHINE | Required | Derived/validated when selected | Optional; must belong to machine |
| PRODUCTION_LINE | Absent | Required | Absent |
| GENERAL | Absent | Absent | Absent |

GENERAL may carry an authorized cost center and readable work location. No fake machine, request or work order is created for direct work.

## 9. Multi-Engineer Execution

Real SQL/HTTP proof covers individual and simultaneous participation, late join, early leave, handoff and sequential continuation. Handoff closes only the outgoing session and does not start the successor, complete work or close downtime. Team completion requires confirmation and uses one end timestamp.

Global overlap checks run under user locks; the filtered unique active-technician index is the database barrier across executions. Historical closed intervals are checked too.

## 10. Labor / Elapsed / Downtime

- Labor: sum of all engineer session intervals, using current time for open sessions.
- Elapsed: one execution start-to-completion/current interval, independent of participant count.
- Downtime: canonical machine-stop intervals, independent of engineer sessions.
- Request downtime is merged/deduplicated for both list and detail through one batch query.
- Historical two-engineer proof: 60 elapsed minutes and 120 labor minutes.
- No labor price is invented from duration; existing explicit work-order labor cost entries remain authoritative.

## 11. Actual Part Usage

CONSUMED posts stock usage without installation. INSTALLED requires a real machine and compatible spare/product. REPLACED reuses canonical installed-part/replacement services and records the actual removed part or justified no-return disposition.

Shared team usage creates one usage/movement, not one per engineer. Optional session attribution validates execution identity and time. Unplanned usage is allowed. Retry identity plus payload fingerprint prevents duplicate stock posting and rejects changed-payload retries.

## 12. Inventory Integration

InventoryMovement/InventoryMovementLine, InventoryBalance/quantityBase, the valuation engine, condition accounting and canonical material cost ledger remain the authorities. ExecutionPartUsage provides traceability only.

One transaction validates warehouse/tenant/location/stock, posts one movement, updates physical and monetary state once, records usage/installation/replacement and audits. Both Float physical quantity and Decimal base quantity are checked. Quantities reject nonfinite values and more than four decimal places.

## 13. Direct Work Inventory

DIRECT GENERAL, LINE and MACHINE scopes issue stock through the same helper. GENERAL and LINE do not create installed parts or fake parent documents. Valued general consumption is proven by HTTP/SQL and by both-language browser completion.

## 14. Installed Part / Replacement

MachineComponent-to-Machine validation remains canonical. The old installed physical record is locked and reread, preventing duplicate replacement. Installation/replacement timestamps use the execution usage time, with chronology validation. The replacement selector now uses canonical ACTIVE status.

## 15. Downtime

Request machine-stop creation and execution stop creation reuse canonical downtime behavior under machine lock. Handoff/leave never close it. Return to service closes the correct stop with end/duration/repair facts while execution may remain active. Completion may include authorized return to service atomically. Machine readiness is retained until canonical completion rules permit activation.

## 16. Database Changes

- Extended existing MaintenanceTask: source/scope, optional source IDs, direct tenant ownership, authenticated creator, machine/line/component/cost-center/location context.
- Added supporting MaintenanceExecutionSession and MaintenanceExecutionPartUsage.
- Extended MaintenanceWorkOrder with scope/line/location/cost center and execution relations.
- Extended DowntimeLog with execution relation.
- Added reverse relations and targeted source/tenant/session/usage indexes.
- SparePart remains global; no applicability catalog or ownership redesign.

## 17. Migration

- Name: 20261008020000_maintenance_execution_workflow_redesign.
- Path: apps/api/prisma/migrations/20261008020000_maintenance_execution_workflow_redesign/migration.sql.
- Final bytes: 18267.
- SHA256: d95967a51d976a4645244705c4c6196049981132fe30b73d134814a02be0bb06.
- Line endings: LF. The exact final bytes were re-proven on fresh disposable databases.
- Additive SQL Server 2016-compatible DDL; nullable historical ownership; source/machine-based backfill; source/scope/chronology/quantity checks; NoAction FKs; targeted indexes; filtered global active-engineer uniqueness.
- Existing IDs, titles, timestamps and historical links are retained. No engineer sessions or creator identities are invented for historical rows.
- XACT_ABORT + TRY/TRANSACTION/CATCH rollback makes the batch atomic.
- Successful application rollback retains additive schema; destructive schema removal requires separate reviewed work.
- No applied historical migration or ledger checksum was modified.

## 18. Production Read-Only Facts

Current SELECT-only inspection: database ATsoftERP_DB, DB_ID 8, SQL Server 13.0.5108.50. Configured @@SERVERNAME is DESKTOP-HJALRR4\\WINCC; SERVERPROPERTY(ServerName) reports DELL\\WINCC. These are distinct observed fields, not assumed identical.

Tasks: 0. Requests: 13 total, 7 not deleted. Work orders: 4 not deleted. Downtime logs: 0. Candidate migration ledger rows: 0. New execution tables/sourceType column: absent. Final artifact hashes/timestamps are observations, not a claimed before/after hash comparison.

## 19. Disposable Migration Proof

17/17 PASS on:
- ATsoftERP_MWR_PROOF_20261010201256.
- ATsoftERP_MWR_ROLLBACK_20261010201256.

The structural clone includes affected/reference tables only. Actual production historical task count is zero; three explicitly synthetic historical rows were inserted only in the disposable clone to test fact-preserving backfill.

Proof covers FK enforcement, valid/invalid source/scope combinations, active-session uniqueness, chronology, session attribution, usage/movement/idempotency checks, shared completion, transaction rollback and trusted enabled constraints/indexes. A deliberately late THROW before commit restores metadata and rows exactly.

## 20. API Changes

Existing request/work-order/task controllers and services were extended. New task routes under /api/v1/maintenance/tasks:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /participants and /participants/:id | Scoped engineer lookup |
| POST | /register-historical | Validated completed historical work |
| PATCH | /:id/join | Join/add authorized engineer |
| PATCH | /:id/leave | End own participation |
| PATCH | /:id/handoff | Record performed/remaining work |
| POST | /:id/parts | Actual canonical stock usage |
| PATCH | /:id/return-to-service | Canonical downtime closure |

Existing CRUD/start/complete/cancel/assign/list routes remain. Completion DTO supports team confirmation, optional parts and return to service. Unknown identity/tenant fields are rejected. Legacy work-order from-request route is explicitly deprecated.

## 21. UI Changes

Request, independent work-order and execution workflows use the real APIs and existing shared controls. Arabic RTL and English LTR were exercised in Chromium. Forms use progressive actual-parts YES/NO disclosure, generated identity, scoped F9 lookups, permission-driven actions and busy/error feedback.

A real browser failure exposed stale F9 responses overwriting newer searches. The shared modal now stabilizes semantic filters, accepts only the latest response, invalidates closed/context-changed requests and displays a localized load error. The browser regression delays actual unfiltered server responses without mock operational data.

## 22. Permissions / Audit

Added and seeded in source:
- maintenance-task:registerHistorical.
- maintenance-task:parts.issue.
- maintenance-task:downtime.close.

Existing task/request/work-order permissions are reused. Backend also checks embedded part/downtime actions, preventing completion-based permission bypass. Scoped participants honor company/branch and explicit administration/department grants. SUPER_ADMIN self-participation is explicit.

Sensitive writes use transactional audit. Notifications/SLA refresh occur after committed request transitions; delivery failures remain observable. Production permissions were not seeded or changed.

## 23. Focused Development Checks

Focused API guard/valuation suites: 5 suites, 191 tests PASS. Canonical execution-stock/replacement helper regression batch: 3 suites, 97 tests PASS during integration. Request service guard tests: 55 PASS. New input tests cover actual storage boundaries, unknown identity rejection, finite four-decimal quantities and bilingual errors.

New Web tests resolve literal execution-screen keys and all table headings against actual EN/AR dictionaries, preventing object/missing-key fallback labels.

## 24. Final Comprehensive Tests

| Check | Result |
| --- | --- |
| API | 187 suites; 3757 tests PASS; 0 failed |
| Web | 53 suites; 1301 tests PASS; 0 failed |
| API typecheck | PASS |
| Web typecheck | PASS |
| API isolated build | PASS |
| Web isolated build | PASS; 191 pages |
| Prisma validate/generate | PASS; client 7.8.0 |
| UI baseline/i18n/raw keys/permission UI | PASS |
| Exact migration/rollback | 17 checks PASS |
| Real HTTP/SQL workflow/security/rollback | 25 checks; 84 HTTP requests PASS |
| Real bilingual browser | 8 checks PASS |

No tests were skipped, deleted or weakened to hide failures. Earlier failures during implementation were corrected and rerun. Existing build warnings: missing ESLint configuration; multiple lockfiles in the isolated copy; standalone/next-start warning for proof serving. No unresolved implementation-caused failure remains.

## 25. Browser Proof

Both languages prove:
1. Line-before-machine request creation with generated creator/title and no required parts.
2. Independent GENERAL work-order creation with no request link.
3. Simultaneous two-engineer execution and confirmed completion.
4. One actual stock issue for the team: quantity 2, valued cost 20, actual work-order cost 20; session/source/audit SQL checks.
5. F9 selection remains correct after delayed stale real-server responses.

See browser-proof.json and browser-en/ar-*.png. Visual review checks alignment, translated labels, progressive disclosure and refreshed result. Screenshots contain disposable proof users/data only.

## 26. Security / Tenant Isolation

PASS: Company B read/edit/reference/list attempts are denied; foreign participants and warehouses are rejected; unauthorized branch access fails; unauthenticated/permission denial and embedded completion permission checks are enforced. Unknown creator injection is rejected. Insufficient stock and late audit failure leave source/session/usage/physical/valuation/ledger/downtime/audit snapshots unchanged.

Proof is against disposable SQL Server and the isolated API, not against deployed production code.

## 27. M5 Regression

PASS. Canonical same-tenant wrong-machine component reference returns 400. Request, work-order, execution, installation and replacement paths retain machine/component validation. Historical M5 migrations remain untouched.

## 28. Applicability

APPLICABILITY_INVARIANTS_I_J = DEFERRED. No applicability scope was activated.

## 29. Historical Debt Unchanged

Known QA fresh-replay historical compatibility gap and 17 legacy migration checksum provenance anomalies remain unchanged. This task neither repaired nor masked them. No claim of full historical fresh replay closure is made.

## 30. Production Mutations

- BUSINESS DATA = NONE.
- NEW MIGRATION APPLIED TO PRODUCTION = NO.
- PRODUCTION SCHEMA CHANGE = NO.
- PRODUCTION DEPLOYMENT = NO.
- PRODUCTION API/WEB RESTART = NO.
- Production .env and serving API/Web bundles were not modified. Local typecheck cache files are excluded from the commit.
- Tests/builds used .tmp/mwr-validation, ports 4310/4311 and guarded disposable databases. Disposable fixtures/databases are retained for evidence, not production cleanup.

## 31. Exact Changed Files

### Prisma and migration

- CREATED: apps/api/prisma/migrations/20261008020000_maintenance_execution_workflow_redesign/migration.sql
- MODIFIED: apps/api/prisma/schema.prisma

### Permissions

- MODIFIED: apps/api/prisma/seed/seed-cmms-permission-keys.ts
- MODIFIED: apps/web/src/lib/permissions/permission-catalogue.ts

### i18n

- MODIFIED: apps/api/src/common/i18n/api-messages.ts
- MODIFIED: apps/web/src/lib/i18n/locales/ar/maintenance.ts
- MODIFIED: apps/web/src/lib/i18n/locales/ar/navigation.ts
- MODIFIED: apps/web/src/lib/i18n/locales/en/maintenance.ts
- MODIFIED: apps/web/src/lib/i18n/locales/en/navigation.ts

### API

- MODIFIED: apps/api/src/modules/factory/maintenance/downtime-logs/downtime-logs.service.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/installed-parts-replacement/installed-parts-replacement.service.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-requests/dto/create-maintenance-request.dto.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-requests/maintenance-requests.controller.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-requests/maintenance-requests.module.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-requests/maintenance-requests.service.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.service.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-tasks/dto/create-maintenance-task.dto.ts
- CREATED: apps/api/src/modules/factory/maintenance/maintenance-tasks/dto/execution-action.dto.ts
- CREATED: apps/api/src/modules/factory/maintenance/maintenance-tasks/maintenance-execution-policy.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-tasks/maintenance-tasks.controller.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-tasks/maintenance-tasks.module.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-tasks/maintenance-tasks.service.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-work-orders/dto/create-maintenance-work-order.dto.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-work-orders/maintenance-work-orders.controller.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-work-orders/maintenance-work-orders.module.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-work-orders/maintenance-work-orders.service.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance.service.ts

### Tests

- CREATED: apps/api/src/modules/factory/maintenance/downtime-logs/downtime-logs.execution.spec.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-requests/maintenance-requests.service.spec.ts
- CREATED: apps/api/src/modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.execution.spec.ts
- CREATED: apps/api/src/modules/factory/maintenance/maintenance-tasks/maintenance-execution-validation.spec.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-tasks/maintenance-tasks.service.spec.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-work-orders/maintenance-work-orders.r1e.spec.ts
- MODIFIED: apps/api/src/modules/factory/maintenance/maintenance-work-orders/maintenance-work-orders.service.spec.ts
- MODIFIED: apps/web/tests/hold-route-remediation.test.ts
- CREATED: apps/web/tests/maintenance-execution.test.ts

### Web

- MODIFIED: apps/web/src/app/admin/maintenance/requests/[id]/edit/page.tsx
- MODIFIED: apps/web/src/app/admin/maintenance/requests/[id]/page.tsx
- MODIFIED: apps/web/src/app/admin/maintenance/requests/page.tsx
- MODIFIED: apps/web/src/app/admin/maintenance/tasks/[id]/assign/page.tsx
- MODIFIED: apps/web/src/app/admin/maintenance/tasks/[id]/complete/page.tsx
- MODIFIED: apps/web/src/app/admin/maintenance/tasks/[id]/edit/page.tsx
- MODIFIED: apps/web/src/app/admin/maintenance/tasks/[id]/page.tsx
- MODIFIED: apps/web/src/app/admin/maintenance/tasks/page.tsx
- MODIFIED: apps/web/src/app/admin/maintenance/work-orders/[id]/page.tsx
- MODIFIED: apps/web/src/app/admin/maintenance/work-orders/page.tsx
- MODIFIED: apps/web/src/components/f9/F9LookupModal.tsx
- MODIFIED: apps/web/src/components/f9/types.ts
- CREATED: apps/web/src/components/maintenance/execution-form.tsx
- CREATED: apps/web/src/components/maintenance/execution-parts.tsx
- MODIFIED: apps/web/src/lib/admin-types/maintenance.ts
- CREATED: apps/web/src/lib/maintenance-execution.ts

### Proof and documentation

- CREATED: docs/proofs/maintenance-workflow-redesign/browser-ar-request-form.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-ar-team-active.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-ar-team-complete.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-ar-team-completed.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-ar-team-start.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-ar-work-order-general.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-en-request-form.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-en-team-active.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-en-team-complete.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-en-team-completed.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-en-team-start.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-en-work-order-general.png
- CREATED: docs/proofs/maintenance-workflow-redesign/browser-proof.json
- CREATED: docs/proofs/maintenance-workflow-redesign/complete-maintenance-workflow-redesign-report.md
- CREATED: docs/proofs/maintenance-workflow-redesign/migration-proof.json
- CREATED: docs/proofs/maintenance-workflow-redesign/production-readonly.json
- CREATED: docs/proofs/maintenance-workflow-redesign/runtime-proof.json
- CREATED: docs/proofs/maintenance-workflow-redesign/validation-summary.json

### Repeatable proof scripts

- CREATED: scripts/maintenance-execution-browser-proof.cjs
- CREATED: scripts/maintenance-execution-migration-proof.cjs
- CREATED: scripts/maintenance-execution-runtime-proof.cjs

## 32. Commit(s)

One logical commit requested: feat(maintenance): redesign execution workflow and work tracking. This report is included in that commit. The resulting full commit SHA is supplied with the final delivery and in the local .tmp/mwr-final-git.json evidence; a commit cannot include its own final hash.

## 33. Push

Normal push to origin/main only, after green proof and staged diff review. Final delivery records actual push result, HEAD, origin/main, ahead/behind and working-tree status. No force push or production deployment is part of this operation.

## 34. Remaining Genuine Follow-ups

- Separately authorized production release: reviewed backup/recovery, apply this migration, seed/grant the three permissions to intended roles, build/package/deploy and verify production runtime.
- Applicability I/J and historical QA/checksum debt remain separate tasks.
- Disposable proof databases/artifacts may be retained for review or removed in an explicitly scoped cleanup task.

## 35. Production Deployment Recommendation

READY_FOR_PRODUCTION_DEPLOYMENT, subject to the separately authorized production release procedure. This task stops after the normal source push. Production deployment/runtime verification has not been performed.
