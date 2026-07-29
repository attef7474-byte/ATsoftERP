SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- Additive operational access model. Existing User organization columns remain
-- unchanged and continue to provide the documented legacy fallback.
IF OBJECT_ID(N'[dbo].[user_operational_scopes]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[user_operational_scopes] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [administrationId] NVARCHAR(1000) NULL,
    [departmentId] NVARCHAR(1000) NULL,
    [isDefault] BIT NOT NULL
      CONSTRAINT [user_operational_scopes_isDefault_df] DEFAULT 0,
    [status] NVARCHAR(50) NOT NULL
      CONSTRAINT [user_operational_scopes_status_df] DEFAULT N'ACTIVE',
    [notes] NVARCHAR(MAX) NULL,
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [user_operational_scopes_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2 NULL,
    CONSTRAINT [user_operational_scopes_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [user_operational_scopes_userId_fkey]
      FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [user_operational_scopes_companyId_fkey]
      FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [user_operational_scopes_branchId_fkey]
      FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [user_operational_scopes_administrationId_fkey]
      FOREIGN KEY ([administrationId]) REFERENCES [dbo].[administrations]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [user_operational_scopes_departmentId_fkey]
      FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'user_operational_scopes_userId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[user_operational_scopes]')
)
  CREATE NONCLUSTERED INDEX [user_operational_scopes_userId_idx]
    ON [dbo].[user_operational_scopes]([userId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'user_operational_scopes_userId_isDefault_idx'
    AND object_id = OBJECT_ID(N'[dbo].[user_operational_scopes]')
)
  CREATE NONCLUSTERED INDEX [user_operational_scopes_userId_isDefault_idx]
    ON [dbo].[user_operational_scopes]([userId], [isDefault]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'user_operational_scopes_companyId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[user_operational_scopes]')
)
  CREATE NONCLUSTERED INDEX [user_operational_scopes_companyId_idx]
    ON [dbo].[user_operational_scopes]([companyId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'user_operational_scopes_branchId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[user_operational_scopes]')
)
  CREATE NONCLUSTERED INDEX [user_operational_scopes_branchId_idx]
    ON [dbo].[user_operational_scopes]([branchId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'user_operational_scopes_administrationId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[user_operational_scopes]')
)
  CREATE NONCLUSTERED INDEX [user_operational_scopes_administrationId_idx]
    ON [dbo].[user_operational_scopes]([administrationId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'user_operational_scopes_departmentId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[user_operational_scopes]')
)
  CREATE NONCLUSTERED INDEX [user_operational_scopes_departmentId_idx]
    ON [dbo].[user_operational_scopes]([departmentId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'user_operational_scopes_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[user_operational_scopes]')
)
  CREATE NONCLUSTERED INDEX [user_operational_scopes_status_idx]
    ON [dbo].[user_operational_scopes]([status]);

-- SQL Server filtered uniqueness guarantees at most one active default scope
-- per user without changing or backfilling existing User assignments.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'user_operational_scopes_one_active_default_uidx'
    AND object_id = OBJECT_ID(N'[dbo].[user_operational_scopes]')
)
  CREATE UNIQUE NONCLUSTERED INDEX
    [user_operational_scopes_one_active_default_uidx]
    ON [dbo].[user_operational_scopes]([userId])
    WHERE [isDefault] = 1 AND [deletedAt] IS NULL;

IF OBJECT_ID(N'[dbo].[_prisma_migrations]', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM [dbo].[_prisma_migrations]
    WHERE [migration_name] = N'20260729120000_add_user_operational_scopes'
      AND [rolled_back_at] IS NULL
  )
BEGIN
  INSERT INTO [dbo].[_prisma_migrations]
    ([id], [checksum], [finished_at], [migration_name], [logs],
     [rolled_back_at], [started_at], [applied_steps_count])
  VALUES
    (NEWID(), N'', GETDATE(),
     N'20260729120000_add_user_operational_scopes',
     NULL, NULL, GETDATE(), 1);
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
