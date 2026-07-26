BEGIN TRY
  BEGIN TRANSACTION;

  ALTER TABLE [maintenance_checklist_items] ADD [isMandatory] BIT NOT NULL CONSTRAINT [DF_maintenance_checklist_items_isMandatory] DEFAULT 0;

  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  THROW;
END CATCH;
