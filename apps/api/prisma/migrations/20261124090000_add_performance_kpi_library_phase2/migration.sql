-- Performance Phase 2: central KPI library + profile KPI eligibility. Additive only.
-- Creates performance_kpi_definitions and performance_profile_kpi_eligibilities.
-- No existing table/data mutation. No backfill. No destructive operation.
-- No score/weight/ranking/result tables. Raw metric preview is read-only application logic.
-- Recovery: roll back application; retain additive structures/data. A future reviewed
-- down migration may remove new empty structures only after verifying no dependents.
-- Never drop history, reset, or modify any earlier migration.
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
BEGIN TRY

BEGIN TRAN;

CREATE TABLE [dbo].[performance_kpi_definitions] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(100) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [nameAr] NVARCHAR(200),
    [nameEn] NVARCHAR(200),
    [description] NVARCHAR(2000),
    [descriptionAr] NVARCHAR(2000),
    [descriptionEn] NVARCHAR(2000),
    [domain] NVARCHAR(50) NOT NULL,
    [measurementUnit] NVARCHAR(30) NOT NULL,
    [direction] NVARCHAR(30) NOT NULL,
    [aggregationType] NVARCHAR(30) NOT NULL,
    [calculationMode] NVARCHAR(50) NOT NULL,
    [sourceContractKey] NVARCHAR(100) NOT NULL,
    [calculationVersion] INT NOT NULL CONSTRAINT [performance_kpi_definitions_calculationVersion_df] DEFAULT 1,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [performance_kpi_definitions_status_df] DEFAULT N'DRAFT',
    [isActive] BIT NOT NULL CONSTRAINT [performance_kpi_definitions_isActive_df] DEFAULT 0,
    [effectiveFrom] DATETIME2,
    [effectiveTo] DATETIME2,
    [notes] NVARCHAR(2000),
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [performance_kpi_definitions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [performance_kpi_definitions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [performance_kpi_definitions_companyId_code_key] UNIQUE NONCLUSTERED ([companyId], [code])
);

CREATE TABLE [dbo].[performance_profile_kpi_eligibilities] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [performanceProfileId] NVARCHAR(1000) NOT NULL,
    [kpiDefinitionId] NVARCHAR(1000) NOT NULL,
    [isRequired] BIT NOT NULL CONSTRAINT [performance_profile_kpi_eligibilities_isRequired_df] DEFAULT 0,
    [isEnabled] BIT NOT NULL CONSTRAINT [performance_profile_kpi_eligibilities_isEnabled_df] DEFAULT 1,
    [effectiveFrom] DATETIME2,
    [effectiveTo] DATETIME2,
    [notes] NVARCHAR(1000),
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [performance_profile_kpi_eligibilities_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [performance_profile_kpi_eligibilities_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [performance_profile_kpi_eligibilities_companyId_performanceProfileId_kpiDefinitionId_key] UNIQUE NONCLUSTERED ([companyId], [performanceProfileId], [kpiDefinitionId])
);

CREATE NONCLUSTERED INDEX [performance_kpi_definitions_companyId_idx] ON [dbo].[performance_kpi_definitions]([companyId]);
CREATE NONCLUSTERED INDEX [performance_kpi_definitions_companyId_domain_idx] ON [dbo].[performance_kpi_definitions]([companyId], [domain]);
CREATE NONCLUSTERED INDEX [performance_kpi_definitions_companyId_status_idx] ON [dbo].[performance_kpi_definitions]([companyId], [status]);
CREATE NONCLUSTERED INDEX [performance_kpi_definitions_companyId_isActive_idx] ON [dbo].[performance_kpi_definitions]([companyId], [isActive]);
CREATE NONCLUSTERED INDEX [performance_kpi_definitions_companyId_sourceContractKey_idx] ON [dbo].[performance_kpi_definitions]([companyId], [sourceContractKey]);

CREATE NONCLUSTERED INDEX [performance_profile_kpi_eligibilities_companyId_idx] ON [dbo].[performance_profile_kpi_eligibilities]([companyId]);
CREATE NONCLUSTERED INDEX [performance_profile_kpi_eligibilities_companyId_performanceProfileId_isEnabled_idx] ON [dbo].[performance_profile_kpi_eligibilities]([companyId], [performanceProfileId], [isEnabled]);
CREATE NONCLUSTERED INDEX [performance_profile_kpi_eligibilities_companyId_kpiDefinitionId_idx] ON [dbo].[performance_profile_kpi_eligibilities]([companyId], [kpiDefinitionId]);
CREATE NONCLUSTERED INDEX [performance_profile_kpi_eligibilities_performanceProfileId_isEnabled_idx] ON [dbo].[performance_profile_kpi_eligibilities]([performanceProfileId], [isEnabled]);

ALTER TABLE [dbo].[performance_kpi_definitions] ADD CONSTRAINT [performance_kpi_definitions_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_profile_kpi_eligibilities] ADD CONSTRAINT [performance_profile_kpi_eligibilities_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_profile_kpi_eligibilities] ADD CONSTRAINT [performance_profile_kpi_eligibilities_performanceProfileId_fkey] FOREIGN KEY ([performanceProfileId]) REFERENCES [dbo].[performance_profiles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_profile_kpi_eligibilities] ADD CONSTRAINT [performance_profile_kpi_eligibilities_kpiDefinitionId_fkey] FOREIGN KEY ([kpiDefinitionId]) REFERENCES [dbo].[performance_kpi_definitions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
