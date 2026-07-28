# Permissions Design Proof — Batch V

## Governance permissions seeded (13 total)

| Key | Module | Action | Status |
|-----|--------|--------|--------|
| inventory:lock:read | inventory:lock | read | ACTIVE |
| inventory:lock:create | inventory:lock | create | ACTIVE |
| inventory:lock:update | inventory:lock | update | ACTIVE |
| inventory:lock:activate | inventory:lock | activate | ACTIVE |
| inventory:lock:deactivate | inventory:lock | deactivate | ACTIVE |
| inventory:lock:delete | inventory:lock | delete | ACTIVE |
| inventory:lock:override | inventory:lock | override | ACTIVE |
| inventory:audit:read | inventory:audit | read | ACTIVE |
| inventory:audit:export | inventory:audit | export | ACTIVE |
| inventory:governance:read | inventory:governance | read | ACTIVE |
| inventory:reports:ledger | inventory:reports | ledger | ACTIVE |
| inventory:reports:reconciliation | inventory:reports | reconciliation | ACTIVE |
| inventory:reports:permissions-view | inventory:reports | permissions-view | ACTIVE |

## Permission assignment
- All 13 permissions assigned to SUPER_ADMIN role via upsert
- Existing permissions unchanged
- No permission removed

## Verification
- All 13 keys verified present in permission table
- SUPER_ADMIN role has all 13 role_permission entries
- Permissions enforced via @Permissions() decorator on each controller route
