# Backend Endpoints Proof: Preventive + Emergency Execution Flow

## New Endpoints

### 1. `POST /api/v1/maintenance/schedules/:id/generate-request`
- **Permission**: `maintenance-schedule:generateRequest`
- **Service**: `MaintenanceSchedulesService.generateRequest()`
- **Logic**:
  - Validates schedule is ACTIVE
  - Checks for existing OPEN/IN_PROGRESS requests for same machine/type
  - Increments number sequence `MAINTENANCE_REQUEST`
  - Creates a new `MaintenanceRequest` with type=schedule.type, priority=MEDIUM
  - Updates schedule: `lastGeneratedAt = now()`, `nextDueDate = calculated`, `requestId = null`
  - Next due date calculated from `intervalDays` or `frequency` (DAILY/WEEKLY/MONTHLY/QUARTERLY/YEARLY)
  - Returns created request

### 2. `POST /api/v1/maintenance/requests/emergency`
- **Permission**: `maintenance-request:createEmergency`
- **Service**: `MaintenanceRequestsService.createEmergency()`
- **Logic**:
  - Calls internal `createRequest()` with `isEmergency = true`
  - Automatically sets priority to HIGH
  - Creates a `DowntimeLog` linked to the emergency request
  - Returns created request with emergency flag

### 3. Enhanced `POST /api/v1/maintenance/preventive/generate-due-tasks`
- **Existing endpoint** updated in `PreventiveMaintenanceService.generateDueTasks()`
- **Logic enhancement**:
  - After creating each request, updates schedule: `lastGeneratedAt = now()`, `nextDueDate = calculated`
  - Resets `schedule.requestId = null` to allow future generation
  - Added `calculateNextDueDate()` helper

## Enhanced Query Parameters

### `GET /api/v1/maintenance/requests`
- Added `isEmergency` query filter (string: "true"/"false")

## Permissions Added

| Permission Key | Module | Action |
|---|---|---|
| `maintenance-schedule:generateRequest` | maintenance-schedule | generateRequest |
| `maintenance-request:createEmergency` | maintenance-request | createEmergency |

## Build Verification
- `npm run build` (API): ✅ Passed (0 errors)
- `npm run build` (Web): ✅ Passed (0 errors)
- Health check: ✅ `{"status":"ok","timestamp":"...","uptime":...}`
