# Security Proof

## Authentication & Authorization

- All maintenance endpoints protected by `@UseGuards(JwtAuthGuard, PermissionsGuard)`
- JwtAuthGuard validates JWT tokens from Authorization header
- PermissionsGuard checks user roles and permission keys
- SUPER_ADMIN has unconditional access to all permissions

## Protection Coverage

| Threat | Mitigation | Status |
|--------|-----------|--------|
| No token | JwtAuthGuard returns 401 | IMPLEMENTED |
| Expired token | JwtAuthGuard validates expiry | IMPLEMENTED |
| Tampered token | JwtAuthGuard validates signature | IMPLEMENTED |
| Missing permission | PermissionsGuard returns 403 | IMPLEMENTED |
| Invalid UUID | ParseUUIDPipe returns 400 | IMPLEMENTED |
| SQL injection | Prisma parameterized queries | INHERENT |
| XSS | React auto-escaping + API validation | INHERENT |

## Data Safety

- No destructive cascade deletes - dependency checks prevent deletion of referenced records
- Referenced records protected by ConflictException (409)
- Soft delete preferred (7 of 15 use deletedAt timestamp)
- Password hashes never exposed (bcrypt)
- JWT secrets stored in environment variables

## Module Isolation

- HR module: INACTIVE (not enabled, no changes made)
- Finance module: INACTIVE (not enabled, no changes made)
- BI module: INACTIVE (not enabled, no changes made)
- Only Maintenance module affected by this corrective
