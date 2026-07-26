# Backend Source Changes: Modified Files

## 1. `prisma/schema.prisma`
- Added `isEmergency Boolean?` to `MaintenanceRequest`
- Added `nextDueDate DateTime?` and `lastGeneratedAt DateTime?` to `MaintenanceSchedule`

## 2. `prisma/seed/seed-cmms-permissions.ts`
- Added `maintenance-schedule:generateRequest` permission
- Added `maintenance-request:createEmergency` permission

## 3. `preventive-maintenance/preventive-maintenance.service.ts`
- Updated `generateDueTasks()` to:
  - Set `lastGeneratedAt = now()` and `nextDueDate = calculated` on schedule after generation
  - Reset `schedule.requestId = null` for future generation
- Added private `calculateNextDueDate()` helper

## 4. `maintenance-schedules/maintenance-schedules.service.ts`
- Added `generateRequest(id, userId)` method for single-schedule request generation
- Added private `calculateNextDueDate()` helper
- Added `BadRequestException` to imports

## 5. `maintenance-schedules/maintenance-schedules.controller.ts`
- Added `POST :id/generate-request` endpoint with permission `maintenance-schedule:generateRequest`

## 6. `maintenance-requests/maintenance-requests.service.ts`
- Refactored `create()` to delegate to private `createRequest()` with `isEmergency` parameter
- Added `createEmergency()` method: creates request with emergency flag + downtime log
- Added `isEmergency?: string` to `findAll()` query type
- Added `isEmergency` filter in `findAll()` where clause

## 7. `maintenance-requests/maintenance-requests.controller.ts`
- Added `POST emergency` endpoint with permission `maintenance-request:createEmergency`
- Added `isEmergency?: string` to `findAll()` query parameters
