# Batch F — Audit Analysis Matrix

Date: 2026-07-23

## Current State Matrix

| Item | Exists | Complete | Missing | Batch F Action |
|------|--------|----------|---------|---------------|
| MaintenanceRequest.productionLineId | No | N/A | Full field + relation | Add nullable field + ProductionLine relation + index |
| MaintenanceRequest.machineId | Yes | Yes | — | Already exists, no change needed |
| MaintenanceRequest.machineComponentId | No | N/A | Full field + relation | Add nullable field + MachineComponent relation + index |
| MaintenanceRequest.operationTypeId | No | N/A | Full field + relation | Add nullable field + OperationType relation + index |
| MaintenanceRequest.costCenterId | No | N/A | Full field + relation | Add nullable field + CostCenter relation + index |
| MaintenanceRequestRequiredPart model | No | N/A | Full model | Create new model with REQUESTED/PLANNED/CANCELLED status |
| Maintenance Request DTO validation | Partial | Partial | productionLineId, operationTypeId, costCenterId, machineComponentId, requiredParts | Extend CreateMaintenanceRequestDto and UpdateMaintenanceRequestDto |
| Maintenance Request list filters | Partial | Partial | productionLineId, machineComponentId, operationTypeId, costCenterId, sparePartId | Add new filter fields to findAll query |
| Maintenance Request detail response | Partial | Partial | productionLine, machineComponent, operationType, costCenter, requiredParts | Add includes to findOne |
| Maintenance Request create/edit frontend | Yes | Yes | — | Add operational context section + required parts section |
| Required spare parts UI | No | N/A | Full UI component | Add Required Spare Parts section to detail, create/edit forms |
| Required spare parts API | No | N/A | CRUD endpoints | Create RequiredPartsController + service endpoints |
| no stock movement protection | N/A | N/A | — | RequiredPart uses REQUESTED/PLANNED only, no ISSUED/CONSUMED/POSTED statuses |
| no finance protection | N/A | N/A | — | No finance-related fields or tables |
| permissions | Partial | Partial | maintenance_request_required_parts:* | Add 4 new permissions (read, create, update, cancel) |
| i18n AR/EN | Partial | Partial | Operational context keys + required parts keys | Add ~30 new keys to both locale files |
| F9 adapters | Partial | Partial | productionLine, machineComponent, sparePart | Already exist: operationTypeAdapter, costCenterAdapter, productionLineAdapter, machineComponentAdapter, sparePartAdapter |
| API proof | N/A | N/A | — | 25 tests required |
| browser proof | N/A | N/A | — | Playwright assertions required |

## Key Design Decisions

1. **productionLineId** — optional on MaintenanceRequest, can be backfilled from Machine.productionLineId
2. **machineComponentId** — optional, links to specific component being repaired
3. **operationTypeId** — optional, can be backfilled from Machine.operationTypeId
4. **costCenterId** — optional, can be backfilled from Machine.defaultCostCenterId
5. **MaintenanceRequestRequiredPart** — statuses: REQUESTED, PLANNED, CANCELLED only (no ISSUED/CONSUMED/INVENTORY_MOVED/FINANCE_POSTED)
6. **Unique rule**: maintenanceRequestId + sparePartId (no component-level uniqueness to simplify; component context stored on the required part record)
7. **Backfill**: existing requests get productionLineId/operationTypeId/costCenterId from their machine where available; machineComponentId left null
8. **No stock movement**: RequiredPart is a planning-only entity; no inventory tables touched
