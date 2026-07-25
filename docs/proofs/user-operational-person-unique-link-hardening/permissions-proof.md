# Permissions Proof: User ↔ OperationalPerson Unique Link

## Status: VERIFIED — NO CHANGES NEEDED

The permission system uses action-based permissions (e.g., `maintenance-personnel:create`, `maintenance-personnel:read`, etc.) defined in the permission seed data and checked via `@Permissions()` decorators.

Controllers still use the same permission strings. No permission definitions were changed. No new permissions were added. No roles were modified.

### Verified
- `maintenance-personnel:create` → `POST /maintenance/personnel`
- `maintenance-personnel:read` → `GET /maintenance/personnel`
- `maintenance-personnel:update` → `PATCH /maintenance/personnel/:id`
- `maintenance-personnel:delete` → `DELETE /maintenance/personnel/:id`
- `maintenance-personnel:activate` → `PATCH /maintenance/personnel/:id/activate`
- `maintenance-personnel:deactivate` → `PATCH /maintenance/personnel/:id/deactivate`
