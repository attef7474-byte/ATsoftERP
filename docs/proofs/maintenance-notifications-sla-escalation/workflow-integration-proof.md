# Workflow Integration Proof — Batch M

## Notification Wiring (in existing services)

### `MaintenanceRequestsService`
| Action | Notification | SLA |
|---|---|---|
| `create` (within `createRequest`) | `notifyRequestCreated` if assigned | `createSlaState` |
| `start` | `notifyRequestStarted` | `recalculateSla` |
| `complete` | `notifyRequestCompleted` | — |
| `close` | `notifyRequestClosed` | — |
| `cancel` | — | — |
| `assign` | `notifyRequestAssigned` | — |
| `reopen` | — | — |

### `MaintenanceSparePartRequestLinesService`
| Action | Notification |
|---|---|
| `submit` (DRAFT→REQUESTED) | `notifyPartRequested` |
| `approve` (REQUESTED→APPROVED) | `notifyPartApproved` |
| `reject` (REQUESTED→REJECTED) | `notifyPartRejected` |
| `reserve` (APPROVED→RESERVED) | `notifyPartReserved` |
| `markUsed` (RESERVED/APPROVED→USED) | `notifyPartUsed` |
| `cancel` | — |

### Wiring approach
- `try { ... } catch { }` blocks — notifications are non-blocking
- Notifications fire after database operation + audit log
- Module imports: `MaintenanceNotificationModule` and `MaintenanceSlaModule` imported into `MaintenanceRequestsModule` and `MaintenanceSparePartRequestLinesModule`

## Existing Workflows Not Modified
- Preventive generation — unchanged
- Emergency creation — unchanged
- Checklist execution — unchanged
- Downtime log creation — unchanged
- RCA/KPIs — unchanged
- Delete (soft) — unchanged
- Edit prefill — unchanged
- Code immutability — all new nullable fields, no schema changes to existing columns
