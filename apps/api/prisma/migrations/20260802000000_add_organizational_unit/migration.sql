SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- ============================================================================
-- Phase 0 (Master Plan): OrganizationalUnit tree model.
-- New additive table `organizational_units` linking to company + branch with an
-- optional parent for the org tree. 100% additive: a new table plus indexes.
-- No existing column is altered, renamed, or dropped.
--
-- Existing-data impact: none (new table only).
-- Rollback/recovery: drop the table (see migration review notes); pre-migration
-- backup exists at C:\Users\attef\AppData\Local\Temp\opencode\ATsoftERP_DB_backup_20260801_ux1b2c.bak
-- Index impact: one nonclustered index per real query path (company, branch,
-- parent tree, type, status, company+status).
-- Tenant impact: the table is tenant-scoped by companyId + branchId columns
-- (enforced in the service layer); unique code is scoped per branch.
-- ============================================================================

IF OBJECT_ID(N'[dbo].[organizational_units]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[organizational_units] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [parentId] NVARCHAR(1000) NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL
      CONSTRAINT [organizational_units_type_df] DEFAULT N'DEPARTMENT',
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [organizational_units_status_df] DEFAULT N'ACTIVE',
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [organizational_units_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2 NULL,
    CONSTRAINT [organizational_units_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [organizational_units_branchId_code_key] UNIQUE NONCLUSTERED ([branchId], [code]),
    CONSTRAINT [organizational_units_companyId_fkey]
      FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [organizational_units_branchId_fkey]
      FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [organizational_units_parentId_fkey]
      FOREIGN KEY ([parentId]) REFERENCES [dbo].[organizational_units]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'organizational_units_companyId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[organizational_units]')
)
  CREATE NONCLUSTERED INDEX [organizational_units_companyId_idx]
    ON [dbo].[organizational_units]([companyId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'organizational_units_branchId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[organizational_units]')
)
  CREATE NONCLUSTERED INDEX [organizational_units_branchId_idx]
    ON [dbo].[organizational_units]([branchId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'organizational_units_parentId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[organizational_units]')
)
  CREATE NONCLUSTERED INDEX [organizational_units_parentId_idx]
    ON [dbo].[organizational_units]([parentId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'organizational_units_type_idx'
    AND object_id = OBJECT_ID(N'[dbo].[organizational_units]')
)
  CREATE NONCLUSTERED INDEX [organizational_units_type_idx]
    ON [dbo].[organizational_units]([type]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'organizational_units_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[organizational_units]')
)
  CREATE NONCLUSTERED INDEX [organizational_units_status_idx]
    ON [dbo].[organizational_units]([status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'organizational_units_createdAt_idx'
    AND object_id = OBJECT_ID(N'[dbo].[organizational_units]')
)
  CREATE NONCLUSTERED INDEX [organizational_units_createdAt_idx]
    ON [dbo].[organizational_units]([createdAt]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'organizational_units_companyId_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[organizational_units]')
)
  CREATE NONCLUSTERED INDEX [organizational_units_companyId_status_idx]
    ON [dbo].[organizational_units]([companyId], [status]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
