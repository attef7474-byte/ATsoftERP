# Schema Migration Proof: Preventive + Emergency Execution Flow

## Changes Applied

### Migration: `20260726050155_add_schedule_next_due_and_request_emergency`

#### 1. `maintenance_requests` — Added `isEmergency`
```sql
ALTER TABLE [dbo].[maintenance_requests] ADD [isEmergency] BIT;
```
- Nullable boolean flag to mark emergency maintenance requests
- Default: NULL (not emergency)

#### 2. `maintenance_schedules` — Added `nextDueDate`, `lastGeneratedAt`
```sql
ALTER TABLE [dbo].[maintenance_schedules] ADD [nextDueDate] DATETIME2;
ALTER TABLE [dbo].[maintenance_schedules] ADD [lastGeneratedAt] DATETIME2;
```
- `nextDueDate`: Calculated next due date based on frequency/interval after request generation
- `lastGeneratedAt`: Timestamp of last request generation from this schedule
- Both nullable; backward compatible

### Prisma Schema Updates
- `model MaintenanceRequest`: Added `isEmergency Boolean?`
- `model MaintenanceSchedule`: Added `nextDueDate DateTime?` and `lastGeneratedAt DateTime?`

### Migration Status
- Migration file created: `prisma/migrations/20260726050155_add_schedule_next_due_and_request_emergency/migration.sql`
- Applied to database: ✅ via `prisma migrate deploy`
- Prisma Client regenerated: ✅ via `prisma generate`

## Verification
- `prisma migrate deploy`: All 20 migrations applied successfully
- `prisma generate`: Client regenerated without errors
