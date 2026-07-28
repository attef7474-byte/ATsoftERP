# Phase 9 — Security & Permissions Proof

## Permissions Added

| Key | Module | Action | Assigned To |
|-----|--------|--------|-------------|
| repair-orders:read | repair-orders | read | Super Administrator |
| repair-orders:create | repair-orders | create | Super Administrator |
| repair-orders:manage | repair-orders | manage | Super Administrator |
| repair-orders:complete | repair-orders | complete | Super Administrator |
| repair-orders:scrap | repair-orders | scrap | Super Administrator |
| repair-actions:read | repair-actions | read | Super Administrator |
| repair-actions:create | repair-actions | create | Super Administrator |

## Seed

Added to `apps/api/prisma/seed/seed.ts` `extraPermissions` array.

## DB Insertion

Permissions and role_permissions inserted via sqlcmd for "Super Administrator" role.

## Controller Protection

- All 17 endpoints use `@Permissions('repair-orders:*')` decorators
- Read endpoints: `repair-orders:read`
- Create endpoints: `repair-orders:create`
- Manage transitions: `repair-orders:manage`
- Complete transitions: `repair-orders:complete`
- Scrap: `repair-orders:scrap`
- Action endpoints: `repair-actions:read` / `repair-actions:create`
- All under `JwtAuthGuard` + `PermissionsGuard`

## Forbidden Module Check

❌ No Finance/Purchasing/Sales/HR activation
❌ No Workflow engine activation
❌ No unsafe direct stock mutation endpoint
❌ No direct InventoryBalance editing endpoint
✅ All stock-affecting transitions are backend-validated, permission-protected, and transactional

## Audit Events

All lifecycle transitions emit audit events:
- SPARE_PART_REPAIR_ORDER_CREATED
- SPARE_PART_REPAIR_IN_INSPECTION
- SPARE_PART_REPAIR_APPROVED_FOR_REPAIR
- SPARE_PART_REPAIR_UNDER_REPAIR
- SPARE_PART_REPAIR_UNDER_TEST
- SPARE_PART_REPAIR_COMPLETED_SERVICEABLE
- SPARE_PART_REPAIR_COMPLETED_PARTIAL
- SPARE_PART_REPAIR_SCRAPPED
- SPARE_PART_REPAIR_CANCELLED
- SPARE_PART_REPAIR_ACTION_ADDED
