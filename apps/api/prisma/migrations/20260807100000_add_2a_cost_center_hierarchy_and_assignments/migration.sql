SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- Phase 2 Batch 2A — stage A (additive structure).
-- Adds the CostCenter hierarchy/effective overlay columns and the new
-- operational_cost_center_assignments table. No required-field change, no
-- uniqueness change, no constraint that can fail on existing rows.
-- Existing-data impact: additive only; every existing column/row is untouched.
-- The tenant (companyId) and (companyId, code) uniqueness changes are deferred
-- to stage C after the backfill gate in stage B is proven.
-- Index and default-constraint names match Prisma's generated conventions so
-- a later `prisma migrate diff --from-migrations` reports no drift.

-- CostCenter hierarchy + effective overlay (all columns nullable / defaulted).
ALTER TABLE [dbo].[cost_centers] ADD
    [parentId]      NVARCHAR(1000) NULL,
    [effectiveFrom] DATETIME2      NULL,
    [effectiveTo]   DATETIME2      NULL,
    [isPrimary]     BIT            NOT NULL CONSTRAINT [cost_centers_isPrimary_df] DEFAULT 0;

-- Compile constraints/indexes after SQL Server can resolve the ALTER-added
-- columns on this pre-existing table.
EXEC sys.sp_executesql N'
ALTER TABLE [dbo].[cost_centers] ADD CONSTRAINT [cost_centers_effective_ck]
    CHECK ([effectiveTo] IS NULL OR [effectiveTo] >= [effectiveFrom]);

ALTER TABLE [dbo].[cost_centers] ADD CONSTRAINT [cost_centers_parentId_fkey]
    FOREIGN KEY ([parentId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [cost_centers_parentId_idx] ON [dbo].[cost_centers]([parentId]);
CREATE NONCLUSTERED INDEX [cost_centers_companyId_parentId_status_idx] ON [dbo].[cost_centers]([companyId], [parentId], [status]);
';

-- Operational cost center assignments (Phase 2 Batch 2A).
CREATE TABLE [dbo].[operational_cost_center_assignments] (
  [id]                NVARCHAR(1000) NOT NULL,
  [code]              NVARCHAR(1000) NOT NULL,
  [resourceType]      NVARCHAR(1000) NOT NULL,
  [costCenterId]      NVARCHAR(1000) NOT NULL,
  [machineId]         NVARCHAR(1000) NULL,
  [productionLineId]  NVARCHAR(1000) NULL,
  [productionUnitId]  NVARCHAR(1000) NULL,
  [effectiveFrom]     DATETIME2 NOT NULL,
  [effectiveTo]       DATETIME2 NULL,
  [priority]          INT NOT NULL CONSTRAINT [operational_cost_center_assignments_priority_df] DEFAULT 0,
  [source]            NVARCHAR(1000) NOT NULL CONSTRAINT [operational_cost_center_assignments_source_df] DEFAULT 'MANUAL',
  [reason]            NVARCHAR(1000) NULL,
  [companyId]         NVARCHAR(1000) NOT NULL,
  [branchId]          NVARCHAR(1000) NULL,
  [status]            NVARCHAR(1000) NOT NULL CONSTRAINT [operational_cost_center_assignments_status_df] DEFAULT 'DRAFT',
  [createdAt]         DATETIME2 NOT NULL CONSTRAINT [operational_cost_center_assignments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt]         DATETIME2 NOT NULL,
  [deletedAt]         DATETIME2 NULL,
  CONSTRAINT [operational_cost_center_assignments_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [operational_cost_center_assignments_code_key] UNIQUE NONCLUSTERED ([code]),
  CONSTRAINT [operational_cost_center_assignments_resource_type_ck] CHECK ([resourceType] IN (N'MACHINE', N'LINE', N'UNIT')),
  CONSTRAINT [operational_cost_center_assignments_source_ck] CHECK ([source] IN (N'MANUAL', N'BACKFILL_FROM_ORDER', N'BACKFILL_FROM_RUN', N'BACKFILL_FROM_LINE', N'BACKFILL_FROM_MACHINE', N'SYSTEM_DEFAULT')),
  CONSTRAINT [operational_cost_center_assignments_status_ck] CHECK ([status] IN (N'DRAFT', N'ACTIVE', N'ENDED')),
  CONSTRAINT [operational_cost_center_assignments_priority_ck] CHECK ([priority] >= 0),
  CONSTRAINT [operational_cost_center_assignments_effective_ck] CHECK ([effectiveTo] IS NULL OR [effectiveTo] >= [effectiveFrom]),
  CONSTRAINT [operational_cost_center_assignments_resource_shape_ck] CHECK (
    ([resourceType] = N'MACHINE' AND [machineId] IS NOT NULL AND [productionLineId] IS NULL AND [productionUnitId] IS NULL) OR
    ([resourceType] = N'LINE'    AND [machineId] IS NULL AND [productionLineId] IS NOT NULL AND [productionUnitId] IS NULL) OR
    ([resourceType] = N'UNIT'    AND [machineId] IS NULL AND [productionLineId] IS NULL AND [productionUnitId] IS NOT NULL)
  ),
  CONSTRAINT [operational_cost_center_assignments_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_center_assignments_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_center_assignments_cost_center_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_center_assignments_machine_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_center_assignments_line_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_center_assignments_unit_fkey] FOREIGN KEY ([productionUnitId]) REFERENCES [dbo].[production_units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_code_idx] ON [dbo].[operational_cost_center_assignments]([code]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_resourceType_idx] ON [dbo].[operational_cost_center_assignments]([resourceType]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_costCenterId_idx] ON [dbo].[operational_cost_center_assignments]([costCenterId]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_machineId_idx] ON [dbo].[operational_cost_center_assignments]([machineId]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_productionLineId_idx] ON [dbo].[operational_cost_center_assignments]([productionLineId]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_productionUnitId_idx] ON [dbo].[operational_cost_center_assignments]([productionUnitId]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_effectiveFrom_idx] ON [dbo].[operational_cost_center_assignments]([effectiveFrom]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_effectiveTo_idx] ON [dbo].[operational_cost_center_assignments]([effectiveTo]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_companyId_idx] ON [dbo].[operational_cost_center_assignments]([companyId]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_branchId_idx] ON [dbo].[operational_cost_center_assignments]([branchId]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_status_idx] ON [dbo].[operational_cost_center_assignments]([status]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_resourceType_machineId_effectiveFrom_effectiveTo_idx] ON [dbo].[operational_cost_center_assignments]([resourceType], [machineId], [effectiveFrom], [effectiveTo]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_resourceType_productionLineId_effectiveFrom_effectiveTo_idx] ON [dbo].[operational_cost_center_assignments]([resourceType], [productionLineId], [effectiveFrom], [effectiveTo]);
CREATE NONCLUSTERED INDEX [operational_cost_center_assignments_resourceType_productionUnitId_effectiveFrom_effectiveTo_idx] ON [dbo].[operational_cost_center_assignments]([resourceType], [productionUnitId], [effectiveFrom], [effectiveTo]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
