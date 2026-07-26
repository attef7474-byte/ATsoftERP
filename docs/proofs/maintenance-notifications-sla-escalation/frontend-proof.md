# Frontend Proof — Maintenance Notifications + SLA Escalation (Batch M)

## Notification UI (Reused, Existing)

| Feature | File | Status |
|---|---|---|
| Bell icon with unread badge | `notification-bell.tsx` | ✅ Polls `/notifications/unread-count` every 30s |
| Dropdown (5 recent) | `notification-dropdown.tsx` | ✅ Mark read, mark all read, delete |
| Notification item | `notification-item.tsx` | ✅ Type icon, priority badge, title, body, time |
| Center page | `notifications/page.tsx` | ✅ Filters (type, read/unread), DataTable, pagination, detail modal with clickable link |
| Polling hook | `use-notifications-polling.ts` | ✅ Fetches unread count with auth token |

## SLA UI (New)

### Request Detail Page — SLA Badge
File: `maintenance/requests/[id]/page.tsx`
- Displays `slaStatus` as colored badge (green ON_TRACK, red OVERDUE)
- Displays `escalationLevel` if not NONE (amber badge)
- Shows `responseDueAt`, `startDueAt`, `completeDueAt` in detail grid

### SLA Dashboard Pages
- `/admin/maintenance/dashboard/sla-overdue` — Table of SLA overdue requests
- `/admin/maintenance/dashboard/sla-escalated` — Table of escalated requests
- Both pages: real API data, row click navigates to request detail, back/refresh action bar

### Maintenance Dashboard KPI Cards
- SLA Overdue count (red, links to `/admin/maintenance/dashboard/sla-overdue`)
- SLA Escalated count (amber, links to `/admin/maintenance/dashboard/sla-escalated`)
- Unread Notifications count (pink, links to `/admin/notifications`)

### Main Dashboard KPI Cards
- Unread Notifications (pink, links to `/admin/notifications`)
- SLA Overdue (red, links to `/admin/maintenance/requests?overdue=true`)
- SLA Escalated (amber, links to `/admin/maintenance/requests?escalated=true`)

## i18n Keys Added

| Key | EN | AR |
|---|---|---|
| `maintenance.slaStatus` | SLA Status | حالة اتفاقية مستوى الخدمة |
| `maintenance.escalated` | Escalated | تصعيد |
| `maintenance.slaOnTrack` | On Track | ضمن الخطة |
| `maintenance.slaOverdue` | Overdue | متأخر |
| `dashboard.unreadNotifications` | Unread Notifications | الإشعارات غير المقروءة |
| `dashboard.slaOverdue` | SLA Overdue | SLA متأخرة |
| `dashboard.slaEscalated` | SLA Escalated | SLA مصعدة |

## Verification
- build:web ✅ (137 routes compiled)
- SLA overdue page: 2.52 kB, dynamically rendered
- SLA escalated page: 2.49 kB, dynamically rendered
- Maintenance dashboard: 3 kB (added SLA cards)
- Notification center: 4.02 kB
