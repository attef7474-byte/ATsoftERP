# Schema Migration Proof — Maintenance Downtime + Failure + RCA + Reliability KPIs

## Migration
- File: `20260726073000_add_downtime_rca_reliability_fields`
- Type: Safe nullable addition (no destructive changes)
- Status: Applied to SQL Server WINCC:50079 / ATsoftERP_DB

## Changes to DowntimeLog model

| # | Field | Type | Nullable | Default | Purpose |
|---|---|---|---|---|---|
| 1 | failureCause | NVARCHAR(1000) | YES | NULL | Structured failure cause description |
| 2 | failureCategory | NVARCHAR(100) | YES | NULL | Category (MECHANICAL, ELECTRICAL, etc.) |
| 3 | rootCause | NVARCHAR(2000) | YES | NULL | Root cause analysis result |
| 4 | correctiveAction | NVARCHAR(2000) | YES | NULL | Corrective action taken |
| 5 | preventiveAction | NVARCHAR(2000) | YES | NULL | Preventive action recommended |
| 6 | detectedAt | DATETIME2 | YES | NULL | When failure was detected |
| 7 | responseStartedAt | DATETIME2 | YES | NULL | When response started |
| 8 | repairStartedAt | DATETIME2 | YES | NULL | When repair started |
| 9 | repairCompletedAt | DATETIME2 | YES | NULL | When repair completed |
| 10 | isRepeatFailure | BIT | YES | NULL | Whether this is a repeat failure |
| 11 | repeatedFailureGroupId | NVARCHAR(100) | YES | NULL | Group ID for linking repeat failures |
| 12 | machineStopped | BIT | YES | NULL | Whether machine was stopped |
| 13 | productionImpact | NVARCHAR(1000) | YES | NULL | Description of production impact |
| 14 | rcaStatus | NVARCHAR(50) | YES | 'PENDING' | PENDING / IN_PROGRESS / COMPLETED |
| 15 | rcaCompletedByUserId | NVARCHAR(1000) | YES | NULL | FK to User who completed RCA |
| 16 | rcaCompletedAt | DATETIME2 | YES | NULL | When RCA was completed |

## New Foreign Key
- `FK_downtime_logs_rcaCompletedByUserId`: `downtime_logs.rcaCompletedByUserId` → `users.id` (NO ACTION on delete/update)

## New Indexes
- `downtime_logs_failureCategory_idx` on `failureCategory`
- `downtime_logs_rcaStatus_idx` on `rcaStatus`

## Prisma Schema Changes
- `DowntimeLog` model: 16 new nullable fields added
- `User` model: new `rcaCompletedDowntimeLogs` relation added

## Data Integrity
- All new fields are nullable: existing rows unaffected
- No existing data modified
- No destructive migration
- No reset
- Migration applied via `prisma db execute` and marked resolved

## Verification
- `prisma validate`: ✅ PASS
- `prisma generate`: ✅ PASS
- `prisma migrate status`: Database schema is up to date
- SQL Server columns verified: 27 total columns (11 original + 16 new)
