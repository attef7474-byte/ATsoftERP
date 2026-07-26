# Downtime Workflow Proof — Maintenance Downtime + Failure + RCA + Reliability KPIs

## Existing Workflow (Preserved)
1. Start downtime → POST /start → creates DowntimeLog with startTime, detectedAt
2. End downtime → PATCH :id/end → sets endTime, repairCompletedAt, calculates duration
3. Close downtime → PATCH :id/close → sets endTime, durationMinutes (if not already set)
4. Cancel downtime → PATCH :id/cancel → sets cancelledAt
5. Classify downtime → PATCH :id/classify → sets failureCategory

## New Workflow Steps
6. Set failure cause → PATCH :id/failure-cause → sets failureCause, failureCategory
7. Set RCA → PATCH :id/rca → sets rootCause, correctiveAction, preventiveAction, auto-rcaStatus=IN_PROGRESS
8. Complete RCA → PATCH :id/rca/complete → sets rcaStatus=COMPLETED, rcaCompletedByUserId, rcaCompletedAt

## Validation Rules
- Cannot set failure cause on cancelled log → 400
- Cannot set RCA on cancelled log → 400
- Cannot set RCA on already completed RCA → 400
- Cannot complete already completed RCA → 400
- Cannot complete RCA on cancelled log → 400

## State Transitions

### Downtime Status
- ACTIVE → (end) → CLOSED
- ACTIVE → (cancel) → CANCELLED
- CLOSED → (close) → CLOSED (idempotent, error if already closed)
- Any → (delete) → removed (only if closed/cancelled)

### RCA Status
- PENDING → (set RCA fields) → IN_PROGRESS
- IN_PROGRESS → (complete RCA) → COMPLETED
- COMPLETED → (any RCA update) → BLOCKED (400 error)

## Preservation
- Existing emergency request → auto downtime log creation: PRESERVED
- Existing start/end/close workflow: PRESERVED
- Existing classify endpoint: PRESERVED (now stores in failureCategory)
- Existing analysis page: PRESERVED (now also includes byCause grouping)
