# Users, Roles, and Permissions

> Admin Guide — Section 4

## Overview

ATsoft ERP uses a role-based access control (RBAC) system:
- **Users** are assigned to **roles**
- **Roles** have **permissions**
- **Permissions** grant access to specific actions (read, create, update, delete) on modules

## Default Roles

| Role | Description |
|------|-------------|
| SUPER_ADMIN | Full access to all modules and actions |
| USER | Limited access based on assigned permissions |

## Users

### Viewing Users

API: `GET /api/v1/users`
Web: Navigate to **Users** in the sidebar

### User Fields

- Email (used for login)
- Name
- Status (Active/Inactive)
- Assigned roles

## Roles

### Viewing Roles

API: `GET /api/v1/roles`
Web: Navigate to **Roles** in the sidebar

### Role Permissions

Each role has a set of permission strings:
- `module:action` (e.g., `users:read`, `inventory:create`)
- `module:*` gives all actions on a module

## Permissions

### Viewing Permissions

API: `GET /api/v1/permissions`
API: `GET /api/v1/permissions/grouped`
API: `GET /api/v1/permissions/modules`
API: `GET /api/v1/permissions/matrix`

### Permission Model

Every protected endpoint requires:
1. A valid JWT token (JwtAuthGuard)
2. The appropriate permission (PermissionsGuard)
3. SUPER_ADMIN bypasses all permission checks

## Public Endpoint Allowlist

Only the following endpoints are public (no authentication required):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/auth/login` | POST | User login |

All other endpoints require authentication.

## Summary

- JWT token obtained via login
- Token sent as `Authorization: Bearer <token>` header
- Protected endpoints return 401 without token
- Insufficient permissions return 403
- Batch 38 verified 46/46 endpoints correctly blocked unauthenticated access
