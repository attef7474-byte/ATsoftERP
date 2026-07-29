# 03 — Schema and Access Model Proof

## Decision

The existing `User.companyId`, `User.branchId`, and `User.departmentId` fields
represent one legacy assignment only. `UserRole` and `RolePermission` do not
contain operational scope data. Normal users therefore cannot be granted more
than one allowed company/branch context without an additive access model.

This batch will add one SQL Server-safe model:

`UserOperationalScope`

Each active scope belongs to one user and one required company/branch pair.
Administration and department are optional restrictions. The record also
contains `isDefault`, `status`, timestamps, and `deletedAt`. Foreign keys use
`NO ACTION`; no existing table, column, row, migration, or relation is removed.

## Resolution Rules

1. An active `SUPER_ADMIN` receives the current set of active
   company/branch combinations dynamically.
2. A normal user with active explicit scope rows receives only those rows.
3. A normal user with no explicit rows falls back to the existing
   `User.companyId` / `User.branchId` / `User.departmentId` assignment.
4. A normal user with neither a valid explicit scope nor a complete legacy
   company/branch pair receives no operational context.
5. `branchId = null` never means all branches for a normal user.
6. Company, branch, optional administration, and optional department
   relationships are validated before a context is accepted.
7. Inactive or soft-deleted users, roles, scopes, or organization records do
   not grant access.
8. The context source is computed as `SUPER_ADMIN`, `EXPLICIT_SCOPE`, or
   `LEGACY_USER_ASSIGNMENT`; it is not persisted.

## Pre-migration Database Counters

Read-only checks were executed against the configured local SQL Server
database. The connection string and credentials were not printed.

| Counter | Before |
|---|---:|
| User tables | 90 |
| User-table columns | 1295 |
| Non-deleted users | 3 |
| Non-deleted companies | 6 |
| Non-deleted branches | 5 |
| Non-deleted administrations | 3 |
| Non-deleted departments | 4 |
| `user_operational_scopes` table exists | 0 |

The 90 SQL tables include Prisma migration tracking; the current Prisma schema
contains 89 application models.

## Migration Safety Contract

- Additive table, indexes, and foreign keys only.
- SQL Server 2016-compatible idempotent checks.
- Explicit transaction with rollback on error.
- No `prisma db push`.
- No `prisma migrate dev`.
- No `prisma migrate reset`.
- No drop, truncate, delete, destructive seed, or data rewrite.
- Existing user assignment columns remain intact for compatibility and
  fallback.
- Post-migration counters, foreign-key checks, Prisma validation/generation,
  builds, tests, and DB integrity proof are mandatory before acceptance.

## Result

The migration was applied through the installed SQL Server `sqlcmd` client.
The first executable attempt failed on a required filtered-index session
setting and rolled back its transaction. A second attempt with shortened
foreign-key columns also rolled back because SQL Server requires matching FK
lengths. The final script sets the required SQL options, keeps FK lengths
identical to the existing schema, and completed successfully.

| Counter | Before | After |
|---|---:|---:|
| User tables | 90 | 91 |
| User-table columns | 1295 | 1307 |
| Non-deleted users | 3 | 3 |
| Non-deleted companies | 6 | 6 |
| Non-deleted branches | 5 | 5 |
| Non-deleted administrations | 3 | 3 |
| Non-deleted departments | 4 | 4 |
| Operational scope rows | N/A | 0 |
| Operational scope foreign keys | N/A | 5 |
| Operational scope indexes | N/A | 9 |
| Migration tracking rows | 0 | 1 |

No business row was inserted, updated, or deleted. Existing assignments remain
the only fallback until explicit scope rows are administered.

Schema decision and migration: **PASS**.
