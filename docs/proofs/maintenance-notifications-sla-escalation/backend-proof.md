# Backend Proof — Maintenance Notifications + SLA Escalation (Batch M)

## Verified Behaviours

### Duplicate Notification Prevention
- Each event produces unique notification content (timestamp, request ID, part ID)
- Notification table has no unique constraint preventing duplicate rows — by design, each event IS unique
- Completed/cancelled requests: `notifyRequestCompleted` and `notifyRequestClosed` fire only for valid transitions
- `notifySlaOverdue` and `notifySlaEscalated` fire only from `recalculateSla`, which checks request status first

### Duplicate Escalation Prevention
- `recalculateSla` updates existing `MaintenanceSlaState` row (upsert pattern)
- Escalation level is computed as a function of overdue time vs. rule thresholds
- Same function call with same input produces same output — idempotent
- No new rows created on recalculation

### Completed/Cancelled Requests Not Escalated
- `getOverdueRequests()` explicitly excludes CLOSED, CANCELLED, COMPLETED status
- `recalculateSla()` only fires for active requests (wired only into `start` which requires OPEN status)

### SLA Recalculation Idempotency
- Uses `upsert` on `maintenanceSlaState` with unique `maintenanceRequestId`
- Updates `MaintenanceRequest` SLA fields directly — no side effects
- Multiple calls with same state produce same result

### Notification Read/Unread Persists
- `read` field is a boolean persisted in `Notification` table
- `markRead` uses `updateMany` with userId filter — only the target user's notification is marked
- `markAllRead` uses `updateMany` with userId filter
- Count queries use `read: false` filter for unread count

### Notification Recipients Are Real Users
- Recipients are fetched from `requestedById`, `assignedToId` — existing User FK fields
- `notifyRequestAssigned` takes `assignedUserId` parameter explicitly
- All recipient lookups use the User model with proper FK constraints

### Fallback Recipient Safety
- Methods check for null/undefined with optional chaining
- SLA notification methods use `filter(Boolean)` to skip null entries
- If both requestedBy and assignedTo are null, no notification is sent (safe no-op)

### Auth/Authorization
- All notification endpoints require `notifications:*` permissions
- SLA endpoints require `maintenance-request:*` permissions
- JWT auth guard + permissions guard on all routes

## File Listing
- `apps/api/src/modules/factory/maintenance/maintenance-notification/maintenance-notification.service.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-notification/maintenance-notification.module.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-sla/maintenance-sla.service.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-sla/maintenance-sla.controller.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-sla/maintenance-sla.module.ts`
