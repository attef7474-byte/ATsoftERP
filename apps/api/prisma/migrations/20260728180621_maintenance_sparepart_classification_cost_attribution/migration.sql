BEGIN TRY
BEGIN TRAN;

-- AlterTable: SparePart — add classification columns
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('spare_parts') AND name = 'technicalClassification')
  ALTER TABLE [dbo].[spare_parts] ADD [technicalClassification] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('spare_parts') AND name = 'usageType')
  ALTER TABLE [dbo].[spare_parts] ADD [usageType] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('spare_parts') AND name = 'nature')
  ALTER TABLE [dbo].[spare_parts] ADD [nature] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('spare_parts') AND name = 'importance')
  ALTER TABLE [dbo].[spare_parts] ADD [importance] NVARCHAR(1000);

-- CreateIndex for SparePart new columns
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'spare_parts_technicalClassification_idx' AND object_id = OBJECT_ID('spare_parts'))
  CREATE NONCLUSTERED INDEX [spare_parts_technicalClassification_idx] ON [dbo].[spare_parts]([technicalClassification]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'spare_parts_usageType_idx' AND object_id = OBJECT_ID('spare_parts'))
  CREATE NONCLUSTERED INDEX [spare_parts_usageType_idx] ON [dbo].[spare_parts]([usageType]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'spare_parts_nature_idx' AND object_id = OBJECT_ID('spare_parts'))
  CREATE NONCLUSTERED INDEX [spare_parts_nature_idx] ON [dbo].[spare_parts]([nature]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'spare_parts_importance_idx' AND object_id = OBJECT_ID('spare_parts'))
  CREATE NONCLUSTERED INDEX [spare_parts_importance_idx] ON [dbo].[spare_parts]([importance]);

-- AlterTable: Warehouse — add warehouseType column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('warehouses') AND name = 'warehouseType')
  ALTER TABLE [dbo].[warehouses] ADD [warehouseType] NVARCHAR(1000);

-- CreateIndex for Warehouse warehouseType
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'warehouses_warehouseType_idx' AND object_id = OBJECT_ID('warehouses'))
  CREATE NONCLUSTERED INDEX [warehouses_warehouseType_idx] ON [dbo].[warehouses]([warehouseType]);

-- AlterTable: MaintenanceRequestRequiredPart — add cost attribution columns
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'costOwnerType')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [costOwnerType] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'costOwnerAdministrationId')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [costOwnerAdministrationId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'costDepartmentId')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [costDepartmentId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'costProductionLineId')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [costProductionLineId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'costMachineId')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [costMachineId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'costMachineComponentId')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [costMachineComponentId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'unitCost')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [unitCost] DECIMAL(18,4);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'totalCost')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [totalCost] DECIMAL(18,4);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'receivedByUserId')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [receivedByUserId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'receivedAt')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [receivedAt] DATETIME2;

-- CreateIndex for RequiredPart new columns
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'maintenance_request_required_parts_costOwnerType_idx' AND object_id = OBJECT_ID('maintenance_request_required_parts'))
  CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_costOwnerType_idx] ON [dbo].[maintenance_request_required_parts]([costOwnerType]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'maintenance_request_required_parts_costProductionLineId_idx' AND object_id = OBJECT_ID('maintenance_request_required_parts'))
  CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_costProductionLineId_idx] ON [dbo].[maintenance_request_required_parts]([costProductionLineId]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'maintenance_request_required_parts_costMachineId_idx' AND object_id = OBJECT_ID('maintenance_request_required_parts'))
  CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_costMachineId_idx] ON [dbo].[maintenance_request_required_parts]([costMachineId]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'maintenance_request_required_parts_costMachineComponentId_idx' AND object_id = OBJECT_ID('maintenance_request_required_parts'))
  CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_costMachineComponentId_idx] ON [dbo].[maintenance_request_required_parts]([costMachineComponentId]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'maintenance_request_required_parts_receivedByUserId_idx' AND object_id = OBJECT_ID('maintenance_request_required_parts'))
  CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_receivedByUserId_idx] ON [dbo].[maintenance_request_required_parts]([receivedByUserId]);

-- Update migration tracking
INSERT INTO [dbo].[_prisma_migrations] ([id], [checksum], [finished_at], [migration_name], [logs], [rolled_back_at], [started_at], [applied_steps_count])
VALUES (NEWID(), '', GETDATE(), '20260728180621_maintenance_sparepart_classification_cost_attribution', NULL, NULL, GETDATE(), 1);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
