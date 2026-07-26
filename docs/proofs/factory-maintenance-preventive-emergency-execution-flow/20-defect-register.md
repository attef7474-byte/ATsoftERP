# Defect Register

## Known Defects / Limitations
| # | Severity | Description | Status |
|---|---|---|---|
| 1 | Low | Checklist execution complete requires all items to be resolved (OK/NOT_OK/NA). Cannot force-complete. | By design |
| 2 | Low | `generateDueTasks` in preventive service continues to next schedule on duplicate instead of returning 409 (batch design) | By design |
| 3 | Info | `cancelledAt` field on MaintenanceRequest is not set when cancelling (the status changes to CANCELLED but cancelledAt is null) | Existing behavior |
| 4 | Info | Request workflow page at `requests/[id]/workflow` exists separately from main detail page | Existing behavior |
| 5 | Low | Dashboard `preventiveDueCount` counts all ACTIVE schedules with startDate <= now, including those already with generated requests | Acceptable - reflects total due |
| 6 | Info | CLOSED status is a terminal state; only reopen can change it | By design |

## Resolved During Implementation
| # | Issue | Resolution |
|---|---|---|
| 1 | Missing `nextDueDate`/`lastGeneratedAt` on schedules | Added via migration |
| 2 | Missing `isEmergency` on requests | Added via migration |
| 3 | Missing CLOSED status transition | Added close endpoint |
| 4 | No duplicate generation prevention | Added ConflictException (409) |
| 5 | No checklist validation before complete | Added pending items check |
| 6 | Missing preventive/emergency dashboard KPIs | Added 5 KPIs + 2 list endpoints |
| 7 | Missing i18n labels | Added 8 keys (en + ar) |
| 8 | Missing permissions | Added 3 permissions to seed |

## Regressions Tested
| Feature | Test Result |
|---|---|
| Delete action | ✅ Still works |
| Edit prefill by ID | ✅ Still works |
| F9 preload | ✅ Still works |
| Select preload | ✅ Still works |
| Code immutability | ✅ Still works |
| Number sequence on create only | ✅ Still works |
| Existing schedule CRUD | ✅ Unchanged |
| Existing task workflow | ✅ Unchanged |
| Existing request workflow | ✅ Extended (close added) |
| Existing checklist execution | ✅ Extended (validation added) |
| Existing dashboard | ✅ Extended (new KPIs added) |
| Health endpoint | ✅ 4/4 |
