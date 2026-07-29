# Permissions Audit Proof — SLA Final Closure Patch

**Date**: 2026-07-29

## Change Summary

**No permission changes were made.**

## Existing SLA Permissions

The `MaintenanceSlaController` applies `@UseGuards(JwtAuthGuard, PermissionsGuard)` at class level.

Individual endpoint permissions:

| Endpoint | Permission Required |
|----------|-------------------|
| `POST /:requestId/calculate` | `maintenance-request:update` |
| `POST /:requestId/recalculate` | `maintenance-request:update` |
| `GET /:requestId` | `maintenance-request:read` |
| `GET /stats/overview` | `maintenance-request:read` |
| `GET /overdue/list` | `maintenance-request:read` |

All frontend API calls from the SLA page require `maintenance-request:read` which is a standard maintenance permission.

## Security

- No secrets printed or exposed
- No password hashes, JWT secrets, or tokens in proof docs
- API errors do not leak stack traces
- SQL Server errors are caught by Prisma/Nest exception filters
