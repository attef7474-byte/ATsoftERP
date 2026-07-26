# Permissions Proof

## New Permissions Added

| Key | Module | Action | Endpoint |
|---|---|---|---|
| `maintenance-schedule:generateRequest` | maintenance-schedule | generateRequest | `POST /maintenance/schedules/:id/generate-request` |
| `maintenance-request:createEmergency` | maintenance-request | createEmergency | `POST /maintenance/requests/emergency` |
| `maintenance-request:close` | maintenance-request | close | `PATCH /maintenance/requests/:id/close` |

## Existing Relevant Permissions

| Key | Module | Action |
|---|---|---|
| `maintenance-schedule:execute` | maintenance-schedule | execute |
| `maintenance-schedule:history` | maintenance-schedule | history |
| `maintenance-schedule:activate` | maintenance-schedule | activate |
| `maintenance-schedule:deactivate` | maintenance-schedule | deactivate |
| `maintenance-request:start` | maintenance-request | start |
| `maintenance-request:complete` | maintenance-request | complete |
| `maintenance-request:cancel` | maintenance-request | cancel |
| `maintenance-request:assign` | maintenance-request | assign |
| `maintenance-request:reopen` | maintenance-request | reopen |
| `maintenance-task:start` | maintenance-task | start |
| `maintenance-task:complete` | maintenance-task | complete |
| `maintenance-task:cancel` | maintenance-task | cancel |
| `maintenance-task:assign` | maintenance-task | assign |
| `maintenance-checklist-execution:complete` | maintenance-checklist-execution | complete |
| `maintenance-checklist-execution:update` | maintenance-checklist-execution | update |
| `preventive-maintenance:generateDueTasks` | preventive-maintenance | generateDueTasks |

## Permission Convention
- Pattern: `<module>:<action>`
- All endpoints use `@Permissions()` decorator with `JwtAuthGuard` + `PermissionsGuard`
- Unauthenticated requests → 401
- Authenticated without permission → 403
