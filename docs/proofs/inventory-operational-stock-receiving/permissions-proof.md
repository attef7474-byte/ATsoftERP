# Permissions Proof — Operational Stock Receiving

## Permissions Added (9 entries)
File: `apps/api/prisma/seed/seed-cmms-permissions.ts`

| Key | Module | Action |
|-----|--------|--------|
| inventory:operational-receipt:read | inventory:operational-receipt | read |
| inventory:operational-receipt:create | inventory:operational-receipt | create |
| inventory:operational-receipt:update | inventory:operational-receipt | update |
| inventory:operational-receipt:submit | inventory:operational-receipt | submit |
| inventory:operational-receipt:approve | inventory:operational-receipt | approve |
| inventory:operational-receipt:reject | inventory:operational-receipt | reject |
| inventory:operational-receipt:post | inventory:operational-receipt | post |
| inventory:operational-receipt:cancel | inventory:operational-receipt | cancel |
| inventory:operational-receipt:delete-draft | inventory:operational-receipt | delete-draft |

## Guard Enforcement
All endpoints use `@Permissions()` decorator with `PermissionsGuard`. SUPER_ADMIN role automatically gets all permissions via seed linkage.
