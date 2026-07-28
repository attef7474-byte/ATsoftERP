# Z-AA — Permissions/Audit Proof

## Permissions

New permission codes used by the controller:
- `spare-part-conditions:read` — for all GET endpoints
- `spare-part-conditions:create` — for POST movement endpoint

These permission codes follow the existing convention: `{module}:{action}`.

These permissions were seeded into the database via sqlcmd and assigned to SUPER_ADMIN role on 2026-07-28. Also added to `prisma/seed/seed.ts` `extraPermissions` array for future seed runs.

Verified in DB:
```sql
SELECT [key] FROM dbo.permissions WHERE [key] LIKE 'spare-part-conditions%';
-- spare-part-conditions:read
-- spare-part-conditions:create

SELECT p.[key] FROM dbo.role_permissions rp
JOIN dbo.permissions p ON p.id = rp.permissionId
WHERE rp.roleId = 'cmrl31uxa0003ok95t4refsnp' AND p.[key] LIKE 'spare-part-conditions%';
-- spare-part-conditions:read
-- spare-part-conditions:create
```

## Audit

Audit logging is handled by the caller (`MaintenanceStockIssueService`):
- Audit logs for stock issue/return already exist at `MaintenanceStockIssueService` level
- The `SparePartConditionService` does not add separate audit logging (movements are already recorded as database rows in `spare_part_condition_movements` table)
- The condition movement records themselves serve as immutable audit trail

## Guards

All endpoints are protected with:
- `@UseGuards(JwtAuthGuard, PermissionsGuard)` — class-level
- `@ApiBearerAuth()` — Swagger auth marker

## Security

- No secrets exposed
- No password hashes or tokens returned
- No SQL injection risk (Prisma parameterized queries)
- No stack traces leaked (NestJS exception filters handle error formatting)
- User IDs are extracted from JWT via `@CurrentUser('id')`
