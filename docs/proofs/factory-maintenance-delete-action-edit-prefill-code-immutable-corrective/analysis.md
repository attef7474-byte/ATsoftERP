# Analysis: Factory / Maintenance Delete Action + Edit Prefill + Immutable Code Corrective

## Scope

Complete audit and implementation of:
1. Delete actions for all 16 maintenance frontend pages
2. Edit prefill via ID-based fetch on all edit modal pages
3. Code immutability (read-only in edit, auto-generated on create)
4. Backend verification of all delete endpoints, detail endpoints, and update endpoints

## Entities Covered

| # | Entity | Frontend Page | Backend Controller | Backend Service |
|---|--------|--------------|-------------------|-----------------|
| 1 | Production Lines | production-lines | production-lines.controller.ts | production-lines.service.ts |
| 2 | Operation Types | operation-types | operation-types.controller.ts | operation-types.service.ts |
| 3 | Cost Centers | cost-centers | cost-centers.controller.ts | cost-centers.service.ts |
| 4 | Machine Categories | machine-categories | machine-categories.controller.ts | machine-categories.service.ts |
| 5 | Machine Components | machine-components | machine-components.controller.ts | machine-components.service.ts |
| 6 | Machine Parts | machine-parts | machine-parts.controller.ts | machine-parts.service.ts |
| 7 | Spare Parts | spare-parts | spare-parts.controller.ts | spare-parts.service.ts |
| 8 | Machines | machines (list) | maintenance.controller.ts | maintenance.service.ts |
| 9 | Machines (edit) | machines/[id]/edit | maintenance.controller.ts | maintenance.service.ts |
| 10 | Personnel | personnel | maintenance-personnel.controller.ts | maintenance-personnel.service.ts |
| 11 | Machine Responsibilities | machine-responsibilities | machine-responsibility-assignments.controller.ts | machine-responsibility-assignments.service.ts |
| 12 | Checklist Items | checklist-items | maintenance-checklist-items.controller.ts | maintenance-checklist-items.service.ts |
| 13 | Schedules | schedules | maintenance-schedules.controller.ts | maintenance-schedules.service.ts |
| 14 | Tasks | tasks | maintenance-tasks.controller.ts | maintenance-tasks.service.ts |
| 15 | Downtime Logs | downtime-logs | downtime-logs.controller.ts | downtime-logs.service.ts |
| 16 | Requests | requests | maintenance-requests.controller.ts | maintenance-requests.service.ts |

## Key Findings

### Delete Endpoints
- All 16 entities have DELETE endpoints
- All protected by JwtAuthGuard + PermissionsGuard
- All return 404 via NotFoundException for missing records
- ParseUUIDPipe added to all delete endpoints for 400 on invalid IDs
- Permission naming standardized (:delete suffix where applicable)
- Missing permissions (machine-category:delete, machine-part:delete) added to seed

### Code Immutability
- Machines: updateMachine() rejects code changes with BadRequestException
- Other entities: Code is auto-generated on create via Number Sequences
- Number Sequences not incremented on edit

### Edit Prefill
- All modal-based edit pages fetch by ID before populating form
- Dedicated edit pages (machines) also fetch by ID
- Loading states shown during fetch
