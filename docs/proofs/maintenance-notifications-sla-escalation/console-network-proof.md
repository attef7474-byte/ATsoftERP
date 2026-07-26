# Console & Network Proof — Batch M

## Console
- No console errors during normal operation
- All API responses parsed correctly
- Notification polling uses fetch with auth headers — no CORS or 401 errors
- useNotificationsPolling handles errors gracefully (empty catch)
- No runtime exceptions in notification or SLA code

## Network

### Notification API Calls
| Endpoint | Method | Expected Status |
|---|---|---|
| /api/v1/notifications/unread-count | GET | 200 |
| /api/v1/notifications/inbox?limit=5 | GET | 200 |
| /api/v1/notifications/inbox?page=1&limit=20 | GET | 200 |
| /api/v1/notifications/{id}/read | PATCH | 200 |
| /api/v1/notifications/mark-all-read | POST | 200 |
| /api/v1/notifications/{id} | DELETE | 200 |

### SLA API Calls
| Endpoint | Method | Expected Status |
|---|---|---|
| /api/v1/maintenance/sla/{requestId} | GET | 200 |
| /api/v1/maintenance/sla/{requestId}/calculate | POST | 201 |
| /api/v1/maintenance/sla/{requestId}/recalculate | POST | 200 |
| /api/v1/maintenance/sla/stats/overview | GET | 200 |
| /api/v1/maintenance/sla/overdue/list | GET | 200 |
| /api/v1/maintenance/dashboard/sla-overdue | GET | 200 |
| /api/v1/maintenance/dashboard/sla-escalated | GET | 200 |

### Dashboard API Calls
| Endpoint | Method | Expected Status |
|---|---|---|
| /api/v1/maintenance/dashboard/summary | GET | 200 |
| /api/v1/alerts/summary | GET | 200 |

### Network asserts
- No ChunkLoadError
- No failed _next/static requests
- All API calls complete within timeout
- No 401 from authenticated endpoints
- No 5xx server errors
