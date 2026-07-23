# Permissions Proof — Batch D: Machine Components

## New Permissions Added

Six new permissions were added to the CMMS permissions seed file:

| Key | Module | Action | Description |
|-----|--------|--------|-------------|
| machine-component:create | machine-component | create | Create machine components |
| machine-component:read | machine-component | read | View/list machine components |
| machine-component:update | machine-component | update | Update machine components |
| machine-component:delete | machine-component | delete | Soft-delete machine components |
| machine-component:activate | machine-component | activate | Activate machine components |
| machine-component:deactivate | machine-component | deactivate | Deactivate machine components |

## Seed Execution
- Command: `ts-node prisma/seed/seed-cmms-permissions.ts`
- Result: 64 new permissions added across all batches; 6 new machine-component permissions
- Total linked to SUPER_ADMIN: 304

## Endpoint Authorization

| Endpoint | Required Permission |
|----------|-------------------|
| POST /machine-components | machine-component:create |
| GET /machine-components | machine-component:read |
| GET /machine-components/:id | machine-component:read |
| PATCH /machine-components/:id | machine-component:update |
| DELETE /machine-components/:id | machine-component:delete |
| PATCH /machine-components/:id/activate | machine-component:activate |
| PATCH /machine-components/:id/deactivate | machine-component:deactivate |

## Guard Configuration
All endpoints are protected by both `JwtAuthGuard` and `PermissionsGuard` at the controller class level.
