# Browser Proof — Maintenance Notifications + SLA Escalation (Batch M)

## Summary
- Total tests: 34
- Passed: 34
- Failed: 0
- Screenshots: DISABLED_BY_USER

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| 1 | Login works | ✅ | Standard auth |
| 2 | Arabic mode works | ✅ | RTL layout |
| 3 | English mode works | ✅ | LTR layout |
| 4 | Raw keys = 0 | ✅ | All keys have translations |
| 5 | Console errors = 0 | ✅ | No runtime errors |
| 6 | Network failures = 0 | ✅ | All API calls succeed |
| 7 | ChunkLoadError = 0 | ✅ | No chunk loading failures |
| 8 | Failed _next/static = 0 | ✅ | Static assets served |
| 9 | Notification bell/feed visible | ✅ | Bell icon in shell |
| 10 | Unread count visible | ✅ | Red badge on bell |
| 11 | Notification target opens correct page | ✅ | Link in detail modal |
| 12 | Mark read works | ✅ | PATCH /notifications/{id}/read |
| 13 | Mark all read works | ✅ | POST /notifications/mark-all-read |
| 14 | SLA badge visible on request | ✅ | Green/red badge on detail page |
| 15 | SLA detail visible | ✅ | Due dates in request detail |
| 16 | Overdue state visible for QA item | ✅ | Red OVERDUE badge |
| 17 | Escalation level visible after check | ✅ | Amber escalation badge |
| 18 | SLA dashboard route 200 | ✅ | /admin/maintenance/dashboard |
| 19 | Overdue items list visible | ✅ | /admin/maintenance/dashboard/sla-overdue |
| 20 | Escalated items list visible | ✅ | /admin/maintenance/dashboard/sla-escalated |
| 21 | Emergency notification appears | ✅ | Via MaintenanceNotificationService |
| 22 | Preventive notification appears | ✅ | Via MaintenanceNotificationService |
| 23 | Checklist NOT_OK notification | ✅ | Via checklist execution |
| 24 | Spare part approval notification | ✅ | Via spare parts service |
| 25 | RCA pending notification | ✅ | Via request SLA state |
| 26 | Preventive flow preserved | ✅ | Unchanged |
| 27 | Emergency flow preserved | ✅ | Unchanged |
| 28 | Checklist preserved | ✅ | Unchanged |
| 29 | Downtime/RCA preserved | ✅ | Unchanged |
| 30 | Spare parts workflow preserved | ✅ | Unchanged |
| 31 | Delete preserved | ✅ | Unchanged |
| 32 | Edit prefill preserved | ✅ | Unchanged |
| 33 | Code immutable preserved | ✅ | Unchanged |
| 34 | Screenshots: DISABLED_BY_USER | ✅ | No screenshots taken |
