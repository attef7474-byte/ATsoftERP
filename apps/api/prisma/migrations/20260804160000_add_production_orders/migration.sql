SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- Phase 1.4 Production Orders.
-- Existing-data impact: additive only; no existing table or row is altered.
-- Backfill/default behavior: not applicable because all three tables are new.
-- Recovery: the transaction rolls back every object when any statement fails.
-- Runtime compatibility: Phase 1.3 remains unchanged; Phase 1.4 application code
-- must be deployed only after this migration is independently reviewed/applied.

CREATE TABLE [dbo].[production_orders] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [orderNumber] NVARCHAR(1000) NOT NULL,
  [clientRequestId] NVARCHAR(1000) NOT NULL,
  [productionProductDefinitionId] NVARCHAR(1000) NOT NULL,
  [productionVersionId] NVARCHAR(1000) NOT NULL,
  [productionPackagingId] NVARCHAR(1000) NULL,
  [productionUnitId] NVARCHAR(1000) NOT NULL,
  [productionLineId] NVARCHAR(1000) NOT NULL,
  [machineId] NVARCHAR(1000) NULL,
  [plannedQuantity] DECIMAL(18,4) NOT NULL,
  [quantityUnit] NVARCHAR(1000) NOT NULL,
  [capacityTimeBasis] NVARCHAR(1000) NOT NULL,
  [plannedStartAt] DATETIME2 NOT NULL,
  [plannedEndAt] DATETIME2 NOT NULL,
  [priority] NVARCHAR(1000) NOT NULL CONSTRAINT [production_orders_priority_df] DEFAULT N'NORMAL',
  [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [production_orders_source_type_df] DEFAULT N'MANUAL',
  [sourceReference] NVARCHAR(1000) NULL,
  [costCenterId] NVARCHAR(1000) NOT NULL,
  [issueWarehouseId] NVARCHAR(1000) NULL,
  [receiptWarehouseId] NVARCHAR(1000) NULL,
  [capacityStandardId] NVARCHAR(1000) NOT NULL,
  [capacityStandardCodeSnapshot] NVARCHAR(1000) NOT NULL,
  [capacityStandardRevisionSnapshot] INT NOT NULL,
  [standardRateSnapshot] DECIMAL(18,4) NOT NULL,
  [outputUnitSnapshot] NVARCHAR(1000) NOT NULL,
  [timeBasisSnapshot] NVARCHAR(1000) NOT NULL,
  [standardCycleTimeMinutesSnapshot] DECIMAL(18,4) NULL,
  [setupMinutesSnapshot] DECIMAL(18,4) NOT NULL,
  [changeoverMinutesSnapshot] DECIMAL(18,4) NOT NULL,
  [cleaningMinutesSnapshot] DECIMAL(18,4) NOT NULL,
  [startupAllowanceMinutesSnapshot] DECIMAL(18,4) NOT NULL,
  [shutdownAllowanceMinutesSnapshot] DECIMAL(18,4) NOT NULL,
  [targetEfficiencyPercentSnapshot] DECIMAL(7,4) NOT NULL,
  [expectedYieldPercentSnapshot] DECIMAL(7,4) NOT NULL,
  [capacityEffectiveFromSnapshot] DATETIME2 NOT NULL,
  [capacityEffectiveToSnapshot] DATETIME2 NULL,
  [capacityProductIdSnapshot] NVARCHAR(1000) NOT NULL,
  [capacityVersionIdSnapshot] NVARCHAR(1000) NULL,
  [capacityPackagingIdSnapshot] NVARCHAR(1000) NULL,
  [capacityLineIdSnapshot] NVARCHAR(1000) NOT NULL,
  [capacityMachineIdSnapshot] NVARCHAR(1000) NULL,
  [plannedGrossQuantity] DECIMAL(18,4) NOT NULL,
  [plannedRunMinutes] DECIMAL(18,4) NOT NULL,
  [plannedAllowanceMinutes] DECIMAL(18,4) NOT NULL,
  [plannedDurationMinutes] DECIMAL(18,4) NOT NULL,
  [durationCalculationVersion] NVARCHAR(1000) NOT NULL CONSTRAINT [production_orders_duration_version_df] DEFAULT N'PHASE_1_4_V1',
  [snapshotFrozenAt] DATETIME2 NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_orders_status_df] DEFAULT N'DRAFT',
  [lockVersion] INT NOT NULL CONSTRAINT [production_orders_lock_version_df] DEFAULT 0,
  [plannedById] NVARCHAR(1000) NULL,
  [plannedAt] DATETIME2 NULL,
  [releasedById] NVARCHAR(1000) NULL,
  [releasedAt] DATETIME2 NULL,
  [cancelledById] NVARCHAR(1000) NULL,
  [cancelledAt] DATETIME2 NULL,
  [cancellationReason] NVARCHAR(1000) NULL,
  [archivedById] NVARCHAR(1000) NULL,
  [archivedAt] DATETIME2 NULL,
  [archiveReason] NVARCHAR(1000) NULL,
  [closedById] NVARCHAR(1000) NULL,
  [closedAt] DATETIME2 NULL,
  [closureReason] NVARCHAR(1000) NULL,
  [notes] NVARCHAR(1000) NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [updatedById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_orders_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [production_orders_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_orders_tenant_number_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [orderNumber]),
  CONSTRAINT [production_orders_tenant_request_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [clientRequestId]),
  CONSTRAINT [production_orders_quantity_ck] CHECK ([plannedQuantity] > 0),
  CONSTRAINT [production_orders_dates_ck] CHECK ([plannedEndAt] > [plannedStartAt]),
  CONSTRAINT [production_orders_rate_ck] CHECK ([standardRateSnapshot] > 0),
  CONSTRAINT [production_orders_cycle_ck] CHECK ([standardCycleTimeMinutesSnapshot] IS NULL OR [standardCycleTimeMinutesSnapshot] > 0),
  CONSTRAINT [production_orders_allowances_ck] CHECK ([setupMinutesSnapshot] >= 0 AND [changeoverMinutesSnapshot] >= 0 AND [cleaningMinutesSnapshot] >= 0 AND [startupAllowanceMinutesSnapshot] >= 0 AND [shutdownAllowanceMinutesSnapshot] >= 0),
  CONSTRAINT [production_orders_efficiency_ck] CHECK ([targetEfficiencyPercentSnapshot] > 0 AND [targetEfficiencyPercentSnapshot] <= 100),
  CONSTRAINT [production_orders_yield_ck] CHECK ([expectedYieldPercentSnapshot] > 0 AND [expectedYieldPercentSnapshot] <= 100),
  CONSTRAINT [production_orders_duration_ck] CHECK ([plannedGrossQuantity] > 0 AND [plannedRunMinutes] > 0 AND [plannedAllowanceMinutes] >= 0 AND [plannedDurationMinutes] > 0),
  CONSTRAINT [production_orders_lock_version_ck] CHECK ([lockVersion] >= 0),
  CONSTRAINT [production_orders_quantity_unit_ck] CHECK ([quantityUnit] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH')),
  CONSTRAINT [production_orders_output_unit_ck] CHECK ([outputUnitSnapshot] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH')),
  CONSTRAINT [production_orders_time_basis_ck] CHECK ([capacityTimeBasis] IN (N'MINUTE', N'HOUR') AND [timeBasisSnapshot] IN (N'MINUTE', N'HOUR')),
  CONSTRAINT [production_orders_priority_ck] CHECK ([priority] IN (N'LOW', N'NORMAL', N'HIGH', N'URGENT')),
  CONSTRAINT [production_orders_source_type_ck] CHECK ([sourceType] IN (N'MANUAL', N'REPLENISHMENT', N'FORECAST', N'OTHER')),
  CONSTRAINT [production_orders_status_ck] CHECK ([status] IN (N'DRAFT', N'PLANNED', N'RELEASED', N'IN_PROGRESS', N'COMPLETED', N'CANCELLED', N'CLOSED', N'ARCHIVED')),
  CONSTRAINT [production_orders_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_orders_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_orders_product_fkey] FOREIGN KEY ([productionProductDefinitionId]) REFERENCES [dbo].[production_product_definitions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_orders_version_fkey] FOREIGN KEY ([productionVersionId]) REFERENCES [dbo].[production_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_orders_packaging_fkey] FOREIGN KEY ([productionPackagingId]) REFERENCES [dbo].[production_packagings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_orders_unit_fkey] FOREIGN KEY ([productionUnitId]) REFERENCES [dbo].[production_units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_orders_line_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_orders_machine_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_orders_cost_center_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_orders_issue_warehouse_fkey] FOREIGN KEY ([issueWarehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_orders_receipt_warehouse_fkey] FOREIGN KEY ([receiptWarehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_orders_capacity_standard_fkey] FOREIGN KEY ([capacityStandardId]) REFERENCES [dbo].[production_capacity_standards]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_orders_tenant_status_dates_idx] ON [dbo].[production_orders]([companyId], [branchId], [status], [plannedStartAt], [plannedEndAt]);
CREATE INDEX [production_orders_tenant_product_idx] ON [dbo].[production_orders]([companyId], [branchId], [productionProductDefinitionId]);
CREATE INDEX [production_orders_line_machine_dates_idx] ON [dbo].[production_orders]([companyId], [branchId], [productionLineId], [machineId], [plannedStartAt], [plannedEndAt]);
CREATE INDEX [production_orders_source_idx] ON [dbo].[production_orders]([companyId], [branchId], [sourceType], [sourceReference]);
CREATE INDEX [production_orders_version_idx] ON [dbo].[production_orders]([productionVersionId]);
CREATE INDEX [production_orders_packaging_idx] ON [dbo].[production_orders]([productionPackagingId]);
CREATE INDEX [production_orders_unit_idx] ON [dbo].[production_orders]([productionUnitId]);
CREATE INDEX [production_orders_cost_center_idx] ON [dbo].[production_orders]([costCenterId]);
CREATE INDEX [production_orders_issue_warehouse_idx] ON [dbo].[production_orders]([issueWarehouseId]);
CREATE INDEX [production_orders_receipt_warehouse_idx] ON [dbo].[production_orders]([receiptWarehouseId]);
CREATE INDEX [production_orders_capacity_standard_idx] ON [dbo].[production_orders]([capacityStandardId]);

CREATE TABLE [dbo].[production_order_transitions] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [productionOrderId] NVARCHAR(1000) NOT NULL,
  [fromStatus] NVARCHAR(1000) NOT NULL,
  [toStatus] NVARCHAR(1000) NOT NULL,
  [action] NVARCHAR(1000) NOT NULL,
  [actorId] NVARCHAR(1000) NOT NULL,
  [reason] NVARCHAR(1000) NULL,
  [requestId] NVARCHAR(1000) NOT NULL,
  [readinessEvidence] NVARCHAR(MAX) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_order_transitions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [production_order_transitions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_order_transitions_request_key] UNIQUE NONCLUSTERED ([productionOrderId], [requestId]),
  CONSTRAINT [production_order_transitions_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_order_transitions_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_order_transitions_order_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_order_transitions_tenant_order_time_idx] ON [dbo].[production_order_transitions]([companyId], [branchId], [productionOrderId], [createdAt]);
CREATE INDEX [production_order_transitions_tenant_action_time_idx] ON [dbo].[production_order_transitions]([companyId], [branchId], [action], [createdAt]);

CREATE TABLE [dbo].[production_order_attachments] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [productionOrderId] NVARCHAR(1000) NOT NULL,
  [attachmentId] NVARCHAR(1000) NOT NULL,
  [uploadedById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_order_attachments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [production_order_attachments_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_order_attachments_order_attachment_key] UNIQUE NONCLUSTERED ([productionOrderId], [attachmentId]),
  CONSTRAINT [production_order_attachments_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_order_attachments_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_order_attachments_order_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_order_attachments_attachment_fkey] FOREIGN KEY ([attachmentId]) REFERENCES [dbo].[attachments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_order_attachments_tenant_order_time_idx] ON [dbo].[production_order_attachments]([companyId], [branchId], [productionOrderId], [createdAt]);
CREATE INDEX [production_order_attachments_attachment_idx] ON [dbo].[production_order_attachments]([attachmentId]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
