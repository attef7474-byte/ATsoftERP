# Security Proof — Maintenance Downtime + Failure + RCA + Reliability KPIs

## Authentication
- All new endpoints use `JwtAuthGuard` + `PermissionsGuard`
- No token → 401
- Bad/expired token → 401

## Permissions

### New Permission Keys (Seeded)
| Key | Module | Action | Description |
|---|---|---|---|
| `downtime-rca:update` | downtime-rca | update | Set RCA fields (root cause, corrective, preventive) |
| `downtime-rca:complete` | downtime-rca | complete | Mark RCA as complete |
| `maintenance-reliability:read` | maintenance-reliability | read | View reliability KPIs |

### Existing Permission Keys Used
| Key | Endpoints | Purpose |
|---|---|---|
| `downtime-log:create` | POST / | Create downtime log |
| `downtime-log:read` | GET /, GET /:id, GET /:id/summary, GET /:id/rca | List/detail/summary/RCA |
| `downtime-log:update` | PATCH /:id, PATCH /:id/failure-cause, PATCH /:id/rca, PATCH /:id/rca/complete | Update, set failure cause, set RCA, complete RCA |
| `downtime-log:delete` | DELETE /:id | Delete |
| `downtime-log:start` | POST /start | Start downtime |
| `downtime-log:end` | PATCH /:id/end | End downtime |
| `downtime-log:close` | PATCH /:id/close | Close downtime |
| `downtime-log:cancel` | PATCH /:id/cancel | Cancel downtime |
| `downtime-log:classify` | PATCH /:id/classify | Classify downtime |
| `downtime-log:current.view` | GET /current | Current downtime |
| `downtime-log:analysis.view` | GET /analysis | Analysis |
| `downtime-log:byMachine.view` | GET /by-machine/:machineId | By machine |
| `maintenance-reliability:read` | GET /maintenance/reliability/* | All reliability KPI endpoints |

### Permission Seed
- `seed-cmms-permissions.ts` updated with 3 new permission entries
- Idempotent seed: creates only if not exists
- All permissions linked to SUPER_ADMIN role

## No Secrets Exposed
- No passwordHash in any response
- No .env values in responses
- No tokens in logs

## No Sensitive Data
- All audit logs use structured metadata (no secrets)
- Debug endpoints not exposed in production
- Swagger docs require auth
