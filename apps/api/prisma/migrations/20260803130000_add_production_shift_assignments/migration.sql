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
-- Phase 1.2 (Master Plan): Production Shift & Operational Assignments slice.
-- New additive tables:
--   1. `production_shifts`                   - configurable tenant-scoped shifts.
--   2. `production_shift_templates`          - reusable weekly shift templates.
--   3. `production_shift_template_days`      - day-of-week -> shift mapping lines.
--   4. `production_shift_calendars`          - shift calendars with effective
--                                              date ranges (template based).
--   5. `production_shift_calendar_entries`   - per-date calendar override lines.
--   6. `production_shift_assignments`        - person -> shift assignments with
--                                              effective dates.
--   7. `production_operational_assignments`  - machine/line/unit -> shift
--                                              assignments with capacity and
--                                              effective dates.
-- 100% additive: new tables plus indexes. No existing column is altered,
-- renamed, or dropped.
--
-- Existing-data impact: none (new tables only).
-- Tenant impact: tenant-owned tables are scoped by companyId + branchId columns
-- (enforced in the service layer). Child tables inherit tenant scope through
-- their parent (validated in the service layer).
-- Referential targets: companies, branches, production_units, production_lines,
-- machines, operational_people - all exist.
-- ============================================================================

IF OBJECT_ID(N'[dbo].[production_shifts]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_shifts] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NULL,
    [startTime] NVARCHAR(1000) NOT NULL,
    [endTime] NVARCHAR(1000) NOT NULL,
    [durationMinutes] INT NOT NULL
      CONSTRAINT [production_shifts_durationMinutes_df] DEFAULT 480,
    [breakMinutes] INT NOT NULL
      CONSTRAINT [production_shifts_breakMinutes_df] DEFAULT 0,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_shifts_status_df] DEFAULT N'ACTIVE',
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_shifts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2 NULL,
    CONSTRAINT [production_shifts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_shifts_companyId_branchId_code_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [code]),
    CONSTRAINT [production_shifts_companyId_fkey]
      FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_shifts_branchId_fkey]
      FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[production_shift_templates]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_shift_templates] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_shift_templates_status_df] DEFAULT N'ACTIVE',
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_shift_templates_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2 NULL,
    CONSTRAINT [production_shift_templates_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_shift_templates_companyId_branchId_code_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [code]),
    CONSTRAINT [production_shift_templates_companyId_fkey]
      FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_shift_templates_branchId_fkey]
      FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[production_shift_template_days]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_shift_template_days] (
    [id] NVARCHAR(1000) NOT NULL,
    [templateId] NVARCHAR(1000) NOT NULL,
    [dayOfWeek] INT NOT NULL,
    [shiftId] NVARCHAR(1000) NOT NULL,
    [isWorkDay] BIT NOT NULL
      CONSTRAINT [production_shift_template_days_isWorkDay_df] DEFAULT 1,
    [sortOrder] INT NOT NULL
      CONSTRAINT [production_shift_template_days_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_shift_template_days_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_shift_template_days_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_shift_template_days_templateId_dayOfWeek_key] UNIQUE NONCLUSTERED ([templateId], [dayOfWeek]),
    CONSTRAINT [production_shift_template_days_templateId_fkey]
      FOREIGN KEY ([templateId]) REFERENCES [dbo].[production_shift_templates]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_shift_template_days_shiftId_fkey]
      FOREIGN KEY ([shiftId]) REFERENCES [dbo].[production_shifts]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[production_shift_calendars]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_shift_calendars] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NULL,
    [templateId] NVARCHAR(1000) NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2 NULL,
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_shift_calendars_status_df] DEFAULT N'ACTIVE',
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_shift_calendars_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2 NULL,
    CONSTRAINT [production_shift_calendars_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_shift_calendars_companyId_branchId_code_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [code]),
    CONSTRAINT [production_shift_calendars_templateId_fkey]
      FOREIGN KEY ([templateId]) REFERENCES [dbo].[production_shift_templates]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_shift_calendars_companyId_fkey]
      FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_shift_calendars_branchId_fkey]
      FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[production_shift_calendar_entries]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_shift_calendar_entries] (
    [id] NVARCHAR(1000) NOT NULL,
    [calendarId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [shiftId] NVARCHAR(1000) NULL,
    [isWorkDay] BIT NOT NULL
      CONSTRAINT [production_shift_calendar_entries_isWorkDay_df] DEFAULT 1,
    [notes] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_shift_calendar_entries_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_shift_calendar_entries_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_shift_calendar_entries_calendarId_date_key] UNIQUE NONCLUSTERED ([calendarId], [date]),
    CONSTRAINT [production_shift_calendar_entries_calendarId_fkey]
      FOREIGN KEY ([calendarId]) REFERENCES [dbo].[production_shift_calendars]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_shift_calendar_entries_shiftId_fkey]
      FOREIGN KEY ([shiftId]) REFERENCES [dbo].[production_shifts]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[production_shift_assignments]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_shift_assignments] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [shiftId] NVARCHAR(1000) NOT NULL,
    [calendarId] NVARCHAR(1000) NULL,
    [operationalPersonId] NVARCHAR(1000) NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2 NULL,
    [isPrimary] BIT NOT NULL
      CONSTRAINT [production_shift_assignments_isPrimary_df] DEFAULT 0,
    [notes] NVARCHAR(1000) NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_shift_assignments_status_df] DEFAULT N'ACTIVE',
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_shift_assignments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2 NULL,
    CONSTRAINT [production_shift_assignments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_shift_assignments_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [production_shift_assignments_shiftId_fkey]
      FOREIGN KEY ([shiftId]) REFERENCES [dbo].[production_shifts]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_shift_assignments_calendarId_fkey]
      FOREIGN KEY ([calendarId]) REFERENCES [dbo].[production_shift_calendars]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_shift_assignments_operationalPersonId_fkey]
      FOREIGN KEY ([operationalPersonId]) REFERENCES [dbo].[operational_people]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_shift_assignments_companyId_fkey]
      FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_shift_assignments_branchId_fkey]
      FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[production_operational_assignments]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_operational_assignments] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [resourceType] NVARCHAR(1000) NOT NULL,
    [machineId] NVARCHAR(1000) NULL,
    [productionLineId] NVARCHAR(1000) NULL,
    [productionUnitId] NVARCHAR(1000) NULL,
    [shiftId] NVARCHAR(1000) NULL,
    [capacityPerShift] DECIMAL(18,4) NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2 NULL,
    [isPrimary] BIT NOT NULL
      CONSTRAINT [production_operational_assignments_isPrimary_df] DEFAULT 0,
    [notes] NVARCHAR(1000) NULL,
    [createdById] NVARCHAR(1000) NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_operational_assignments_status_df] DEFAULT N'ACTIVE',
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_operational_assignments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2 NULL,
    CONSTRAINT [production_operational_assignments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_operational_assignments_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [production_operational_assignments_machineId_fkey]
      FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_operational_assignments_productionLineId_fkey]
      FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_operational_assignments_productionUnitId_fkey]
      FOREIGN KEY ([productionUnitId]) REFERENCES [dbo].[production_units]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_operational_assignments_shiftId_fkey]
      FOREIGN KEY ([shiftId]) REFERENCES [dbo].[production_shifts]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_operational_assignments_companyId_fkey]
      FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_operational_assignments_branchId_fkey]
      FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

-- production_shifts indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shifts_companyId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shifts]')
)
  CREATE NONCLUSTERED INDEX [production_shifts_companyId_idx]
    ON [dbo].[production_shifts]([companyId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shifts_branchId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shifts]')
)
  CREATE NONCLUSTERED INDEX [production_shifts_branchId_idx]
    ON [dbo].[production_shifts]([branchId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shifts_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shifts]')
)
  CREATE NONCLUSTERED INDEX [production_shifts_status_idx]
    ON [dbo].[production_shifts]([status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shifts_companyId_branchId_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shifts]')
)
  CREATE NONCLUSTERED INDEX [production_shifts_companyId_branchId_status_idx]
    ON [dbo].[production_shifts]([companyId], [branchId], [status]);

-- production_shift_templates indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_templates_companyId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_templates]')
)
  CREATE NONCLUSTERED INDEX [production_shift_templates_companyId_idx]
    ON [dbo].[production_shift_templates]([companyId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_templates_branchId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_templates]')
)
  CREATE NONCLUSTERED INDEX [production_shift_templates_branchId_idx]
    ON [dbo].[production_shift_templates]([branchId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_templates_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_templates]')
)
  CREATE NONCLUSTERED INDEX [production_shift_templates_status_idx]
    ON [dbo].[production_shift_templates]([status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_templates_companyId_branchId_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_templates]')
)
  CREATE NONCLUSTERED INDEX [production_shift_templates_companyId_branchId_status_idx]
    ON [dbo].[production_shift_templates]([companyId], [branchId], [status]);

-- production_shift_template_days indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_template_days_templateId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_template_days]')
)
  CREATE NONCLUSTERED INDEX [production_shift_template_days_templateId_idx]
    ON [dbo].[production_shift_template_days]([templateId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_template_days_shiftId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_template_days]')
)
  CREATE NONCLUSTERED INDEX [production_shift_template_days_shiftId_idx]
    ON [dbo].[production_shift_template_days]([shiftId]);

-- production_shift_calendars indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_calendars_companyId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_calendars]')
)
  CREATE NONCLUSTERED INDEX [production_shift_calendars_companyId_idx]
    ON [dbo].[production_shift_calendars]([companyId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_calendars_branchId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_calendars]')
)
  CREATE NONCLUSTERED INDEX [production_shift_calendars_branchId_idx]
    ON [dbo].[production_shift_calendars]([branchId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_calendars_templateId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_calendars]')
)
  CREATE NONCLUSTERED INDEX [production_shift_calendars_templateId_idx]
    ON [dbo].[production_shift_calendars]([templateId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_calendars_effectiveFrom_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_calendars]')
)
  CREATE NONCLUSTERED INDEX [production_shift_calendars_effectiveFrom_idx]
    ON [dbo].[production_shift_calendars]([effectiveFrom]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_calendars_effectiveTo_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_calendars]')
)
  CREATE NONCLUSTERED INDEX [production_shift_calendars_effectiveTo_idx]
    ON [dbo].[production_shift_calendars]([effectiveTo]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_calendars_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_calendars]')
)
  CREATE NONCLUSTERED INDEX [production_shift_calendars_status_idx]
    ON [dbo].[production_shift_calendars]([status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_calendars_companyId_branchId_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_calendars]')
)
  CREATE NONCLUSTERED INDEX [production_shift_calendars_companyId_branchId_status_idx]
    ON [dbo].[production_shift_calendars]([companyId], [branchId], [status]);

-- production_shift_calendar_entries indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_calendar_entries_calendarId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_calendar_entries]')
)
  CREATE NONCLUSTERED INDEX [production_shift_calendar_entries_calendarId_idx]
    ON [dbo].[production_shift_calendar_entries]([calendarId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_calendar_entries_shiftId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_calendar_entries]')
)
  CREATE NONCLUSTERED INDEX [production_shift_calendar_entries_shiftId_idx]
    ON [dbo].[production_shift_calendar_entries]([shiftId]);

-- production_shift_assignments indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_assignments_shiftId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_shift_assignments_shiftId_idx]
    ON [dbo].[production_shift_assignments]([shiftId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_assignments_calendarId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_shift_assignments_calendarId_idx]
    ON [dbo].[production_shift_assignments]([calendarId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_assignments_operationalPersonId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_shift_assignments_operationalPersonId_idx]
    ON [dbo].[production_shift_assignments]([operationalPersonId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_assignments_effectiveFrom_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_shift_assignments_effectiveFrom_idx]
    ON [dbo].[production_shift_assignments]([effectiveFrom]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_assignments_effectiveTo_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_shift_assignments_effectiveTo_idx]
    ON [dbo].[production_shift_assignments]([effectiveTo]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_assignments_companyId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_shift_assignments_companyId_idx]
    ON [dbo].[production_shift_assignments]([companyId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_assignments_branchId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_shift_assignments_branchId_idx]
    ON [dbo].[production_shift_assignments]([branchId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_assignments_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_shift_assignments_status_idx]
    ON [dbo].[production_shift_assignments]([status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_assignments_companyId_branchId_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_shift_assignments_companyId_branchId_status_idx]
    ON [dbo].[production_shift_assignments]([companyId], [branchId], [status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_shift_assignments_person_shift_dates_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_shift_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_shift_assignments_person_shift_dates_idx]
    ON [dbo].[production_shift_assignments]([operationalPersonId], [shiftId], [effectiveFrom], [effectiveTo]);

-- production_operational_assignments indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_resourceType_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_resourceType_idx]
    ON [dbo].[production_operational_assignments]([resourceType]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_machineId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_machineId_idx]
    ON [dbo].[production_operational_assignments]([machineId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_productionLineId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_productionLineId_idx]
    ON [dbo].[production_operational_assignments]([productionLineId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_productionUnitId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_productionUnitId_idx]
    ON [dbo].[production_operational_assignments]([productionUnitId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_shiftId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_shiftId_idx]
    ON [dbo].[production_operational_assignments]([shiftId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_effectiveFrom_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_effectiveFrom_idx]
    ON [dbo].[production_operational_assignments]([effectiveFrom]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_effectiveTo_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_effectiveTo_idx]
    ON [dbo].[production_operational_assignments]([effectiveTo]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_companyId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_companyId_idx]
    ON [dbo].[production_operational_assignments]([companyId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_branchId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_branchId_idx]
    ON [dbo].[production_operational_assignments]([branchId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_status_idx]
    ON [dbo].[production_operational_assignments]([status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_companyId_branchId_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_companyId_branchId_status_idx]
    ON [dbo].[production_operational_assignments]([companyId], [branchId], [status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_machine_dates_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_machine_dates_idx]
    ON [dbo].[production_operational_assignments]([resourceType], [machineId], [effectiveFrom], [effectiveTo]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_line_dates_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_line_dates_idx]
    ON [dbo].[production_operational_assignments]([resourceType], [productionLineId], [effectiveFrom], [effectiveTo]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_operational_assignments_unit_dates_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_operational_assignments]')
)
  CREATE NONCLUSTERED INDEX [production_operational_assignments_unit_dates_idx]
    ON [dbo].[production_operational_assignments]([resourceType], [productionUnitId], [effectiveFrom], [effectiveTo]);

COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  THROW;
END CATCH;
