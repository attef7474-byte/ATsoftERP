# Defect Register: User ↔ OperationalPerson Unique Link Hardening

## Status: CLEAN

| # | Date | Severity | Description | Status | Resolution |
|---|------|----------|-------------|--------|------------|
| 1 | 2026-07-25 | BLOCKER | `prisma db execute` cannot parse multi-step DDL in single file (SQL Server batch separator issue) | RESOLVED | Split migration into manual Node.js script using `$executeRawUnsafe` |
| 2 | 2026-07-25 | BLOCKER | `DROP CONSTRAINT maintenance_personnel_code_key` failed — constraint depends on `code` column | RESOLVED | Dropped constraint + indexes before dropping columns |
| 3 | 2026-07-25 | BLOCKER | `DROP COLUMN userId` failed — FK constraint `maintenance_personnel_userId_fkey` exists | RESOLVED | Dropped FK constraint before dropping column |
| 4 | 2026-07-25 | MAJOR | 16 TypeScript errors after schema change | RESOLVED | Refactored 5 backend services to use `operationalPerson` relation with response mapping |

### Known Limitations
- `maintenance_personnel` groupBy on `code`/`name` is no longer possible — use `operationalPerson` path
- In-memory sorting may be needed for code/name in some edge cases where Prisma does not support relation field sort
