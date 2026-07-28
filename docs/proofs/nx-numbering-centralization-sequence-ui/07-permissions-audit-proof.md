# Permissions & Audit Proof

## Permissions
No new permissions were added or changed. Existing permissions suffice:

| Permission | Endpoint |
|-----------|----------|
| `numbering:read` | GET `/numbering`, GET `/numbering/:id`, GET `/numbering/:id/preview`, GET `/numbering/code/:code` |
| `numbering:create` | POST `/numbering` |
| `numbering:update` | PATCH `/numbering/:id` |
| `numbering:generate` | POST `/numbering/generate` |

Each converted service already has its own entity-level permissions (e.g., `inventory:movement:create`) — the numbering generation is a side effect called from within those permission-guarded methods.

## Audit
Audit logging was already present in each calling service before conversion. The conversion does not change audit behavior — it only changes how the code/number is generated. Audit events (e.g., `audit.log(userId, 'CREATE', 'InventoryMovement', movement.id, ...)`) continue to fire normally.
