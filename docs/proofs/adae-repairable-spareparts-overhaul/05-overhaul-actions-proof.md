# Phase 5 — Overhaul / Actions Proof

## Model

`SparePartRepairAction` with 12 columns:
- `actionType`: INSPECTION, DIAGNOSIS, REPAIR, OVERHAUL, PART_REPLACED, CLEANING, TEST, SCRAP_DECISION, STATUS_CHANGE, NOTE
- `actionStatus`: PLANNED, IN_PROGRESS, DONE, FAILED, CANCELLED
- `description`, `result`, `performedByUserId`, `performedAt`, `durationMinutes`, `notes`

## Backend

- `RepairOrdersService.getActions(repairOrderId)` — list actions
- `RepairOrdersService.addAction(repairOrderId, dto, userId)` — create action
- Validation: repair order must not be in completed/scrapped/cancelled status

## Controller Endpoints

- `GET /api/maintenance/repair-orders/:id/actions` — list actions
- `POST /api/maintenance/repair-orders/:id/actions` — add action

## Overhaul Tracking

Overhaul is tracked via `actionType = 'OVERHAUL'` with description, result, performedBy, performedAt, durationMinutes. No separate model needed.

## Audit Events

- `SPARE_PART_REPAIR_ACTION_ADDED` — on each action creation
