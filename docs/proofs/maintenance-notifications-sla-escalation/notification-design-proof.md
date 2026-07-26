# Notification Design Proof — Batch M

## Architecture

Existing notification system reused (no new notification tables):
- `Notification` model — userId, title, message, type, read, link, createdAt
- `NotificationRule` model — eventType, channel, severity, enabled
- API: dispatch, inbox, unread-count, mark-read, mark-all-read, delete
- UI: bell with badge, dropdown with recent 5 + actions, full center page at /admin/notifications

## Maintenance Notification Service

`MaintenanceNotificationService` (new) dispatches via existing `NotificationsService.dispatch()`:

| Event | Method | Recipient | Link | Type |
|---|---|---|---|---|
| Request created (assigned) | `notifyRequestCreated` | assignedToId | /admin/maintenance/requests/{id} | INFO |
| Request started | `notifyRequestStarted` | requestedById | /admin/maintenance/requests/{id} | INFO |
| Request completed | `notifyRequestCompleted` | requestedById | /admin/maintenance/requests/{id} | SUCCESS |
| Request closed | `notifyRequestClosed` | requestedById | /admin/maintenance/requests/{id} | SUCCESS |
| Request assigned | `notifyRequestAssigned` | assignedUserId | /admin/maintenance/requests/{id} | INFO |
| Part requested | `notifyPartRequested` | requestedById | /admin/maintenance/requests/{id} | INFO |
| Part approved | `notifyPartApproved` | requestedByUserId | /admin/maintenance/requests/{id} | SUCCESS |
| Part rejected | `notifyPartRejected` | requestedByUserId | /admin/maintenance/requests/{id} | WARNING |
| Part reserved | `notifyPartReserved` | requestedByUserId | /admin/maintenance/requests/{id} | INFO |
| Part used | `notifyPartUsed` | requestedByUserId | /admin/maintenance/requests/{id} | SUCCESS |
| SLA overdue | `notifySlaOverdue` | assignedToId + requestedById | /admin/maintenance/requests/{id} | WARNING |
| SLA escalated | `notifySlaEscalated` | assignedToId + requestedById | /admin/maintenance/requests/{id} | WARNING |

## Duplicate Prevention
- Notification dispatch is a simple INSERT — no duplicate check is needed as each event produces unique content
- Completed/cancelled requests are not eligible for SLA escalation (checked in SLA recalculation)
- Each escalation level is stored once; the SLA recalculation updates rather than creates new rows

## Fallback Recipient
- All notification methods check for null recipients before dispatching
- SLA overdue methods filter(Boolean) to skip null userIds
- No fallback user — safe by construction

## Real-time Polling
- `useNotificationsPolling()` polls `/notifications/unread-count` every 30s
- Bell badge shows live unread count
- Dropdown fetches 5 most recent on open
