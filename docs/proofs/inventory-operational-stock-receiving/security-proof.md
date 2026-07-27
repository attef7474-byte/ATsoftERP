# Security Proof — Operational Stock Receiving

## Authentication
All endpoints protected by `JwtAuthGuard` — requires valid JWT token.

## Authorization
All endpoints protected by `PermissionsGuard` with specific `@Permissions()` decorators matching the 9 permissions defined in seed.

## Audit Logging
All status transitions and CRUD operations logged via `AuditService.log()`:
- CREATE, UPDATE, DELETE on document
- SUBMIT, APPROVE, REJECT, POST, CANCEL status transitions
- ADD_LINE, UPDATE_LINE, REMOVE_LINE on lines

## Data Isolation
- Soft delete via `deletedAt` field — no data loss
- All queries filter `deletedAt: null` for active records
