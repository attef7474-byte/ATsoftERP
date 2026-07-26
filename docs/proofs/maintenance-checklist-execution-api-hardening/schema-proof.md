# Schema Proof

## Migration: add_checklist_item_mandatory
- ID: 20260726060000_add_checklist_item_mandatory
- SQL file: apps/api/prisma/migrations/20260726060000_add_checklist_item_mandatory/migration.sql
- Change: ALTER TABLE maintenance_checklist_items ADD isMandatory BIT NOT NULL DEFAULT 0

## Models verified
- MaintenanceChecklistItem: has `isMandatory Boolean @default(false)` field
- MaintenanceChecklistExecution: has `scheduleId`, `requestId?`, `status`, `startedAt`, `completedAt`, `completedById`, `notes`
- MaintenanceChecklistExecutionItem: has `executionId`, `checklistItemId`, `status`, `passed`, `notes`, `completedAt`, `completedById`

## Relations verified
- MaintenanceChecklistExecution.schedule → MaintenanceSchedule (required)
- MaintenanceChecklistExecution.request → MaintenanceRequest (optional)
- MaintenanceChecklistExecutionItem.execution → MaintenanceChecklistExecution
- MaintenanceChecklistExecutionItem.checklistItem → MaintenanceChecklistItem

## Migration status
- 21 migrations applied (20 previous + 1 new)
- Prisma generate: ✅ PASS
- Prisma validate: ✅ PASS
