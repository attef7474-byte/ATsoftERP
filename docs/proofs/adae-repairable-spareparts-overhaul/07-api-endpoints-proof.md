# Phase 7 — API Endpoints Proof

## Route Family: `/api/maintenance/repair-orders`

### Read Endpoints (5)
| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/` | repair-orders:read | List with filters |
| GET | `/queue` | repair-orders:read | Repairable parts queue |
| GET | `/:id` | repair-orders:read | Detail by ID |
| GET | `/:id/actions` | repair-orders:read | List actions |
| POST | `/:id/actions` | repair-actions:create | Add action |

### Create Endpoints (2)
| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| POST | `/` | repair-orders:create | Create manually |
| POST | `/from-replacement-history` | repair-orders:create | Create from AB-AC |

### Status Transition Endpoints (8)
| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| POST | `/:id/start-inspection` | repair-orders:manage | Start inspection |
| POST | `/:id/approve-repair` | repair-orders:manage | Approve for repair |
| POST | `/:id/start-repair` | repair-orders:manage | Start repair |
| POST | `/:id/start-test` | repair-orders:manage | Start test |
| POST | `/:id/complete-serviceable` | repair-orders:complete | Complete serviceable |
| POST | `/:id/complete-partial` | repair-orders:complete | Complete partial |
| POST | `/:id/scrap` | repair-orders:scrap | Scrap |
| POST | `/:id/cancel` | repair-orders:manage | Cancel |

### Total: 17 endpoints

## API Behavior

- All endpoints require JWT auth via `JwtAuthGuard`
- All endpoints require permission via `PermissionsGuard`
- 401 for missing/expired token
- 403 for missing permission
- 400 for validation/business rule violations with localized error
- 404 for not found resources

## API i18n Messages Added

```
maintenance.repairOrderNotFound
maintenance.repairOrderAlreadyExists
maintenance.invalidRepairStatus
maintenance.invalidRepairTransition
maintenance.repairSourceNotFound
maintenance.repairSourceNotRepairable
maintenance.repairQuantityInvalid
maintenance.repairAlreadyCompleted
maintenance.repairAlreadyCancelled
maintenance.repairCancelReasonRequired
```
