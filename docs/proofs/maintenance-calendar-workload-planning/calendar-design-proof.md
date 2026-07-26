# Calendar Design — Batch N

## Event Sources (all real data, no fake events)
1. **Maintenance requests** (all types: preventive, emergency, corrective, predictive)
2. **Maintenance schedules** (preventive schedules with nextDueDate)
3. **Maintenance request assignments** (personnel assigned to requests)
4. **Overdue requests** (past planned endDate and not completed)
5. **SLA due requests** (completeDueAt approaching/passed)
6. **Checklist incomplete** (schedules with pending checklist executions)
7. **RCA pending** (requests with downtime logs needing RCA)

## Event Fields (computed from source data)
- id -> request.id or schedule.id
- title -> request.title or schedule.title
- eventType -> 'MAINTENANCE_REQUEST', 'SCHEDULE', 'ASSIGNMENT', 'SLA_DUE'
- requestId -> request.id (nullable)
- scheduleId -> schedule.id (nullable)
- machineId -> request.machineId or schedule.machineId
- productionLineId -> request.productionLineId
- assignedPersonnelId -> from assignments
- status -> from request.status
- priority -> from request.priority
- plannedStartAt -> request.startDate
- plannedEndAt -> request.endDate
- actualStartAt -> from request actual timestamps
- actualEndAt -> from request actual timestamps
- dueAt -> request.completeDueAt
- slaStatus -> request.slaStatus
- escalationLevel -> request.escalationLevel
- targetRoute -> `/admin/maintenance/requests/${id}`
- color -> computed from status/type/priority data

## Views
- List view (default) — sortable by date/priority/status
- Day view — events grouped by hour
- Week view — 7-day grid (if UI supports)
- Month view — month grid showing event counts per day

## Filters
- Date range (startDate, endDate)
- Technician/personnel ID
- Machine ID
- Production line ID
- Request type (PREVENTIVE, EMERGENCY, etc.)
- Status (OPEN, IN_PROGRESS, etc.)
- Priority (LOW, MEDIUM, HIGH, CRITICAL)
- SLA status (ON_TRACK, AT_RISK, OVERDUE, BREACHED)
- Event type (all/schedules/requests/assignments)

## Empty State
"No maintenance events found for the selected filters."

## Rules
- No fake events
- No external calendar sync
- Completed/cancelled events visually distinct (grey/strikethrough)
- Overdue events highlighted red
- SLA escalated events highlighted amber
- Target navigation to real request/schedule page
