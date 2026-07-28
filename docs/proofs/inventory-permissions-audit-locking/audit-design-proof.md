# Audit Design Proof — Batch V

## Architecture
- Reuses existing `AuditService` (`apps/api/src/common/audit/audit.service.ts`)
- Uses existing `AuditLog` table in schema.prisma
- No new audit model or table created
- `InventoryAuditController` wraps AuditService for inventory-specific endpoints

## Audit endpoints
| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/v1/inventory/audit | inventory:audit:read | List audit logs |
| GET | /api/v1/inventory/audit/summary | inventory:audit:read | Audit summary stats |
| GET | /api/v1/inventory/audit/export | inventory:audit:export | Export CSV |
| GET | /api/v1/inventory/audit/:id | inventory:audit:read | Single log detail |

## Audit events captured for locks
| Action | Entity | Trigger |
|--------|--------|---------|
| CREATE | inventory-lock | Lock created |
| UPDATE | inventory-lock | Lock updated |
| ACTIVATE | inventory-lock | Lock activated |
| DEACTIVATE | inventory-lock | Lock deactivated |
| DELETE | inventory-lock | Lock deleted |

## Security
- AuditService sanitizes details field before returning
- No passwordHash, JWT, or secrets exposed in audit logs
- No PII leakage in audit log output
