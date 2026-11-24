-- Performance Phase 3: additive targets, profile KPI weights, scoring rules.
-- Creates performance_kpi_targets, performance_profile_kpi_weights, performance_kpi_scoring_rules.
-- No existing table/data mutation. No backfill. No destructive operation.
-- No employee score/result/ranking/bonus/penalty persistence. Simulation is read-only application logic.
-- Recovery: roll back application; retain additive structures/data. A future reviewed
-- down migration may remove new empty structures only after verifying no dependents.
-- Never drop history, reset, or modify any earlier migration.
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
BEGIN TRY

BEGIN TRAN;

CREATE TABLE [dbo].[performance_kpi_targets] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [performanceProfileId] NVARCHAR(1000),
    [kpiDefinitionId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000),
    [productionLineId] NVARCHAR(1000),
    [machineId] NVARCHAR(1000),
    [productionProductDefinitionId] NVARCHAR(1000),
    [departmentId] NVARCHAR(1000),
    [jobTitleId] NVARCHAR(1000),
    [scopeType] NVARCHAR(30) NOT NULL,
    [targetValue] DECIMAL(19,6) NOT NULL,
    [minimumAcceptableValue] DECIMAL(19,6),
    [maximumExceptionalValue] DECIMAL(19,6),
    [unit] NVARCHAR(30),
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [revision] INT NOT NULL CONSTRAINT [performance_kpi_targets_revision_df] DEFAULT 1,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [performance_kpi_targets_status_df] DEFAULT N'DRAFT',
    [supersedesId] NVARCHAR(1000),
    [reason] NVARCHAR(1000),
    [notes] NVARCHAR(2000),
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [performance_kpi_targets_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [performance_kpi_targets_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[performance_profile_kpi_weights] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [performanceProfileId] NVARCHAR(1000) NOT NULL,
    [kpiDefinitionId] NVARCHAR(1000) NOT NULL,
    [weightPercent] DECIMAL(7,4) NOT NULL,
    [isRequired] BIT NOT NULL CONSTRAINT [performance_profile_kpi_weights_isRequired_df] DEFAULT 0,
    [isInformational] BIT NOT NULL CONSTRAINT [performance_profile_kpi_weights_isInformational_df] DEFAULT 0,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [revision] INT NOT NULL CONSTRAINT [performance_profile_kpi_weights_revision_df] DEFAULT 1,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [performance_profile_kpi_weights_status_df] DEFAULT N'DRAFT',
    [supersedesId] NVARCHAR(1000),
    [reason] NVARCHAR(1000),
    [notes] NVARCHAR(2000),
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [performance_profile_kpi_weights_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [performance_profile_kpi_weights_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[performance_kpi_scoring_rules] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [performanceProfileId] NVARCHAR(1000),
    [kpiDefinitionId] NVARCHAR(1000) NOT NULL,
    [scoringMode] NVARCHAR(40) NOT NULL,
    [direction] NVARCHAR(30) NOT NULL,
    [minScore] DECIMAL(7,4) NOT NULL CONSTRAINT [performance_kpi_scoring_rules_minScore_df] DEFAULT 0,
    [maxScore] DECIMAL(7,4) NOT NULL CONSTRAINT [performance_kpi_scoring_rules_maxScore_df] DEFAULT 100,
    [targetScore] DECIMAL(7,4),
    [floorValue] DECIMAL(19,6),
    [targetValue] DECIMAL(19,6),
    [ceilingValue] DECIMAL(19,6),
    [bandsJson] NVARCHAR(max),
    [missingDataPolicy] NVARCHAR(40) NOT NULL CONSTRAINT [performance_kpi_scoring_rules_missingDataPolicy_df] DEFAULT N'INSUFFICIENT_DATA',
    [notApplicablePolicy] NVARCHAR(40) NOT NULL CONSTRAINT [performance_kpi_scoring_rules_notApplicablePolicy_df] DEFAULT N'NOT_APPLICABLE',
    [configMissingPolicy] NVARCHAR(40) NOT NULL CONSTRAINT [performance_kpi_scoring_rules_configMissingPolicy_df] DEFAULT N'CONFIGURATION_MISSING',
    [clampMin] DECIMAL(7,4),
    [clampMax] DECIMAL(7,4),
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [revision] INT NOT NULL CONSTRAINT [performance_kpi_scoring_rules_revision_df] DEFAULT 1,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [performance_kpi_scoring_rules_status_df] DEFAULT N'DRAFT',
    [supersedesId] NVARCHAR(1000),
    [reason] NVARCHAR(1000),
    [notes] NVARCHAR(2000),
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [performance_kpi_scoring_rules_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [performance_kpi_scoring_rules_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [performance_kpi_targets_companyId_kpiDefinitionId_status_effectiveFrom_effectiveTo_idx] ON [dbo].[performance_kpi_targets]([companyId], [kpiDefinitionId], [status], [effectiveFrom], [effectiveTo]);
CREATE NONCLUSTERED INDEX [performance_kpi_targets_companyId_performanceProfileId_kpiDefinitionId_status_idx] ON [dbo].[performance_kpi_targets]([companyId], [performanceProfileId], [kpiDefinitionId], [status]);
CREATE NONCLUSTERED INDEX [performance_kpi_targets_companyId_branchId_status_idx] ON [dbo].[performance_kpi_targets]([companyId], [branchId], [status]);
CREATE NONCLUSTERED INDEX [performance_kpi_targets_companyId_productionLineId_status_idx] ON [dbo].[performance_kpi_targets]([companyId], [productionLineId], [status]);
CREATE NONCLUSTERED INDEX [performance_kpi_targets_companyId_machineId_status_idx] ON [dbo].[performance_kpi_targets]([companyId], [machineId], [status]);
CREATE NONCLUSTERED INDEX [performance_kpi_targets_companyId_productionProductDefinitionId_status_idx] ON [dbo].[performance_kpi_targets]([companyId], [productionProductDefinitionId], [status]);
CREATE NONCLUSTERED INDEX [performance_kpi_targets_companyId_departmentId_status_idx] ON [dbo].[performance_kpi_targets]([companyId], [departmentId], [status]);
CREATE NONCLUSTERED INDEX [performance_kpi_targets_companyId_jobTitleId_status_idx] ON [dbo].[performance_kpi_targets]([companyId], [jobTitleId], [status]);
CREATE NONCLUSTERED INDEX [performance_kpi_targets_supersedesId_idx] ON [dbo].[performance_kpi_targets]([supersedesId]);

CREATE NONCLUSTERED INDEX [performance_profile_kpi_weights_companyId_performanceProfileId_status_effectiveFrom_effectiveTo_idx] ON [dbo].[performance_profile_kpi_weights]([companyId], [performanceProfileId], [status], [effectiveFrom], [effectiveTo]);
CREATE NONCLUSTERED INDEX [performance_profile_kpi_weights_companyId_performanceProfileId_kpiDefinitionId_status_idx] ON [dbo].[performance_profile_kpi_weights]([companyId], [performanceProfileId], [kpiDefinitionId], [status]);
CREATE NONCLUSTERED INDEX [performance_profile_kpi_weights_companyId_kpiDefinitionId_status_idx] ON [dbo].[performance_profile_kpi_weights]([companyId], [kpiDefinitionId], [status]);
CREATE NONCLUSTERED INDEX [performance_profile_kpi_weights_supersedesId_idx] ON [dbo].[performance_profile_kpi_weights]([supersedesId]);

CREATE NONCLUSTERED INDEX [performance_kpi_scoring_rules_companyId_kpiDefinitionId_status_effectiveFrom_effectiveTo_idx] ON [dbo].[performance_kpi_scoring_rules]([companyId], [kpiDefinitionId], [status], [effectiveFrom], [effectiveTo]);
CREATE NONCLUSTERED INDEX [performance_kpi_scoring_rules_companyId_performanceProfileId_kpiDefinitionId_status_idx] ON [dbo].[performance_kpi_scoring_rules]([companyId], [performanceProfileId], [kpiDefinitionId], [status]);
CREATE NONCLUSTERED INDEX [performance_kpi_scoring_rules_supersedesId_idx] ON [dbo].[performance_kpi_scoring_rules]([supersedesId]);

ALTER TABLE [dbo].[performance_kpi_targets] ADD CONSTRAINT [performance_kpi_targets_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_targets] ADD CONSTRAINT [performance_kpi_targets_performanceProfileId_fkey] FOREIGN KEY ([performanceProfileId]) REFERENCES [dbo].[performance_profiles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_targets] ADD CONSTRAINT [performance_kpi_targets_kpiDefinitionId_fkey] FOREIGN KEY ([kpiDefinitionId]) REFERENCES [dbo].[performance_kpi_definitions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_targets] ADD CONSTRAINT [performance_kpi_targets_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_targets] ADD CONSTRAINT [performance_kpi_targets_productionLineId_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_targets] ADD CONSTRAINT [performance_kpi_targets_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_targets] ADD CONSTRAINT [performance_kpi_targets_productionProductDefinitionId_fkey] FOREIGN KEY ([productionProductDefinitionId]) REFERENCES [dbo].[production_product_definitions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_targets] ADD CONSTRAINT [performance_kpi_targets_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_targets] ADD CONSTRAINT [performance_kpi_targets_jobTitleId_fkey] FOREIGN KEY ([jobTitleId]) REFERENCES [dbo].[job_titles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_targets] ADD CONSTRAINT [performance_kpi_targets_supersedesId_fkey] FOREIGN KEY ([supersedesId]) REFERENCES [dbo].[performance_kpi_targets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[performance_profile_kpi_weights] ADD CONSTRAINT [performance_profile_kpi_weights_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_profile_kpi_weights] ADD CONSTRAINT [performance_profile_kpi_weights_performanceProfileId_fkey] FOREIGN KEY ([performanceProfileId]) REFERENCES [dbo].[performance_profiles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_profile_kpi_weights] ADD CONSTRAINT [performance_profile_kpi_weights_kpiDefinitionId_fkey] FOREIGN KEY ([kpiDefinitionId]) REFERENCES [dbo].[performance_kpi_definitions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_profile_kpi_weights] ADD CONSTRAINT [performance_profile_kpi_weights_supersedesId_fkey] FOREIGN KEY ([supersedesId]) REFERENCES [dbo].[performance_profile_kpi_weights]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[performance_kpi_scoring_rules] ADD CONSTRAINT [performance_kpi_scoring_rules_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_scoring_rules] ADD CONSTRAINT [performance_kpi_scoring_rules_performanceProfileId_fkey] FOREIGN KEY ([performanceProfileId]) REFERENCES [dbo].[performance_profiles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_scoring_rules] ADD CONSTRAINT [performance_kpi_scoring_rules_kpiDefinitionId_fkey] FOREIGN KEY ([kpiDefinitionId]) REFERENCES [dbo].[performance_kpi_definitions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[performance_kpi_scoring_rules] ADD CONSTRAINT [performance_kpi_scoring_rules_supersedesId_fkey] FOREIGN KEY ([supersedesId]) REFERENCES [dbo].[performance_kpi_scoring_rules]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
