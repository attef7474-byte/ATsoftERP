SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- Phase 1.8 Operational Cost (rate masters, standard-cost snapshots, immutable cost transactions).
-- Existing-data impact: additive only; no existing table, column or row is altered.
-- Backfill/default behavior: not applicable because all three tables are new.
-- Recovery: the transaction rolls back every object when any statement fails.
-- Runtime compatibility: Phases 1.1-1.7 remain unchanged; Phase 1.8 application code
-- must be deployed only after this migration is independently reviewed/applied.
-- Check constraints below enforce: positive rates/quantities/amounts, rate effective-date
-- ordering, snapshot freeze/supersede metadata consistency, and the immutable
-- posting/reversal invariant (a POSTED event is never mutated; a REVERSED event must
-- reference its source, carry a reason, and negate quantity/amount). The filtered index
-- enforces at most one active rate per (tenant, code) at the SQL level.

CREATE TABLE [dbo].[operational_cost_rates] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [code] NVARCHAR(1000) NOT NULL,
  [nameAr] NVARCHAR(1000) NOT NULL,
  [nameEn] NVARCHAR(1000) NOT NULL,
  [description] NVARCHAR(1000) NULL,
  [costType] NVARCHAR(1000) NOT NULL,
  [unit] NVARCHAR(1000) NOT NULL,
  [rate] DECIMAL(19,4) NOT NULL,
  [currencyCode] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_cost_rates_currency_df] DEFAULT N'USD',
  [productionLineId] NVARCHAR(1000) NULL,
  [machineId] NVARCHAR(1000) NULL,
  [costCenterId] NVARCHAR(1000) NULL,
  [effectiveFrom] DATETIME2 NOT NULL,
  [effectiveTo] DATETIME2 NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_cost_rates_status_df] DEFAULT N'ACTIVE',
  [createdById] NVARCHAR(1000) NOT NULL,
  [updatedById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [operational_cost_rates_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [operational_cost_rates_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [operational_cost_rates_tenant_code_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [code]),
  CONSTRAINT [operational_cost_rates_cost_type_ck] CHECK ([costType] IN (N'MATERIAL', N'LABOR', N'MACHINE', N'OVERHEAD')),
  CONSTRAINT [operational_cost_rates_unit_ck] CHECK ([unit] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH', N'HOUR', N'MINUTE')),
  CONSTRAINT [operational_cost_rates_rate_ck] CHECK ([rate] > 0),
  CONSTRAINT [operational_cost_rates_status_ck] CHECK ([status] IN (N'ACTIVE', N'INACTIVE')),
  CONSTRAINT [operational_cost_rates_effective_ck] CHECK ([effectiveTo] IS NULL OR [effectiveTo] >= [effectiveFrom]),
  CONSTRAINT [operational_cost_rates_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_rates_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_rates_line_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_rates_machine_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_rates_cost_center_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [operational_cost_rates_tenant_type_status_idx] ON [dbo].[operational_cost_rates]([companyId], [branchId], [costType], [status]);
CREATE INDEX [operational_cost_rates_tenant_cost_center_dates_idx] ON [dbo].[operational_cost_rates]([companyId], [branchId], [costCenterId], [effectiveFrom], [effectiveTo]);
CREATE INDEX [operational_cost_rates_tenant_line_machine_dates_idx] ON [dbo].[operational_cost_rates]([companyId], [branchId], [productionLineId], [machineId], [effectiveFrom], [effectiveTo]);
CREATE INDEX [operational_cost_rates_line_idx] ON [dbo].[operational_cost_rates]([productionLineId]);
CREATE INDEX [operational_cost_rates_machine_idx] ON [dbo].[operational_cost_rates]([machineId]);
CREATE INDEX [operational_cost_rates_cost_center_idx] ON [dbo].[operational_cost_rates]([costCenterId]);

CREATE TABLE [dbo].[operational_standard_cost_snapshots] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [code] NVARCHAR(1000) NOT NULL,
  [revision] INT NOT NULL CONSTRAINT [operational_standard_cost_snapshots_revision_df] DEFAULT 1,
  [productionProductDefinitionId] NVARCHAR(1000) NOT NULL,
  [productionVersionId] NVARCHAR(1000) NULL,
  [productionPackagingId] NVARCHAR(1000) NULL,
  [productionLineId] NVARCHAR(1000) NULL,
  [machineId] NVARCHAR(1000) NULL,
  [costCenterId] NVARCHAR(1000) NULL,
  [costType] NVARCHAR(1000) NOT NULL,
  [unit] NVARCHAR(1000) NOT NULL,
  [quantity] DECIMAL(18,4) NOT NULL,
  [rate] DECIMAL(19,4) NOT NULL,
  [amount] DECIMAL(19,4) NOT NULL,
  [currencyCode] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_standard_cost_snapshots_currency_df] DEFAULT N'USD',
  [effectiveFrom] DATETIME2 NOT NULL,
  [effectiveTo] DATETIME2 NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_standard_cost_snapshots_status_df] DEFAULT N'DRAFT',
  [frozenById] NVARCHAR(1000) NULL,
  [frozenAt] DATETIME2 NULL,
  [supersededById] NVARCHAR(1000) NULL,
  [supersededAt] DATETIME2 NULL,
  [notes] NVARCHAR(1000) NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [operational_standard_cost_snapshots_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [operational_standard_cost_snapshots_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [operational_standard_cost_snapshots_tenant_code_revision_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [code], [revision]),
  CONSTRAINT [operational_standard_cost_snapshots_revision_ck] CHECK ([revision] >= 1),
  CONSTRAINT [operational_standard_cost_snapshots_cost_type_ck] CHECK ([costType] IN (N'MATERIAL', N'LABOR', N'MACHINE', N'OVERHEAD')),
  CONSTRAINT [operational_standard_cost_snapshots_unit_ck] CHECK ([unit] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH', N'HOUR', N'MINUTE')),
  CONSTRAINT [operational_standard_cost_snapshots_quantity_ck] CHECK ([quantity] > 0),
  CONSTRAINT [operational_standard_cost_snapshots_rate_ck] CHECK ([rate] > 0),
  CONSTRAINT [operational_standard_cost_snapshots_amount_ck] CHECK ([amount] > 0),
  CONSTRAINT [operational_standard_cost_snapshots_status_ck] CHECK ([status] IN (N'DRAFT', N'FROZEN', N'SUPERSEDED')),
  CONSTRAINT [operational_standard_cost_snapshots_frozen_ck] CHECK ([frozenAt] IS NULL OR ([frozenById] IS NOT NULL AND [status] IN (N'FROZEN', N'SUPERSEDED'))),
  CONSTRAINT [operational_standard_cost_snapshots_superseded_ck] CHECK ([supersededAt] IS NULL OR ([supersededById] IS NOT NULL AND [status] = N'SUPERSEDED')),
  CONSTRAINT [operational_standard_cost_snapshots_effective_ck] CHECK ([effectiveTo] IS NULL OR [effectiveTo] >= [effectiveFrom]),
  CONSTRAINT [operational_standard_cost_snapshots_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_standard_cost_snapshots_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_standard_cost_snapshots_product_fkey] FOREIGN KEY ([productionProductDefinitionId]) REFERENCES [dbo].[production_product_definitions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_standard_cost_snapshots_version_fkey] FOREIGN KEY ([productionVersionId]) REFERENCES [dbo].[production_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_standard_cost_snapshots_packaging_fkey] FOREIGN KEY ([productionPackagingId]) REFERENCES [dbo].[production_packagings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_standard_cost_snapshots_line_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_standard_cost_snapshots_machine_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_standard_cost_snapshots_cost_center_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [operational_standard_cost_snapshots_tenant_product_type_status_idx] ON [dbo].[operational_standard_cost_snapshots]([companyId], [branchId], [productionProductDefinitionId], [productionVersionId], [productionPackagingId], [costType], [status]);
CREATE INDEX [operational_standard_cost_snapshots_tenant_status_dates_idx] ON [dbo].[operational_standard_cost_snapshots]([companyId], [branchId], [status], [effectiveFrom], [effectiveTo]);
CREATE INDEX [operational_standard_cost_snapshots_product_idx] ON [dbo].[operational_standard_cost_snapshots]([productionProductDefinitionId]);
CREATE INDEX [operational_standard_cost_snapshots_version_idx] ON [dbo].[operational_standard_cost_snapshots]([productionVersionId]);
CREATE INDEX [operational_standard_cost_snapshots_packaging_idx] ON [dbo].[operational_standard_cost_snapshots]([productionPackagingId]);
CREATE INDEX [operational_standard_cost_snapshots_line_idx] ON [dbo].[operational_standard_cost_snapshots]([productionLineId]);
CREATE INDEX [operational_standard_cost_snapshots_machine_idx] ON [dbo].[operational_standard_cost_snapshots]([machineId]);
CREATE INDEX [operational_standard_cost_snapshots_cost_center_idx] ON [dbo].[operational_standard_cost_snapshots]([costCenterId]);

CREATE TABLE [dbo].[operational_cost_transactions] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [eventType] NVARCHAR(1000) NOT NULL,
  [sourceType] NVARCHAR(1000) NOT NULL,
  [sourceId] NVARCHAR(1000) NOT NULL,
  [sourceNumberSnapshot] NVARCHAR(1000) NULL,
  [clientRequestId] NVARCHAR(1000) NOT NULL,
  [productionOrderId] NVARCHAR(1000) NULL,
  [productionRunId] NVARCHAR(1000) NULL,
  [productId] NVARCHAR(1000) NULL,
  [productCodeSnapshot] NVARCHAR(1000) NULL,
  [productNameSnapshot] NVARCHAR(1000) NULL,
  [productionVersionId] NVARCHAR(1000) NULL,
  [productionPackagingId] NVARCHAR(1000) NULL,
  [productionLineId] NVARCHAR(1000) NULL,
  [machineId] NVARCHAR(1000) NULL,
  [shiftId] NVARCHAR(1000) NULL,
  [costCenterId] NVARCHAR(1000) NULL,
  [standardCostSnapshotId] NVARCHAR(1000) NULL,
  [outputEventId] NVARCHAR(1000) NULL,
  [quantity] DECIMAL(18,4) NOT NULL,
  [unit] NVARCHAR(1000) NOT NULL,
  [rate] DECIMAL(19,4) NOT NULL,
  [amount] DECIMAL(19,4) NOT NULL,
  [currencyCode] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_cost_transactions_currency_df] DEFAULT N'USD',
  [standardAmount] DECIMAL(19,4) NULL,
  [varianceAmount] DECIMAL(19,4) NULL,
  [occurredAt] DATETIME2 NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_cost_transactions_status_df] DEFAULT N'POSTED',
  [reversalOfId] NVARCHAR(1000) NULL,
  [reversalReason] NVARCHAR(1000) NULL,
  [notes] NVARCHAR(1000) NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [reversedById] NVARCHAR(1000) NULL,
  [reversedAt] DATETIME2 NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [operational_cost_transactions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [operational_cost_transactions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [operational_cost_transactions_tenant_request_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [clientRequestId]),
  CONSTRAINT [operational_cost_transactions_event_type_ck] CHECK ([eventType] IN (N'MATERIAL', N'LABOR', N'MACHINE', N'OVERHEAD')),
  CONSTRAINT [operational_cost_transactions_source_type_ck] CHECK ([sourceType] IN (N'PRODUCTION_ORDER', N'PRODUCTION_RUN', N'OUTPUT_EVENT', N'FG_RECEIPT', N'MATERIAL_DOCUMENT', N'QUALITY_DISPOSITION', N'REVERSAL', N'MANUAL')),
  CONSTRAINT [operational_cost_transactions_unit_ck] CHECK ([unit] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH', N'HOUR', N'MINUTE')),
  CONSTRAINT [operational_cost_transactions_status_ck] CHECK ([status] IN (N'POSTED', N'REVERSED')),
  CONSTRAINT [operational_cost_transactions_quantity_sign_ck] CHECK (([status] = N'POSTED' AND [quantity] > 0) OR ([status] = N'REVERSED' AND [quantity] < 0)),
  CONSTRAINT [operational_cost_transactions_amount_sign_ck] CHECK (([status] = N'POSTED' AND [amount] > 0) OR ([status] = N'REVERSED' AND [amount] < 0)),
  CONSTRAINT [operational_cost_transactions_rate_ck] CHECK ([rate] > 0),
  CONSTRAINT [operational_cost_transactions_reversal_link_ck] CHECK (([status] = N'POSTED' AND [reversalOfId] IS NULL) OR ([status] = N'REVERSED' AND [reversalOfId] IS NOT NULL)),
  CONSTRAINT [operational_cost_transactions_reversal_reason_ck] CHECK ([status] <> N'REVERSED' OR [reversalReason] IS NOT NULL),
  CONSTRAINT [operational_cost_transactions_reversal_meta_ck] CHECK ([reversedAt] IS NULL OR ([reversedById] IS NOT NULL AND [reversalOfId] IS NULL)),
  CONSTRAINT [operational_cost_transactions_standard_amount_ck] CHECK ([standardAmount] IS NULL OR [standardAmount] >= 0),
  CONSTRAINT [operational_cost_transactions_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_order_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_run_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_product_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_version_fkey] FOREIGN KEY ([productionVersionId]) REFERENCES [dbo].[production_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_packaging_fkey] FOREIGN KEY ([productionPackagingId]) REFERENCES [dbo].[production_packagings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_line_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_machine_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_shift_fkey] FOREIGN KEY ([shiftId]) REFERENCES [dbo].[production_shifts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_cost_center_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_snapshot_fkey] FOREIGN KEY ([standardCostSnapshotId]) REFERENCES [dbo].[operational_standard_cost_snapshots]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_output_event_fkey] FOREIGN KEY ([outputEventId]) REFERENCES [dbo].[production_output_events]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [operational_cost_transactions_reversal_of_fkey] FOREIGN KEY ([reversalOfId]) REFERENCES [dbo].[operational_cost_transactions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [operational_cost_transactions_tenant_type_time_idx] ON [dbo].[operational_cost_transactions]([companyId], [branchId], [eventType], [occurredAt]);
CREATE INDEX [operational_cost_transactions_tenant_source_idx] ON [dbo].[operational_cost_transactions]([companyId], [branchId], [sourceType], [sourceId]);
CREATE INDEX [operational_cost_transactions_tenant_order_time_idx] ON [dbo].[operational_cost_transactions]([companyId], [branchId], [productionOrderId], [occurredAt]);
CREATE INDEX [operational_cost_transactions_tenant_run_time_idx] ON [dbo].[operational_cost_transactions]([companyId], [branchId], [productionRunId], [occurredAt]);
CREATE INDEX [operational_cost_transactions_tenant_cost_center_time_idx] ON [dbo].[operational_cost_transactions]([companyId], [branchId], [costCenterId], [occurredAt]);
CREATE INDEX [operational_cost_transactions_order_idx] ON [dbo].[operational_cost_transactions]([productionOrderId]);
CREATE INDEX [operational_cost_transactions_run_idx] ON [dbo].[operational_cost_transactions]([productionRunId]);
CREATE INDEX [operational_cost_transactions_product_idx] ON [dbo].[operational_cost_transactions]([productId]);
CREATE INDEX [operational_cost_transactions_version_idx] ON [dbo].[operational_cost_transactions]([productionVersionId]);
CREATE INDEX [operational_cost_transactions_packaging_idx] ON [dbo].[operational_cost_transactions]([productionPackagingId]);
CREATE INDEX [operational_cost_transactions_line_idx] ON [dbo].[operational_cost_transactions]([productionLineId]);
CREATE INDEX [operational_cost_transactions_machine_idx] ON [dbo].[operational_cost_transactions]([machineId]);
CREATE INDEX [operational_cost_transactions_shift_idx] ON [dbo].[operational_cost_transactions]([shiftId]);
CREATE INDEX [operational_cost_transactions_cost_center_idx] ON [dbo].[operational_cost_transactions]([costCenterId]);
CREATE INDEX [operational_cost_transactions_snapshot_idx] ON [dbo].[operational_cost_transactions]([standardCostSnapshotId]);
CREATE INDEX [operational_cost_transactions_output_event_idx] ON [dbo].[operational_cost_transactions]([outputEventId]);
CREATE INDEX [operational_cost_transactions_reversal_of_idx] ON [dbo].[operational_cost_transactions]([reversalOfId]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
