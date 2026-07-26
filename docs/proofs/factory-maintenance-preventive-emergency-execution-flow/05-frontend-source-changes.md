# Frontend Source Changes: Modified Files

## 1. `lib/admin-types/maintenance.ts`
- Added `isEmergency?: boolean | null` to `MaintenanceRequest`
- Added `productionLine`, `machineComponent`, `operationType`, `costCenter` optional fields to `MaintenanceRequest`
- Added `nextDueDate?: string | null` and `lastGeneratedAt?: string | null` to `MaintenanceSchedule`

## 2. `schedules/[id]/page.tsx`
- Added `generating` state and `handleGenerateRequest()` handler
- Added `ActionAddIcon` to imports
- Added "Generate Request" admin action button
- Added `nextDueDate` and `lastGeneratedAt` fields to detail display
- Added clickable "Generate Request" card

## 3. `schedules/page.tsx`
- Added `nextDueDate` column to data grid

## 4. `requests/[id]/page.tsx`
- Added emergency badge display when `isEmergency = true`

## 5. `lib/i18n/locales/en/maintenance.ts`
- Added 6 new i18n keys (see frontend UI proof)

## 6. `lib/i18n/locales/ar/maintenance.ts`
- Added 6 new i18n keys (see frontend UI proof)
