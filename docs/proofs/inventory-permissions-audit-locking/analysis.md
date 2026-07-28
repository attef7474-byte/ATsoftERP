# Batch V — Analysis

## Objective
Add inventory governance layer: permissions hardening, audit trail, period/warehouse/location/item locking, and posting/edit/delete protection for all accepted inventory batches O through U.

## Scope
- **In scope**: Permissions for governance/audit/reports, InventoryLock model & migration, lock CRUD & enforcement, audit controller wrapping existing AuditService, lock guard on posting endpoints, frontend pages for locks & audit, i18n for navigation
- **Out of scope**: Finance/Accounting/Purchasing/Sales/HR modules, InventoryMovement creation, StockBalance direct editing, Docker/PostgreSQL

## Design decisions
1. InventoryLock model uses standalone fields (no Prisma relations) to avoid modifying existing models
2. Lock enforcement via InventoryLockGuard (NestJS guard) — lightweight, declarative
3. Audit reuses existing AuditService + AuditLog table — no new audit model
4. Permissions seeded for lock CRUD + audit read/export + governance read + report types
5. Frontend pages are read-only for stock data — no StockBalance or InventoryMutation on governance pages
6. SQL Server runtime throughout — no Docker/PostgreSQL
7. Migration uses `prisma migrate deploy` (production-safe) not `migrate dev`

## Files changed
- `apps/api/prisma/schema.prisma` — added InventoryLock model
- `apps/api/prisma/migrations/20260728000000_add_inventory_locks/` — migration SQL
- `apps/api/prisma/seed/seed-inventory-governance-permissions.ts` — 13 permissions
- `apps/api/src/modules/factory/inventory-locks/` — service, controller, module, DTOs
- `apps/api/src/common/guards/inventory-lock.guard.ts` — lock enforcement guard
- `apps/api/src/app.module.ts` — module registration
- `apps/web/src/app/admin/inventory/locks/` — frontend pages (list, new, detail)
- `apps/web/src/app/admin/inventory/governance-audit/` — audit page
- `apps/web/src/components/admin/shell/navigation-data.ts` — sidebar entries
- `apps/web/src/lib/i18n/locales/en/navigation.ts` — English labels
- `apps/web/src/lib/i18n/locales/ar/navigation.ts` — Arabic labels
- 6 posting controllers — added InventoryLockGuard

## Risk assessment
- Lock enforcement may block legitimate operations if lock dates overlap: mitigated by deactivate/override
- No rollback mechanism if lock blocks critical stock operation: documented limitation
- Reports remain readable under lock as designed
