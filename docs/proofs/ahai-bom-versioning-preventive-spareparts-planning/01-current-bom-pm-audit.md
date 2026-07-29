# Phase 1: Current BOM / PM / Spare Part Planning Audit — AH-AI

## 1. Background

Batch AH-AI implements BOM (Bill of Materials) versioning and preventive spare parts planning. This audit documents the existing codebase state before any changes.

## 2. Existing BOM Models

**Result: NOT FOUND.** There are zero existing BOM models:
- No `MaintenanceBom`, `BomVersion`, `BomItem`, `PreventiveSparePartPlan` or similar
- No `bomId` field in `Machine`, `MachineComponent`, or `MaintenanceSchedule`
- No spare parts planning snapshot model

Existing spare part links that partially overlap with BOM scope:
- `ComponentSparePart` — links SparePart to MachineComponent (with quantity, isPrimary)
- `MachineSparePart` — links SparePart to Machine directly (with quantity, isPrimary)
- Both lack versioning, change tracking, active version control

## 3. Existing PM / Schedule Structure

### MaintenanceSchedule (schema.prisma lines 1952-1981)
- `@@map("maintenance_schedules")`
- Fields: id, machineId, requestId?, type, frequency, intervalDays?, startDate, endDate?, title, description?, status (ACTIVE/INACTIVE), nextDueDate?, lastGeneratedAt?, createdAt, updatedAt
- Relations: checklistItems, checklistExecutions
- **No spare part or BOM fields**

### PreventiveMaintenanceService (preventive-maintenance.service.ts)
- Methods: getUpcoming, getOverdue, getCalendar, getExecutionHistory, generateDueTasks
- `generateDueTasks()` creates MaintenanceRequest from schedules — **no spare parts are copied**
- No connection to stock availability

### Schedules Service (maintenance-schedules.service.ts)
- Full CRUD + activate/deactivate + generateRequest + execute
- No spare part planning integration

## 4. Existing Component/Spare Part Links

### ComponentSparePart (schema.prisma lines 1529-1548)
- `@@map("component_spare_parts")`
- Fields: id, componentId→MachineComponent, sparePartId→SparePart, quantity, unit?, usageNote?, isPrimary, status
- `@@unique([componentId, sparePartId])`

### MachineSparePart (schema.prisma lines 1550-1569)
- `@@map("machine_spare_parts")`
- Fields: id, machineId→Machine, sparePartId→SparePart, quantity, unit?, usageNote?, isPrimary, status
- `@@unique([machineId, sparePartId])`

## 5. SparePart Model and Inventory

### SparePart (schema.prisma lines 1475-1527)
- Key field: `productId` (links to Product for inventory)
- Already has classifications from Batch Y (technicalClassification, usageType, nature, importance)

### InventoryBalance (schema.prisma lines 772-795)
- **IMPORTANT**: Linked to Product, NOT SparePart
- SparePart inventory accessible via `SparePart.productId → Product → InventoryBalance`
- `@@unique([warehouseId, productId, batchNumber, serialNumber])`

### SparePartConditionBalance (schema.prisma lines 2358-2379)
- `@@unique([sparePartId, warehouseId, condition])`
- Has `availableQuantity` field

### Warehouse (schema.prisma lines 641-679)
- `warehouseType` = String (SPARE_PART, PRODUCT, RAW_MATERIAL)
- Stock issue service defines `FORBIDDEN_WAREHOUSE_TYPES = ['PRODUCT', 'RAW_MATERIAL']`

## 6. Numbering Entity Types

Current active maintenance entity types: MACHINE, MAINTENANCE_REQUEST, SPARE_PART, SPARE_PART_REPLACEMENT, SPARE_PART_REPAIR_ORDER, etc.
**No BOM_VERSION or SPARE_PART_PLAN entity type exists.**

## 7. Existing Permissions (seed.ts lines 11-25, 128-147)

Modules seeded: company, branch, ..., maintenance-request, maintenance-task, maintenance-schedule, ...
Extra permissions: spare-part-conditions, repair-orders, repair-actions
**No BOM or preventive-spare-part-plan permissions.**

## 8. i18n Patterns

- `maintenance.ts` (EN/AR): ~855 lines each, covers spare parts, requests, PM
- `settings.ts` (EN/AR): numbering section with 49 entity type maps
- `api-messages.ts`: maintenance section with ~20 keys

## 9. Gaps Summary

| Gap | Impact |
|-----|--------|
| No BOM models | Must create from scratch |
| No spare parts planning model | Must create from scratch |
| No BOM-PM integration | Must wire schedule/bom/planning |
| Missing numbering entity types | Must add MNT_BOM, SPP_PLAN |
| Missing permissions | Must seed bom:* and spare-part-plan:* |
| Missing i18n keys | Must add EN/AR for all new UI + API |
| `InventoryBalance` is Product-based | Must join via SparePart.productId for availability |

## 10. Key Files Reference

| File | Path |
|------|------|
| Prisma schema | `apps/api/prisma/schema.prisma` |
| Numbering constants | `apps/api/src/modules/numbering/numbering.constants.ts` |
| Seed | `apps/api/prisma/seed/seed.ts` |
| API i18n | `apps/api/src/common/i18n/api-messages.ts` |
| EN maintenance i18n | `apps/web/src/lib/i18n/locales/en/maintenance.ts` |
| AR maintenance i18n | `apps/web/src/lib/i18n/locales/ar/maintenance.ts` |
| EN settings i18n | `apps/web/src/lib/i18n/locales/en/settings.ts` |
| AR settings i18n | `apps/web/src/lib/i18n/locales/ar/settings.ts` |
| Schedules service | `apps/api/src/modules/factory/maintenance/maintenance-schedules/` |
| Preventive maint. service | `apps/api/src/modules/factory/maintenance/preventive-maintenance/` |
| Stock issue service | `apps/api/src/modules/factory/maintenance/maintenance-stock-issue/` |
| app.module.ts | `apps/api/src/app.module.ts` |
