# Security proof

## Verified

| Check | Status |
|---|---|
| No .env committed to git | ✅ |
| No cookies committed | ✅ |
| No tokens committed | ✅ |
| No secrets in docs/screenshots | ✅ |
| No passwordHash exposure | ✅ |
| No JWT secret exposure | ✅ |
| No stack traces in API source | ✅ |
| ValidationPipe configured in main.ts | ✅ (whitelist + transform) |
| JwtAuthGuard active on all protected routes | ✅ |
| PermissionsGuard active on all protected routes | ✅ |
| @Permissions decorators on all report routes | ✅ |
| Rejected domains inactive (Sales, Purchasing, Finance, HR, AI, IoT, BI, Forecasting, Workflows, Import/Export Designer, Print Template Designer) | ✅ |

## Notes

- `apps/mobile/lib/src/core/auth/token_storage.dart` is a legitimate mobile auth token storage file, not a secret leak
- Old screenshots from previous sessions contain UI images only, no secrets
- All guards, permissions, and validation pipeline confirmed active
- Unauthorized requests return 401 (JwtAuthGuard) or 403 (PermissionsGuard) as expected
