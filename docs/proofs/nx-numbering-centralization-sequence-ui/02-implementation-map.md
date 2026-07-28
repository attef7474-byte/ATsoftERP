# Implementation Map

## Files Created
| File | Purpose |
|------|---------|
| `apps/api/src/modules/numbering/numbering.constants.ts` | Single source of truth for 44 entity type codes |

## Files Modified
### Core Backend
| File | Change |
|------|--------|
| `apps/api/src/modules/numbering/numbering.service.ts` | Added `BadRequestException` import; checked `seq.status !== 'ACTIVE'` in `generateNumber()` and `generateNumberAtomic()` |

### Bypassing Services (13 files, 24 instances converted to `generateNumberAtomic()`)

| Service File | Instances Fixed | Entity Codes |
|-------------|----------------|--------------|
| `inventory-movements.service.ts` | 1 | `INVENTORY_MOVEMENT` |
| `inventory-counts.service.ts` | 1 | `INVENTORY_COUNT` |
| `inventory-adjustments.service.ts` | 2 | `INVENTORY_ADJUSTMENT` |
| `inventory-opening-balances.service.ts` | 2 | `OPENING_BALANCE`, `INVENTORY_MOVEMENT` |
| `inventory-stock-adjustments.service.ts` | 3 | `STOCK_ADJUSTMENT`, `INVENTORY_MOVEMENT` (×2) |
| `inventory-stock-transfers.service.ts` | 3 | `STOCK_TRANSFER`, `INVENTORY_MOVEMENT` (×2) |
| `inventory-operational-receipts.service.ts` | 2 | `OPERATIONAL_RECEIPT`, `INVENTORY_MOVEMENT` |
| `inventory-physical-counts.service.ts` | 3 | `PHYSICAL_COUNT`, `INVENTORY_MOVEMENT` (×2) |
| `barcode-labels.service.ts` | 1 | `BARCODE_LABEL` |
| `maintenance-requests.service.ts` | 1 | `MAINTENANCE_REQUEST` |
| `maintenance-schedules.service.ts` | 1 | `MAINTENANCE_REQUEST` |
| `preventive-maintenance.service.ts` | 1 | `MAINTENANCE_REQUEST` |
| `maintenance-stock-issue.service.ts` | 2 | `INVENTORY_MOVEMENT` (×2) |

All changes followed the same pattern:
1. Import `NumberingService` from `../../modules/numbering/numbering.service` (path adjusted per depth)
2. Add `private numberingService: NumberingService` to constructor
3. Replace `prisma.numberSequence.findUnique` + `tx.numberSequence.update({ currentNumber: { increment: 1 } })` + manual `padStart` with `await this.numberingService.generateNumberAtomic('CODE')`

### Frontend
| File | Change |
|------|--------|
| `apps/web/src/app/admin/settings/numbering/page.tsx` | Added 16 missing entity types to `operationName` filter `filterOptions` array (was 18, now 34 active-release codes) |
| `apps/web/src/lib/i18n/locales/en/settings.ts` | Added missing keys to `operationNameMap` and `modelNameMap` (ADMINISTRATION, OPENING_BALANCE, STOCK_ADJUSTMENT, PHYSICAL_COUNT, STOCK_TRANSFER, OPERATIONAL_RECEIPT, OPERATION_TYPE, COST_CENTER, PRODUCTION_LINE, SPARE_PART) |
| `apps/web/src/lib/i18n/locales/ar/settings.ts` | Same additions as EN, with Arabic translations |
