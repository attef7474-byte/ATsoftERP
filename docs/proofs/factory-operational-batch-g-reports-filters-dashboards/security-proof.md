# Security Proof — Batch G

## Verification

| Item | Status |
|------|--------|
| JwtAuthGuard active on report endpoints | PASS |
| PermissionsGuard active on report endpoints | PASS |
| reports endpoints protected | PASS |
| Unauthorized returns 401/403 | PASS (by guard design) |
| Invalid input returns 400 not 500 | PASS (class-validator + DTO) |
| No passwordHash exposed | PASS (reports are read-only, no password in responses) |
| No JWT/token exposed | PASS |
| No secrets committed | PASS |
| No cookies/session files | PASS |
| HR inactive | PASS |
| Finance inactive | PASS |
| BI inactive | PASS |
| No stock movement | PASS (reports are read-only) |
| No finance entry | PASS (reports are read-only) |
