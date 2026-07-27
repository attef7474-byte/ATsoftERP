# Permissions Proof — Stock Transfers (Batch R)

## New Permissions

Seed file `apps/api/prisma/seed/seed-cmms-permissions.ts` updated with 9 permissions:

| Permission | Description |
|------------|-------------|
| `inventory:stock-transfer:read` | View stock transfers |
| `inventory:stock-transfer:create` | Create new stock transfers |
| `inventory:stock-transfer:update` | Edit existing DRAFT stock transfers |
| `inventory:stock-transfer:submit` | Submit for approval |
| `inventory:stock-transfer:approve` | Approve submitted transfers |
| `inventory:stock-transfer:reject` | Reject submitted transfers |
| `inventory:stock-transfer:post` | Post approved transfers (creates movements) |
| `inventory:stock-transfer:cancel` | Cancel DRAFT/SUBMITTED transfers |
| `inventory:stock-transfer:delete-draft` | Delete DRAFT transfers |

## Permission Naming Pattern

Follows the existing inventory convention:
```
inventory:{module}:{action}
```

## Permission Guard Usage

All controller methods are decorated with `@Permissions()` guard:
- `create` → `inventory:stock-transfer:create`
- `findAll`, `findOne` → `inventory:stock-transfer:read`
- `update` → `inventory:stock-transfer:update`
- `submit` → `inventory:stock-transfer:submit`
- `approve` → `inventory:stock-transfer:approve`
- `reject` → `inventory:stock-transfer:reject`
- `post` → `inventory:stock-transfer:post`
- `cancel` → `inventory:stock-transfer:cancel`
- `remove` → `inventory:stock-transfer:delete-draft`

## Number Sequence

| Code | Prefix | Start | Padding | Scope |
|------|--------|-------|---------|-------|
| STOCK_TRANSFER | ST- | 1 | 6 | GLOBAL |

The sequence generates codes like: `ST-000001`, `ST-000002`, etc.

## Module Registration

`inventory-stock-transfer` added to the `MODULES` array in `apps/api/prisma/seed/seed.ts` to ensure the number sequence and permissions are included during seeding.

## Conclusion

9 permissions created following the exact naming convention. Permission guards applied to all endpoints. Number sequence seeded with ST- prefix. No gaps in authorization.
