# DB Integrity Proof — AH-AI

## Pre-Migration State
| Metric | Value |
|--------|-------|
| Total tables | 85 |
| Total columns | 1,242 |
| Number sequences | 47 |

## Post-Migration State
| Metric | Value |
|--------|-------|
| Total tables | 90 |
| Total columns | 1,295 |
| Number sequences | 49 |

## New Tables

| Table | Columns | Verdict |
|-------|---------|---------|
| maintenance_boms | 10 | ✅ |
| maintenance_bom_versions | 10 | ✅ |
| maintenance_bom_items | 10 | ✅ |
| preventive_spare_part_plans | 11 | ✅ |
| preventive_spare_part_plan_items | 12 | ✅ |

## Constraints Verified
- Primary keys on all 5 tables ✅
- Foreign keys to machines, machine_components, users, spare_parts, maintenance_schedules, maintenance_requests ✅
- Unique constraints on code (maintenance_boms), planNumber (preventive_spare_part_plans), bomId+versionNumber (maintenance_bom_versions) ✅
- Indexes on all FK columns ✅

## Prisma Validation
- `npx prisma validate`: PASS ✅
- `npx prisma generate`: PASS ✅

## Migration Script
`apps/api/prisma/migrations/ahai_bom_versioning_preventive_spareparts_planning.sql`

**Additive only** — no destructive changes, no table drops, no column drops.

## Data Safety
- No existing data modified
- No seed data altered
- All constraints are NO ACTION (no cascade)
- Soft delete pattern for BOMs (deletedAt column)

## DB Integrity: PASS ✅
