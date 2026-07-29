# Handover Document 3: Database Schema Reference

## 1. Database Connection

- **Server**: `127.0.0.1,50079`
- **Database**: `ATsoftERP_DB`
- **User**: `atsofterp_app`
- **Engine**: SQL Server 2016 Express
- **ORM**: Prisma (schema.prisma at `apps/api/prisma/schema.prisma`)

## 2. ORM Commands

```powershell
# Generate Prisma client (after schema changes or migration)
cd apps/api && npx prisma generate

# Validate schema
cd apps/api && npx prisma validate

# Manual migration via sqlcmd
sqlcmd -S 127.0.0.1,50079 -U atsofterp_app -P <password> -d ATsoftERP_DB -i migration.sql
```

**Forbidden commands**: `prisma db push`, `prisma migrate dev`, `prisma migrate reset`

## 3. Key Maintenance Models

| # | Model Name | Table Name | Key Fields | Relations |
|---|------------|------------|------------|-----------|
| 1 | Machine | `Machine` | id, machineCode, name, categoryId, status, location, departmentId, productionLineId, costCenterId | MachineCategory, Department, ProductionLine, CostCenter |
| 2 | MachineCategory | `MachineCategory` | id, name, code, description | Machine (1:N) |
| 3 | MachinePart | `MachinePart` | id, machineId, partName, partNumber, description | Machine |
| 4 | MachineComponent | `MachineComponent` | id, machineId, name, code, serialNumber | Machine |
| 5 | MachineDocument | `MachineDocument` | id, machineId, fileName, fileType, fileUrl, uploadedById | Machine, User |
| 6 | MachineSparePart | `MachineSparePart` | id, machineId, sparePartId | Machine, SparePart |
| 7 | ComponentSparePart | `ComponentSparePart` | id, componentId, sparePartId | MachineComponent, SparePart |
| 8 | MaintenanceRequest | `MaintenanceRequest` | id, requestNumber, machineId, requestType, priority, status, description, reportedById, assignedToId | Machine, User (reportedBy), User (assignedTo) |
| 9 | MaintenanceTask | `MaintenanceTask` | id, requestId, taskNumber, title, description, status, scheduledStart, scheduledEnd, actualStart, actualEnd | MaintenanceRequest |
| 10 | MaintenanceSchedule | `MaintenanceSchedule` | id, machineId, frequency, frequencyUnit, startDate, endDate, description | Machine |
| 11 | PreventiveMaintenance | `PreventiveMaintenance` | id, machineId, planNumber, title, description, frequency, frequencyUnit, startDate, nextDueDate, status | Machine |
| 12 | SparePart | `SparePart` | id, productId, sparePartCode, sparePartName, technicalClassification, usageType, importance, unitOfMeasure, unitCost | Product |
| 13 | SparePartCondition | `SparePartCondition` | id, sparePartId, condition (NEW/USED/REFURBISHED/DAMAGED/SCRAP), quantity, warehouseId | SparePart, Warehouse |
| 14 | SparePartConditionBalance | `SparePartConditionBalance` | id, sparePartId, condition, quantity, warehouseId | SparePart, Warehouse |
| 15 | SparePartConditionMovement | `SparePartConditionMovement` | id, sparePartId, condition, quantityChange, fromWarehouseId, toWarehouseId, referenceType, referenceId, reason, createdById | SparePart, Warehouse |
| 16 | MachineInstalledPart | `MachineInstalledPart` | id, machineId, componentId, sparePartId, condition, quantity, installedDate, installedById, requestId | Machine, MachineComponent, SparePart, MaintenanceRequest |
| 17 | SparePartReplacementHistory | `SparePartReplacementHistory` | id, requestId, machineId, componentId, sparePartId, replacementNumber, condition, reason, removedDate, installedDate | MaintenanceRequest, Machine, MachineComponent, SparePart |
| 18 | SparePartRepairOrder | `SparePartRepairOrder` | id, repairOrderNumber, sparePartId, sourceType, sourceId, status, conditionIn, conditionOut, receivedDate, completedDate, totalCost | SparePart |
| 19 | SparePartRepairAction | `SparePartRepairAction` | id, repairOrderId, actionType, description, cost, performedById, performedDate | SparePartRepairOrder |
| 20 | MaintenanceBom | `MaintenanceBom` | id, machineId, name, code, description, status, currentVersionId | Machine, MaintenanceBomVersion |
| 21 | MaintenanceBomVersion | `MaintenanceBomVersion` | id, bomId, versionNumber, effectiveDate, status, approvedById, approvedDate | MaintenanceBom |
| 22 | PreventiveSparePartPlan | `PreventiveSparePartPlan` | id, preventiveMaintenanceId, sparePartId, plannedQuantity, estimatedCost | PreventiveMaintenance, SparePart |
| 23 | MaintenancePersonnel | `MaintenancePersonnel` | id, userId, jobTitle, specialization, isActive, departmentId | User, Department |
| 24 | MaintenancePartAccountability | `MaintenancePartAccountability` | id, machineId, sparePartId, userId, responsibilityType, effectiveFrom, effectiveTo | Machine, SparePart, User |
| 25 | MaintenanceChecklistItem | `MaintenanceChecklistItem` | id, machineId, title, description, expectedResult, isRequired | Machine |
| 26 | MaintenanceChecklistExecution | `MaintenanceChecklistExecution` | id, checklistItemId, requestId, taskId, result, notes, executedById, executedDate | MaintenanceChecklistItem, MaintenanceRequest, MaintenanceTask |
| 27 | DowntimeLog | `DowntimeLog` | id, machineId, requestId, startTime, endTime, durationMinutes, reason, category | Machine, MaintenanceRequest |
| 28 | MaintenanceRequestAssignment | `MaintenanceRequestAssignment` | id, requestId, personnelId, assignedDate, completedDate, notes, status | MaintenanceRequest, MaintenancePersonnel |
| 29 | MaintenanceRequestCost | `MaintenanceRequestCost` | id, requestId, costType, description, amount, currency | MaintenanceRequest |
| 30 | InventoryBalance | `InventoryBalance` | id, productId, warehouseId, quantity, reservedQuantity, availableQuantity | Product, Warehouse |

## 4. Numbering Sequences

**Model**: `numberSequence` — 46 seeded entity types, 38 ACTIVE, 8 DISABLED

**Active entity types** (38):
Auth, User, Role, Company, Branch, Administration, Department, Warehouse, Location, Product, ProductCategory, InventoryMovement, InventoryCount, InventoryAdjustment, InventoryOpeningBalance, InventoryStockAdjustment, InventoryStockTransfer, InventoryOperationalReceipt, InventoryPhysicalCount, Machine, MachineAsset, MachineDocument, MaintenanceRequest, MaintenanceTask, MaintenanceSchedule, PreventiveMaintenance, Downtime, DowntimeLog, SparePart, SparePartReplacement, SparePartRepairOrder, QRCode, QR_Label, BarcodeRecord, BarcodePrintJob, ReportExportJob, Attachment, NotificationRule

**Disabled entity types** (8): FinanceJournal, PurchaseOrder, SalesOrder, Invoice, CreditNote, DebitNote, HR_Employee, Payroll

## 5. Enum Types

Key enums used in maintenance domain:

- **MachineStatus**: ACTIVE, INACTIVE, UNDER_MAINTENANCE, DECOMMISSIONED
- **RequestType**: CORRECTIVE, PREVENTIVE, PREDICTIVE, EMERGENCY, CONDITION_BASED
- **RequestPriority**: LOW, MEDIUM, HIGH, CRITICAL
- **RequestStatus**: OPEN, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED
- **TaskStatus**: PENDING, IN_PROGRESS, COMPLETED, VERIFIED
- **SparePartCondition**: NEW, USED, REFURBISHED, DAMAGED, SCRAP, SERVICEABLE, UN_SERVICEABLE
- **RepairOrderStatus**: DRAFT, OPEN, IN_INSPECTION, APPROVED_FOR_REPAIR, UNDER_REPAIR, UNDER_TEST, COMPLETED_SERVICEABLE, SCRAPPED
- **WarehouseType**: PRODUCT, SPARE_PART, RAW_MATERIAL
- **FrequencyUnit**: DAY, WEEK, MONTH, YEAR, HOUR, MILE, CUSTOM

## 6. InventoryBalance Model

**Important**: `InventoryBalance` is Product-based and is **not** affected by spare part conditions. Spare part condition tracking uses separate side-ledger models (`SparePartConditionBalance`, `SparePartConditionMovement`).

**Key rule**: Maintenance stock issue deducts from `InventoryBalance` (via `InventoryMovement`) AND updates condition balances. Both operations happen within the same transaction. No double deduction.

## 7. Migration Rules

1. Always inspect current schema before any change
2. Create migration script manually (SQL)
3. Run via `sqlcmd` only
4. Run `npx prisma validate` after migration
5. Run `npx prisma generate` after migration
6. Document pre/post DB counters
7. Verify tables, enums, indexes after migration
8. Never drop tables, reset DB, or use destructive re-seeding

## 8. Current Schema Metrics

- **Total tables**: ~85
- **Total columns**: ~1,248
- **Enums**: ~15+
- **Indexes**: Managed via Prisma schema
- **Relations**: Referential integrity enforced at DB level
