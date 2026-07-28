# Audit Events Proof — Batch V

## Events captured by inventory-lock lifecycle
| Action | Entity | Trigger location | Test status |
|--------|--------|-----------------|-------------|
| CREATE | inventory-lock | InventoryLocksService.create() | Verified |
| UPDATE | inventory-lock | InventoryLocksService.update() | Verified |
| ACTIVATE | inventory-lock | InventoryLocksService.activate() | Verified |
| DEACTIVATE | inventory-lock | InventoryLocksService.deactivate() | Verified |
| DELETE | inventory-lock | InventoryLocksService.remove() | Verified |

## Audit event details
Each audit entry contains:
- userId — who performed the action
- action — CREATE/UPDATE/ACTIVATE/DEACTIVATE/DELETE
- entity — 'inventory-lock'
- entityId — the lock's UUID
- details — human-readable description including lock code and type
- createdAt — timestamp
- ip — not stored (user agent not stored for lock events)

## Security
- AuditService sanitizes details field (JSON.stringify on object details)
- No passwordHash, JWT token, or secrets in audit entries
- No PII leakage
- IP/userAgent not captured for inventory-lock audit events

## Limitation
- Blocked attempt audit not implemented: when a posting is blocked by InventoryLockGuard, no audit entry is created. This is because the guard throws before any service method executes. This is a documented limitation — the guard could be enhanced to log blocked attempts.
