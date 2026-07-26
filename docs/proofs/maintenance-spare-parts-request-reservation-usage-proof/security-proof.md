# Security Proof — Maintenance Spare Parts Request + Reservation + Usage Proof

## Guards
- `JwtAuthGuard` active on all 10 endpoints
- `PermissionsGuard` active on all 10 endpoints

## Permissions (9 new keys)

| Key | Endpoint(s) |
|---|---|
| maintenance-request-parts:read | GET /requests/:requestId/parts, GET /requests/:requestId/parts/:lineId |
| maintenance-request-parts:create | POST /requests/:requestId/parts |
| maintenance-request-parts:update | PATCH /requests/:requestId/parts/:lineId |
| maintenance-request-parts:request | PATCH /requests/:requestId/parts/:lineId/request |
| maintenance-request-parts:approve | PATCH /requests/:requestId/parts/:lineId/approve |
| maintenance-request-parts:reject | PATCH /requests/:requestId/parts/:lineId/reject |
| maintenance-request-parts:reserve | PATCH /requests/:requestId/parts/:lineId/reserve |
| maintenance-request-parts:use | PATCH /requests/:requestId/parts/:lineId/use |
| maintenance-request-parts:cancel | PATCH /requests/:requestId/parts/:lineId/cancel |

## Security Verifications

| Check | Status |
|---|---|
| JwtAuthGuard active | ✅ |
| PermissionsGuard active | ✅ |
| Unauthorized returns 401 | ✅ |
| Bad token returns 401 | ✅ |
| Invalid input returns 400 | ✅ |
| Invalid transition returns 400/409 | ✅ |
| No passwordHash exposed | ✅ |
| No JWT/token exposed | ✅ |
| No secrets committed | ✅ |
| No cookies/logs committed | ✅ |
| HR inactive | ✅ |
| Finance inactive | ✅ |
| BI inactive | ✅ |
| No stock movement | ✅ |
| No finance entry | ✅ |

## Permission Seed
Permissions are seeded idempotently in `seed-cmms-permissions.ts` and linked to SUPER_ADMIN role.

Seed output: "Added 17 new permissions. Total permissions linked to SUPER_ADMIN: 367"
