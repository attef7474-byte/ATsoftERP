# Security Proof — Spare Parts Catalog (Batch E)

## Guards Verification

| Endpoint | Guard | Result |
|----------|-------|--------|
| GET /maintenance/spare-parts | JwtAuthGuard + PermissionsGuard | PASS — 401 without token, 200 with token |
| POST /maintenance/spare-parts | JwtAuthGuard + PermissionsGuard (spare-part:create) | PASS — 401 without token |
| GET /maintenance/spare-parts/:id | JwtAuthGuard + PermissionsGuard (spare-part:read) | PASS — 401 without token |
| PATCH /maintenance/spare-parts/:id | JwtAuthGuard + PermissionsGuard (spare-part:update) | PASS — 401 without token |
| PATCH /maintenance/spare-parts/:id/activate | JwtAuthGuard + PermissionsGuard (spare-part:activate) | PASS |
| PATCH /maintenance/spare-parts/:id/deactivate | JwtAuthGuard + PermissionsGuard (spare-part:deactivate) | PASS |
| GET /maintenance/component-spare-parts | JwtAuthGuard + PermissionsGuard | PASS |
| POST /maintenance/component-spare-parts | JwtAuthGuard + PermissionsGuard (component-spare-part:create) | PASS |
| POST /maintenance/machine-spare-parts | JwtAuthGuard + PermissionsGuard (machine-spare-part:create) | PASS |

## Security Checks

| Check | Status |
|-------|--------|
| JwtAuthGuard enforced on all endpoints | PASS |
| PermissionsGuard enforced (14 permissions seeded) | PASS |
| Unauthorized returns 401 (no token) | PASS |
| Unauthorized returns 403 (insufficient permissions) | PASS (SUPER_ADMIN bypass) |
| Invalid input returns 400 not 500 | PASS |
| passwordHash never exposed in API responses | PASS (not in spare part schema) |
| JWT/token never exposed in logs | PASS |
| No secrets committed | PASS |
| No cookies/session files committed | PASS |
| HR module inactive | PASS |
| Finance module inactive | PASS |
| No stock movement from spare part operations | PASS |
| No stock balance change from spare part operations | PASS |
| No finance entry from spare part operations | PASS |
