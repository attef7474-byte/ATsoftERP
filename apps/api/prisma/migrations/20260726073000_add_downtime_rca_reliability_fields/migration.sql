BEGIN TRY
  BEGIN TRANSACTION;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'failureCause')
    ALTER TABLE [downtime_logs] ADD [failureCause] NVARCHAR(1000) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'failureCategory')
    ALTER TABLE [downtime_logs] ADD [failureCategory] NVARCHAR(100) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'rootCause')
    ALTER TABLE [downtime_logs] ADD [rootCause] NVARCHAR(2000) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'correctiveAction')
    ALTER TABLE [downtime_logs] ADD [correctiveAction] NVARCHAR(2000) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'preventiveAction')
    ALTER TABLE [downtime_logs] ADD [preventiveAction] NVARCHAR(2000) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'detectedAt')
    ALTER TABLE [downtime_logs] ADD [detectedAt] DATETIME2 NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'responseStartedAt')
    ALTER TABLE [downtime_logs] ADD [responseStartedAt] DATETIME2 NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'repairStartedAt')
    ALTER TABLE [downtime_logs] ADD [repairStartedAt] DATETIME2 NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'repairCompletedAt')
    ALTER TABLE [downtime_logs] ADD [repairCompletedAt] DATETIME2 NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'isRepeatFailure')
    ALTER TABLE [downtime_logs] ADD [isRepeatFailure] BIT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'repeatedFailureGroupId')
    ALTER TABLE [downtime_logs] ADD [repeatedFailureGroupId] NVARCHAR(100) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'machineStopped')
    ALTER TABLE [downtime_logs] ADD [machineStopped] BIT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'productionImpact')
    ALTER TABLE [downtime_logs] ADD [productionImpact] NVARCHAR(1000) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'rcaStatus')
    ALTER TABLE [downtime_logs] ADD [rcaStatus] NVARCHAR(50) NULL CONSTRAINT [DF_downtime_logs_rcaStatus] DEFAULT N'PENDING';
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'rcaCompletedByUserId')
    ALTER TABLE [downtime_logs] ADD [rcaCompletedByUserId] NVARCHAR(1000) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'downtime_logs') AND name = N'rcaCompletedAt')
    ALTER TABLE [downtime_logs] ADD [rcaCompletedAt] DATETIME2 NULL;

  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  THROW;
END CATCH;
