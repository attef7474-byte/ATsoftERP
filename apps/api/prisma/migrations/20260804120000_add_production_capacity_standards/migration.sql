SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- Phase 1.3 Product Capacity Standards.
-- Live implementation pre-flight found zero production_packagings rows. These
-- guards remain authoritative for later deployment: each non-null Float must
-- round-trip through DECIMAL(18,4) unchanged. TRY_CONVERT covers conversion
-- and range failures; FLOAT round-trip comparison rejects any rounding.
IF EXISTS (
  SELECT 1 FROM [dbo].[production_packagings]
  WHERE [packQuantity] IS NOT NULL AND (
    TRY_CONVERT(DECIMAL(18,4), [packQuantity]) IS NULL OR
    [packQuantity] <> CONVERT(FLOAT, TRY_CONVERT(DECIMAL(18,4), [packQuantity])))
)
  THROW 51013, 'Phase 1.3 blocked: production_packagings.packQuantity cannot be preserved exactly as DECIMAL(18,4).', 1;

IF EXISTS (
  SELECT 1 FROM [dbo].[production_packagings]
  WHERE [grossWeight] IS NOT NULL AND (
    TRY_CONVERT(DECIMAL(18,4), [grossWeight]) IS NULL OR
    [grossWeight] <> CONVERT(FLOAT, TRY_CONVERT(DECIMAL(18,4), [grossWeight])))
)
  THROW 51014, 'Phase 1.3 blocked: production_packagings.grossWeight cannot be preserved exactly as DECIMAL(18,4).', 1;

IF EXISTS (
  SELECT 1 FROM [dbo].[production_packagings]
  WHERE [netWeight] IS NOT NULL AND (
    TRY_CONVERT(DECIMAL(18,4), [netWeight]) IS NULL OR
    [netWeight] <> CONVERT(FLOAT, TRY_CONVERT(DECIMAL(18,4), [netWeight])))
)
  THROW 51015, 'Phase 1.3 blocked: production_packagings.netWeight cannot be preserved exactly as DECIMAL(18,4).', 1;

-- All guards deliberately precede the first destructive type alteration.
ALTER TABLE [dbo].[production_packagings] ALTER COLUMN [packQuantity] DECIMAL(18,4) NOT NULL;
ALTER TABLE [dbo].[production_packagings] ALTER COLUMN [grossWeight] DECIMAL(18,4) NULL;
ALTER TABLE [dbo].[production_packagings] ALTER COLUMN [netWeight] DECIMAL(18,4) NULL;

CREATE TABLE [dbo].[production_capacity_standards] (
  [id] NVARCHAR(1000) NOT NULL,
  [code] NVARCHAR(1000) NOT NULL,
  [revision] INT NOT NULL CONSTRAINT [production_capacity_standards_revision_df] DEFAULT 1,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [productionProductId] NVARCHAR(1000) NOT NULL,
  [productionVersionId] NVARCHAR(1000) NULL,
  [productionPackagingId] NVARCHAR(1000) NULL,
  [productionLineId] NVARCHAR(1000) NOT NULL,
  [machineId] NVARCHAR(1000) NULL,
  [standardRate] DECIMAL(18,4) NOT NULL,
  [outputUnit] NVARCHAR(1000) NOT NULL,
  [timeBasis] NVARCHAR(1000) NOT NULL,
  [standardCycleTimeMinutes] DECIMAL(18,4) NULL,
  [setupMinutes] DECIMAL(18,2) NOT NULL CONSTRAINT [production_capacity_standards_setup_df] DEFAULT 0,
  [changeoverMinutes] DECIMAL(18,2) NOT NULL CONSTRAINT [production_capacity_standards_changeover_df] DEFAULT 0,
  [cleaningMinutes] DECIMAL(18,2) NOT NULL CONSTRAINT [production_capacity_standards_cleaning_df] DEFAULT 0,
  [startupAllowanceMinutes] DECIMAL(18,2) NOT NULL CONSTRAINT [production_capacity_standards_startup_df] DEFAULT 0,
  [shutdownAllowanceMinutes] DECIMAL(18,2) NOT NULL CONSTRAINT [production_capacity_standards_shutdown_df] DEFAULT 0,
  [targetEfficiencyPercent] DECIMAL(7,4) NOT NULL,
  [expectedYieldPercent] DECIMAL(7,4) NOT NULL,
  [sourceType] NVARCHAR(1000) NOT NULL,
  [sourceReference] NVARCHAR(1000) NULL,
  [notes] NVARCHAR(1000) NULL,
  [effectiveFrom] DATETIME2 NOT NULL,
  [effectiveTo] DATETIME2 NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_capacity_standards_status_df] DEFAULT N'DRAFT',
  [supersedesId] NVARCHAR(1000) NULL,
  [lastMateriallyEditedById] NVARCHAR(1000) NOT NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [updatedById] NVARCHAR(1000) NOT NULL,
  [approvedById] NVARCHAR(1000) NULL,
  [approvedAt] DATETIME2 NULL,
  [suspendedById] NVARCHAR(1000) NULL,
  [suspendedAt] DATETIME2 NULL,
  [suspensionReason] NVARCHAR(1000) NULL,
  [archivedById] NVARCHAR(1000) NULL,
  [archivedAt] DATETIME2 NULL,
  [archiveReason] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_capacity_standards_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [production_capacity_standards_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_capacity_standards_company_branch_code_revision_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [code], [revision]),
  CONSTRAINT [production_capacity_standards_rate_ck] CHECK ([standardRate] > 0),
  CONSTRAINT [production_capacity_standards_cycle_ck] CHECK ([standardCycleTimeMinutes] IS NULL OR [standardCycleTimeMinutes] > 0),
  CONSTRAINT [production_capacity_standards_allowances_ck] CHECK ([setupMinutes] >= 0 AND [changeoverMinutes] >= 0 AND [cleaningMinutes] >= 0 AND [startupAllowanceMinutes] >= 0 AND [shutdownAllowanceMinutes] >= 0),
  CONSTRAINT [production_capacity_standards_efficiency_ck] CHECK ([targetEfficiencyPercent] > 0 AND [targetEfficiencyPercent] <= 100),
  CONSTRAINT [production_capacity_standards_yield_ck] CHECK ([expectedYieldPercent] > 0 AND [expectedYieldPercent] <= 100),
  CONSTRAINT [production_capacity_standards_dates_ck] CHECK ([effectiveTo] IS NULL OR [effectiveTo] > [effectiveFrom]),
  CONSTRAINT [production_capacity_standards_status_ck] CHECK ([status] IN (N'DRAFT', N'APPROVED', N'SUSPENDED', N'ARCHIVED')),
  CONSTRAINT [production_capacity_standards_output_unit_ck] CHECK ([outputUnit] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH')),
  CONSTRAINT [production_capacity_standards_time_basis_ck] CHECK ([timeBasis] IN (N'MINUTE', N'HOUR')),
  CONSTRAINT [production_capacity_standards_source_type_ck] CHECK ([sourceType] IN (N'MEASURED', N'ENGINEERING', N'SUPPLIER', N'HISTORICAL', N'OWNER_OVERRIDE')),
  CONSTRAINT [production_capacity_standards_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_capacity_standards_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_capacity_standards_product_fkey] FOREIGN KEY ([productionProductId]) REFERENCES [dbo].[production_product_definitions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_capacity_standards_version_fkey] FOREIGN KEY ([productionVersionId]) REFERENCES [dbo].[production_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_capacity_standards_packaging_fkey] FOREIGN KEY ([productionPackagingId]) REFERENCES [dbo].[production_packagings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_capacity_standards_line_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_capacity_standards_machine_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_capacity_standards_supersedes_fkey] FOREIGN KEY ([supersedesId]) REFERENCES [dbo].[production_capacity_standards]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_capacity_standards_tenant_status_dates_idx] ON [dbo].[production_capacity_standards]([companyId], [branchId], [status], [effectiveFrom], [effectiveTo]);
CREATE INDEX [production_capacity_standards_resolution_idx] ON [dbo].[production_capacity_standards]([companyId], [branchId], [productionProductId], [productionLineId], [machineId]);
CREATE INDEX [production_capacity_standards_version_idx] ON [dbo].[production_capacity_standards]([productionVersionId]);
CREATE INDEX [production_capacity_standards_packaging_idx] ON [dbo].[production_capacity_standards]([productionPackagingId]);
CREATE INDEX [production_capacity_standards_supersedes_idx] ON [dbo].[production_capacity_standards]([supersedesId]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
