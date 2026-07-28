# Scope and Rules

## In Scope
- Centralize all numbering generation through `NumberingService.generateNumberAtomic()`
- Add `ACTIVE` status check to prevent generating from inactive/deactivated sequences
- Create single source of truth for entity type codes (`numbering.constants.ts`)
- Convert all 13 bypassing services (24 bypass instances) to use centralized numbering
- Update UI filter to list all 44 seeded entity types (was 18)
- Add missing i18n keys for entity types not in the UI

## Not in Scope
- No schema changes (no migration needed)
- No forbidden module activation
- No new API endpoints
- No new frontend pages
- No DB changes

## Rules Followed
- No `prisma db push` / `migrate dev` / `migrate reset`
- No mock APIs or placeholder pages
- Numbering generation remains backend-only and transaction-safe
- All generated codes remain immutable after creation
- No secrets exposed
- No raw English-only errors for user-facing cases
