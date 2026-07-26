# Batch N — Maintenance Calendar + Workload Planning Audit

## Existing State

### Models/ Tables

| Area | Model/Table | Page | API | Current behavior | Missing behavior | Needs migration | Needs backend | Needs frontend | HR risk | Stock/finance risk | Decision | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Maintenance Request | `MaintenanceRequest` (startDate, endDate, status, type, priority, machineId, productionLineId, assignedToId, slaStatus, escalationLevel, responseDueAt, startDueAt, completeDueAt) | `requests/[id]/page.tsx` | `maintenance/requests/*` | Tracks work orders with planned/actual dates | No plannedStartAt/plannedEndAt distinction, no estimatedDurationMinutes | Add `estimatedDurationMinutes` | Extend for planning | Add planning fields to request form | NONE | NONE | Add nullable Int? | PENDING |
| Maintenance Schedule | `MaintenanceSchedule` (startDate, endDate, nextDueDate, frequency, intervalDays, machineId, status) | `schedules/*` | `maintenance/schedules/*` | Preventive schedules with frequency/interval | No calendar event generation from schedules | NONE | Add calendar event generation | NONE | NONE | NONE | Reuse as-is | PENDING |
| Maintenance Personnel | `MaintenancePersonnel` (operationalPersonId, role, specialty, isActive) | `personnel/page.tsx` | `maintenance/personnel/*` | Tracks maintenance workers | No capacity/ workload fields | Add `dailyCapacityMinutes` | Extend for workload | Add capacity field to personnel | NONE | NONE | Add Int @default(480) | PENDING |
| Maintenance Request Assignment | `MaintenanceRequestAssignment` (maintenanceRequestId, maintenancePersonnelId, status, assignedAt, startedAt, completedAt) | `requests/[id]/page.tsx` (Assign tab) | `maintenance/request-assignments/*` | Per-personnel assignment with status workflow | No workload calculation from assignments | NONE | Compute workload from assignments | Show workload by personnel | NONE | NONE | Reuse as-is | PENDING |
| Machine Responsibility | `MachineResponsibilityAssignment` (machineId, maintenancePersonnelId, isPrimary) | `machine-responsibilities/page.tsx` | `maintenance/machine-responsibilities/*` | Links personnel to machines | No workload by machine | NONE | Compute machine workload | NONE | NONE | NONE | Reuse as-is | PENDING |
| Preventive Calendar | NONE (computed in controller) | `preventive/calendar/page.tsx` | `maintenance/preventive/calendar` | Basic month grid showing schedules | No work orders, no assignment, no drag/drop | NONE | Build unified calendar API | Replace with unified calendar | NONE | NONE | Build new | PENDING |
| SLA State | `MaintenanceSlaState` (responseDueAt, startDueAt, completeDueAt, slaStatus, overdueMin) | Request detail SLA badge | `maintenance/sla/*` | SLA tracking per request | No SLA due list in planning | NONE | Add SLA due to workload | Add SLA due planning view | NONE | NONE | Reuse as-is | PENDING |
| Notifications | `Notification` (userId, title, type, read, link) | Notification bell/dropdown/center | `notifications/*` | In-app notification dispatch | No calendar planning notifications | NONE | Add planning event notifications | NONE | NONE | NONE | Reuse as-is | PENDING |
| Maintenance Dashboard | Computed summary | `dashboard/page.tsx` | `maintenance/dashboard/summary` | 11 KPI cards with real data | No planning/workload KPIs | NONE | Add planning KPIs | Add planning KPI cards | NONE | NONE | Extend | PENDING |
| Main Dashboard | Computed summary | `admin/dashboard/page.tsx` | `alerts/summary` | 3 SLA KPI cards | No planning/workload cards | NONE | Add planning KPIs | Add planning cards | NONE | NONE | Extend | PENDING |
| Permissions | String literals on controllers | Client-side checks | via JwtAuthGuard + PermissionsGuard | `resource:action` pattern | No calendar/planning/workload permissions | NONE | Add new permissions | Add permission checks | NONE | NONE | Add permissions | PENDING |
| i18n | `maintenance.ts` (7 namespaces) | All maintenance pages | N/A | AR/EN parity | No calendar/workload keys | NONE | NONE | Add i18n keys | NONE | NONE | Add keys | PENDING |

## Decision Summary
1. Add `MaintenancePersonnel.dailyCapacityMinutes` (Int, default 480) — safe capacity field
2. Add `MaintenanceRequest.estimatedDurationMinutes` (Int?) — planning field
3. Build computed calendar events from existing requests/schedules/assignments
4. Build computed workload from existing assignments/responsibilities
5. Build conflict detection from overlapping assignments
6. Extend dashboard with planning KPIs
7. Add permissions: maintenance-calendar:read/update, maintenance-workload:read/manage, maintenance-planning:read/update/assign/reschedule
8. Add i18n keys for all calendar/workload/planning terms

## Non-Impact
- HR: Not activated. Uses MaintenancePersonnel only.
- Stock: No movements. No balance changes.
- Finance: No entries. No cost posting.
- Warehouse: No movements.
