# SLA Design Proof — Batch M

## Models

### MaintenanceSlaRule (config table)
- Admin-defined rules by priority + type
- Response/start/complete hours define deadlines
- Escalation delay hours + levels define escalation behavior

### MaintenanceSlaState (per-request)
- 1:1 with MaintenanceRequest via unique FK
- Stores calculated deadlines, actual timestamps, overdue minutes
- Tracks escalation level and last escalation time

## Service — `MaintenanceSlaService`

### `calculateDeadlines(request)`
- Looks up active `MaintenanceSlaRule` matching request priority + type
- Computes responseDueAt, startDueAt, completeDueAt from createdAt + rule hours
- Returns null deadlines if no matching rule exists

### `createSlaState(requestId)`
- Calculates deadlines and creates/upserts `MaintenanceSlaState`
- Updates `MaintenanceRequest` with SLA fields

### `recalculateSla(requestId)`
- Compares due dates against current time
- Computes overdue minutes for response/start/complete
- Sets `slaStatus` = ON_TRACK or OVERDUE
- Computes escalation level based on rule config
- **Completed/cancelled requests are not escalated** (status filter)
- Idempotent — always updates rather than creating

### `getSlaSummary(requestId)`
- Returns `MaintenanceSlaState` for a request

### `getOverdueRequests()`
- Returns non-terminal requests where any due date is past
- Excludes CLOSED, CANCELLED, COMPLETED

### `getSlaStats()`
- Counts ON_TRACK, OVERDUE, escalated requests

## API Endpoints (MaintenanceSlaController)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/maintenance/sla/{requestId}/calculate` | Calculate SLA deadlines |
| POST | `/maintenance/sla/{requestId}/recalculate` | Recalculate SLA + escalation |
| GET | `/maintenance/sla/{requestId}` | Get SLA summary |
| GET | `/maintenance/sla/stats/overview` | SLA statistics |
| GET | `/maintenance/sla/overdue/list` | Overdue requests list |

## Dashboard Integration
- `MaintenanceDashboardService.getSummary()` returns `slaOverdue` and `slaEscalated` counts
- New endpoints: `/maintenance/dashboard/sla-overdue`, `/maintenance/dashboard/sla-escalated`
- Dashboard KPI cards show SLA Overdue, SLA Escalated, Unread Notifications
