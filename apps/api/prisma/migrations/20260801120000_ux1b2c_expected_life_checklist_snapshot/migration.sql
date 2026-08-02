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
-- UX-1B-2C: Expected-life tracking for installed parts, installed-part
-- readings, checklist result types, and immutable checklist execution
-- snapshots. 100% additive: new nullable columns with defaults plus one new
-- table. No existing column is altered, renamed, or dropped; no backfill is
-- required because every new column has a safe default or is nullable.
--
-- Existing-data impact: none (additive only).
-- Default/backfill: warning_threshold_percent=80, life_status='UNKNOWN',
-- alert_threshold_reached='NONE' apply to existing rows on read path via
-- column defaults.
-- Rollback/recovery: drop the new table and the added columns (see migration
-- review notes); a full pre-migration backup exists at
-- C:\Users\attef\AppData\Local\Temp\opencode\ATsoftERP_DB_backup_20260801_ux1b2c.bak
-- Index impact: one new index on machine_installed_parts(life_status) for the
-- expected-life alert evaluation query path.
-- Tenant impact: none -- these entities are tenant-scoped through the owning
-- machine (machine.companyId/branchId), matching the established
-- maintenance-requests pattern; no tenant columns are added.
-- ============================================================================

-- ── 1. MaintenanceChecklistItem: result-type support ──────────────
IF COL_LENGTH(N'dbo.maintenance_checklist_items', N'resultType') IS NULL
  ALTER TABLE [dbo].[maintenance_checklist_items]
    ADD [resultType] NVARCHAR(50) NOT NULL
      CONSTRAINT [maintenance_checklist_items_resultType_df] DEFAULT N'PASS_FAIL';

IF COL_LENGTH(N'dbo.maintenance_checklist_items', N'minValue') IS NULL
  ALTER TABLE [dbo].[maintenance_checklist_items]
    ADD [minValue] FLOAT NULL;

IF COL_LENGTH(N'dbo.maintenance_checklist_items', N'maxValue') IS NULL
  ALTER TABLE [dbo].[maintenance_checklist_items]
    ADD [maxValue] FLOAT NULL;

IF COL_LENGTH(N'dbo.maintenance_checklist_items', N'unit') IS NULL
  ALTER TABLE [dbo].[maintenance_checklist_items]
    ADD [unit] NVARCHAR(100) NULL;

-- ── 2. MaintenanceChecklistExecutionItem: immutable snapshot + result ─
IF COL_LENGTH(N'dbo.maintenance_checklist_execution_items', N'itemTitleSnapshot') IS NULL
  ALTER TABLE [dbo].[maintenance_checklist_execution_items]
    ADD [itemTitleSnapshot] NVARCHAR(1000) NULL;

IF COL_LENGTH(N'dbo.maintenance_checklist_execution_items', N'itemSortOrderSnapshot') IS NULL
  ALTER TABLE [dbo].[maintenance_checklist_execution_items]
    ADD [itemSortOrderSnapshot] INT NULL;

IF COL_LENGTH(N'dbo.maintenance_checklist_execution_items', N'itemMandatorySnapshot') IS NULL
  ALTER TABLE [dbo].[maintenance_checklist_execution_items]
    ADD [itemMandatorySnapshot] BIT NULL;

IF COL_LENGTH(N'dbo.maintenance_checklist_execution_items', N'resultTypeSnapshot') IS NULL
  ALTER TABLE [dbo].[maintenance_checklist_execution_items]
    ADD [resultTypeSnapshot] NVARCHAR(50) NULL;

IF COL_LENGTH(N'dbo.maintenance_checklist_execution_items', N'minValueSnapshot') IS NULL
  ALTER TABLE [dbo].[maintenance_checklist_execution_items]
    ADD [minValueSnapshot] FLOAT NULL;

IF COL_LENGTH(N'dbo.maintenance_checklist_execution_items', N'maxValueSnapshot') IS NULL
  ALTER TABLE [dbo].[maintenance_checklist_execution_items]
    ADD [maxValueSnapshot] FLOAT NULL;

IF COL_LENGTH(N'dbo.maintenance_checklist_execution_items', N'resultValue') IS NULL
  ALTER TABLE [dbo].[maintenance_checklist_execution_items]
    ADD [resultValue] NVARCHAR(2000) NULL;

-- ── 3. MachineInstalledPart: expected-life tracking ──────────────
IF COL_LENGTH(N'dbo.machine_installed_parts', N'expected_life_value') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [expected_life_value] FLOAT NULL;

IF COL_LENGTH(N'dbo.machine_installed_parts', N'expected_life_unit') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [expected_life_unit] NVARCHAR(50) NULL;

IF COL_LENGTH(N'dbo.machine_installed_parts', N'life_start_date') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [life_start_date] DATETIME2 NULL;

IF COL_LENGTH(N'dbo.machine_installed_parts', N'life_start_reading') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [life_start_reading] FLOAT NULL;

IF COL_LENGTH(N'dbo.machine_installed_parts', N'current_reading') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [current_reading] FLOAT NULL;

IF COL_LENGTH(N'dbo.machine_installed_parts', N'warning_threshold_percent') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [warning_threshold_percent] INT NOT NULL
      CONSTRAINT [machine_installed_parts_warning_threshold_percent_df] DEFAULT 80;

IF COL_LENGTH(N'dbo.machine_installed_parts', N'expected_expiry_date') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [expected_expiry_date] DATETIME2 NULL;

IF COL_LENGTH(N'dbo.machine_installed_parts', N'expected_expiry_reading') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [expected_expiry_reading] FLOAT NULL;

IF COL_LENGTH(N'dbo.machine_installed_parts', N'life_status') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [life_status] NVARCHAR(50) NOT NULL
      CONSTRAINT [machine_installed_parts_life_status_df] DEFAULT N'UNKNOWN';

IF COL_LENGTH(N'dbo.machine_installed_parts', N'last_evaluated_at') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [last_evaluated_at] DATETIME2 NULL;

IF COL_LENGTH(N'dbo.machine_installed_parts', N'alert_threshold_reached') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [alert_threshold_reached] NVARCHAR(50) NOT NULL
      CONSTRAINT [machine_installed_parts_alert_threshold_reached_df] DEFAULT N'NONE';

IF COL_LENGTH(N'dbo.machine_installed_parts', N'expected_life_alert_at') IS NULL
  ALTER TABLE [dbo].[machine_installed_parts]
    ADD [expected_life_alert_at] DATETIME2 NULL;

-- ── 4. MachineInstalledPartReading: stored real readings ─────────
IF OBJECT_ID(N'[dbo].[machine_installed_part_readings]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[machine_installed_part_readings] (
    [id] NVARCHAR(1000) NOT NULL,
    [installedPartId] NVARCHAR(1000) NOT NULL,
    [readingType] NVARCHAR(50) NOT NULL,
    [readingValue] FLOAT NOT NULL,
    [isReset] BIT NOT NULL
      CONSTRAINT [machine_installed_part_readings_isReset_df] DEFAULT 0,
    [recordedByUserId] NVARCHAR(1000) NULL,
    [recordedAt] DATETIME2 NOT NULL
      CONSTRAINT [machine_installed_part_readings_recordedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [notes] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [machine_installed_part_readings_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [machine_installed_part_readings_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [machine_installed_part_readings_installedPartId_fkey]
      FOREIGN KEY ([installedPartId]) REFERENCES [dbo].[machine_installed_parts]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [machine_installed_part_readings_recordedByUserId_fkey]
      FOREIGN KEY ([recordedByUserId]) REFERENCES [dbo].[users]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'machine_installed_part_readings_installedPartId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[machine_installed_part_readings]')
)
  CREATE NONCLUSTERED INDEX [machine_installed_part_readings_installedPartId_idx]
    ON [dbo].[machine_installed_part_readings]([installedPartId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'machine_installed_part_readings_recordedAt_idx'
    AND object_id = OBJECT_ID(N'[dbo].[machine_installed_part_readings]')
)
  CREATE NONCLUSTERED INDEX [machine_installed_part_readings_recordedAt_idx]
    ON [dbo].[machine_installed_part_readings]([recordedAt]);

-- ── 5. Expected-life evaluation index ─────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'machine_installed_parts_lifeStatus_idx'
    AND object_id = OBJECT_ID(N'[dbo].[machine_installed_parts]')
)
  CREATE NONCLUSTERED INDEX [machine_installed_parts_lifeStatus_idx]
    ON [dbo].[machine_installed_parts]([life_status]);

-- ── 6. Record the migration in _prisma_migrations ─────────────────
IF NOT EXISTS (
  SELECT 1 FROM [dbo].[_prisma_migrations]
  WHERE [migration_name] = N'20260801120000_ux1b2c_expected_life_checklist_snapshot'
)
  INSERT INTO [dbo].[_prisma_migrations]
    ([id], [checksum], [finished_at], [migration_name], [logs],
     [rolled_back_at], [started_at], [applied_steps_count])
  VALUES
    (NEWID(), N'', GETDATE(),
     N'20260801120000_ux1b2c_expected_life_checklist_snapshot',
     NULL, NULL, GETDATE(), 1);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
