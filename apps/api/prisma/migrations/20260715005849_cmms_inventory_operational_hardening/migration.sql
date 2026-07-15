BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[downtime_logs] ADD [cancelledAt] DATETIME2;

-- AlterTable
ALTER TABLE [dbo].[maintenance_tasks] ADD [cancelledAt] DATETIME2,
[completedAt] DATETIME2,
[startedAt] DATETIME2;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
