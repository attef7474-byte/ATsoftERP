## Database Integrity & Counters Proof

- **Database**: SQL Server (LocalDB) — `ATsoftERP`
- **Date**: 2026-07-26
- **Migration Status**: 26/26 applied, database up to date

### Table Row Counts

| Table | Count | Status |
|-------|-------|--------|
| `maintenance_requests` | 44 | ✅ |
| `maintenance_schedules` | 26 | ✅ |
| `maintenance_personnel` | 31 | ✅ |
| `maintenance_assignments` | 41 | ✅ |
| `maintenance_machines` | 19 | ✅ |
| `maintenance_spare_parts` | 9 | ✅ |
| `production_lines` | 6 | ✅ |
| `machine_categories` | 6 | ✅ |
| `maintenance_downtime_logs` | 5 | ✅ |
| `maintenance_checklist_items` | 4 | ✅ |

### SLA Column Verification
All 6 SLA columns exist on `maintenance_requests` table:
| Column | Type |
|--------|------|
| `lastEscalatedAt` | `datetime2` |
| `responseDueAt` | `datetime2` |
| `startDueAt` | `datetime2` |
| `completeDueAt` | `datetime2` |
| `slaStatus` | `nvarchar(50)` |
| `escalationLevel` | `int` |

### Migration History
- Total migrations: **26**
- Status: **Database schema is up to date**
- Latest migration: `20260726200000_add_sla_fields_batch_m` (applied 2026-07-26)
- No unapplied or pending migrations

### Validation
- `prisma validate`: **Valid** 🚀
- `prisma migrate status`: **Database schema is up to date!**
- DB backup: Standard LocalDB auto-sync via Prisma migrations managed in version control
