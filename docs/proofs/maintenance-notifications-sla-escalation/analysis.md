# Analysis — Maintenance Notifications + SLA Escalation (Batch M)

## Current State Audit

### Existing Notification System

| Area | Model/Table | Current behavior | Decision |
|---|---|---|---|
| Notification storage | `Notification` (notifications) | Full CRUD: userId, title, message, type, read, link, createdAt | **Reuse** — dispatch from maintenance hooks |
| Notification rules | `NotificationRule` (notification_rules) | eventType, channel, severity, enabled | **Reuse** — add maintenance event types |
| Notifications API | `NotificationsService` + `NotificationsController` | dispatch, inbox, markRead, markAllRead, delete, countUnread | **Reuse** — already works |
| Notifications UI | `notification-bell`, `notification-dropdown`, `notification-center` | Bell badge, dropdown list, full center page with filters | **Reuse** — already works |
| Alerts (derived) | `AlertsService` + `AlertsController` | On-the-fly computed alerts from other models | **Reuse** — extend for SLA |
| Dashboard | `DashboardService` | unreadNotifications count, overdueSchedules | **Extend** — add SLA cards |
| Notification Rules UI | `notification-rules/page.tsx` | Settings page for notification rules | **Reuse** |
| Notifications report | Reports module | Notifications report, by-type breakdown | **Reuse** |

### Missing SLA Infrastructure

| Feature | Status |
|---|---|
| SLA deadline fields on MaintenanceRequest | ❌ Missing |
| SLA state tracking | ❌ Missing |
| SLA rules configuration | ❌ Missing |
| SLA recalculation | ❌ Missing |
| SLA escalation | ❌ Missing |
| SLA badge/UI on request detail | ❌ Missing |
| SLA dashboard cards | ❌ Missing |
| Overdue filters | ❌ Missing |

### Missing Notification Integration

| Event | Status |
|---|---|
| Emergency request created → notify assigned/responsible | ❌ Missing |
| Preventive request generated → notify machine responsible | ❌ Missing |
| Request assigned → notify personnel | ❌ Missing |
| Request started → notify requester | ❌ Missing |
| Request completed → notify requester | ❌ Missing |
| Request closed → notify requester | ❌ Missing |
| Checklist NOT_OK → notify supervisor | ❌ Missing |
| Downtime started → notify maintenance | ❌ Missing |
| Downtime open beyond threshold → escalate | ❌ Missing |
| RCA pending → notify requester | ❌ Missing |
| Spare part requested → notify approver | ❌ Missing |
| Spare part approved/rejected → notify requester | ❌ Missing |
| Spare part reserved/used → notify requester | ❌ Missing |

## Approach

1. **Schema**: Add SLA deadline fields to `MaintenanceRequest`, create `MaintenanceSlaRule` and `MaintenanceSlaState` models
2. **Backend**: Create `MaintenanceSlaService` + `MaintenanceNotificationService`, wire notifications into existing controllers
3. **Frontend**: SLA badge on request detail, SLA dashboard card
4. All new fields nullable, no destructive changes, no stock/finance/HR
