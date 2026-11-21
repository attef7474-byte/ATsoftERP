# Personnel and maintenance correction register

Date: 2026-11-20. Starting branch main; HEAD/origin/main 7e1dc6d7d150f9ae5285c2025287c81b8c50f87a; ahead/behind 0/0; clean. Dedicated branch: fix/personnel-maintenance-integrity-r1.

Phase 1 is authorized now. Later phases remain discovery candidates and must be reverified before implementation. File prefixes: API = apps/api/src/modules; UI = apps/web/src/app/admin; DB = apps/api/prisma/schema.prisma.

| ID | Requirement | Current authority / files / DB / API / UI | Observed root cause | Target / proposed fix | Migration / preflight | Risk / focused tests / browser proof | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1-01 | Four-word full name | OperationalPerson; admin/person-registrations, admin/employees, admin/users, factory/maintenance/maintenance-personnel; User; POST/PATCH corresponding APIs; core/persons, access/users, maintenance/personnel | DTOs accept any string; services store it | Shared safe whitespace validator at DTO and service; UI validation | No DDL; legacy names counted | Existing short names retained; DTO/direct-service tests; Arabic/English form proof | VERIFIED Phase 1 |
| P1-02 | Yemen phone control and canonical storage | Same identity authorities/paths as P1-01; phone fields | Free text; no normalization | Visible fixed +967 control; nine local ASCII digits; server accepts local/+967/00967 and stores +967 | No DDL; read-only format preflight | No carrier restrictions; malformed API tests; UI prefix proof | VERIFIED Phase 1 |
| P1-03 | Duplicate person names | OperationalPerson via company assignment; User via companyId; same APIs/UI | Only code/email uniqueness | Whitespace-only name comparison per company within each separate authority; exclude edited id | No index/backfill; duplicate preflight | No cross-table uniqueness or automatic merging; same-record/collision tests | VERIFIED Phase 1 |
| P1-04 | Duplicate phones | Same as P1-03 | Equivalent encodings not compared | Canonical comparison under transaction/company lock, bounded legacy scan | No index over dirty data | Concurrent writes, legacy aliases, own edit, company isolation | VERIFIED Phase 1 |
| P1-05 | Labels | UI core/persons; locales ar/en/core.ts; core.maintenanceCapability and enableMaintenanceCapability | Capability-oriented labels | Specialty / Enable role, Arabic التخصص / تمكين الدور | None | i18n parity, browser RTL/LTR | VERIFIED Phase 1 |
| P1-06 | Current assignment table and pagination | OperationalPersonAssignment; admin/person-assignments service/controller; GET /person-assignments; core/person-assignments | findAll has no date predicate; branch override trusted | Effective current rows; main UI explicitly requests PRIMARY; F9 retains all current types; effectiveFrom <= now < effectiveTo; same query for count/data; reject branch override | No DDL; read-only assignment preflight | Boundary/search/count/tenant tests; current table proof | VERIFIED Phase 1 |
| P1-07 | Transfer action/history | Same authority; POST /person-assignments/:id/transfer[/preview]; GET /person-assignments/person/:id | Transfer closes history correctly; expired row remains in main list; inclusive end overlaps at transfer instant | Preserve transaction/history; filter main list; action only eligible current open primary | None | A-B-C-A and history/audit tests; UI action proof | VERIFIED Phase 1 |
| P2-01 | Request highlighting | MaintenanceRequest; factory/maintenance/maintenance-requests; GET /maintenance/requests; maintenance/requests; shared components/admin/datagrid | Shared BodyRow currently normal zebra/selection styling | Semantic attention/inProgress tones from workflow | None | Deferred status/selection/RTL/LTR tests | Deferred Phase 2 |
| P2-02 | Work order highlighting | MaintenanceWorkOrder; maintenance-work-orders service; maintenance/work-orders | Same shared-row limitation | Shared tone mapping | None | Deferred workflow/color browser proof | Deferred Phase 2 |
| P2-03 | Downtime highlighting | DowntimeLog, MaintenanceTask; downtime-logs / maintenance-tasks; maintenance/downtime-logs | Need linked execution evidence verified at phase entry | Shared tone from actual repair state | Reverify | No fabricated timestamps | Deferred Phase 2 |
| P3-01 | Simplify work order form | MaintenanceWorkOrder header; maintenance-work-orders DTO/service; maintenance/work-orders | Header carries costCenterId/warehouseId/assignedToId/supervisorId/estimatedCost | Derive hidden fields without changing cost/inventory authority | Reverify legacy values | Deferred DTO/UI/integration regression | Deferred Phase 3 |
| P4-01 | SparePart-only planning | MaintenanceWorkOrderPart; work-order-part.dto.ts; issueParts; maintenance/work-orders | Legacy sparePartId/productId dual input | SparePart-centric new writes; preserve legacy Product history | Additive DDL if needed; reconcile legacy | No inventory authority duplication | Deferred Phase 4 |
| P4-02 | Warehouse per part | Same authority/service; header warehouse fallback | One header warehouse for all parts | Add per-line warehouse and safe legacy fallback | Additive migration + clone proof | Atomic stock issue/tenant/rollback tests | Deferred Phase 4 |
| P5-01 | Multi-technician team | MaintenanceWorkOrder.assignedToId; MaintenancePersonnel via OperationalPerson; work-orders | Singular assignment; personnel API currently lacks active context | Scoped team assignments, preserve historical membership and F9 reuse | Additive model + preflight | Team reconciliation, RBAC, branch denial | Deferred Phase 5 |
| P6-01 | Canonical execution | MaintenanceTask + MaintenanceExecutionSession; maintenance-tasks service/controller; /maintenance/tasks/my-tasks | Singular assignedToId limits work queue | Extend existing task access/authorization to active WO team and sessions | Reverify new team schema | A/B/C visible, D denied; sessions/downtime/stock invariants | Deferred Phase 6 |
| P7-01 | Schedule/checklist unified editor | MaintenanceSchedule + MaintenanceChecklistItem; maintenance-schedules and maintenance-checklist-items; maintenance/schedules | Separate template editing surfaces | Atomic create/edit/reconcile/retire in one operator form | Additive item lifecycle if absent; clone proof | Historical snapshots unchanged | Deferred Phase 7 |
| P8-01 | Checklist starter/completer | MaintenanceChecklistExecution; maintenance-checklist-executions + maintenance-schedules execute | Starter/completer semantics require current-path verification | startedById at start, completedById only at finish | Additive starter field if absent; no invented history | Actor identity + API permission tests | Deferred Phase 8 |
| P8-02 | Checklist item executor/history | MaintenanceChecklistExecutionItem snapshots and completedById | Existing snapshot architecture must be preserved | Authenticated actors; preserve all snapshots | Reverify | Multi-actor execution and template edits | Deferred Phase 8 |
| P8-03 | Prevent duplicate active execution | Same execution authority; multiple start entry points | Guards differ by entry point, needs concurrency trace | One canonical start transaction and SQL Server lock | Reverify schema/preflight | Concurrent double start, unauthorized actor | Deferred Phase 8 |
| P9-01 | Preventive due-date authority | MaintenanceSchedule.nextDueDate/startDate; maintenance-schedules service and calendar/upcoming/overdue | Due-date uses require full phase trace | Canonical nextDueDate ?? startDate and date advancement | Reverify | Future monthly nextDueDate not overdue | Deferred Phase 9 |
| P10-01 | Preserve security, audit, inventory, costing, production | Existing authorities and Phase 10 full gates | Parallel main can advance | Reconcile latest main; full regression; clone/migrations; exact merged deployment proof | Reviewed clone/backup only | Production browser + reconciliation SQL; no history/data loss | Deferred Phase 10 |

## Read-only identity preflight

Current target database: User 25 rows, 19 names below four words, 13 phones present, 10 invalid phones, 1 canonical phone duplicate group, 2 normalized-name duplicate groups. OperationalPerson 86 rows, 72 short names, 21 phones present, 14 invalid phones, 1 canonical phone duplicate group, 9 normalized-name duplicate groups. These totals span all rows/companies and are not a claim that every group conflicts inside the proposed company scope. No raw names, numbers or secrets are included. No records modified. No unique constraint added, no automatic merge, no normalization backfill.

## Phase 1 decisions

Uniqueness is company-wide inside each authority, including nondeleted historical placements for OperationalPerson, preventing duplicate re-registration after transfer or expiry. Branch is an authorization boundary, not a second identity boundary. Legacy unanchored maintenance creation must use canonical registration with a required department. Identity changes are prospective; omitted identity fields permit unrelated edits to legacy records. Empty/null phone clears an optional phone. Nonempty malformed phone is rejected.

Transfer intervals are half-open so at the exact transfer instant the successor alone is current. Main assignment UI explicitly requests PRIMARY; the generic current-list API keeps other assignment types available to F9 and scoped consumers. Person-specific history remains available unchanged. No later-phase implementation is authorized until the continuation command.


## Reconciliation and Phase 1 handoff — 2026-11-21

The original workspace and its 47 pending files are preserved byte for byte. Work continues in the isolated fix/personnel-maintenance-integrity-r1-integrated branch based on origin/main 1fce7f1e2a00fe16200e27f0a1cadb1500048c2e. Phase 5 Unified Issue Voucher, GeneralInventoryIssue/Line, migration 20261120160000_add_general_inventory_issue, native posting/reversal/approval behavior, permissions and P01-P41 are preserved. Only additive shared translation and governance changes overlap upstream files. See ownership-proof.json.

Phase 1 implementation and all runtime checks are verified; Git closeout is recorded in phase-1-closeout.md. Phase 2 is NOT STARTED. The original program specification remains available at C:/Users/attef/.codex/attachments/b76ddec1-6d29-4d89-ba6e-69aae972e835/Pasted text.txt. Resume the next phase only when the user sends: انتقل لتنفيذ المرحلة التالية.

### Explicit coverage of the 28 program requirements

| Requirement | Register authority | Phase / state |
| --- | --- | --- |
| 1. Full-name validation | P1-01 | Phase 1 verified |
| 2. Yemen phone validation and normalization | P1-02 | Phase 1 verified |
| 3. Duplicate person-name protection | P1-03 | Phase 1 verified |
| 4. Duplicate phone protection | P1-04 | Phase 1 verified |
| 5. Maintenance personnel labels | P1-05 | Phase 1 verified |
| 6. Current assignment duplication after transfer | P1-06 | Phase 1 verified |
| 7. Transfer action remains available | P1-07 | Phase 1 verified |
| 8. Assignment history preserved | P1-07 | Phase 1 verified in DB and UI |
| 9. Maintenance request row highlighting | P2-01 | Deferred Phase 2 |
| 10. Work order row highlighting | P2-02 | Deferred Phase 2 |
| 11. Downtime row highlighting | P2-03 | Deferred Phase 2 |
| 12. Work order input simplification | P3-01 | Deferred Phase 3 |
| 13. SparePart-only work order parts | P4-01 | Deferred Phase 4 |
| 14. Warehouse selection per part | P4-02 | Deferred Phase 4 |
| 15. Multiple work order technicians | P5-01 | Deferred Phase 5 |
| 16. Reuse MaintenanceTask engine | P6-01 | Deferred Phase 6 |
| 17. Assigned work visible to every technician | P6-01 | Deferred Phase 6 |
| 18. Technician authorization | P6-01 | Deferred Phase 6 |
| 19. Multi-technician execution sessions | P6-01 | Deferred Phase 6 |
| 20. Unified schedule/checklist editor | P7-01 | Deferred Phase 7 |
| 21. Checklist execution history | P8-02 | Deferred Phase 8 |
| 22. Checklist starter identity | P8-01 | Deferred Phase 8 |
| 23. Checklist item executor identity | P8-02 | Deferred Phase 8 |
| 24. Checklist completer identity | P8-01 | Deferred Phase 8 |
| 25. Active checklist execution uniqueness | P8-03 | Deferred Phase 8 |
| 26. completedById must not be set at start | P8-01 | Deferred Phase 8 |
| 27. Preventive due-date authority | P9-01 | Deferred Phase 9 |
| 28. Preserve tenancy/RBAC/audit/inventory/cost/production | P10-01 | Phase 1 relevant tests passed; final program closeout deferred Phase 10 |
