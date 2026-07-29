# Scope and Rules — AH-AI

## Batch
AH-AI — BOM Versioning + Preventive Spare Parts Planning

## Priority Plan Position
Stage 9 of 11 (AF-AG → AH-AI → AJ-AK → UI-QA)

## Scope
- BOM (Bill of Materials) versioning for machines and components
- Preventive spare parts planning linked to PM schedules
- Read-only stock availability check (no stock mutation during planning)
- Copy-to-request flow (creates MaintenanceRequestRequiredPart entries)
- Numbering, permissions, audit, i18n

## Hard Rules Enforced
- ✅ Additive-only schema changes
- ✅ SQL Server only (via sqlcmd)
- ✅ No prisma db push / migrate dev / reset
- ✅ No destructive data changes
- ✅ No forbidden modules activated
- ✅ Numbering via NumberingService.generateNumberAtomic()
- ✅ Audit logging on all mutations
- ✅ Permission guards on all endpoints
- ✅ API i18n (localized message keys)
- ✅ No English-only user-facing errors
- ✅ No mock APIs or placeholder pages
- ✅ No screenshots

## Excluded from Scope
- Frontend BOM/planning pages (keys ready, UI to be built separately)
- Auto-generation on PM schedule execution
- BOM version diff/comparison
- Integration with Finance/Purchasing (forbidden)
- InventoryBalance mutation from planning (read-only)
