# RCA (Root Cause Analysis) Proof — Maintenance Downtime + Failure + RCA + Reliability KPIs

## Implementation

### Fields Added to DowntimeLog
| Field | Purpose |
|---|---|
| failureCause | Description of what caused the failure |
| failureCategory | Category (e.g., MECHANICAL, ELECTRICAL, OPERATIONAL, SOFTWARE, OTHER) |
| rootCause | Identified root cause |
| correctiveAction | Action taken to fix the issue |
| preventiveAction | Action recommended to prevent recurrence |
| rcaStatus | PENDING → IN_PROGRESS → COMPLETED |
| rcaCompletedByUserId | User who marked RCA complete |
| rcaCompletedAt | Timestamp of RCA completion |
| isRepeatFailure | Whether this failure is a repeat |
| repeatedFailureGroupId | Group linking related failures |

### API Endpoints
| Method | Route | Purpose |
|---|---|---|
| PATCH | `/maintenance/downtime-logs/:id/failure-cause` | Set failure cause + category |
| PATCH | `/maintenance/downtime-logs/:id/rca` | Set root cause, corrective action, preventive action |
| PATCH | `/maintenance/downtime-logs/:id/rca/complete` | Mark RCA as complete |
| GET | `/maintenance/downtime-logs/:id/rca` | Get RCA details |

### Frontend Display
- Downtime detail page shows RCA section with all fields
- RCA status badge uses CmmsStatusBadge
- Repeat failure flag displayed
- Production impact displayed

### Validation
- Cannot modify RCA after COMPLETED → 400
- Cannot modify RCA on cancelled log → 400
- Auto-transitions from PENDING to IN_PROGRESS when any RCA field is set
- Audited: SET_FAILURE_CAUSE, SET_RCA, COMPLETE_RCA audit log entries

### Repeat Failure Detection
- `isRepeatFailure` boolean flag on DowntimeLog
- `repeatedFailureGroupId` for linking related failures
- API endpoint: GET `/maintenance/reliability/repeat-failures` returns all flagged logs

### No Mock Data
All RCA data is real user-inputted data. No seed data for RCA fields.
