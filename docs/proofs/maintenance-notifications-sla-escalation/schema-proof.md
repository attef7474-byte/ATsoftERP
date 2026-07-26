# Schema Proof — Maintenance Notifications + SLA Escalation (Batch M)

## Prisma Models

### MaintenanceRequest — New SLA fields (all nullable)
- `responseDueAt DateTime?` — SLA deadline for first response
- `startDueAt DateTime?` — SLA deadline for work start
- `completeDueAt DateTime?` — SLA deadline for completion
- `slaStatus String?` — ON_TRACK / OVERDUE
- `escalationLevel String?` — NONE / LEVEL_1 / LEVEL_2 / LEVEL_3
- `lastEscalatedAt DateTime?` — timestamp of last escalation

### MaintenanceSlaRule (new)
- `id`, `name`, `priority`, `type`, `responseHours`, `startHours`, `completeHours`
- `escalationDelayHours`, `escalationLevels`, `isActive`
- Indexes: priority, type, isActive

### MaintenanceSlaState (new, 1:1 with MaintenanceRequest)
- `maintenanceRequestId` (unique FK), `responseDueAt`, `startDueAt`, `completeDueAt`
- `slaStatus`, `escalationLevel`, `lastEscalatedAt`
- `responseActualAt`, `startActualAt`, `completeActualAt` — actual timestamps
- `responseOverdueMin`, `startOverdueMin`, `completeOverdueMin` — overdue duration
- Indexes: maintenanceRequestId (unique), slaStatus, escalationLevel

### Notification — Unchanged
- Existing model reused. Fields: userId, title, message, type, read, link, createdAt

## Migration
File: `20260726090001_add_maintenance_sla_and_notification_hooks/migration.sql`
- All ALTER TABLE use IF NOT EXISTS guards
- New tables use IF NOT EXISTS guards
- FK on maintenance_sla_states uses NVARCHAR(1000) to match existing column type
- prisma db execute ✅
- prisma migrate resolve ✅
- prisma validate ✅

## Verification
- All new fields nullable — no existing data breakage
- No shadow database required — manual SQL migration
- prisma generate ✅
