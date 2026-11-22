BEGIN TRY

BEGIN TRAN;

-- Phase 7: additive soft-retire lifecycle for checklist template items.
-- Existing rows remain current/active (DEFAULT 1 backfills atomically).
ALTER TABLE [dbo].[maintenance_checklist_items] ADD [isActive] BIT NOT NULL CONSTRAINT [maintenance_checklist_items_isActive_df] DEFAULT 1;

EXEC(N'CREATE NONCLUSTERED INDEX [maintenance_checklist_items_scheduleId_isActive_idx] ON [dbo].[maintenance_checklist_items]([scheduleId], [isActive]);');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
