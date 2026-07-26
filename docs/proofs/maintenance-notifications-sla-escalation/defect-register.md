# Defect Register — Batch M (Maintenance Notifications + SLA Escalation)

## Open Defects

| # | Severity | Description | Status | Notes |
|---|---|---|---|---|
| 1 | LOW | External email/SMS infrastructure does not exist | ACCEPTED | In-app notifications only; documented as N/A |
| 2 | LOW | `prisma migrate dev` fails on SQL Server shadow database | ACCEPTED | Manual SQL migration + prisma db execute + migrate resolve workaround |
| 3 | CLOSED | Smoke test API login failure (pre-existing) | RESOLVED | Smoke script requires `-Password` param from `.env` `SEED_ADMIN_PASSWORD`; 8/8 passes when provided |

## Closed During Development

| # | Severity | Description | Resolution |
|---|---|---|---|
| 1 | HIGH | `RequirePermissions` decorator not found | Changed to `Permissions` from auth/decorators |
| 2 | HIGH | `maintenanceSlaRule` / `maintenanceSlaState` not in Prisma client | Fixed by adding models to schema + prisma generate |
| 3 | HIGH | SLA fields not in `MaintenanceRequest` type | Fixed by adding fields to Prisma schema model + regenerate |
| 4 | HIGH | FK column NVARCHAR(255) vs NVARCHAR(1000) mismatch | Fixed migration SQL to use NVARCHAR(1000) |
| 5 | MEDIUM | TS strict null check on `responseOverdueMin` | Added `?? 0` default values |
| 6 | MEDIUM | Missing opposite relation on MaintenanceRequest for slaState | Added `slaState MaintenanceSlaState?` field |
| 7 | LOW | Migration SQL executed twice (columns already exist) | Added IF NOT EXISTS guards to migration SQL |
| 8 | LOW | Notification bell file path differed from expectation | Located at components/admin/notifications/notification-bell.tsx |
