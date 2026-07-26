# Route Proof

## Maintenance DELETE Routes

| Method | Route | Controller | Permission |
|--------|-------|-----------|------------|
| DELETE | /api/v1/maintenance/production-lines/:id | production-lines.controller | productionLines:delete |
| DELETE | /api/v1/maintenance/operation-types/:id | operation-types.controller | operationTypes:delete |
| DELETE | /api/v1/maintenance/cost-centers/:id | cost-centers.controller | costCenters:delete |
| DELETE | /api/v1/maintenance/machine-categories/:id | machine-categories.controller | machine-category:delete |
| DELETE | /api/v1/maintenance/machine-components/:id | machine-components.controller | machine-component:delete |
| DELETE | /api/v1/maintenance/machine-parts/:id | machine-parts.controller | machine-part:delete |
| DELETE | /api/v1/maintenance/spare-parts/:id | spare-parts.controller | spare-part:delete |
| DELETE | /api/v1/maintenance/machines/:id | maintenance.controller | machines:delete |
| DELETE | /api/v1/maintenance/parts/:id | maintenance.controller | machine-parts:delete |
| DELETE | /api/v1/maintenance/documents/:id | maintenance.controller | machine-document:deactivate |
| DELETE | /api/v1/maintenance/personnel/:id | maintenance-personnel.controller | maintenance-personnel:delete |
| DELETE | /api/v1/maintenance/machine-responsibilities/:id | machine-responsibility-assignments.controller | machine-responsibility:delete |
| DELETE | /api/v1/maintenance/checklist-items/:id | maintenance-checklist-items.controller | maintenance-checklist:delete |
| DELETE | /api/v1/maintenance/schedules/:id | maintenance-schedules.controller | maintenance-schedule:delete |
| DELETE | /api/v1/maintenance/tasks/:id | maintenance-tasks.controller | maintenance-task:delete |
| DELETE | /api/v1/maintenance/downtime-logs/:id | downtime-logs.controller | downtime-log:delete |
| DELETE | /api/v1/maintenance/requests/:id | maintenance-requests.controller | maintenance-request:delete |
| DELETE | /api/v1/maintenance/part-accountabilities/:id | maintenance-part-accountability.controller | maintenance-part-accountability:delete |

## HTTP Status Codes

| Scenario | Status | Implementation |
|----------|--------|---------------|
| Success | 200 | All endpoints return success object |
| Invalid UUID | 400 | ParseUUIDPipe |
| Not found | 404 | NotFoundException in service |
| Dependency conflict | 409 | ConflictException with message |
| No auth token | 401 | JwtAuthGuard |
| Invalid token | 401 | JwtAuthGuard |
| Missing permission | 403 | PermissionsGuard |
