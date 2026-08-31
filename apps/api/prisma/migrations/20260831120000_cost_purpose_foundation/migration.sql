BEGIN TRY
BEGIN TRAN;

-- Cost Purpose R1 — canonical "WHY" attribution foundation (all additive, nullable, backward compatible)

-- AlterTable: MaintenanceRequestRequiredPart — add canonical Cost Purpose + override reason
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'costPurpose')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [costPurpose] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('maintenance_request_required_parts') AND name = 'costPurposeOverrideReason')
  ALTER TABLE [dbo].[maintenance_request_required_parts] ADD [costPurposeOverrideReason] NVARCHAR(1000);

-- CreateIndex for MaintenanceRequestRequiredPart new columns
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'maintenance_request_required_parts_costPurpose_idx' AND object_id = OBJECT_ID('maintenance_request_required_parts'))
  CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_costPurpose_idx] ON [dbo].[maintenance_request_required_parts]([costPurpose]);

-- AlterTable: ProductionMaterialDocumentLine — add canonical Cost Purpose, override reason, and
-- historical attribution snapshots (productionLineId/departmentId/costCenterId/machineId).
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_material_document_lines') AND name = 'costPurpose')
  ALTER TABLE [dbo].[production_material_document_lines] ADD [costPurpose] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_material_document_lines') AND name = 'costPurposeOverrideReason')
  ALTER TABLE [dbo].[production_material_document_lines] ADD [costPurposeOverrideReason] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_material_document_lines') AND name = 'productionLineId')
  ALTER TABLE [dbo].[production_material_document_lines] ADD [productionLineId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_material_document_lines') AND name = 'departmentId')
  ALTER TABLE [dbo].[production_material_document_lines] ADD [departmentId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_material_document_lines') AND name = 'costCenterId')
  ALTER TABLE [dbo].[production_material_document_lines] ADD [costCenterId] NVARCHAR(1000);
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_material_document_lines') AND name = 'machineId')
  ALTER TABLE [dbo].[production_material_document_lines] ADD [machineId] NVARCHAR(1000);

-- CreateIndex for ProductionMaterialDocumentLine new columns
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'production_material_document_lines_costPurpose_idx' AND object_id = OBJECT_ID('production_material_document_lines'))
  CREATE NONCLUSTERED INDEX [production_material_document_lines_costPurpose_idx] ON [dbo].[production_material_document_lines]([costPurpose]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'production_material_document_lines_productionLineId_idx' AND object_id = OBJECT_ID('production_material_document_lines'))
  CREATE NONCLUSTERED INDEX [production_material_document_lines_productionLineId_idx] ON [dbo].[production_material_document_lines]([productionLineId]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'production_material_document_lines_departmentId_idx' AND object_id = OBJECT_ID('production_material_document_lines'))
  CREATE NONCLUSTERED INDEX [production_material_document_lines_departmentId_idx] ON [dbo].[production_material_document_lines]([departmentId]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'production_material_document_lines_costCenterId_idx' AND object_id = OBJECT_ID('production_material_document_lines'))
  CREATE NONCLUSTERED INDEX [production_material_document_lines_costCenterId_idx] ON [dbo].[production_material_document_lines]([costCenterId]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'production_material_document_lines_machineId_idx' AND object_id = OBJECT_ID('production_material_document_lines'))
  CREATE NONCLUSTERED INDEX [production_material_document_lines_machineId_idx] ON [dbo].[production_material_document_lines]([machineId]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
