BEGIN TRY

BEGIN TRAN;

-- Phase 8: additive starter identity. Never rewrites the Phase 3 migration.
-- User foreign keys and nullable String columns are NVARCHAR(1000) in this schema.
ALTER TABLE [dbo].[maintenance_checklist_executions] ADD [startedById] NVARCHAR(1000);

-- Preserve the unit shown to the operator at execution start.
ALTER TABLE [dbo].[maintenance_checklist_execution_items] ADD [unitSnapshot] NVARCHAR(1000);

-- Historical rows used completedById for the starter. Preserve that actor as
-- the starter; the completer column is left untouched for completed history.
-- EXEC defers compilation until after the ALTER above has committed its column
-- within this transaction; a direct UPDATE in the same batch fails with 207.
EXEC(N'UPDATE [dbo].[maintenance_checklist_executions]
SET [startedById] = [completedById]
WHERE [startedById] IS NULL AND [completedById] IS NOT NULL;');

EXEC(N'ALTER TABLE [dbo].[maintenance_checklist_executions] ADD CONSTRAINT [maintenance_checklist_executions_startedById_fkey] FOREIGN KEY ([startedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;');

EXEC(N'CREATE NONCLUSTERED INDEX [maintenance_checklist_executions_startedById_idx] ON [dbo].[maintenance_checklist_executions]([startedById]);');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
