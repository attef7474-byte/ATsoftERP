# Security Proof

## Authentication
- All maintenance endpoints protected by `JwtAuthGuard`
- Unauthenticated requests receive **401 Unauthorized**
- Invalid/expired tokens receive **401 Unauthorized**

## Authorization
- All endpoints use `@Permissions()` decorator with `PermissionsGuard`
- Authenticated users without required permission receive **403 Forbidden**
- Permission names follow convention: `<module>:<action>`
- New permissions added to seed for all new endpoints

## Input Validation
- All DTOs use `class-validator` decorators
- UUID validation via `ParseUUIDPipe` on ID parameters
- String/enum validation on status transitions
- Invalid transitions return **400 BadRequest** with descriptive message

## Data Integrity
- Soft delete (`deletedAt`) used for requests
- Audit logs created for all state-changing operations
- Transactional operations prevent partial updates
- Foreign key constraints enforced at database level

## Security Checklist
| Check | Result |
|---|---|
| No API keys or secrets exposed | ✅ |
| No hardcoded credentials | ✅ |
| Input validation on all endpoints | ✅ |
| Authorization on all endpoints | ✅ |
| No SQL injection vectors (Prisma ORM) | ✅ |
| No mass assignment vulnerabilities | ✅ |
| CORS configured | ✅ |
| Rate limiting available | ✅ |

## No Sensitive Data Exposure
- Audit logs track actions, not passwords
- User IDs used internally, not exposed
- Request numbers are sequential but prefixed
