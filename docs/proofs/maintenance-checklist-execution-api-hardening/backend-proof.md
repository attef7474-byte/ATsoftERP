# Backend Proof

## New Endpoints Added

### Under existing checklist-executions controller
| Method | Path | Permission | Status |
|---|---|---|---|
| PATCH | /maintenance/checklist-executions/items/:itemId | maintenance-checklist-execution:update | ✅ Implemented |

### Under existing maintenance-requests controller
| Method | Path | Permission | Status |
|---|---|---|---|
| GET | /maintenance/requests/:id/checklist-executions | maintenance-request:checklist.view | ✅ Implemented |
| POST | /maintenance/requests/:id/checklist-executions | maintenance-request:checklist.manage | ✅ Implemented |
| GET | /maintenance/requests/:id/checklist-executions/:executionId | maintenance-request:checklist.view | ✅ Implemented |

## Modified Services

### MaintenanceChecklistExecutionsService
- `complete()`: Now only blocks on pending MANDATORY items (isMandatory=true), allows optional items to remain pending
- `updateItemDirect()`: New method that looks up item by ID, resolves executionId, delegates to updateItem()

### MaintenanceRequestsService
- `complete()`: Now checks for IN_PROGRESS checklist executions with pending mandatory items before allowing request completion
- `getChecklistExecution()`: New method to get a specific checklist execution for a request

## Modified DTOs
- CreateMaintenanceChecklistItemDto: Added `isMandatory?: boolean` field

## Fixed Permission Seeds
- `maintenance-request:checklist` → `maintenance-request:checklist.view`
- `maintenance-request:createChecklist` → `maintenance-request:checklist.manage`

## Guard Behavior
- All endpoints protected by JwtAuthGuard and PermissionsGuard
- No token → 401
- Bad token → 401
- Insufficient permissions → 403
- Invalid ID → 400/404
- Invalid transition → 400/409
