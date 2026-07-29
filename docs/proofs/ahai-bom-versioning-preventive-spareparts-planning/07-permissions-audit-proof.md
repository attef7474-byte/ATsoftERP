# Permissions + Audit Proof — AH-AI

## New Permissions

Seeded via `seed.ts` loop (MODULES array) + extraPermissions:

### Module: `maintenance-bom`
| Permission Key | Action |
|---------------|--------|
| maintenance-bom:create | create |
| maintenance-bom:read | read |
| maintenance-bom:update | update |
| maintenance-bom:delete | delete |

### Module: `preventive-spare-part-plan`
| Permission Key | Action |
|---------------|--------|
| preventive-spare-part-plan:create | create |
| preventive-spare-part-plan:read | read |
| preventive-spare-part-plan:update | update |
| preventive-spare-part-plan:delete | delete |

Total new permissions: 8

**DB verification:** `SELECT COUNT(*) FROM permissions WHERE module IN ('maintenance-bom','preventive-spare-part-plan')` → 8 ✅

## Audit Logging

Both services inject `AuditService` and log on every mutation:

| Service | Events Logged |
|---------|--------------|
| MaintenanceBomService | CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE, CREATE_VERSION, ACTIVATE_VERSION, ADD_ITEM, UPDATE_ITEM, REMOVE_ITEM |
| PreventiveSparePartPlanService | CREATE, UPDATE, DELETE, STATUS_ACTIVE, STATUS_COMPLETED, STATUS_CANCELLED, GENERATE_FROM_SCHEDULE, ADD_ITEM, UPDATE_ITEM, REMOVE_ITEM, REFRESH_AVAILABILITY, COPY_TO_REQUEST |

## Permissions Guard

All endpoints use `@Permissions('module:action')` decorators with `JwtAuthGuard` + `PermissionsGuard`.

## Audit Proof: PASS ✅
