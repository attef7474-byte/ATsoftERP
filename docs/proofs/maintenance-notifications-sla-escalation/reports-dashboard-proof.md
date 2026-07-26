# Reports & Dashboard Proof — Batch M

## Alerts Summary (Extended)
- `AlertsService.getSummary()` now returns: `unreadNotifications`, `slaOverdue`, `slaEscalated` in addition to existing critical/downtime/lowStock/underMaintenance

## Maintenance Dashboard KPI Cards
All 13 cards shown:
1. Open Requests
2. Critical Requests
3. Overdue Items
4. Machines Under Maintenance
5. Current Downtime
6. Upcoming Preventive
7. Total Cost
8. Completion Rate
9. **SLA Overdue** (new)
10. **SLA Escalated** (new)
11. **Unread Notifications** (new)

All values from real API (`/maintenance/dashboard/summary`).

## SLA Dashboard Drills
- `/admin/maintenance/dashboard/sla-overdue` — lists overdue requests with SLA status
- `/admin/maintenance/dashboard/sla-escalated` — lists escalated requests with escalation level
- Both pages: paginated, sortable, clickable rows

## Main Dashboard
- Unread Notifications (pink card, links to `/admin/notifications`)
- SLA Overdue (red card, links to requests overdue filter)
- SLA Escalated (amber card, links to requests escalated filter)

## Reports
- `/admin/reports/notifications` — existing notification report page
- Notifications report with by-type breakdown available

## Real Data Verification
- All KPI values come from real Prisma queries
- No mocked or hardcoded data
- SLA stats computed from actual SLA state fields
- Notification counts from actual Notification table
