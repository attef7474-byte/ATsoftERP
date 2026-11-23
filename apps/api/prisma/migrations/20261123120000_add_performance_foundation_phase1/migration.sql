-- Performance Phase 1: additive foundation only.
-- Creates performance_profiles and performance_profile_mappings.
-- No existing table/data mutation. No backfill. No destructive operation.
-- Recovery: roll back application; retain additive structures/data. A future reviewed
-- down migration may remove new empty structures only after verifying no dependents.
-- Never drop history, reset, or modify any earlier migration.
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[performance_profiles] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(100) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [nameAr] NVARCHAR(200),
    [nameEn] NVARCHAR(200),
    [description] NVARCHAR(1000),
    [category] NVARCHAR(30) NOT NULL CONSTRAINT [performance_profiles_category_df] DEFAULT N'GENERAL',
    [isActive] BIT NOT NULL CONSTRAINT [performance_profiles_isActive_df] DEFAULT 1,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [performance_profiles_status_df] DEFAULT N'ACTIVE',
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [performance_profiles_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [performance_profiles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [performance_profiles_companyId_code_key] UNIQUE NONCLUSTERED ([companyId], [code])
);

-- CreateTable
CREATE TABLE [dbo].[performance_profile_mappings] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [performanceProfileId] NVARCHAR(1000) NOT NULL,
    [targetType] NVARCHAR(30) NOT NULL,
    [jobTitleId] NVARCHAR(1000),
    [targetCode] NVARCHAR(100),
    [priority] INT NOT NULL CONSTRAINT [performance_profile_mappings_priority_df] DEFAULT 100,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [performance_profile_mappings_isActive_df] DEFAULT 1,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [performance_profile_mappings_status_df] DEFAULT N'ACTIVE',
    [notes] NVARCHAR(1000),
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [performance_profile_mappings_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [performance_profile_mappings_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [performance_profiles_companyId_idx] ON [dbo].[performance_profiles]([companyId]);
CREATE NONCLUSTERED INDEX [performance_profiles_companyId_isActive_idx] ON [dbo].[performance_profiles]([companyId], [isActive]);
CREATE NONCLUSTERED INDEX [performance_profiles_companyId_status_idx] ON [dbo].[performance_profiles]([companyId], [status]);
CREATE NONCLUSTERED INDEX [performance_profiles_companyId_category_idx] ON [dbo].[performance_profiles]([companyId], [category]);

CREATE NONCLUSTERED INDEX [performance_profile_mappings_companyId_idx] ON [dbo].[performance_profile_mappings]([companyId]);
CREATE NONCLUSTERED INDEX [performance_profile_mappings_companyId_performanceProfileId_idx] ON [dbo].[performance_profile_mappings]([companyId], [performanceProfileId]);
CREATE NONCLUSTERED INDEX [performance_profile_mappings_companyId_targetType_isActive_idx] ON [dbo].[performance_profile_mappings]([companyId], [targetType], [isActive]);
CREATE NONCLUSTERED INDEX [performance_profile_mappings_companyId_jobTitleId_effectiveFrom_effectiveTo_idx] ON [dbo].[performance_profile_mappings]([companyId], [jobTitleId], [effectiveFrom], [effectiveTo]);
CREATE NONCLUSTERED INDEX [performance_profile_mappings_companyId_targetType_targetCode_effectiveFrom_effectiveTo_idx] ON [dbo].[performance_profile_mappings]([companyId], [targetType], [targetCode], [effectiveFrom], [effectiveTo]);
CREATE NONCLUSTERED INDEX [performance_profile_mappings_performanceProfileId_status_idx] ON [dbo].[performance_profile_mappings]([performanceProfileId], [status]);

-- AddForeignKey
ALTER TABLE [dbo].[performance_profiles] ADD CONSTRAINT [performance_profiles_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_profile_mappings] ADD CONSTRAINT [performance_profile_mappings_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_profile_mappings] ADD CONSTRAINT [performance_profile_mappings_performanceProfileId_fkey] FOREIGN KEY ([performanceProfileId]) REFERENCES [dbo].[performance_profiles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_profile_mappings] ADD CONSTRAINT [performance_profile_mappings_jobTitleId_fkey] FOREIGN KEY ([jobTitleId]) REFERENCES [dbo].[job_titles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
