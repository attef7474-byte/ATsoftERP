-- COST-R2D-B1: additive source/period foundation; no allocation or ledger writes.
-- Existing data: unchanged; no backfill. Recovery: restore verified predeployment backup.
-- IDs use NVARCHAR(200); legacy FK sources retain 1000 with exact bounded mirrors.
-- Theoretical key matrix is documented in the B1 proof; maximum key=1200 bytes.
-- No historical migration or history row changes.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;
IF OBJECT_ID(N'dbo.operational_overhead_periods') IS NOT NULL OR OBJECT_ID(N'dbo.operational_overhead_entries') IS NOT NULL
  THROW 51000, 'Unexpected existing B1 tables; stop deployment', 1;

CREATE TABLE [dbo].[operational_overhead_periods] (
    [id]          NVARCHAR(200) NOT NULL,
    [companyId]   NVARCHAR(1000) NOT NULL,
    [companyKey] NVARCHAR(200) NOT NULL,
    [branchId]    NVARCHAR(1000) NOT NULL,
    [branchKey] NVARCHAR(200) NOT NULL,
    [code]        NVARCHAR(100)   NOT NULL,
    [periodFrom]  DATETIME2(7)      NOT NULL,
    [periodTo]    DATETIME2(7)      NOT NULL,
    [status]      NVARCHAR(20)   NOT NULL CONSTRAINT [df_operational_overhead_periods_status] DEFAULT N'DRAFT',
    [createdAt]   DATETIME2(7)      NOT NULL CONSTRAINT [df_operational_overhead_periods_created_at] DEFAULT GETUTCDATE(),
    [updatedAt]   DATETIME2(7)      NOT NULL,
    [createdById] NVARCHAR(1000) NOT NULL,
    [updatedById] NVARCHAR(1000) NOT NULL,
    [closedAt]    DATETIME2(7)      NULL,
    [closedById]  NVARCHAR(1000) NULL,
    [deletedAt]   DATETIME2(7)      NULL,
    CONSTRAINT [pk_operational_overhead_periods] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [fk_operational_overhead_periods_company] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [fk_operational_overhead_periods_branch]  FOREIGN KEY ([branchId])  REFERENCES [dbo].[branches] ([id])  ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- Half-open interval: periodFrom inclusive, periodTo exclusive; never zero-length.
ALTER TABLE [dbo].[operational_overhead_periods] WITH CHECK ADD CONSTRAINT [operational_overhead_periods_period_ck] CHECK
(
  [periodFrom] < [periodTo]
);
ALTER TABLE [dbo].[operational_overhead_periods] CHECK CONSTRAINT [operational_overhead_periods_period_ck];

-- Closed lifecycle: DRAFT -> OPEN -> CLOSED (never reopened); CANCELLED for a discarded DRAFT.
ALTER TABLE [dbo].[operational_overhead_periods] WITH CHECK ADD CONSTRAINT [operational_overhead_periods_status_ck] CHECK
(
  [status] IN (N'DRAFT', N'OPEN', N'CLOSED', N'CANCELLED')
);
ALTER TABLE [dbo].[operational_overhead_periods] CHECK CONSTRAINT [operational_overhead_periods_status_ck];

-- A CLOSED period must carry its close evidence.
ALTER TABLE [dbo].[operational_overhead_periods] WITH CHECK ADD CONSTRAINT [operational_overhead_periods_close_meta_ck] CHECK
(
  ([status] <> N'CLOSED') OR ([closedAt] IS NOT NULL AND [closedById] IS NOT NULL)
);
ALTER TABLE [dbo].[operational_overhead_periods] CHECK CONSTRAINT [operational_overhead_periods_close_meta_ck];

-- Bounded code non-empty (uniqueness per branch enforced in application code).
ALTER TABLE [dbo].[operational_overhead_periods] WITH CHECK ADD CONSTRAINT [operational_overhead_periods_code_ck] CHECK
(
  LEN(LTRIM(RTRIM([code]))) > (0)
);
ALTER TABLE [dbo].[operational_overhead_periods] CHECK CONSTRAINT [operational_overhead_periods_code_ck];

CREATE NONCLUSTERED INDEX [ix_operational_overhead_periods_status_range]
 ON [dbo].[operational_overhead_periods] ([companyKey], [branchKey], [status], [periodFrom], [periodTo]);
CREATE NONCLUSTERED INDEX [ix_operational_overhead_periods_code]
 ON [dbo].[operational_overhead_periods] ([companyKey], [branchKey], [code]);

CREATE TABLE [dbo].[operational_overhead_entries] (
    [id]                       NVARCHAR(200) NOT NULL,
    [companyId]                NVARCHAR(1000) NOT NULL,
    [companyKey] NVARCHAR(200) NOT NULL,
    [branchId]                 NVARCHAR(1000) NOT NULL,
    [branchKey] NVARCHAR(200) NOT NULL,
    [periodId]                 NVARCHAR(200) NOT NULL,
    [reference]                NVARCHAR(100)  NOT NULL,
    [overheadCategory]         NVARCHAR(30)   NOT NULL,
    [costPurpose]              NVARCHAR(30)   NOT NULL,
    [description]              NVARCHAR(2000)  NOT NULL,
    [amount]                   DECIMAL(19, 4) NOT NULL,
    [currencyCode]             NVARCHAR(3)    NOT NULL,
    [incurredAt]               DATETIME2(7)      NOT NULL,
    [sourceCostCenterId]       NVARCHAR(1000) NOT NULL,
    [sourceCostCenterKey] NVARCHAR(200) NOT NULL,
    [status]                   NVARCHAR(20)   NOT NULL CONSTRAINT [df_operational_overhead_entries_status] DEFAULT N'DRAFT',
    [finalizedAt]              DATETIME2(7)      NULL,
    [finalizedById]            NVARCHAR(1000) NULL,
    [notes]                    NVARCHAR(2000) NULL,
    [externalDocumentReference] NVARCHAR(200) NULL,
    [createdById]              NVARCHAR(1000) NOT NULL,
    [updatedById]              NVARCHAR(1000) NOT NULL,
    [createdAt]                DATETIME2(7)      NOT NULL CONSTRAINT [df_operational_overhead_entries_created_at] DEFAULT GETUTCDATE(),
    [updatedAt]                DATETIME2(7)      NOT NULL,
    [deletedAt]                DATETIME2(7)      NULL,
    CONSTRAINT [pk_operational_overhead_entries] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [fk_operational_overhead_entries_company]   FOREIGN KEY ([companyId])   REFERENCES [dbo].[companies] ([id])  ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [fk_operational_overhead_entries_branch]    FOREIGN KEY ([branchId])    REFERENCES [dbo].[branches] ([id])   ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [fk_operational_overhead_entries_period]    FOREIGN KEY ([periodId])    REFERENCES [dbo].[operational_overhead_periods] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [fk_operational_overhead_entries_costcenter] FOREIGN KEY ([sourceCostCenterId]) REFERENCES [dbo].[cost_centers] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- Actual overhead source amount must be strictly positive. No zero, no negative.
ALTER TABLE [dbo].[operational_overhead_entries] WITH CHECK ADD CONSTRAINT [operational_overhead_entries_amount_ck] CHECK
(
  [amount] > (0)
);
ALTER TABLE [dbo].[operational_overhead_entries] CHECK CONSTRAINT [operational_overhead_entries_amount_ck];

-- Closed server enum overhead category (CATEGORY != COST_PURPOSE). No direct-cost
-- values (MATERIAL/LABOR/EXTERNAL_SERVICE/DOWNTIME/MACHINE) are allowed.
ALTER TABLE [dbo].[operational_overhead_entries] WITH CHECK ADD CONSTRAINT [operational_overhead_entries_category_ck] CHECK
(
  [overheadCategory] IN
  (N'UTILITIES', N'RENT', N'DEPRECIATION', N'INSURANCE', N'INDIRECT_LABOR',
   N'INDIRECT_MAINTENANCE', N'FACTORY_SERVICE', N'ADMIN', N'OTHER')
);
ALTER TABLE [dbo].[operational_overhead_entries] CHECK CONSTRAINT [operational_overhead_entries_category_ck];

-- Source lifecycle: DRAFT (editable) -> FINALIZED (immutable).
ALTER TABLE [dbo].[operational_overhead_entries] WITH CHECK ADD CONSTRAINT [operational_overhead_entries_status_ck] CHECK
(
  [status] IN (N'DRAFT', N'FINALIZED')
);
ALTER TABLE [dbo].[operational_overhead_entries] CHECK CONSTRAINT [operational_overhead_entries_status_ck];

-- A FINALIZED entry must carry finalization evidence.
ALTER TABLE [dbo].[operational_overhead_entries] WITH CHECK ADD CONSTRAINT [operational_overhead_entries_finalize_meta_ck] CHECK
(
  ([status] <> N'FINALIZED') OR ([finalizedAt] IS NOT NULL AND [finalizedById] IS NOT NULL)
);
ALTER TABLE [dbo].[operational_overhead_entries] CHECK CONSTRAINT [operational_overhead_entries_finalize_meta_ck];

-- Currency must be non-empty (authority = Company.operationalCurrencyCode, FX = NO);
-- equality with the company's code is enforced in application code.
ALTER TABLE [dbo].[operational_overhead_entries] WITH CHECK ADD CONSTRAINT [operational_overhead_entries_currency_ck] CHECK
(
  LEN([currencyCode]) = 3 AND [currencyCode] COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Z]%'
);
ALTER TABLE [dbo].[operational_overhead_entries] CHECK CONSTRAINT [operational_overhead_entries_currency_ck];

-- Bounded reference non-empty (uniqueness within a period enforced in app code).
ALTER TABLE [dbo].[operational_overhead_entries] WITH CHECK ADD CONSTRAINT [operational_overhead_entries_reference_ck] CHECK
(
  LEN(LTRIM(RTRIM([reference]))) > (0)
);
ALTER TABLE [dbo].[operational_overhead_entries] CHECK CONSTRAINT [operational_overhead_entries_reference_ck];

-- Query support: bounded-only composite keys + single-column FK/tenant keys.
CREATE NONCLUSTERED INDEX [ix_operational_overhead_entries_period]
    ON [dbo].[operational_overhead_entries] ([periodId], [status]);

CREATE NONCLUSTERED INDEX [ix_operational_overhead_entries_costcenter]
    ON [dbo].[operational_overhead_entries] ([companyKey], [branchKey], [sourceCostCenterKey]);

CREATE NONCLUSTERED INDEX [ix_operational_overhead_entries_reference]
    ON [dbo].[operational_overhead_entries] ([periodId], [reference]);

CREATE NONCLUSTERED INDEX [ix_operational_overhead_entries_category_incurred]
    ON [dbo].[operational_overhead_entries] ([companyKey], [branchKey], [overheadCategory], [incurredAt]);

CREATE NONCLUSTERED INDEX [ix_operational_overhead_entries_purpose_incurred]
    ON [dbo].[operational_overhead_entries] ([companyKey], [branchKey], [costPurpose], [incurredAt]);


ALTER TABLE [dbo].[operational_overhead_periods] WITH CHECK ADD CONSTRAINT [operational_overhead_periods_companyKey_ck] CHECK (DATALENGTH([companyId]) <= 400 AND DATALENGTH([companyKey]) = DATALENGTH([companyId]) AND [companyKey] COLLATE Latin1_General_100_BIN2 = [companyId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_periods] CHECK CONSTRAINT [operational_overhead_periods_companyKey_ck];

ALTER TABLE [dbo].[operational_overhead_periods] WITH CHECK ADD CONSTRAINT [operational_overhead_periods_branchKey_ck] CHECK (DATALENGTH([branchId]) <= 400 AND DATALENGTH([branchKey]) = DATALENGTH([branchId]) AND [branchKey] COLLATE Latin1_General_100_BIN2 = [branchId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_periods] CHECK CONSTRAINT [operational_overhead_periods_branchKey_ck];

ALTER TABLE [dbo].[operational_overhead_entries] WITH CHECK ADD CONSTRAINT [operational_overhead_entries_companyKey_ck] CHECK (DATALENGTH([companyId]) <= 400 AND DATALENGTH([companyKey]) = DATALENGTH([companyId]) AND [companyKey] COLLATE Latin1_General_100_BIN2 = [companyId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_entries] CHECK CONSTRAINT [operational_overhead_entries_companyKey_ck];

ALTER TABLE [dbo].[operational_overhead_entries] WITH CHECK ADD CONSTRAINT [operational_overhead_entries_branchKey_ck] CHECK (DATALENGTH([branchId]) <= 400 AND DATALENGTH([branchKey]) = DATALENGTH([branchId]) AND [branchKey] COLLATE Latin1_General_100_BIN2 = [branchId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_entries] CHECK CONSTRAINT [operational_overhead_entries_branchKey_ck];

ALTER TABLE [dbo].[operational_overhead_entries] WITH CHECK ADD CONSTRAINT [operational_overhead_entries_sourceCostCenterKey_ck] CHECK (DATALENGTH([sourceCostCenterId]) <= 400 AND DATALENGTH([sourceCostCenterKey]) = DATALENGTH([sourceCostCenterId]) AND [sourceCostCenterKey] COLLATE Latin1_General_100_BIN2 = [sourceCostCenterId] COLLATE Latin1_General_100_BIN2);
ALTER TABLE [dbo].[operational_overhead_entries] CHECK CONSTRAINT [operational_overhead_entries_sourceCostCenterKey_ck];

ALTER TABLE [dbo].[operational_overhead_entries] WITH CHECK ADD CONSTRAINT [operational_overhead_entries_purpose_ck] CHECK ([costPurpose] IN (N'MAINTENANCE',N'PRODUCTION',N'QUALITY',N'PROJECT',N'UTILITIES',N'ADMIN',N'DEVELOPMENT',N'OTHER'));
ALTER TABLE [dbo].[operational_overhead_entries] CHECK CONSTRAINT [operational_overhead_entries_purpose_ck];

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
