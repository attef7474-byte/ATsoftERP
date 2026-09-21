-- COST-R2D-B2: additive, initially empty tables; no backfill/business-row mutation.
-- Existing B1/MIG-PROV objects and history are unchanged. Preserve legacy FK widths.
-- Defaults initialize only new rows. Index impacts are in the complete key matrix.
-- Recovery: retain a verified COPY_ONLY backup and old artifacts before deployment.
-- SQL failure rolls back; after successful commit do not destructively undo business
-- writes. Use the reviewed additive-schema/old-artifact recovery plan under service stop.
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.operational_overhead_period_allocations',N'U') IS NOT NULL THROW 51001, 'Unexpected existing B2 table: operational_overhead_period_allocations', 1;
IF OBJECT_ID(N'dbo.operational_overhead_allocation_lines',N'U') IS NOT NULL THROW 51001, 'Unexpected existing B2 table: operational_overhead_allocation_lines', 1;
IF OBJECT_ID(N'dbo.operational_overhead_allocation_sources',N'U') IS NOT NULL THROW 51001, 'Unexpected existing B2 table: operational_overhead_allocation_sources', 1;

CREATE TABLE [dbo].[operational_overhead_period_allocations] (
  [id] NVARCHAR(200) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [companyKey] NVARCHAR(200) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [branchKey] NVARCHAR(200) NOT NULL,
  [periodId] NVARCHAR(200) NOT NULL,
  [version] INT NOT NULL CONSTRAINT [ohoa_version_df] DEFAULT 1,
  [status] NVARCHAR(10) NOT NULL CONSTRAINT [ohoa_status_df] DEFAULT 'DRAFT',
  [clientRequestId] NVARCHAR(200) NOT NULL,
  [notes] NVARCHAR(2000) NULL,
  [currencyCode] NVARCHAR(3) NOT NULL,
  [periodFrom] DATETIME2(7) NOT NULL,
  [periodTo] DATETIME2(7) NOT NULL,
  [createdAt] DATETIME2(7) NOT NULL CONSTRAINT [ohoa_created_df] DEFAULT GETUTCDATE(),
  [updatedAt] DATETIME2(7) NOT NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [updatedById] NVARCHAR(1000) NOT NULL,
  [finalizedAt] DATETIME2(7) NULL,
  [finalizedById] NVARCHAR(1000) NULL,
  CONSTRAINT [ohoa_company_fk] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohoa_branch_fk] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohoa_period_fk] FOREIGN KEY ([periodId]) REFERENCES [dbo].[operational_overhead_periods] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohoa_pk] PRIMARY KEY CLUSTERED ([id])
);
CREATE UNIQUE NONCLUSTERED INDEX [ohoa_period_uq] ON [dbo].[operational_overhead_period_allocations] ([periodId]);
CREATE UNIQUE NONCLUSTERED INDEX [ohoa_request_uq] ON [dbo].[operational_overhead_period_allocations] ([companyKey], [branchKey], [clientRequestId]);
CREATE NONCLUSTERED INDEX [ohoa_scope_ix] ON [dbo].[operational_overhead_period_allocations] ([companyKey], [branchKey], [status], [createdAt]);
ALTER TABLE [dbo].[operational_overhead_period_allocations] WITH CHECK ADD CONSTRAINT [ohoa_status_ck] CHECK ([status] IN ('DRAFT','FINAL'));
ALTER TABLE [dbo].[operational_overhead_period_allocations] CHECK CONSTRAINT [ohoa_status_ck];
ALTER TABLE [dbo].[operational_overhead_period_allocations] WITH CHECK ADD CONSTRAINT [ohoa_version_ck] CHECK ([version] = 1);
ALTER TABLE [dbo].[operational_overhead_period_allocations] CHECK CONSTRAINT [ohoa_version_ck];
ALTER TABLE [dbo].[operational_overhead_period_allocations] WITH CHECK ADD CONSTRAINT [ohoa_final_ck] CHECK (([status]='DRAFT' AND [finalizedAt] IS NULL AND [finalizedById] IS NULL) OR ([status]='FINAL' AND [finalizedAt] IS NOT NULL AND [finalizedById] IS NOT NULL));
ALTER TABLE [dbo].[operational_overhead_period_allocations] CHECK CONSTRAINT [ohoa_final_ck];
ALTER TABLE [dbo].[operational_overhead_period_allocations] WITH CHECK ADD CONSTRAINT [ohoa_range_ck] CHECK ([periodFrom] < [periodTo]);
ALTER TABLE [dbo].[operational_overhead_period_allocations] CHECK CONSTRAINT [ohoa_range_ck];
ALTER TABLE [dbo].[operational_overhead_period_allocations] WITH CHECK ADD CONSTRAINT [ohoa_companyKey_ck] CHECK (DATALENGTH([companyId]) <= 400 AND DATALENGTH([companyKey]) = DATALENGTH([companyId]) AND [companyKey] COLLATE Latin1_General_100_BIN2 = [companyId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_period_allocations] CHECK CONSTRAINT [ohoa_companyKey_ck];
ALTER TABLE [dbo].[operational_overhead_period_allocations] WITH CHECK ADD CONSTRAINT [ohoa_branchKey_ck] CHECK (DATALENGTH([branchId]) <= 400 AND DATALENGTH([branchKey]) = DATALENGTH([branchId]) AND [branchKey] COLLATE Latin1_General_100_BIN2 = [branchId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_period_allocations] CHECK CONSTRAINT [ohoa_branchKey_ck];
ALTER TABLE [dbo].[operational_overhead_period_allocations] WITH CHECK ADD CONSTRAINT [ohoa_currency_ck] CHECK (DATALENGTH([currencyCode]) = 6 AND [currencyCode] COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^A-Z]%');
ALTER TABLE [dbo].[operational_overhead_period_allocations] CHECK CONSTRAINT [ohoa_currency_ck];

CREATE TABLE [dbo].[operational_overhead_allocation_lines] (
  [id] NVARCHAR(200) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [companyKey] NVARCHAR(200) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [branchKey] NVARCHAR(200) NOT NULL,
  [allocationId] NVARCHAR(200) NOT NULL,
  [periodId] NVARCHAR(200) NOT NULL,
  [productionRunId] NVARCHAR(1000) NOT NULL,
  [productionRunKey] NVARCHAR(200) NOT NULL,
  [costSnapshotId] NVARCHAR(191) NOT NULL,
  [destinationCostCenterId] NVARCHAR(1000) NOT NULL,
  [destinationCostCenterKey] NVARCHAR(200) NOT NULL,
  [costPurpose] NVARCHAR(30) NOT NULL,
  [driverType] NVARCHAR(40) NOT NULL,
  [driverQuantity] DECIMAL(18,4) NOT NULL,
  [driverUnit] NVARCHAR(1000) NOT NULL,
  [poolAmount] DECIMAL(38,4) NOT NULL,
  [totalDriver] DECIMAL(38,4) NOT NULL,
  [allocatedAmount] DECIMAL(19,4) NOT NULL,
  [currencyCode] NVARCHAR(3) NOT NULL,
  [runCostClosedAt] DATETIME2(7) NOT NULL,
  [runNumberSnapshot] NVARCHAR(1000) NOT NULL,
  [costCenterCodeSnapshot] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2(7) NOT NULL CONSTRAINT [ohol_created_df] DEFAULT GETUTCDATE(),
  CONSTRAINT [ohol_company_fk] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohol_branch_fk] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohol_allocation_fk] FOREIGN KEY ([allocationId]) REFERENCES [dbo].[operational_overhead_period_allocations] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohol_period_fk] FOREIGN KEY ([periodId]) REFERENCES [dbo].[operational_overhead_periods] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohol_productionRun_fk] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohol_costSnapshot_fk] FOREIGN KEY ([costSnapshotId]) REFERENCES [dbo].[production_run_cost_snapshots] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohol_destinationCostCenter_fk] FOREIGN KEY ([destinationCostCenterId]) REFERENCES [dbo].[cost_centers] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohol_pk] PRIMARY KEY CLUSTERED ([id])
);
CREATE UNIQUE NONCLUSTERED INDEX [ohol_target_purpose_uq] ON [dbo].[operational_overhead_allocation_lines] ([allocationId], [productionRunKey], [costPurpose]);
ALTER TABLE [dbo].[operational_overhead_allocation_lines] WITH CHECK ADD CONSTRAINT [ohol_amount_ck] CHECK ([allocatedAmount] > 0 AND [poolAmount] > 0);
ALTER TABLE [dbo].[operational_overhead_allocation_lines] CHECK CONSTRAINT [ohol_amount_ck];
ALTER TABLE [dbo].[operational_overhead_allocation_lines] WITH CHECK ADD CONSTRAINT [ohol_driver_ck] CHECK ([driverQuantity] > 0 AND [totalDriver] >= [driverQuantity]);
ALTER TABLE [dbo].[operational_overhead_allocation_lines] CHECK CONSTRAINT [ohol_driver_ck];
ALTER TABLE [dbo].[operational_overhead_allocation_lines] WITH CHECK ADD CONSTRAINT [ohol_driver_type_ck] CHECK ([driverType] = 'FINAL_GOOD_OUTPUT_QUANTITY');
ALTER TABLE [dbo].[operational_overhead_allocation_lines] CHECK CONSTRAINT [ohol_driver_type_ck];
ALTER TABLE [dbo].[operational_overhead_allocation_lines] WITH CHECK ADD CONSTRAINT [ohol_purpose_ck] CHECK ([costPurpose] IN ('MAINTENANCE','PRODUCTION','QUALITY','PROJECT','UTILITIES','ADMIN','DEVELOPMENT','OTHER'));
ALTER TABLE [dbo].[operational_overhead_allocation_lines] CHECK CONSTRAINT [ohol_purpose_ck];
ALTER TABLE [dbo].[operational_overhead_allocation_lines] WITH CHECK ADD CONSTRAINT [ohol_companyKey_ck] CHECK (DATALENGTH([companyId]) <= 400 AND DATALENGTH([companyKey]) = DATALENGTH([companyId]) AND [companyKey] COLLATE Latin1_General_100_BIN2 = [companyId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_allocation_lines] CHECK CONSTRAINT [ohol_companyKey_ck];
ALTER TABLE [dbo].[operational_overhead_allocation_lines] WITH CHECK ADD CONSTRAINT [ohol_branchKey_ck] CHECK (DATALENGTH([branchId]) <= 400 AND DATALENGTH([branchKey]) = DATALENGTH([branchId]) AND [branchKey] COLLATE Latin1_General_100_BIN2 = [branchId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_allocation_lines] CHECK CONSTRAINT [ohol_branchKey_ck];
ALTER TABLE [dbo].[operational_overhead_allocation_lines] WITH CHECK ADD CONSTRAINT [ohol_productionRunKey_ck] CHECK (DATALENGTH([productionRunId]) <= 400 AND DATALENGTH([productionRunKey]) = DATALENGTH([productionRunId]) AND [productionRunKey] COLLATE Latin1_General_100_BIN2 = [productionRunId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_allocation_lines] CHECK CONSTRAINT [ohol_productionRunKey_ck];
ALTER TABLE [dbo].[operational_overhead_allocation_lines] WITH CHECK ADD CONSTRAINT [ohol_destinationCostCenterKey_ck] CHECK (DATALENGTH([destinationCostCenterId]) <= 400 AND DATALENGTH([destinationCostCenterKey]) = DATALENGTH([destinationCostCenterId]) AND [destinationCostCenterKey] COLLATE Latin1_General_100_BIN2 = [destinationCostCenterId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_allocation_lines] CHECK CONSTRAINT [ohol_destinationCostCenterKey_ck];
ALTER TABLE [dbo].[operational_overhead_allocation_lines] WITH CHECK ADD CONSTRAINT [ohol_currency_ck] CHECK (DATALENGTH([currencyCode]) = 6 AND [currencyCode] COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^A-Z]%');
ALTER TABLE [dbo].[operational_overhead_allocation_lines] CHECK CONSTRAINT [ohol_currency_ck];

CREATE TABLE [dbo].[operational_overhead_allocation_sources] (
  [sourceEntryId] NVARCHAR(200) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [companyKey] NVARCHAR(200) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [branchKey] NVARCHAR(200) NOT NULL,
  [allocationId] NVARCHAR(200) NOT NULL,
  [createdAt] DATETIME2(7) NOT NULL CONSTRAINT [ohos_created_df] DEFAULT GETUTCDATE(),
  CONSTRAINT [ohos_company_fk] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohos_branch_fk] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohos_allocation_fk] FOREIGN KEY ([allocationId]) REFERENCES [dbo].[operational_overhead_period_allocations] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohos_sourceEntry_fk] FOREIGN KEY ([sourceEntryId]) REFERENCES [dbo].[operational_overhead_entries] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [ohos_pk] PRIMARY KEY CLUSTERED ([sourceEntryId])
);
CREATE NONCLUSTERED INDEX [ohos_allocation_ix] ON [dbo].[operational_overhead_allocation_sources] ([allocationId], [sourceEntryId]);
ALTER TABLE [dbo].[operational_overhead_allocation_sources] WITH CHECK ADD CONSTRAINT [ohos_companyKey_ck] CHECK (DATALENGTH([companyId]) <= 400 AND DATALENGTH([companyKey]) = DATALENGTH([companyId]) AND [companyKey] COLLATE Latin1_General_100_BIN2 = [companyId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_allocation_sources] CHECK CONSTRAINT [ohos_companyKey_ck];
ALTER TABLE [dbo].[operational_overhead_allocation_sources] WITH CHECK ADD CONSTRAINT [ohos_branchKey_ck] CHECK (DATALENGTH([branchId]) <= 400 AND DATALENGTH([branchKey]) = DATALENGTH([branchId]) AND [branchKey] COLLATE Latin1_General_100_BIN2 = [branchId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_allocation_sources] CHECK CONSTRAINT [ohos_branchKey_ck];

COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
