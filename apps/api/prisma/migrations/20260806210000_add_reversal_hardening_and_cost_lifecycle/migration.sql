-- Phase 2 reversal + cost + analytics slice — additive hardening.
-- Existing-data impact: additive only; no existing row is altered or deleted.
--
-- 1. ProductionMaterialDocument: explicit immutable reversal relation
--    (reversesDocumentId -> source document) + SQL Server filtered idempotency
--    index replacing the non-filtered unique constraint on nullable requestId.
-- 2. OperationalCostTransaction: sourceFingerprint (dedupe of an authoritative
--    source valuation, filtered-unique per tenant) + calculationId (lifecycle).
-- 3. OperationalCostCalculation: cost-calculation lifecycle table.
-- 4. OperationalSourceChange: tenant-scoped analytics source-change watermark.

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- ── ProductionMaterialDocument reversal relation ──────────────────────────────
ALTER TABLE [dbo].[production_material_documents] ADD [reversesDocumentId] NVARCHAR(1000);

-- The original non-filtered UNIQUE constraint on the nullable requestId permits only
-- ONE NULL requestId per (companyId, branchId), which would break the existing data
-- model. Replace it with a filtered unique index (WHERE requestId IS NOT NULL).
ALTER TABLE [dbo].[production_material_documents] DROP CONSTRAINT [production_material_documents_companyId_branchId_requestId_key];
CREATE UNIQUE NONCLUSTERED INDEX [production_material_documents_companyId_branchId_requestId_key]
  ON [dbo].[production_material_documents] ([companyId],[branchId],[requestId])
  WHERE [requestId] IS NOT NULL;

-- SQL Server compiles a migration batch before an ALTER-added column is visible.
-- Compile the FK/index only after reversesDocumentId has been added above.
EXEC sys.sp_executesql N'
ALTER TABLE [dbo].[production_material_documents] ADD CONSTRAINT [production_material_documents_reversesDocumentId_fkey] FOREIGN KEY ([reversesDocumentId]) REFERENCES [dbo].[production_material_documents] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE NONCLUSTERED INDEX [production_material_documents_reversesDocumentId_idx] ON [dbo].[production_material_documents] ([reversesDocumentId]);
';

-- ── OperationalCostTransaction source fingerprint + calculation link ──────────
ALTER TABLE [dbo].[operational_cost_transactions] ADD [sourceFingerprint] NVARCHAR(1000);
ALTER TABLE [dbo].[operational_cost_transactions] ADD [requestPayloadFingerprint] NVARCHAR(1000);
ALTER TABLE [dbo].[operational_cost_transactions] ADD [calculationId] NVARCHAR(1000);

-- At most one valuation per (tenant, authoritative source + event type). The
-- filter keeps the index live-only: a REVERSED row and a reversed original are
-- excluded, so a corrected re-valuation of the same source is allowed after its
-- reversal while still preventing double valuation of live originals.
EXEC sys.sp_executesql N'
CREATE UNIQUE NONCLUSTERED INDEX [operational_cost_transactions_companyId_branchId_sourceFingerprint_key]
  ON [dbo].[operational_cost_transactions] ([companyId],[branchId],[sourceFingerprint])
  WHERE [sourceFingerprint] IS NOT NULL AND [status] = N''POSTED'' AND [reversedAt] IS NULL;

CREATE NONCLUSTERED INDEX [operational_cost_transactions_companyId_branchId_calculationId_idx] ON [dbo].[operational_cost_transactions] ([companyId],[branchId],[calculationId],[occurredAt]);
';

-- ── OperationalCostCalculation lifecycle ──────────────────────────────────────
CREATE TABLE [dbo].[operational_cost_calculations] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [code] NVARCHAR(1000) NOT NULL,
  [revision] INT NOT NULL CONSTRAINT [operational_cost_calculations_revision_df] DEFAULT 1,
  [scopeType] NVARCHAR(1000) NOT NULL,
  [scopeId] NVARCHAR(1000) NOT NULL,
  [productionOrderId] NVARCHAR(1000) NULL,
  [productionRunId] NVARCHAR(1000) NULL,
  [periodFrom] DATETIME2 NOT NULL,
  [periodTo] DATETIME2 NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_cost_calculations_status_df] DEFAULT N'DRAFT',
  [currencyCode] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_cost_calculations_currency_df] DEFAULT N'USD',
  [reviewedById] NVARCHAR(1000) NULL,
  [reviewedAt] DATETIME2 NULL,
  [finalizedById] NVARCHAR(1000) NULL,
  [finalizedAt] DATETIME2 NULL,
  [supersedesId] NVARCHAR(1000) NULL,
  [reason] NVARCHAR(1000) NULL,
  [notes] NVARCHAR(1000) NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [operational_cost_calculations_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [operational_cost_calculations_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [operational_cost_calculations_tenant_code_revision_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [code], [revision]),
  CONSTRAINT [operational_cost_calculations_revision_ck] CHECK ([revision] >= 1),
  CONSTRAINT [operational_cost_calculations_scope_type_ck] CHECK ([scopeType] IN (N'ORDER', N'RUN')),
  CONSTRAINT [operational_cost_calculations_status_ck] CHECK ([status] IN (N'DRAFT', N'REVIEW', N'FINALIZED')),
  CONSTRAINT [operational_cost_calculations_period_ck] CHECK ([periodTo] >= [periodFrom]),
  CONSTRAINT [operational_cost_calculations_finalized_ck] CHECK ([finalizedAt] IS NULL OR ([finalizedById] IS NOT NULL AND [status] = N'FINALIZED')),
  CONSTRAINT [operational_cost_calculations_reviewed_ck] CHECK ([reviewedAt] IS NULL OR [reviewedById] IS NOT NULL),
  CONSTRAINT [operational_cost_calculations_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_calculations_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_calculations_order_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_calculations_run_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_calculations_supersedes_fkey] FOREIGN KEY ([supersedesId]) REFERENCES [dbo].[operational_cost_calculations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [operational_cost_calculations_tenant_scope_status_idx] ON [dbo].[operational_cost_calculations]([companyId], [branchId], [scopeType], [scopeId], [status]);
CREATE INDEX [operational_cost_calculations_tenant_order_period_idx] ON [dbo].[operational_cost_calculations]([companyId], [branchId], [productionOrderId], [periodFrom], [periodTo]);
CREATE INDEX [operational_cost_calculations_tenant_run_period_idx] ON [dbo].[operational_cost_calculations]([companyId], [branchId], [productionRunId], [periodFrom], [periodTo]);
CREATE INDEX [operational_cost_calculations_supersedes_idx] ON [dbo].[operational_cost_calculations]([supersedesId]);

-- The calculationId FK must be created only after operational_cost_calculations
-- exists (SQL Server resolves the referenced table at statement time).
EXEC sys.sp_executesql N'
ALTER TABLE [dbo].[operational_cost_transactions] ADD CONSTRAINT [operational_cost_transactions_calculationId_fkey] FOREIGN KEY ([calculationId]) REFERENCES [dbo].[operational_cost_calculations] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
';

-- ── OperationalSourceChange analytics watermark ───────────────────────────────
CREATE TABLE [dbo].[operational_source_changes] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [scopeType] NVARCHAR(1000) NOT NULL,
  [scopeId] NVARCHAR(1000) NOT NULL,
  [entityType] NVARCHAR(1000) NOT NULL,
  [entityId] NVARCHAR(1000) NOT NULL,
  [changeType] NVARCHAR(1000) NOT NULL,
  [reason] NVARCHAR(1000) NULL,
  [actorId] NVARCHAR(1000) NOT NULL,
  [actorName] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [operational_source_changes_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [operational_source_changes_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [operational_source_changes_scope_type_ck] CHECK ([scopeType] IN (N'BRANCH', N'ORDER', N'RUN', N'PRODUCT', N'LINE', N'MACHINE')),
  CONSTRAINT [operational_source_changes_change_type_ck] CHECK ([changeType] IN (N'REVERSAL', N'CORRECTION', N'SOURCE_UPDATE')),
  CONSTRAINT [operational_source_changes_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_source_changes_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [operational_source_changes_tenant_scope_time_idx] ON [dbo].[operational_source_changes]([companyId], [branchId], [scopeType], [scopeId], [createdAt]);
CREATE INDEX [operational_source_changes_tenant_entity_idx] ON [dbo].[operational_source_changes]([companyId], [branchId], [entityType], [entityId]);
CREATE INDEX [operational_source_changes_tenant_type_time_idx] ON [dbo].[operational_source_changes]([companyId], [branchId], [changeType], [createdAt]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
