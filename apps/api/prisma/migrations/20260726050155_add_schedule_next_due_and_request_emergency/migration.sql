BEGIN TRY

BEGIN TRAN;

-- AlterTable: maintenance_requests add isEmergency
ALTER TABLE [dbo].[maintenance_requests] ADD [isEmergency] BIT;

-- AlterTable: maintenance_schedules add nextDueDate, lastGeneratedAt
ALTER TABLE [dbo].[maintenance_schedules] ADD [nextDueDate] DATETIME2;
ALTER TABLE [dbo].[maintenance_schedules] ADD [lastGeneratedAt] DATETIME2;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
    ROLLBACK TRAN;

THROW;

END CATCH
