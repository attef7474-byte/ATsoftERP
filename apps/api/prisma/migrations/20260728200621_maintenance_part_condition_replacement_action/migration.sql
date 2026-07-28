BEGIN TRY
BEGIN TRAN;

-- AlterTable: MaintenanceRequestRequiredPart — add condition, replacement action, removed part tracking
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'issuedStockCondition')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [issuedStockCondition] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'replacementAction')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [replacementAction] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'removedPartCondition')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [removedPartCondition] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'removedPartWarehouseId')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [removedPartWarehouseId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'removedPartQuantity')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [removedPartQuantity] FLOAT;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'removedPartReturnedByUserId')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [removedPartReturnedByUserId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'removedPartReceivedByUserId')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [removedPartReceivedByUserId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'removedPartReturnedAt')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [removedPartReturnedAt] DATETIME2;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'noReturnReason')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [noReturnReason] NVARCHAR(4000);

-- CreateIndex for condition / replacement / removed-part columns
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'maintenance_request_required_parts_issuedStockCondition_idx' AND object_id = OBJECT_ID('maintenance_request_required_parts'))
  CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_issuedStockCondition_idx] ON [dbo].[maintenance_request_required_parts]([issuedStockCondition]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'maintenance_request_required_parts_replacementAction_idx' AND object_id = OBJECT_ID('maintenance_request_required_parts'))
  CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_replacementAction_idx] ON [dbo].[maintenance_request_required_parts]([replacementAction]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'maintenance_request_required_parts_removedPartCondition_idx' AND object_id = OBJECT_ID('maintenance_request_required_parts'))
  CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_removedPartCondition_idx] ON [dbo].[maintenance_request_required_parts]([removedPartCondition]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'maintenance_request_required_parts_removedPartWarehouseId_idx' AND object_id = OBJECT_ID('maintenance_request_required_parts'))
  CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_removedPartWarehouseId_idx] ON [dbo].[maintenance_request_required_parts]([removedPartWarehouseId]);

-- Update migration tracking
INSERT INTO [dbo].[_prisma_migrations] ([id], [checksum], [finished_at], [migration_name], [logs], [rolled_back_at], [started_at], [applied_steps_count])
VALUES (NEWID(), '', GETDATE(), '20260728200621_maintenance_part_condition_replacement_action', NULL, NULL, GETDATE(), 1);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
