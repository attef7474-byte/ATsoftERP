-- Phase 3: spare-part catalog standard expected life.
--
-- ADDITIVE ONLY. Adds three nullable columns to dbo.spare_parts. No row is
-- backfilled, no existing value is changed, and no installed part, reading,
-- inventory movement, balance, product, or replacement history is touched.
-- NULL is a valid legacy state meaning "standard expected life not defined".
-- SQL Server compiles a batch before execution, so statements referencing the
-- new columns run in a later sp_executesql batch.

BEGIN TRY
BEGIN TRAN;

IF COL_LENGTH('dbo.spare_parts', 'default_expected_life_value') IS NULL
  ALTER TABLE [dbo].[spare_parts] ADD [default_expected_life_value] FLOAT NULL;

IF COL_LENGTH('dbo.spare_parts', 'default_expected_life_unit') IS NULL
  ALTER TABLE [dbo].[spare_parts] ADD [default_expected_life_unit] NVARCHAR(20) NULL;

IF COL_LENGTH('dbo.spare_parts', 'default_warning_threshold_percent') IS NULL
  ALTER TABLE [dbo].[spare_parts] ADD [default_warning_threshold_percent] INT NULL;

EXEC sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''spare_part_default_life_unit_ck'' AND parent_object_id = OBJECT_ID(N''dbo.spare_parts''))
  ALTER TABLE [dbo].[spare_parts] WITH CHECK ADD CONSTRAINT [spare_part_default_life_unit_ck]
    CHECK ([default_expected_life_unit] IS NULL OR [default_expected_life_unit] IN (N''DAYS'', N''HOURS'', N''CYCLES''));
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''spare_part_default_life_unit_ck'' AND parent_object_id = OBJECT_ID(N''dbo.spare_parts''))
  ALTER TABLE [dbo].[spare_parts] CHECK CONSTRAINT [spare_part_default_life_unit_ck];
';

EXEC sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''spare_part_default_life_value_ck'' AND parent_object_id = OBJECT_ID(N''dbo.spare_parts''))
  ALTER TABLE [dbo].[spare_parts] WITH CHECK ADD CONSTRAINT [spare_part_default_life_value_ck]
    CHECK (
      ([default_expected_life_value] IS NULL AND [default_expected_life_unit] IS NULL)
      OR ([default_expected_life_value] > 0 AND [default_expected_life_unit] IS NOT NULL)
    );
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''spare_part_default_life_value_ck'' AND parent_object_id = OBJECT_ID(N''dbo.spare_parts''))
  ALTER TABLE [dbo].[spare_parts] CHECK CONSTRAINT [spare_part_default_life_value_ck];
';

EXEC sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''spare_part_default_warning_ck'' AND parent_object_id = OBJECT_ID(N''dbo.spare_parts''))
  ALTER TABLE [dbo].[spare_parts] WITH CHECK ADD CONSTRAINT [spare_part_default_warning_ck]
    CHECK ([default_warning_threshold_percent] IS NULL OR ([default_warning_threshold_percent] >= 1 AND [default_warning_threshold_percent] <= 99));
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''spare_part_default_warning_ck'' AND parent_object_id = OBJECT_ID(N''dbo.spare_parts''))
  ALTER TABLE [dbo].[spare_parts] CHECK CONSTRAINT [spare_part_default_warning_ck];
';

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
