# Workload Design — Batch N

## Workload Concepts (computed from real data)

### Planned workload
- Sum of estimated durations for assigned in-progress/open requests per personnel
- Sum of estimated durations for requests per machine
- Sum of estimated durations for requests per production line

### Capacity rules
- Default capacity: 480 minutes (8 hours) per active `MaintenancePersonnel` per day
- Stored in `MaintenancePersonnel.dailyCapacityMinutes` field (Int, default 480)
- No HR shifts/attendance used
- Part-time capacity can be set by editing personnel record

### Workload statuses (computed)
- NORMAL: workload <= 80% capacity
- HIGH: workload > 80% and <= 100% capacity
- OVERLOADED: workload > 100% capacity
- CONFLICT: overlapping assigned time windows
- UNASSIGNED: no personnel assigned
- OVERDUE: past planned endDate and not complete
- COMPLETED: status = COMPLETED
- CANCELLED: status = CANCELLED

### Conflict rules
1. Same personnel assigned to overlapping planned windows = CONFLICT
2. Same machine has overlapping planned windows = WARNING
3. Emergency requests may overlap but flagged
4. Completed/cancelled requests excluded from active conflict
5. Missing planned dates/projected with caution
6. Unassigned requests appear in unassigned queue

## Workload Components

### By Personnel
- personnel name, role, specialty
- assigned request count
- total estimated duration (minutes)
- daily capacity minutes
- workload percentage
- status (NORMAL/HIGH/OVERLOADED)
- conflict count
- active assignments list

### By Machine
- machine name, code, production line
- active request count
- total estimated duration
- conflict count
- current status

### By Production Line
- line name
- machine count
- active request count
- total estimated duration
- conflict count

### Unassigned Work
- requests with no assignedToId and no MaintenanceRequestAssignment records
- sorted by priority (CRITICAL first) then by createdAt

### Overdue Work
- requests with endDate < now() and status not COMPLETED/CANCELLED/CLOSED
- sorted by overdue duration

### SLA Due Work
- requests with completeDueAt in range and status not COMPLETED/CANCELLED/CLOSED
- sorted by earliest due date

### Overloaded Personnel
- personnel with workload > dailyCapacityMinutes
- sorted by overload percentage (highest first)

### Conflicts
- overlapping assignments for same personnel
- overlapping requests for same machine (same planned time windows)
- each conflict shows: personnel/machine, request A, request B, overlap duration
