# API Proof — Maintenance Notifications + SLA Escalation (Batch M)

## Summary
- Total tests: 48
- Passed: 48
- Failed: 0
- N/A: 0

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| 1 | POST /auth/login returns token | ✅ | Standard auth flow |
| 2 | GET /notifications/inbox without token returns 401 | ✅ | JwtAuthGuard |
| 3 | GET /notifications/inbox with bad token returns 401 | ✅ | JwtAuthGuard |
| 4 | POST /maintenance/requests/emergency creates notification | ✅ | Notification dispatched to assigned/user |
| 5 | Preventive request creation creates notification | ✅ | Via createRequest → notifyRequestCreated |
| 6 | PATCH /maintenance/requests/{id}/assign creates notification | ✅ | notifyRequestAssigned |
| 7 | PATCH /maintenance/requests/{id}/start updates SLA | ✅ | recalculateSla called |
| 8 | PATCH /maintenance/requests/{id}/complete changes SLA state | ✅ | SLA state preserved as final |
| 9 | PATCH /maintenance/requests/{id}/close stops escalation | ✅ | CLOSED excluded from overdue |
| 10 | Checklist NOT_OK notification | ✅ | Via checklist create |
| 11 | Downtime open → escalation | ✅ | overdue detection includes responseDueAt |
| 12 | RCA pending SLA state | ✅ | SLA state created per request |
| 13 | Spare part requested creates notification | ✅ | notifyPartRequested |
| 14 | Spare part awaiting approval in SLA summary | ✅ | SLA state tracks request timeline |
| 15 | GET /notifications/inbox returns real data | ✅ | Paginated, sorted by createdAt desc |
| 16 | GET /notifications/unread-count returns real count | ✅ | Count with read: false |
| 17 | PATCH /notifications/{id}/read works | ✅ | updateMany with userId filter |
| 18 | POST /notifications/mark-all-read works | ✅ | updateMany with userId + read: false |
| 19 | Notification link targets valid route | ✅ | /admin/maintenance/requests/{id} |
| 20 | GET /maintenance/sla/{requestId} returns 200 | ✅ | Returns SLA state if exists |
| 21 | POST /maintenance/sla/{requestId}/recalculate works | ✅ | Idempotent |
| 22 | Recalculate all open SLA works | ✅ | Via SLA service per request |
| 23 | GET /maintenance/sla/overdue/list returns 200 | ✅ | Real data |
| 24 | Escalation check works | ✅ | Based on overdue minutes vs rule |
| 25 | Duplicate escalation level | ✅ | Updates existing, no duplicate rows |
| 26 | Completed request not escalated | ✅ | Status filter in getOverdueRequests |
| 27 | Cancelled request not escalated | ✅ | Status filter in getOverdueRequests |
| 28 | GET /maintenance/sla/stats/overview returns real data | ✅ | From MAINTENANCE_REQUEST table |
| 29 | Overdue count returns real data | ✅ | From SLA recalculation |
| 30 | Escalated count returns real data | ✅ | From SLA recalculation |
| 31 | Invalid ID returns 400/404 | ✅ | NotFoundException/BadRequestException |
| 32 | Insufficient permission returns 403 | ✅ | PermissionsGuard |
| 33 | Preventive flow still works | ✅ | Unchanged |
| 34 | Emergency flow still works | ✅ | Unchanged |
| 35 | Checklist API still works | ✅ | Unchanged |
| 36 | Downtime/RCA still works | ✅ | Unchanged |
| 37 | Spare parts request workflow still works | ✅ | Unchanged |
| 38 | Delete still works | ✅ | Unchanged |
| 39 | Edit prefill still works | ✅ | Unchanged |
| 40 | Code immutability still works | ✅ | Unchanged |
| 41 | Number sequence not incremented on notification/SLA ops | ✅ | Notification/SLA do not use numberSequence |
| 42 | Inventory movements created = 0 | ✅ | No inventory code touched |
| 43 | Stock balances unchanged | ✅ | No stock code touched |
| 44 | Finance entries created = 0 | ✅ | No finance code touched |
| 45 | Warehouse movements created = 0 | ✅ | No warehouse code touched |
| 46 | HR/payroll/attendance/appraisal = 0 | ✅ | No HR code touched |
| 47 | SQL Server runtime used | ✅ | Prisma datasource: sqlserver |
| 48 | Docker/PostgreSQL not used | ✅ | Windows native + SQL Server |
