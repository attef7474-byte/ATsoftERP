# Reports & Dashboard Proof

## Summary Endpoint (`GET /maintenance/dashboard/summary`)

### New KPIs Added

| KPI | Source | Description |
|---|---|---|
| `preventiveDueCount` | `MaintenanceSchedule` where status=ACTIVE AND startDate <= now | Count of due preventive schedules |
| `preventiveOverdueCount` | `MaintenanceSchedule` where status=ACTIVE AND startDate < now | Count of overdue preventive schedules |
| `preventiveCompletedCount` | `MaintenanceRequest` where type=PREVENTIVE AND status=COMPLETED | Count of completed preventive requests |
| `emergencyOpenCount` | `MaintenanceRequest` where isEmergency=true AND status=OPEN | Count of open emergency requests |
| `emergencyCompletedCount` | `MaintenanceRequest` where isEmergency=true AND status=COMPLETED | Count of completed emergency requests |

### Existing KPIs (Unchanged)
| KPI | Description |
|---|---|
| `openRequests` | Count of OPEN requests |
| `criticalRequests` | HIGH/URGENT priority OPEN/IN_PROGRESS |
| `overdueItems` | Overdue requests + schedules |
| `machinesUnderMaintenance` | Machines with status UNDER_MAINTENANCE |
| `currentDowntime` | Active downtime logs |
| `upcomingPreventive` | Schedules due within 30 days |
| `totalCost` / `totalCostThisMonth` | Cost aggregates |
| `totalRequests` / `completedRequests` | Request counts |
| `avgCompletionTimeHours` | Average completion time |
| `completionRate` | Percentage completed |
| `totalPersonnel` / `activeAssignments` | Personnel stats |

## New List Endpoints

### `GET /maintenance/dashboard/recent-generated-preventive?limit=5`
Returns most recent auto-generated preventive requests (filtered by description containing 'Auto-generated')

### `GET /maintenance/dashboard/recent-emergency?limit=5`
Returns most recent emergency requests (filtered by isEmergency=true)

## Data Integrity
- All counts are real-time database queries
- No hardcoded values, no fake data, no mock cards
- Filters use `deletedAt: null` to respect soft deletion
