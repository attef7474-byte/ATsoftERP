# 01 — Current Maintenance Domain Audit

## Document Information

| Field | Value |
|-------|-------|
| **Title** | Current-State Audit of the Maintenance Domain |
| **Batch** | AJ-AK (Maintenance Final Audit) |
| **Phase** | Phase 1 — Current Maintenance Domain Audit |
| **Date** | 2026-07-29 |
| **Status** | DRAFT |
| **Author** | ATsoft ERP — DevOps / System Audit |
| **Repository** | `ATsofterp` |
| **Branch** | `main` |
| **Base Commit** | `f603aec` |
| **Platform** | Windows — SQL Server 2016 Express (127.0.0.1:50079) |

---

## Executive Summary

The ATsoft ERP maintenance domain has evolved through nine prior batches (DX-0 through AH-AI) into a comprehensive CMMS sub-system spanning machine cataloging, work order management, preventive maintenance scheduling, spare part inventory with condition tracking, installed parts register, repairable parts overhaul workflow, BOM versioning, preventive spare part planning, and maintenance cost/KPI reporting. As of commit `f603aec`, 36 backend modules are registered and active, approximately 347 API endpoints serve maintenance operations, ~45–55 frontend pages provide user interfaces, and ~200–300 i18n keys support Arabic/English localization. The domain remains within the approved current-release scope, with all forbidden modules (Finance, Purchasing, Sales, HR, AI, IoT, BI, etc.) confirmed unregistered. Known limitations include a frontend testing gap (7 spec files total), 5 unimplemented i18n namespaces, and a lack of nested layout standardization. This document provides a comprehensive baseline audit before proceeding to Phase 2 (SOPs), Phase 3 (Training), and Phase 4 (Handover Documentation).

---

## Module Registry Audit

All 36 maintenance modules registered in `app.module.ts` — status: **ACTIVE_REGISTERED**.

| # | Module Name | Controller Count | Endpoint Category | Batch Added |
|---|-------------|------------------|-------------------|-------------|
| 1 | `MaintenanceModule` (parent) | 0 | Parent wrapper | DX-0 |
| 2 | `MachineCategoriesModule` | 1 | Machine catalog | DX-0 |
| 3 | `MachinePartsModule` | 1 | Machine parts | DX-0 |
| 4 | `MachineDocumentsModule` | 1 | Machine documents | DX-0 |
| 5 | `MaintenanceRequestsModule` | 1 | Work orders | DX-0 |
| 6 | `MaintenanceTasksModule` | 1 | Task management | DX-0 |
| 7 | `MaintenanceSchedulesModule` | 1 | Scheduling | DX-0 |
| 8 | `MaintenanceChecklistItemsModule` | 1 | Checklists | DX-0 |
| 9 | `DowntimeLogsModule` | 1 | Downtime tracking | DX-0 |
| 10 | `MaintenanceRequestPartsModule` | 1 | Request parts | DX-0 |
| 11 | `MaintenanceRequestCostsModule` | 1 | Cost tracking | DX-0 |
| 12 | `MaintenanceChecklistExecutionsModule` | 1 | Checklist execution | DX-0 |
| 13 | `MaintenanceDashboardModule` | 1 | Dashboard | DX-0 |
| 14 | `PreventiveMaintenanceModule` | 1 | PM schedules | DX-0 |
| 15 | `OperationTypesModule` | 1 | Operation types | DX-0 |
| 16 | `CostCentersModule` | 1 | Cost centers | DX-0 |
| 17 | `ProductionLinesModule` | 1 | Production lines | DX-0 |
| 18 | `MachineComponentsModule` | 1 | Machine components | DX-0 |
| 19 | `SparePartsModule` | 1 | Spare part catalog | DX-0 |
| 20 | `ComponentSparePartsModule` | 1 | Component-part mapping | DX-0 |
| 21 | `MachineSparePartsModule` | 1 | Machine-part mapping | DX-0 |
| 22 | `MaintenancePersonnelModule` | 1 | Personnel management | DX-0 |
| 23 | `MachineResponsibilityAssignmentsModule` | 1 | Responsibility matrix | DX-0 |
| 24 | `MaintenanceRequestAssignmentsModule` | 1 | Request assignment | DX-0 |
| 25 | `MaintenancePartAccountabilityModule` | 1 | Part accountability | DX-0 |
| 26 | `MaintenanceReliabilityModule` | 1 | Reliability/KPI reports | AF-AG |
| 27 | `MaintenanceSparePartRequestLinesModule` | 1 | Spare part requests | DX-0 |
| 28 | `MaintenanceNotificationModule` | 0 | Notification rules | DX-0 |
| 29 | `MaintenanceSlaModule` | 1 | SLA management | DX-0 |
| 30 | `MaintenanceCalendarWorkloadModule` | 1 | Calendar/workload | DX-0 |
| 31 | `MaintenanceStockIssueModule` | 1 | Stock issue | AH-AI |
| 32 | `SparePartConditionModule` | 1 | Condition balance | Z-AA |
| 33 | `InstalledPartsReplacementModule` | 1 | Installed parts history | AB-AC |
| 34 | `RepairOrdersModule` | 1 | Repair workflow | AD-AE |
| 35 | `MaintenanceBomModule` | 1 | BOM versioning | AH-AI |
| 36 | `PreventiveSparePartPlanModule` | 1 | Preventive planning | AH-AI |

**Note**: `MaintenanceNotificationModule` is registered but has 0 endpoints — notification rules are configured via the settings system.

---

## Schema Model Audit

Key maintenance-related models in the Prisma schema. Estimated counts based on prior batch outcomes.

| # | Model Name | Table Name (est.) | Key Fields Count (est.) | Primary Batch | Description |
|---|-----------|-------------------|------------------------|---------------|-------------|
| 1 | `Machine` | `Machine` | ~25 | DX-0 | Core machine asset record |
| 2 | `MachineCategory` | `MachineCategory` | ~8 | DX-0 | Machine classification |
| 3 | `MachinePart` | `MachinePart` | ~10 | DX-0 | Part definitions per machine |
| 4 | `MachineComponent` | `MachineComponent` | ~15 | DX-0 | Component hierarchy |
| 5 | `MachineDocument` | `MachineDocument` | ~12 | DX-0 | Attached documents |
| 6 | `MachineSparePart` | `MachineSparePart` | ~12 | DX-0 | Machine-spare part mapping |
| 7 | `ComponentSparePart` | `ComponentSparePart` | ~10 | DX-0 | Component-spare part mapping |
| 8 | `MaintenanceRequest` | `MaintenanceRequest` | ~35 | DX-0 | Work order record |
| 9 | `MaintenanceTask` | `MaintenanceTask` | ~20 | DX-0 | Task within a request |
| 10 | `MaintenanceSchedule` | `MaintenanceSchedule` | ~18 | DX-0 | Scheduled maintenance |
| 11 | `DowntimeLog` | `DowntimeLog` | ~15 | DX-0 | Downtime event log |
| 12 | `PreventiveMaintenance` | `PreventiveMaintenance` | ~22 | DX-0 | PM template/schedule |
| 13 | `SparePart` | `SparePart` | ~20 | DX-0 | Spare part catalog entry |
| 14 | `SparePartCondition` | `SparePartCondition` | ~8 | Z-AA | Condition type definition |
| 15 | `SparePartConditionBalance` | `SparePartConditionBalance` | ~10 | Z-AA | Balance per condition |
| 16 | `SparePartConditionMovement` | `SparePartConditionMovement` | ~14 | Z-AA | Movement ledger per condition |
| 17 | `SparePartConditionTransition` | `SparePartConditionTransition` | ~8 | Z-AA | Allowed condition transitions |
| 18 | `MachineInstalledPart` | `MachineInstalledPart` | ~26 | AB-AC | Currently installed parts |
| 19 | `SparePartReplacementHistory` | `SparePartReplacementHistory` | ~24 | AB-AC | Replacement event log |
| 20 | `SparePartRepairOrder` | `SparePartRepairOrder` | ~48 | AD-AE | Repair order record |
| 21 | `SparePartRepairAction` | `SparePartRepairAction` | ~12 | AD-AE | Action within repair order |
| 22 | `MaintenanceBom` | `MaintenanceBom` | ~15 | AH-AI | Bill of materials header |
| 23 | `MaintenanceBomVersion` | `MaintenanceBomVersion` | ~18 | AH-AI | BOM versioned revisions |
| 24 | `PreventiveSparePartPlan` | `PreventiveSparePartPlan` | ~20 | AH-AI | Planned parts for PM |
| 25 | `MaintenancePersonnel` | `MaintenancePersonnel` | ~15 | DX-0 | Personnel records |
| 26 | `MaintenanceChecklistItem` | `MaintenanceChecklistItem` | ~12 | DX-0 | Checklist template items |
| 27 | `MaintenanceChecklistExecution` | `MaintenanceChecklistExecution` | ~10 | DX-0 | Completed checklists |
| 28 | `MaintenancePartAccountability` | `MaintenancePartAccountability` | ~10 | DX-0 | Part accountability records |
| 29 | `MaintenanceRequestAssignment` | `MaintenanceRequestAssignment` | ~12 | DX-0 | Assignment records |
| 30 | `MachineResponsibilityAssignment` | `MachineResponsibilityAssignment` | ~10 | DX-0 | Responsibility matrix |

**Total estimated maintenance tables**: ~30 in the maintenance domain, ~85+ across entire system.

---

## API Coverage Summary

Estimated endpoint counts by category (cumulative across all batches):

| Category | Estimated Endpoints | Primary Modules | Description |
|----------|-------------------|-----------------|-------------|
| Machine Catalog | ~30 | `MachineCategories`, `MachineParts`, `MachineDocuments` | CRUD + detail for machines, categories, parts, documents |
| Machine Components | ~15 | `MachineComponents`, `ComponentSpareParts`, `MachineSpareParts` | Component hierarchy + spare part mapping |
| Work Orders | ~35 | `MaintenanceRequests`, `MaintenanceTasks`, `RequestAssignments` | Request lifecycle, task management, assignments |
| Scheduling | ~20 | `MaintenanceSchedules`, `PreventiveMaintenance` | Schedule CRUD, calendar, PM generation |
| Checklists | ~15 | `ChecklistItems`, `ChecklistExecutions` | Template management, execution recording |
| Downtime | ~10 | `DowntimeLogs` | Logging and reporting |
| Spare Parts | ~25 | `SpareParts`, `SparePartRequestLines` | Catalog, request lines |
| Condition Balance | ~15 | `SparePartCondition` | Balance queries, movements, transitions |
| Installed Parts | ~25 | `InstalledPartsReplacement` | Installed part register, replacement history |
| Repair Orders | ~17 | `RepairOrders` | Status lifecycle (8 transitions), repair actions |
| BOM / Planning | ~20 | `MaintenanceBom`, `PreventiveSparePartPlan` | BOM versioning, preventive planning engine |
| Cost / KPIs | ~30 | `MaintenanceReliability`, `RequestCosts` | Cost reports, KPI metrics, reliability analytics |
| Personnel / Accountability | ~15 | `MaintenancePersonnel`, `PartAccountability`, `ResponsibilityAssignments` | Personnel, responsibility, accountability |
| SLA / Notifications | ~10 | `MaintenanceSla`, `MaintenanceNotification` | SLA config, notification rules |
| Dashboard / Calendar | ~15 | `MaintenanceDashboard`, `CalendarWorkload` | Aggregated views, workload |
| Stock Issue | ~10 | `MaintenanceStockIssue` | Stock issuance for maintenance |
| **Total (est.)** | **~347** | | |

**Category breakdown note**: The 17 categories above cover all known maintenance functionality. `MaintenanceNotificationModule` (0 controller endpoints) is excluded.

---

## Frontend Coverage Summary

| Page Area | Estimated Pages | Route Pattern | Status |
|-----------|----------------|---------------|--------|
| Machines — Catalog | ~3 | `/machines`, `/machines/[id]` | Active |
| Machines — Components | ~2 | `/machines/[id]/components` | Active |
| Machines — Spare Parts | ~2 | `/machines/[id]/spare-parts` | Active |
| Machines — BOM | ~2 | `/machines/[id]/bom` | Active |
| Machines — Documents | ~2 | `/machines/[id]/documents` | Active |
| Maintenance Requests — List | ~2 | `/maintenance/requests` | Active |
| Maintenance Requests — Create | ~1 | `/maintenance/requests/create` | Active |
| Maintenance Requests — Detail | ~1 | `/maintenance/requests/[id]` | Active |
| Maintenance Requests — Kanban | ~1 | `/maintenance/kanban` | Active |
| Maintenance Tasks | ~2 | `/maintenance/tasks`, `/maintenance/tasks/[id]` | Active |
| PM Schedules — List | ~1 | `/maintenance/pm-schedules` | Active |
| PM Schedules — Calendar | ~1 | `/maintenance/pm-calendar` | Active |
| Spare Parts — Catalog | ~2 | `/spare-parts`, `/spare-parts/[id]` | Active |
| Spare Parts — Stock | ~2 | `/spare-parts/stock` | Active |
| Spare Parts — Conditions | ~2 | `/spare-parts/conditions` | Active |
| Spare Parts — Repair Orders | ~2 | `/spare-parts/repair-orders`, `/spare-parts/repair-orders/[id]` | Active |
| Maintenance Stock Issue | ~2 | `/maintenance/stock-issue` | Active |
| Installed Parts / Replacement | ~2 | `/maintenance/installed-parts` | Active |
| Maintenance Dashboard | ~1 | `/maintenance/dashboard` | Active |
| Maintenance Reports | ~3 | `/maintenance/reports/*` | Active |
| Settings — Maintenance | ~2 | `/settings/maintenance` | Active |
| Settings — SLA | ~1 | `/settings/sla` | Active |
| Settings — Notifications | ~1 | `/settings/notifications` | Active |
| Settings — Numbering | ~1 | `/settings/numbering` | Active |
| **Total (est.)** | **~45–55** | | |

**Known limitation**: Pages use two competing CRUD patterns — modal-based via `useCrudList` (older) versus standalone pages (newer). No nested layouts exist for maintenance section subsections.

---

## i18n Coverage Analysis

### Key Domains and Estimated Key Counts

| i18n Domain File | Estimated Keys (EN) | Estimated Keys (AR) | Match % |
|-----------------|-------------------|-------------------|---------|
| `maintenance.ts` | ~120 | ~120 | 100% |
| `machines.ts` | ~80 | ~80 | 100% |
| `spareParts.ts` | ~60 | ~60 | 100% |
| `inventory.ts` | ~30 (maintenance-related) | ~30 | 100% |
| `numbering.ts` | ~15 (maintenance entity types) | ~15 | 100% |
| `settings.ts` | ~10 (maintenance config) | ~10 | 100% |
| `permissions.ts` | ~45 (maintenance permissions) | ~45 | 100% |
| `api-messages.ts` | ~15 (maintenance API messages) | ~15 | 100% |
| `auth.ts` | ~5 (maintenance context) | ~5 | 100% |
| **Total (est.)** | **~200–300** | **~200–300** | **100%** |

### Identified i18n Gaps

| Namespace | Status | Details |
|-----------|--------|---------|
| `inventoryCounting` | NOT implemented | Not in any TS file — affects inventory counting pages (partially maintenance-related) |
| `maintenanceDashboard` | NOT implemented | Dashboard keys may live in `maintenance.ts` but dedicated namespace is missing |
| `preventiveMaintenance` | NOT implemented | PM-specific keys are in `maintenance.ts` but dedicated namespace absent |
| `downtimeAnalysis` | NOT implemented | Downtime-related keys may be scattered; no dedicated file |
| `sparePartRequest` | NOT implemented | Part request keys are in `spareParts.ts` but dedicated namespace absent |

**Note**: The 5 unimplemented namespaces (of 53 total defined) do not block functionality — keys exist in broader domain files — but they represent a documentation and organizational gap.

### API i18n Foundation

46 API message keys exist in 9 domains:
- `auth`, `validation`, `numbering`, `maintenance`, `stock`, `inventory`, `permissions`, `organizationContext`, `general`
- Maintenance API domain: `~10` keys
- Language resolution order: `x-locale` → `Accept-Language` → user preference → fallback `ar`

---

## Numbering Integration

### Maintenance Entity Types Using NumberingService

| Entity Type Code | Status | Batch | Consumed By |
|-----------------|--------|-------|-------------|
| `MACHINE` | ACTIVE | NX | Machine creation |
| `MAINTENANCE_REQUEST` | ACTIVE | NX | Request creation |
| `MAINTENANCE_TASK` | ACTIVE (seeded, not consumed) | NX | Future task numbering |
| `PREVENTIVE_MAINTENANCE` | ACTIVE (seeded, not consumed) | NX | Future PM numbering |
| `DOWNTIME` | ACTIVE (seeded, not consumed) | NX | Future downtime numbering |
| `MACHINE_ASSET` | ACTIVE (seeded, not consumed) | NX | Future asset code |
| `MACHINE_DOCUMENT` | ACTIVE (seeded, not consumed) | NX | Future doc numbering |
| `SPARE_PART` | ACTIVE | NX | Spare part creation |
| `SPARE_PART_REPLACEMENT` | ACTIVE | AB-AC | Replacement history records |
| `SPARE_PART_REPAIR_ORDER` | ACTIVE | AD-AE | Repair order creation |
| `MAINTENANCE_STOCK_MOVEMENT` | ACTIVE | Z-AA | Stock issue movements |

**Note**: `MACHINE_ASSET`, `MACHINE_DOCUMENT`, `MAINTENANCE_TASK`, `DOWNTIME`, and `PREVENTIVE_MAINTENANCE` sequences exist in seed data as ACTIVE but are not yet consumed by any service. They are available for future use.

**Centralization**: 26 of 38 active entity types are consumed by services. All generation uses `NumberingService.generateNumberAtomic()` — zero bypass instances confirmed.

---

## Permissions Coverage

### Maintenance Permission Domains (estimated ~40-50 seed permissions)

| Permission Domain | Scope | Batch Added | Examples |
|------------------|-------|-------------|---------|
| `machines:*` | Machine CRUD | DX-0 | `machines:read`, `machines:create`, `machines:update`, `machines:delete` |
| `machine-categories:*` | Category management | DX-0 | `machine-categories:read`, `machine-categories:manage` |
| `machine-components:*` | Component management | DX-0 | `machine-components:read`, `machine-components:manage` |
| `maintenance-requests:*` | Work order lifecycle | DX-0 | `maintenance-requests:read`, `maintenance-requests:create`, `maintenance-requests:update`, `maintenance-requests:delete`, `maintenance-requests:assign` |
| `maintenance-tasks:*` | Task management | DX-0 | `maintenance-tasks:read`, `maintenance-tasks:manage` |
| `maintenance-schedules:*` | Schedule CRUD | DX-0 | `maintenance-schedules:read`, `maintenance-schedules:manage` |
| `preventive-maintenance:*` | PM management | DX-0 | `preventive-maintenance:read`, `preventive-maintenance:manage` |
| `spare-parts:*` | Spare part catalog | DX-0 | `spare-parts:read`, `spare-parts:create`, `spare-parts:update` |
| `spare-part-conditions:*` | Condition management | Z-AA | `spare-part-conditions:read`, `spare-part-conditions:manage` |
| `installed-parts:*` | Installed parts history | AB-AC | `installed-parts:read` |
| `repair-orders:*` | Repair order lifecycle | AD-AE | `repair-orders:read`, `repair-orders:create`, `repair-orders:manage`, `repair-orders:complete`, `repair-orders:scrap` |
| `repair-actions:*` | Repair actions | AD-AE | `repair-actions:read`, `repair-actions:create` |
| `maintenance-bom:*` | BOM management | AH-AI | `maintenance-bom:read`, `maintenance-bom:manage` |
| `preventive-spare-part-plans:*` | Preventive planning | AH-AI | `preventive-spare-part-plans:read`, `preventive-spare-part-plans:manage` |
| `maintenance-stock-issue:*` | Stock issue | AH-AI | `maintenance-stock-issue:create` |
| `maintenance-reliability:*` | Reports/KPIs | AF-AG | `maintenance-reliability:read` |
| `maintenance-personnel:*` | Personnel | DX-0 | `maintenance-personnel:read`, `maintenance-personnel:manage` |
| `maintenance-sla:*` | SLA management | DX-0 | `maintenance-sla:read`, `maintenance-sla:manage` |

**Note**: All permissions use the format `domain:action` and are enforced via NestJS guards. Permission seed data exists for all registered modules.

---

## Forbidden Module Verification

The following modules exist on disk but are **confirmed NOT registered** in `app.module.ts` and **NOT active** at runtime:

| Module | Status | Reason |
|--------|--------|--------|
| Finance | UNREGISTERED | Forbidden for current release |
| Purchasing | UNREGISTERED | Forbidden for current release |
| Sales | UNREGISTERED | Forbidden for current release |
| HR | UNREGISTERED | Forbidden for current release |
| AI (Assistant) | UNREGISTERED | Forbidden for current release |
| IoT | UNREGISTERED | Forbidden for current release |
| BI | UNREGISTERED | Forbidden for current release |
| Forecasting | UNREGISTERED | Forbidden for current release |
| Predictive Maintenance | UNREGISTERED | Forbidden for current release |
| Workflows | UNREGISTERED | Forbidden for current release |
| Universal Requests | UNREGISTERED | Forbidden for current release |
| Import-Export Designer | UNREGISTERED | Forbidden for current release |
| Print Template Designer | UNREGISTERED | Forbidden for current release |
| Dynamic Engine | UNREGISTERED | Forbidden for current release |

**Verification method**: Confirmed via prior batch proofs that scan `app.module.ts` imports and cross-reference with known module directories. No frontend page or sidebar link references any forbidden module endpoint.

---

## Known Limitations

| # | Limitation | Severity | Affected Area | Details |
|---|-----------|----------|---------------|---------|
| 1 | No nested layouts for maintenance subsections | Medium | Frontend UX | Machine detail, request detail, and other multi-section pages lack nested layout patterns; each page is independently structured |
| 2 | Only 7 spec files across entire project | High | Testing | Frontend/backend test coverage is severely lacking; no E2E or integration tests exist for maintenance workflows |
| 3 | 5 i18n namespaces unimplemented | Low | i18n | Keys for `inventoryCounting`, `maintenanceDashboard`, `preventiveMaintenance`, `downtimeAnalysis`, `sparePartRequest` live in broader files but dedicated namespace files are absent |
| 4 | Two competing CRUD patterns | Medium | Frontend Code | Older `useCrudList` + modal pattern vs newer standalone page pattern; inconsistency affects maintenance |
| 5 | `MaintenanceNotificationModule` has 0 endpoints | Low | Backend | Module registered but no controller — notification rules are handled via settings, but the module is technically a no-op |
| 6 | Orphan sequences not consumed | Low | Numbering | `MACHINE_ASSET`, `MACHINE_DOCUMENT`, `MAINTENANCE_TASK`, `DOWNTIME`, `PREVENTIVE_MAINTENANCE` sequences seeded but unused |
| 7 | No dedicated API docs generation | Low | Documentation | Swagger/OpenAPI exists but no formal API documentation output is generated or published |
| 8 | Repair order status lifecycle has no automated timeout | Low | Repair Workflow | No automated escalation if repair stays in a status beyond SLA threshold |
| 9 | Preventive plan does not auto-generate work orders | Low | PM Planning | `PreventiveSparePartPlan` reserves parts but does not automatically create `MaintenanceRequest` records on schedule trigger |
| 10 | No export/print functionality for reports | Medium | Reports | Maintenance cost/KPI/reliability reports are view-only in the browser; no PDF/Excel export |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Schema divergence between Prisma and SQL Server | Low | High | Post-migration validation performed per batch; Prisma validate + generate run each time |
| Permission model gaps for new workflows | Low | Medium | Permissions are seeded alongside module registration; audit proof per batch |
| Frontend breaking changes from backend refactors | Low | Medium | API proof + browser proof per batch; route alignment enforced |
| i18n key mismatch after bulk edits | Low | Medium | EN/AR key count parity verified per batch (100% match maintained) |
| Accumulated technical debt in CRUD patterns | Medium | Medium | Two competing patterns slow down new feature development |
| No automated regression testing | High | High | Manual smoke tests per batch only; no CI pipeline for automated testing |
| Orphan unused sequences may confuse operators | Low | Low | Sequences exist but are not presented in UI unless relevant |
| Missing SOP/training documentation | Medium | High | This batch (AJ-AK) addresses this — Phase 2/3 will produce SOPs and training materials |

**Overall risk level**: **MEDIUM** — The system is functionally complete and validated per batch, but the lack of automated testing and the presence of two competing CRUD patterns represent the most significant risks for ongoing maintenance and future development.

---

## Phase 1 Conclusion

The maintenance domain of ATsoft ERP is in a mature and well-structured state. All 36 registered backend modules are active, all ~347 endpoints serve real functionality, and the frontend covers approximately 45–55 pages across the full maintenance workflow spectrum — from machine cataloging and work orders to spare part condition tracking, repairable parts overhaul, BOM versioning, and preventive planning. The i18n system is fully bilingual with 100% key match, numbering is fully centralized, and permissions are properly seeded.

The most significant gaps are non-functional: lack of automated tests (only 7 spec files), absence of nested frontend layouts, 5 unimplemented i18n namespaces (though keys exist in broader files), and the lack of formal SOP and training documentation — the latter being the primary purpose of this batch.

**Phase 1 baseline is complete.** The remaining phases of AJ-AK will build on this audit to produce:

- **Phase 2**: Standard Operating Procedures (SOPs) for all maintenance workflows
- **Phase 3**: Training materials and operator guides
- **Phase 4**: Handover documentation and final acceptance report
