# AB-AC Implementation Map

## Changes Made

### Schema (prisma/schema.prisma)
- Added `MachineInstalledPart` model (lines 2400-2454)
  - Links to: Machine, MachineComponent, SparePart, MaintenanceRequest, MaintenanceRequestRequiredPart, InventoryMovement
  - Tracks: installedQuantity, installedCondition, status (ACTIVE/REMOVED/REPLACED/DECOMMISSIONED), removal tracking, serial/batch numbers
  - Back-references: `installedParts` on Machine, MachineComponent, SparePart, MaintenanceRequest, MaintenanceRequestRequiredPart
- Added `SparePartReplacementHistory` model (lines 2456-2510)
  - Links to: Machine, MachineComponent, MaintenanceRequest, MaintenanceRequestRequiredPart, MachineInstalledPart (old/new), SparePart (old/new), InventoryMovement
  - Tracks: replacementNumber (unique, from NumberingService), issuedCondition, removedCondition, replacementAction, noReturnReason, removedReturnedToStock
  - Back-references: `replacementHistories` on Machine, MachineComponent, MaintenanceRequest, MaintenanceRequestRequiredPart; `oldReplacementHistories/newReplacementHistories` on SparePart; `replacementOutHistories` on InventoryMovement

### Migration (prisma/migrations/abac_installed_parts_replacement_history.sql)
- Creates `machine_installed_parts` table with indexes
- Creates `spare_part_replacement_histories` table with indexes
- Safe additive migration (IF NOT EXISTS guards)

### Numbering
- Added `SPARE_PART_REPLACEMENT` to `numbering.constants.ts`
- Added seed entry in `prisma/seed/seed.ts`
- Manually inserted into `number_sequences` table (prefix: SPR-, padding: 6, global scope)

### Backend Module: `installed-parts-replacement/`
- `dto/installed-parts-replacement.dto.ts` — QueryInstalledPartDto, QueryReplacementHistoryDto
- `installed-parts-replacement.service.ts` — Full CRUD:
  - `recordInstalledPartInTx()` — creates installed part inside a transaction
  - `recordReplacementInTx()` — creates replacement history with atomic number generation
  - `markInstalledPartRemovedInTx()` — marks part as removed/replaced
  - Query methods: getInstalledParts, getInstalledPartById, getInstalledPartsByMachine/Request
  - Replacement methods: getReplacementHistory (filtered), getReplacementHistoryByMachine/Request
  - Count methods: getActiveInstalledPartsCount, getReplacementCount
- `installed-parts-replacement.controller.ts` — 10 endpoints (read-only, permission-gated)
  - GET /installed-parts (list)
  - GET /installed-parts/:id (by ID)
  - GET /installed-parts/by-machine/:machineId
  - GET /installed-parts/by-machine/:machineId/count
  - GET /installed-parts/by-request/:maintenanceRequestId
  - GET /installed-parts/replacement-history
  - GET /installed-parts/replacement-history/by-machine/:machineId
  - GET /installed-parts/replacement-history/by-machine/:machineId/count
  - GET /installed-parts/replacement-history/by-request/:maintenanceRequestId
- `installed-parts-replacement.module.ts` — imports AuditModule, exports service

### Integration
- `maintenance-stock-issue.service.ts`:
  - Injected `InstalledPartsReplacementService`
  - `recordConditionMovementInTx()` now returns created movement (for ID capture)
  - After condition OUT movement: creates MachineInstalledPart record
  - After condition IN movement (for RETURNED_REMOVED_PART): creates SparePartReplacementHistory
  - For NO_REMOVED_PART and NEW_INSTALLATION: creates only the installed part
- `maintenance-stock-issue.module.ts`:
  - Imports `InstalledPartsReplacementModule`

### App Module Registration
- Added `InstalledPartsReplacementModule` to both import statement and imports array in `app.module.ts`

### Frontend Components
- `components/admin/maintenance/installed-parts-card.tsx` — reusable card with DataTable display, supports machineId or requestId context
- `components/admin/maintenance/replacement-history-card.tsx` — reusable card for replacement history display
- Machine detail page (`machines/[id]/page.tsx`): added "Installed Parts" and "Replacement History" tabs
- Request detail page (`requests/[id]/page.tsx`): added "Replacement History" tab

### i18n
- API messages: 3 new keys (`installedParts.notFound`, `installedParts.duplicateInstallation`, `installedParts.replacementFailed`)
- EN maintenance.ts: 7 new keys (installedPart, installedParts, replacementHistory, newPart, oldPart, returnedToStock, installedCondition, noInstalledParts, noReplacementHistory)
- AR maintenance.ts: same 7 keys translated
- EN/AR settings.ts: added `SPARE_PART_REPLACEMENT` numbering entity key
- Fixed AR SPARE_PART_CONDITION_MOVEMENT from English to Arabic

### Types
- `admin-types/maintenance.ts`: Added `MachineInstalledPart` and `SparePartReplacementHistory` interfaces

## Files Changed/Created
- `apps/api/prisma/schema.prisma` (+110 lines for 2 new models + reverse relations)
- `apps/api/prisma/migrations/abac_installed_parts_replacement_history.sql` (new)
- `apps/api/src/modules/numbering/numbering.constants.ts` (+1 line)
- `apps/api/prisma/seed/seed.ts` (+1 line)
- `apps/api/src/modules/factory/maintenance/installed-parts-replacement/` (4 new files)
- `apps/api/src/modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.service.ts` (modified)
- `apps/api/src/modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.module.ts` (modified)
- `apps/api/src/app.module.ts` (modified)
- `apps/api/src/common/i18n/api-messages.ts` (modified)
- `apps/web/src/lib/admin-types/maintenance.ts` (modified)
- `apps/web/src/components/admin/maintenance/installed-parts-card.tsx` (new)
- `apps/web/src/components/admin/maintenance/replacement-history-card.tsx` (new)
- `apps/web/src/app/admin/maintenance/machines/[id]/page.tsx` (modified)
- `apps/web/src/app/admin/maintenance/requests/[id]/page.tsx` (modified)
- `apps/web/src/lib/i18n/locales/en/maintenance.ts` (modified)
- `apps/web/src/lib/i18n/locales/ar/maintenance.ts` (modified)
- `apps/web/src/lib/i18n/locales/en/settings.ts` (modified)
- `apps/web/src/lib/i18n/locales/ar/settings.ts` (modified)

## Endpoints (10 total, all GET/read-only)
| Method | Path | Permission |
|--------|------|-----------|
| GET | /api/v1/installed-parts | installed-parts:read |
| GET | /api/v1/installed-parts/:id | installed-parts:read |
| GET | /api/v1/installed-parts/by-machine/:machineId | installed-parts:read |
| GET | /api/v1/installed-parts/by-machine/:machineId/count | installed-parts:read |
| GET | /api/v1/installed-parts/by-request/:maintenanceRequestId | installed-parts:read |
| GET | /api/v1/installed-parts/replacement-history | installed-parts:read |
| GET | /api/v1/installed-parts/replacement-history/by-machine/:machineId | installed-parts:read |
| GET | /api/v1/installed-parts/replacement-history/by-machine/:machineId/count | installed-parts:read |
| GET | /api/v1/installed-parts/replacement-history/by-request/:maintenanceRequestId | installed-parts:read |

## Integration Points
- `MaintenanceStockIssueService.issue()` records installed part + replacement history after successful stock issue
- Future: `issue()` with RETURNED_REMOVED_PART creates full replacement history linking old/new parts
- Future: NO_REMOVED_PART creates replacement history without removed part details
- Future: NEW_INSTALLATION creates only installed part (no replacement history)
