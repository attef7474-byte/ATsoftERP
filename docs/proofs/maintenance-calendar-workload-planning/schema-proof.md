# Schema Changes — Batch N (Maintenance Calendar + Workload Planning)

## Migration 1: `20260726100000_add_maintenance_calendar_workload_fields`

### Changes

#### 1. `maintenance_requests` table
- Added `estimated_duration_minutes INT NULL` — estimated duration for planning
- Prisma field: `estimatedDurationMinutes Int? @map("estimated_duration_minutes")`

#### 2. `maintenance_personnel` table
- Added `daily_capacity_minutes INT NOT NULL DEFAULT 480` — daily capacity for workload calculation
- Prisma field: `dailyCapacityMinutes Int @default(480) @map("daily_capacity_minutes")`

### Safety
- All new columns are nullable or have safe defaults
- No existing data affected
- No indexes dropped or recreated
- No destructive operations

---

## Migration 2: `20260726200000_add_sla_fields_batch_m`

### Changes (Batch M SLA fields migrated as official Batch N migration)

#### `maintenance_requests` table — 6 new columns

| Column | Type | Nullable | Prisma Field |
|--------|------|----------|-------------|
| `responseDueAt` | DATETIME2 | YES | `responseDueAt DateTime?` |
| `startDueAt` | DATETIME2 | YES | `startDueAt DateTime?` |
| `completeDueAt` | DATETIME2 | YES | `completeDueAt DateTime?` |
| `slaStatus` | NVARCHAR(50) | YES | `slaStatus String? @default("ON_TRACK")` |
| `escalationLevel` | NVARCHAR(50) | YES | `escalationLevel String? @default("NONE")` |
| `lastEscalatedAt` | DATETIME2 | YES | `lastEscalatedAt DateTime?` |

### Drift Resolution
- Columns were added to Prisma schema during Batch M but migration was never created
- Manual `ALTER TABLE` applied via `prisma db execute` on 2026-07-26
- Migration folder created: `prisma/migrations/20260726200000_add_sla_fields_batch_m/`
- Migration registered via `prisma migrate resolve --applied`
- All 6 columns verified present in SQL Server `INFORMATION_SCHEMA.COLUMNS`
- `prisma migrate status`: Database schema is up to date (26/26 migrations)
- `prisma validate`: Valid
- No `prisma db push` used
- No `prisma migrate reset` used
- No data loss
