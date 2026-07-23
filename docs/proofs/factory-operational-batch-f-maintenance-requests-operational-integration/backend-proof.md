# Backend Proof — Maintenance Request Operational Integration

## DTOs

- CreateMaintenanceRequestDto: Extended with productionLineId, machineComponentId, operationTypeId, costCenterId, requiredParts[]
- UpdateMaintenanceRequestDto: Inherits via PartialType
- CreateRequiredPartDto: sparePartId, machineComponentId?, machineId?, quantity, unit?, usageNote?, isPrimary?

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | /maintenance/requests | maintenance-request:create | Create with operational links + required parts |
| GET | /maintenance/requests | maintenance-request:read | List with new filters |
| GET | /maintenance/requests/:id | maintenance-request:read | Detail with included relations |
| PATCH | /maintenance/requests/:id | maintenance-request:update | Update |
| GET | /maintenance/requests/:id/required-parts | maintenance-request-required-part:read | List required parts |
| POST | /maintenance/requests/:id/required-parts | maintenance-request-required-part:create | Add required part |
| PATCH | /maintenance/requests/required-parts/:partId | maintenance-request-required-part:update | Update required part |
| PATCH | /maintenance/requests/required-parts/:partId/cancel | maintenance-request-required-part:cancel | Cancel required part |

## Validation Rules

1. productionLineId must exist if supplied
2. machineId must exist
3. machineComponentId must exist and belong to selected machine
4. operationTypeId must exist if supplied
5. costCenterId must exist if supplied
6. Production line must match machine.productionLineId
7. Component must belong to selected machine
8. Required part sparePartId must exist and be active
9. Quantity must be > 0
10. Duplicate spare part in same request rejected
11. Cannot add/update parts on completed or cancelled requests

## Detail Response Includes

- machine, productionLine, machineComponent, operationType, costCenter
- requestedBy, assignedTo
- tasks, downtimeLogs, schedules
- requiredParts with sparePart and machineComponent/machine info

## List Filters Added

- productionLineId, machineComponentId, operationTypeId, costCenterId, sparePartId
