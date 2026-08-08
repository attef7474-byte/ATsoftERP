SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- Phase 1.9 OEE and Production Analytics (production performance target master + transition history).
-- Existing-data impact: additive only; no existing table, column or row is altered.
-- Backfill/default behavior: not applicable because both tables are new.
-- Recovery: the transaction rolls back every object when any statement fails.

-- CreateTable
CREATE TABLE [dbo].[production_performance_targets] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [scopeType] NVARCHAR(1000) NOT NULL,
    [productionUnitId] NVARCHAR(1000),
    [productionLineId] NVARCHAR(1000),
    [machineId] NVARCHAR(1000),
    [productionProductDefinitionId] NVARCHAR(1000),
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2,
    [availabilityTarget] DECIMAL(7,4) NOT NULL,
    [performanceTarget] DECIMAL(7,4) NOT NULL,
    [qualityTarget] DECIMAL(7,4) NOT NULL,
    [oeeTarget] DECIMAL(7,4) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_performance_targets_status_df] DEFAULT 'DRAFT',
    [revision] INT NOT NULL CONSTRAINT [production_performance_targets_revision_df] DEFAULT 1,
    [supersedesId] NVARCHAR(1000),
    [approvalNote] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdById] NVARCHAR(1000) NOT NULL,
    [updatedById] NVARCHAR(1000) NOT NULL,
    [submittedById] NVARCHAR(1000),
    [submittedAt] DATETIME2,
    [approvedById] NVARCHAR(1000),
    [approvedAt] DATETIME2,
    [deactivatedById] NVARCHAR(1000),
    [deactivatedAt] DATETIME2,
    [deactivationReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_performance_targets_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [production_performance_targets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_performance_targets_companyId_branchId_code_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[production_performance_target_transitions] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [targetId] NVARCHAR(1000) NOT NULL,
    [fromStatus] NVARCHAR(1000) NOT NULL,
    [toStatus] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000) NOT NULL,
    [reason] NVARCHAR(1000),
    [requestId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_performance_target_transitions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [production_performance_target_transitions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_performance_target_transitions_companyId_branchId_targetId_requestId_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[targetId],[requestId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_performance_targets_companyId_branchId_scopeType_status_effectiveFrom_effectiveTo_idx] ON [dbo].[production_performance_targets]([companyId], [branchId], [scopeType], [status], [effectiveFrom], [effectiveTo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_performance_targets_companyId_branchId_productionUnitId_idx] ON [dbo].[production_performance_targets]([companyId], [branchId], [productionUnitId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_performance_targets_companyId_branchId_productionLineId_idx] ON [dbo].[production_performance_targets]([companyId], [branchId], [productionLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_performance_targets_companyId_branchId_machineId_idx] ON [dbo].[production_performance_targets]([companyId], [branchId], [machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_performance_targets_companyId_branchId_productionProductDefinitionId_idx] ON [dbo].[production_performance_targets]([companyId], [branchId], [productionProductDefinitionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_performance_targets_supersedesId_idx] ON [dbo].[production_performance_targets]([supersedesId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_performance_target_transitions_companyId_branchId_targetId_createdAt_idx] ON [dbo].[production_performance_target_transitions]([companyId], [branchId], [targetId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_performance_target_transitions_companyId_branchId_action_createdAt_idx] ON [dbo].[production_performance_target_transitions]([companyId], [branchId], [action], [createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[production_performance_targets] ADD CONSTRAINT [production_performance_targets_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_performance_targets] ADD CONSTRAINT [production_performance_targets_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_performance_targets] ADD CONSTRAINT [production_performance_targets_productionUnitId_fkey] FOREIGN KEY ([productionUnitId]) REFERENCES [dbo].[production_units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_performance_targets] ADD CONSTRAINT [production_performance_targets_productionLineId_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_performance_targets] ADD CONSTRAINT [production_performance_targets_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_performance_targets] ADD CONSTRAINT [production_performance_targets_productionProductDefinitionId_fkey] FOREIGN KEY ([productionProductDefinitionId]) REFERENCES [dbo].[production_product_definitions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_performance_targets] ADD CONSTRAINT [production_performance_targets_supersedesId_fkey] FOREIGN KEY ([supersedesId]) REFERENCES [dbo].[production_performance_targets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_performance_target_transitions] ADD CONSTRAINT [production_performance_target_transitions_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_performance_target_transitions] ADD CONSTRAINT [production_performance_target_transitions_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_performance_target_transitions] ADD CONSTRAINT [production_performance_target_transitions_targetId_fkey] FOREIGN KEY ([targetId]) REFERENCES [dbo].[production_performance_targets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Data-integrity constraints (Phase 1.9): a target scopes to at most ONE dimension
-- (COMPANY/BRANCH scope carries no dimension; UNIT/LINE/MACHINE/PRODUCT scope carries exactly one).
ALTER TABLE [dbo].[production_performance_targets] ADD CONSTRAINT [ck_production_performance_target_scope_xor] CHECK (
    (CASE WHEN [productionUnitId] IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN [productionLineId] IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN [machineId] IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN [productionProductDefinitionId] IS NOT NULL THEN 1 ELSE 0 END) <= 1
);

-- Target percentages are always 0..100 (percent scale, matching capacity-standard snapshot conventions).
ALTER TABLE [dbo].[production_performance_targets] ADD CONSTRAINT [ck_production_performance_target_percent_range] CHECK (
    [availabilityTarget] >= 0 AND [availabilityTarget] <= 100 AND
    [performanceTarget] >= 0 AND [performanceTarget] <= 100 AND
    [qualityTarget] >= 0 AND [qualityTarget] <= 100 AND
    [oeeTarget] >= 0 AND [oeeTarget] <= 100
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
