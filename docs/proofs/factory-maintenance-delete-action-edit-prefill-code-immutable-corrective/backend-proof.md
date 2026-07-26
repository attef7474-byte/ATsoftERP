# Backend Proof

## Controller Changes

### Permission Naming Fixed
- machine-categories: Delete endpoint changed from `machine-category:deactivate` → `machine-category:delete`
- machine-parts: Delete endpoint changed from `machine-part:deactivate` → `machine-part:delete`

### ParseUUIDPipe Added
ParseUUIDPipe added to ALL 20 maintenance DELETE endpoints across these files:

| # | Controller File | Endpoints |
|---|----------------|-----------|
| 1 | production-lines.controller.ts | 1 |
| 2 | operation-types.controller.ts | 1 |
| 3 | cost-centers.controller.ts | 1 |
| 4 | machine-categories.controller.ts | 1 |
| 5 | machine-components.controller.ts | 1 |
| 6 | machine-parts.controller.ts | 1 |
| 7 | spare-parts.controller.ts | 1 |
| 8 | maintenance.controller.ts | 3 (machines, parts, documents) |
| 9 | maintenance-personnel.controller.ts | 1 |
| 10 | machine-responsibility-assignments.controller.ts | 1 |
| 11 | maintenance-checklist-items.controller.ts | 1 |
| 12 | maintenance-schedules.controller.ts | 1 |
| 13 | maintenance-tasks.controller.ts | 1 |
| 14 | downtime-logs.controller.ts | 1 |
| 15 | maintenance-requests.controller.ts | 1 |
| 16 | maintenance-part-accountability.controller.ts | 1 |
| 17 | maintenance-request-parts.controller.ts | 1 |
| 18 | maintenance-request-costs.controller.ts | 1 |
| 19 | maintenance-request-assignments.controller.ts | 1 |
| 20 | machine-documents.controller.ts | 1 |

This ensures invalid UUIDs return 400 BadRequest instead of 500 Internal Server Error.

## Service Changes

### Dependency Check Added
MaintenanceChecklistItemsService.remove() now checks for existing `MaintenanceChecklistExecutionItem` records before hard deleting. Returns 409 Conflict if dependencies exist.

### Seed Permission Additions
Added to `seed-cmms-permissions.ts`:
- `machine-category:delete` 
- `machine-part:delete`
