# Permissions Proof — Batch Y

## Permission Checks

| Action | Permission | Controller Check |
|--------|-----------|------------------|
| List spare parts | `maintenance:read` | `@Permissions('maintenance:read')` |
| Create spare part | `maintenance:write` | `@Permissions('maintenance:write')` |
| Update spare part | `maintenance:write` | `@Permissions('maintenance:write')` |
| List warehouses | `inventory:read` | `@Permissions('inventory:read')` |
| Create warehouse | `inventory:write` | `@Permissions('inventory:write')` |
| Update warehouse | `inventory:write` | `@Permissions('inventory:write')` |
| Issue stock | `maintenance:write` | `@Permissions('maintenance:write')` |
| Return stock | `maintenance:write` | `@Permissions('maintenance:write')` |

## No New Permissions

- No new permission codes were introduced
- All endpoints reuse existing `maintenance:read`, `maintenance:write`, `inventory:read`, `inventory:write`
- Backward compatible with existing role assignments
