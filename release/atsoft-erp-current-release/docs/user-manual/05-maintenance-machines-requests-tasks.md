# Maintenance, Machines, Requests, and Tasks

> User Manual — Section 5

## Purpose

Manage machines/assets, parts, documents, maintenance requests, tasks, preventive maintenance, and downtime logs.

## Who Uses This

Maintenance team.

## Machines / Assets

### View Machines

1. Navigate to **Machines** under Maintenance
2. The list shows all registered machines/assets
3. Click a machine to view its card (details, status, location, warranty)

### Machine Categories

Categories organize machines by type (e.g., CNC, Pump, Conveyor).

## Machine Parts

1. Navigate to **Parts** under Maintenance
2. View spare parts catalog with stock levels

## Machine Documents

1. Navigate to **Documents** under Maintenance (per machine)
2. Uploaded manuals, diagrams, and certificates

## Maintenance Dashboard

A specialized dashboard for maintenance KPIs:
- Machines under maintenance
- Open requests
- Overdue tasks
- Upcoming preventive tasks
- Cost KPIs
- Critical machines

## Maintenance Requests

1. Navigate to **Requests** under Maintenance
2. Create a request when a machine needs attention
3. Track status: Open → In Progress → Completed

## Maintenance Tasks

1. Navigate to **Tasks** under Maintenance
2. Tasks are created from requests or preventive schedules
3. **My Tasks** shows tasks assigned to you
4. Tasks can be started and completed with notes

## Preventive Maintenance

1. Navigate to **Schedules** under Preventive
2. View upcoming and overdue preventive tasks
3. Calendar view shows scheduled maintenance

## Downtime Logs

1. Navigate to **Downtime** under Maintenance
2. Log machine downtime events with reasons
3. Analysis view shows downtime patterns

## Expected Result

- Machine list shows all assets
- Dashboard shows real KPIs
- Requests and tasks reflect current maintenance activity

## Permissions Required

- Machines: `maintenance:read`
- Requests/Tasks: `maintenance:read`
- Preventive: `maintenance:read`
- Downtime: `maintenance:read`

## Related API Routes

- `GET /api/v1/maintenance/machines`
- `GET /api/v1/maintenance/requests`
- `GET /api/v1/maintenance/tasks`
- `GET /api/v1/maintenance/schedules`
- `GET /api/v1/maintenance/downtime-logs`
- `GET /api/v1/maintenance/dashboard/summary`
