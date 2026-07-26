# Analysis: Maintenance Checklist Execution API Hardening

## Audit Matrix

| Area | Model/Table | Page | API | Current behavior | Missing behavior | Needs migration | Needs backend | Needs frontend | Decision | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Checklist Item CRUD | MaintenanceChecklistItem | /admin/maintenance/checklist-items | POST/GET/PATCH/DELETE /maintenance/checklist-items | Full CRUD with pagination, search, scheduleId filter. No activate/deactivate (returns stub). | No `isMandatory` field. UI form references `code`, `taskId`, `required` not in schema. | ✅ Added `isMandatory` Boolean | ✅ Update DTO/Service | N/A | Add isMandatory | ✅ DONE |
| Checklist Execution | MaintenanceChecklistExecution | /admin/maintenance/schedules/[id]/checklist, /admin/maintenance/requests/[id]/checklist | POST/GET /maintenance/checklist-executions, GET /maintenance/checklist-executions/:id, PATCH /maintenance/checklist-executions/:id/complete, PATCH /maintenance/checklist-executions/:id/items/:itemId | Full create/read/complete with items. Create auto-creates items from schedule. Completion blocks on pending items. | No mandatory-only guard. No direct PATCH /maintenance/checklist-execution-items/:itemId endpoint. No nested /maintenance/requests/:id/checklist-executions endpoints. | ✅ isMandatory added | ✅ Updated completion to check mandatory only. Added direct item endpoint. Added nested request endpoints. | ✅ UI already calls real APIs | Add mandatory guard + nested endpoints | ✅ DONE |
| Checklist Execution Items | MaintenanceChecklistExecutionItem | Same pages as execution | PATCH /maintenance/checklist-executions/:id/items/:itemId | Items created with status=PENDING. Update sets status=COMPLETED, passed=true/false/null. | No direct item ID endpoint. | None needed | ✅ Added PATCH /maintenance/checklist-execution-items/:itemId | N/A | Add direct item endpoint | ✅ DONE |
| Permission seeds | Permission | N/A | N/A | mismatch: seed has checklist.view vs checklist.manage | Controller uses checklist.view and checklist.manage | Fixed seed keys | N/A | Fix permission seed keys | ✅ DONE |
| i18n | N/A | All pages | N/A | Full EN/AR coverage exists for checklist. | Missing keys for mandatory items, OK/NOT_OK/NA, save result, incomplete etc. | None | N/A | ✅ Added keys | Add missing keys | ✅ DONE |
| Dashboard | N/A | /admin/maintenance/dashboard | GET /maintenance/dashboard/summary | No checklist KPIs. | No checklist completion count/pending count in dashboard. | None | Not required per scope | Not required per scope | N/A — documented limitation | ✅ N/A |

## Summary of Changes

1. **Schema**: Added `isMandatory` Boolean field to `MaintenanceChecklistItem` via new migration.
2. **Backend**: 
   - Updated `complete()` to only block on pending mandatory items (optional items allowed to remain pending).
   - Added `PATCH /maintenance/checklist-executions/items/:itemId` direct item endpoint.
   - Added nested `GET/POST /maintenance/requests/:id/checklist-executions` and `GET /maintenance/requests/:id/checklist-executions/:executionId` endpoints.
   - Added request completion guard: checks for IN_PROGRESS executions with pending mandatory items before allowing request completion.
   - Fixed permission seed keys to match controller (`checklist.view`, `checklist.manage`).
3. **Frontend**: Added i18n keys for mandatory items, OK/NOT_OK/NA, save result, incomplete, etc.
4. **Dashboard**: Documented as N/A — checklist KPIs not in scope.

## What Was Preserved from Previous Batches

- Preventive request generation (from schedule)
- Duplicate generation returns 409
- Emergency request creation
- Assign/start/complete/close workflow for maintenance requests
- Delete action
- Edit prefill
- Code immutability (code field not modifiable after creation)
- Number sequence behavior (increments only on create/generation)
- Action bar visibility (no selected row)
- Health checks (4/4)
- Smoke tests (8/8)
- SQL Server runtime (no Docker/PostgreSQL)
- All existing dashboard KPIs (unchanged)
