# Security Proof — Opening Balance + Stock Adjustment

## Permissions Added

| Permission Key | Module | Action |
|---------------|--------|--------|
| inventory:opening-balance:read | Opening Balance | read |
| inventory:opening-balance:create | Opening Balance | create |
| inventory:opening-balance:update | Opening Balance | update |
| inventory:opening-balance:submit | Opening Balance | submit |
| inventory:opening-balance:approve | Opening Balance | approve |
| inventory:opening-balance:reject | Opening Balance | reject |
| inventory:opening-balance:post | Opening Balance | post |
| inventory:opening-balance:cancel | Opening Balance | cancel |
| inventory:opening-balance:delete-draft | Opening Balance | delete-draft |
| inventory:stock-adjustment:read | Stock Adjustment | read |
| inventory:stock-adjustment:create | Stock Adjustment | create |
| inventory:stock-adjustment:update | Stock Adjustment | update |
| inventory:stock-adjustment:submit | Stock Adjustment | submit |
| inventory:stock-adjustment:approve | Stock Adjustment | approve |
| inventory:stock-adjustment:reject | Stock Adjustment | reject |
| inventory:stock-adjustment:post | Stock Adjustment | post |
| inventory:stock-adjustment:cancel | Stock Adjustment | cancel |
| inventory:stock-adjustment:delete-draft | Stock Adjustment | delete-draft |

## Security Verification

| Item | Status |
|------|--------|
| JwtAuthGuard active on all endpoints | ✅ |
| PermissionsGuard active on all endpoints | ✅ |
| Unauthorized (no token) returns 401 | ✅ (JWT guard) |
| Bad token returns 401 | ✅ (JWT guard) |
| Insufficient permission returns 403 | ✅ (Permissions guard with test role) |
| Invalid input returns 400 | ✅ (class-validator DTOs) |
| Invalid transition returns 400 | ✅ (service validation) |
| Direct StockBalance edit not exposed | ✅ (no direct balance API in new modules) |
| Posted document edit blocked | ✅ (400 if status !== 'DRAFT') |
| Posted document delete blocked | ✅ (400 if status !== 'DRAFT') |
| No passwordHash exposed | ✅ |
| No JWT/token exposed | ✅ |
| No secrets committed | ✅ |
| No cookies/logs committed | ✅ |
| Finance inactive | ✅ |
| HR inactive | ✅ |
| BI inactive | ✅ |
| Sales/Purchasing inactive | ✅ |
| Stock changes only through approved posted documents | ✅ |

## Seed Status
- 397 total permissions linked to SUPER_ADMIN
- 18 new permissions added for Batch Q
- All permissions seeded idempotently
