# Phase 2: API Route Map

| Field | Value |
|-------|-------|
| Batch | AJ-AK |
| Phase | 2 |
| Title | API Route Map |
| Date | 2026-07-29 |
| Status | DRAFT |
| Author | Batch AJ-AK |

## 1. Overview

This document maps all API endpoints exposed by the 36 maintenance backend modules registered in `app.module.ts`. Each module typically provides a single controller with CRUD + domain-specific endpoints. Total estimated maintenance API endpoints: ~345.

## 2. Module Endpoint Table

| # | Module | Directory | Controller | Estimated Endpoints | Key Routes | Batch Added |
|---|--------|-----------|-----------|----------------------|------------|-------------|
| 1 | MachineCategories | machine-categories | MachineCategoriesController | ~8 | GET/POST/PATCH/DELETE /machines/categories | Core |
| 2 | MachineParts | machine-parts | MachinePartsController | ~8 | GET/POST/PATCH/DELETE /machines/parts | Core |
| 3 | MachineDocuments | machine-documents | MachineDocumentsController | ~8 | GET/POST/PATCH/DELETE /machines/documents | Core |
| 4 | MaintenanceRequests | maintenance-requests | MaintenanceRequestsController | ~20 | GET/POST/PATCH/DELETE /requests, status transitions, approval | Core |
| 5 | MaintenanceTasks | maintenance-tasks | MaintenanceTasksController | ~15 | GET/POST/PATCH/DELETE /tasks, status | Core |
| 6 | MaintenanceSchedules | maintenance-schedules | MaintenanceSchedulesController | ~12 | GET/POST/PATCH/DELETE /schedules, calendar | Core |
| 7 | MaintenanceChecklistItems | maintenance-checklist-items | MaintenanceChecklistItemsController | ~8 | CRUD /checklist-items | Core |
| 8 | DowntimeLogs | downtime-logs | DowntimeLogsController | ~8 | CRUD /downtime-logs, categorize | Core |
| 9 | MaintenanceRequestParts | maintenance-request-parts | MaintenanceRequestPartsController | ~8 | CRUD /requests/:id/parts | Core |
| 10 | MaintenanceRequestCosts | maintenance-request-costs | MaintenanceRequestCostsController | ~8 | CRUD /requests/:id/costs, totals | Core |
| 11 | MaintenanceChecklistExecutions | maintenance-checklist-executions | MaintenanceChecklistExecutionsController | ~8 | POST/GET /checklist-executions | Core |
| 12 | MaintenanceDashboard | maintenance-dashboard | MaintenanceDashboardController | ~10 | GET /dashboard/* (aggregation) | Core |
| 13 | PreventiveMaintenance | preventive-maintenance | PreventiveMaintenanceController | ~15 | CRUD /preventive-maintenance, generate | Core |
| 14 | OperationTypes | operation-types | OperationTypesController | ~8 | CRUD /operation-types | Core |
| 15 | CostCenters | cost-centers | CostCentersController | ~8 | CRUD /cost-centers | Core |
| 16 | ProductionLines | production-lines | ProductionLinesController | ~8 | CRUD /production-lines | Core |
| 17 | MachineComponents | machine-components | MachineComponentsController | ~10 | CRUD /machines/:id/components | Core |
| 18 | SpareParts | spare-parts | SparePartsController | ~12 | CRUD /spare-parts, search, filter | Core |
| 19 | ComponentSpareParts | component-spare-parts | ComponentSparePartsController | ~8 | GET/POST/DELETE /component-spare-parts | Core |
| 20 | MachineSpareParts | machine-spare-parts | MachineSparePartsController | ~8 | GET/POST/DELETE /machine-spare-parts | Core |
| 21 | MaintenancePersonnel | maintenance-personnel | MaintenancePersonnelController | ~8 | CRUD /personnel | Core |
| 22 | MachineResponsibilityAssignments | machine-responsibility-assignments | MachineResponsibilityAssignmentsController | ~8 | CRUD /responsibility-assignments | Core |
| 23 | MaintenanceRequestAssignments | maintenance-request-assignments | MaintenanceRequestAssignmentsController | ~8 | CRUD /request-assignments | Core |
| 24 | MaintenancePartAccountability | maintenance-part-accountability | MaintenancePartAccountabilityController | ~8 | CRUD /part-accountability | Core |
| 25 | MaintenanceReliability | maintenance-reliability | MaintenanceReliabilityController | ~14 | GET /reliability/*, metrics, KPIs | AF-AG |
| 26 | MaintenanceSparePartRequestLines | maintenance-spare-part-request-lines | SparePartRequestLinesController | ~8 | CRUD /spare-part-request-lines | AF-AG |
| 27 | MaintenanceNotification | maintenance-notification | *(no controller)* | 0 | — | AF-AG |
| 28 | MaintenanceSla | maintenance-sla | MaintenanceSlaController | ~8 | CRUD /sla | AF-AG |
| 29 | MaintenanceCalendarWorkload | maintenance-calendar-workload | CalendarWorkloadController | ~8 | GET /calendar-workload | AF-AG |
| 30 | MaintenanceStockIssue | maintenance-stock-issue | MaintenanceStockIssueController | ~15 | POST /stock-issue, GET history, return | Z-AA |
| 31 | SparePartConditions | spare-part-conditions | SparePartConditionsController | ~2 | GET/POST /spare-part-conditions/balances | Z-AA |
| 32 | InstalledPartsReplacement | installed-parts-replacement | InstalledPartsReplacementController | ~10 | GET /installed-parts, GET /replacement-history | AB-AC |
| 33 | RepairOrders | repair-orders | RepairOrdersController | ~17 | CRUD /repair-orders, status transitions, actions | AD-AE |
| 34 | MaintenanceBom | maintenance-bom | MaintenanceBomController | ~15 | CRUD /bom, versions, activate | AH-AI |
| 35 | PreventiveSparePartPlan | preventive-spare-part-plan | PreventiveSparePartPlanController | ~15 | CRUD /preventive-plans, generate reservations | AH-AI |
| 36 | MaintenanceModule (parent) | maintenance/ | *(barrel - delegates to submodules)* | — | — | Core |

## 3. Endpoint Summary by Domain

| Domain Area | Modules | Estimated Endpoints | Batch Coverage |
|-------------|---------|---------------------|----------------|
| Machine Catalog | 5 (categories, parts, documents, components, BOM) | ~49 | Core + AH-AI |
| Spare Parts | 4 (spare-parts, component, machine maps, conditions) | ~30 | Core + Z-AA |
| Maintenance Requests | 5 (requests, tasks, parts, costs, assignments) | ~59 | Core |
| Checklists | 2 (items, executions) | ~16 | Core |
| Schedules / PM | 3 (schedules, preventive, calendar) | ~35 | Core |
| Stock / Inventory | 2 (stock-issue, conditions-inventory) | ~17 | Z-AA/AB-AC |
| Repair | 1 (repair-orders) | ~17 | AD-AE |
| Planning | 2 (BOM, preventive-plan) | ~30 | AH-AI |
| Reports / KPIs | 2 (reliability, dashboard) | ~24 | AF-AG |
| Personnel / Responsibility | 3 (personnel, responsibility, accountability) | ~24 | Core |
| SLA / Notification | 2 (SLA, notification) | ~8 | AF-AG |
| Settings / Config | 3 (operation-types, cost-centers, production-lines) | ~24 | Core |
| **Total** | **34 active** | **~345** | **All batches** |

## 4. API Path Conventions

- Prefix: `/` (leading slash required — 10 paths fixed in DX-0)
- Versionless (no `/v1/`)
- RESTful: `GET /resource`, `POST /resource`, `PATCH /resource/:id`, `DELETE /resource/:id`
- Nested: `/machines/:machineId/components`, `/requests/:requestId/parts`
- Status transitions: `POST /repair-orders/:id/status`
- Actions: `POST /stock-issue`, `POST /repair-orders/:id/complete`
- Dashboard: `GET /dashboard/*`
- Reports: `GET /reliability/*`, `GET /reports/*`

## 5. Integration Points

| External Domain | Integration Type | Maintenance Modules Involved |
|-----------------|------------------|------------------------------|
| Inventory | Stock movements, balance checks | MaintenanceStockIssue, SparePartConditions |
| Numbering | Code generation | Most maintenance modules (30+) |
| Auth | JWT guards | All modules |
| Permissions | `@RequirePermission()` decorators | All modules |
| Audit | Lifecycle event logging | StockIssue, RepairOrders, Requests |
| i18n | API error messages | Core modules via api-messages.ts |
| Notifications | Alerts on status changes | MaintenanceNotification, SLA |

## 6. Passive Modules

- **MaintenanceNotification** (line 27) — registered with 0 controller endpoints. Functions as a passive/configuration-only module. Its functionality is consumed internally by other modules (e.g., SLA breach → notification). Requires no direct API exposure.

## 7. Phase 2 Conclusion

The maintenance API route map covers ~345 endpoints across 34 active controllers (1 passive module). All core CRUD operations are complete. Domain-specific workflows (repair lifecycle, stock issue, BOM versioning, preventive planning) are fully implemented. Integration points with inventory, numbering, auth/permissions, and audit are operational. No orphan endpoints or unregistered modules exist in the maintenance domain.
