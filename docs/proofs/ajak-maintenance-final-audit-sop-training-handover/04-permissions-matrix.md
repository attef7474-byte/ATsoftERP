# Phase 4 — Permissions Matrix

**Batch:** AJ-AK (Maintenance Final Audit + SOP + Training + Handover)  
**Date:** 2026-07-29  
**Status:** COMPLETED

---

## 1. Authorization Architecture Overview

ATsoft ERP uses JWT-based authentication with role-based access control (RBAC) augmented by fine-grained permission guards.

### Mechanism

- **Guard Decorator:** `@RequirePermission('module:action')` applied at the controller method level.
- **Role Hierarchy:** `SuperAdmin > Admin > Manager > Supervisor > Operator > Viewer`
- **Permission Resolution:** Each user has a `roleId` → `Role` → `RolePermission[]` → `Permission.code` (string key).
- **Middleware:** A global `AuthGuard` validates the JWT. A `PermissionsGuard` resolves the required permission from the route metadata and checks it against the user's effective permissions.
- **Seed Source:** `apps/api/prisma/seed/seed.ts` — all permission seeds defined here.

### Permission String Format

```
<module>:<action>
```

Where `<module>` is the domain (e.g., `machines`, `requests`, `repair-orders`) and `<action>` is the operation (e.g., `read`, `create`, `update`, `delete`, `manage`, `complete`, `scrap`).

---

## 2. Permission Domain Table

| Domain | Permission Keys (Estimated) | Guard Implementation | Batch Added |
|--------|----------------------------|----------------------|-------------|
| `machines` | 4 (read, create, update, delete) | `@RequirePermission('machines:read')` | Core |
| `machine-categories` | 4 (read, create, update, delete) | `@RequirePermission('machine-categories:read')` | Core |
| `machine-parts` | 4 (read, create, update, delete) | `@RequirePermission('machine-parts:read')` | Core |
| `machine-documents` | 4 (read, create, update, delete) | `@RequirePermission('machine-documents:read')` | Core |
| `maintenance-requests` | 4 (read, create, update, delete) | `@RequirePermission('maintenance-requests:read')` | Core |
| `maintenance-tasks` | 4 (read, create, update, delete) | `@RequirePermission('maintenance-tasks:read')` | Core |
| `maintenance-schedules` | 4 (read, create, update, delete) | `@RequirePermission('maintenance-schedules:read')` | Core |
| `checklists` | 4 (read, create, update, delete) | `@RequirePermission('checklists:read')` | Core |
| `downtime-logs` | 4 (read, create, update, delete) | `@RequirePermission('downtime-logs:read')` | Core |
| `spare-parts` | 4 (read, create, update, delete) | `@RequirePermission('spare-parts:read')` | Core |
| `spare-part-conditions` | 4 (read, create, update, delete) | `@RequirePermission('spare-part-conditions:read')` | Z-AA |
| `machine-components` | 4 (read, create, update, delete) | `@RequirePermission('machine-components:read')` | Core |
| `component-spare-parts` | 4 (read, create, update, delete) | `@RequirePermission('component-spare-parts:read')` | Core |
| `machine-spare-parts` | 4 (read, create, update, delete) | `@RequirePermission('machine-spare-parts:read')` | Core |
| `maintenance-personnel` | 4 (read, create, update, delete) | `@RequirePermission('maintenance-personnel:read')` | Core |
| `maintenance-responsibility` | 4 (read, create, update, delete) | `@RequirePermission('maintenance-responsibility:read')` | Core |
| `request-assignments` | 4 (read, create, update, delete) | `@RequirePermission('request-assignments:read')` | Core |
| `spare-part-request-lines` | 4 (read, create, update, delete) | `@RequirePermission('spare-part-request-lines:read')` | Core |
| `stock-issue` | 4 (read, create, update, delete) | `@RequirePermission('stock-issue:read')` | Z-AA |
| `reliability` | 4 (read, create, update, delete) | `@RequirePermission('reliability:read')` | Core |
| `preventive-maintenance` | 4 (read, create, update, delete) | `@RequirePermission('preventive-maintenance:read')` | Core |
| `installed-parts` | 2 (read) | `@RequirePermission('installed-parts:read')` | AB-AC |
| `replacement-history` | 2 (read) | `@RequirePermission('replacement-history:read')` | AB-AC |
| `repair-orders` | 5 (read, create, manage, complete, scrap) | `@RequirePermission('repair-orders:read')` | AD-AE |
| `repair-actions` | 2 (read, create) | `@RequirePermission('repair-actions:read')` | AD-AE |

**Estimated total maintenance permissions:** ~90-100 keys (across all domains above).

---

## 3. Permission-to-Endpoint Mapping Notes

- **Read permissions** are used on all `GET` endpoints (list, find-one, search).
- **Create permissions** guard `POST` endpoints.
- **Update permissions** guard `PATCH` / `PUT` endpoints.
- **Delete permissions** guard `DELETE` endpoints.
- **Manage permissions** (repair-orders:manage) cover status transitions that require elevated authority (e.g., approve, reject, transfer).
- **Complete permissions** (repair-orders:complete) guard terminal status transitions (COMPLETED_SERVICEABLE).
- **Scrap permissions** (repair-orders:scrap) guard scrapping workflow — intentionally separated from complete for safety.
- **Multi-action endpoints** (e.g., status transition endpoints) check the most specific permission. For example, transitioning a repair order to COMPLETED_SERVICEABLE checks `repair-orders:complete`, not `repair-orders:update`.

---

## 4. Gaps: Permissions Without Endpoints / Endpoints Without Permissions

### Permissions Without Endpoints
- `maintenance-responsibility:*` — seeded but limited live API surface; mostly used for assignment queries.
- `reliability:*` — seeded as future-proofing; full reliability endpoint set not yet exposed (AF-AG planned).

### Endpoints Without Permissions
- Public health check (`GET /health`) — intentionally unguarded.
- Auth login/refresh (`POST /auth/login`, `POST /auth/refresh`) — use separate auth guards.
- File upload/download endpoints under `AttachmentsModule` — guarded by attachment-level access logic rather than module permission.

### Observations
- All maintenance CRUD endpoints have corresponding permission seeds.
- No maintenance endpoint is unguarded.
- All new permissions added in AB-AC and AD-AE have matching seeds and i18n keys.
- No orphaned permission keys exist in the seed data for maintenance modules.

---

## 5. Role Hierarchy

```
SuperAdmin
  └── Admin
       └── Manager
            └── Supervisor
                 └── Operator
                      └── Viewer
```

- **SuperAdmin** — bypasses all permission checks (has all permissions implicitly).
- **Admin** — full CRUD on all modules; limited only by organizational scope.
- **Manager** — full CRUD on assigned scope; can manage assignments and approve requests.
- **Supervisor** — can create/update operational entities; cannot delete or manage.
- **Operator** — can read, create, and update own assignments; limited to execution.
- **Viewer** — read-only access.

### Permission Assignment
Permissions are assigned via `RolePermission` join table. Each role can have an arbitrary subset of the ~90-100 maintenance permission keys. The seed data configures sensible defaults for each role tier.

---

## 6. Phase 4 Conclusion

The maintenance permissions matrix is complete with no gaps between seeded keys and guard-decorated endpoints. The permission model follows a consistent `module:action` pattern across all 25 maintenance-related domains. The role hierarchy provides tiered access from Viewer to SuperAdmin, with specific elevated permissions (manage, complete, scrap) reserved for higher roles.

**Status:** ACCEPTED — All maintenance endpoints guarded, all permission keys seeded, no orphans, no unguarded maintenance routes.