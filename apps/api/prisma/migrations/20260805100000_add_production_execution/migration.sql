SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- Phase 1.5 Production Execution (runs, sessions, measurement points, output events).
-- Existing-data impact: additive only; no existing table, column or row is altered.
-- Backfill/default behavior: not applicable because all five tables are new.
-- Recovery: the transaction rolls back every object when any statement fails.
-- Runtime compatibility: Phases 1.1-1.4 remain unchanged; Phase 1.5 application code
-- must be deployed only after this migration is independently reviewed/applied.
-- Filtered unique indexes below enforce "one active run per order/line" and "one
-- authoritative FINAL_OUTPUT point per line" at the SQL level; application code
-- enforces the same rules first. Future Prisma migrations may report these filtered
-- indexes as drift; they must be preserved, not dropped.

CREATE TABLE [dbo].[production_runs] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [runNumber] NVARCHAR(1000) NOT NULL,
  [clientRequestId] NVARCHAR(1000) NOT NULL,
  [productionOrderId] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_runs_status_df] DEFAULT N'READY',
  [lockVersion] INT NOT NULL CONSTRAINT [production_runs_lock_version_df] DEFAULT 0,
  [notes] NVARCHAR(1000) NULL,
  [shiftId] NVARCHAR(1000) NULL,
  [shiftCodeSnapshot] NVARCHAR(1000) NULL,
  [shiftNameSnapshot] NVARCHAR(1000) NULL,
  [shiftStartTimeSnapshot] NVARCHAR(1000) NULL,
  [shiftEndTimeSnapshot] NVARCHAR(1000) NULL,
  [shiftAssignmentId] NVARCHAR(1000) NULL,
  [shiftAssignmentCodeSnapshot] NVARCHAR(1000) NULL,
  [operationalAssignmentId] NVARCHAR(1000) NULL,
  [operationalAssignmentCodeSnapshot] NVARCHAR(1000) NULL,
  [operationalPersonId] NVARCHAR(1000) NULL,
  [operationalPersonCodeSnapshot] NVARCHAR(1000) NULL,
  [operationalPersonNameSnapshot] NVARCHAR(1000) NULL,
  [assignmentResolutionSource] NVARCHAR(1000) NOT NULL CONSTRAINT [production_runs_assignment_source_df] DEFAULT N'RESOURCE',
  [assignmentResolutionNote] NVARCHAR(1000) NULL,
  [productionUnitId] NVARCHAR(1000) NOT NULL,
  [productionLineId] NVARCHAR(1000) NOT NULL,
  [machineId] NVARCHAR(1000) NULL,
  [productionProductDefinitionId] NVARCHAR(1000) NOT NULL,
  [productionVersionId] NVARCHAR(1000) NOT NULL,
  [productionPackagingId] NVARCHAR(1000) NULL,
  [costCenterId] NVARCHAR(1000) NOT NULL,
  [issueWarehouseId] NVARCHAR(1000) NULL,
  [receiptWarehouseId] NVARCHAR(1000) NULL,
  [orderNumberSnapshot] NVARCHAR(1000) NOT NULL,
  [plannedQuantitySnapshot] DECIMAL(18,4) NOT NULL,
  [quantityUnitSnapshot] NVARCHAR(1000) NOT NULL,
  [capacityStandardCodeSnapshot] NVARCHAR(1000) NOT NULL,
  [capacityStandardRevisionSnapshot] INT NOT NULL,
  [standardRateSnapshot] DECIMAL(18,4) NOT NULL,
  [outputUnitSnapshot] NVARCHAR(1000) NOT NULL,
  [timeBasisSnapshot] NVARCHAR(1000) NOT NULL,
  [targetEfficiencyPercentSnapshot] DECIMAL(7,4) NOT NULL,
  [expectedYieldPercentSnapshot] DECIMAL(7,4) NOT NULL,
  [snapshotFrozenAtSnapshot] DATETIME2 NULL,
  [startedById] NVARCHAR(1000) NULL,
  [startedAt] DATETIME2 NULL,
  [pausedById] NVARCHAR(1000) NULL,
  [pausedAt] DATETIME2 NULL,
  [endedById] NVARCHAR(1000) NULL,
  [endedAt] DATETIME2 NULL,
  [pauseReason] NVARCHAR(1000) NULL,
  [abortReason] NVARCHAR(1000) NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [updatedById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_runs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [production_runs_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_runs_tenant_number_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [runNumber]),
  CONSTRAINT [production_runs_tenant_request_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [clientRequestId]),
  CONSTRAINT [production_runs_status_ck] CHECK ([status] IN (N'READY', N'RUNNING', N'PAUSED', N'COMPLETED', N'ABORTED')),
  CONSTRAINT [production_runs_lock_version_ck] CHECK ([lockVersion] >= 0),
  CONSTRAINT [production_runs_planned_quantity_ck] CHECK ([plannedQuantitySnapshot] > 0),
  CONSTRAINT [production_runs_rate_ck] CHECK ([standardRateSnapshot] > 0),
  CONSTRAINT [production_runs_efficiency_ck] CHECK ([targetEfficiencyPercentSnapshot] > 0 AND [targetEfficiencyPercentSnapshot] <= 100),
  CONSTRAINT [production_runs_yield_ck] CHECK ([expectedYieldPercentSnapshot] > 0 AND [expectedYieldPercentSnapshot] <= 100),
  CONSTRAINT [production_runs_quantity_unit_ck] CHECK ([quantityUnitSnapshot] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH')),
  CONSTRAINT [production_runs_output_unit_ck] CHECK ([outputUnitSnapshot] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH')),
  CONSTRAINT [production_runs_time_basis_ck] CHECK ([timeBasisSnapshot] IN (N'MINUTE', N'HOUR')),
  CONSTRAINT [production_runs_assignment_source_ck] CHECK ([assignmentResolutionSource] IN (N'RESOURCE', N'EXPLICIT', N'PERSON')),
  CONSTRAINT [production_runs_started_ended_ck] CHECK ([endedAt] IS NULL OR ([startedAt] IS NOT NULL AND [endedAt] >= [startedAt])),
  CONSTRAINT [production_runs_paused_ck] CHECK ([pausedAt] IS NULL OR ([startedAt] IS NOT NULL AND [pausedAt] >= [startedAt])),
  CONSTRAINT [production_runs_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_runs_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_runs_order_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_runs_unit_fkey] FOREIGN KEY ([productionUnitId]) REFERENCES [dbo].[production_units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_runs_line_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_runs_machine_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_runs_product_fkey] FOREIGN KEY ([productionProductDefinitionId]) REFERENCES [dbo].[production_product_definitions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_runs_version_fkey] FOREIGN KEY ([productionVersionId]) REFERENCES [dbo].[production_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_runs_packaging_fkey] FOREIGN KEY ([productionPackagingId]) REFERENCES [dbo].[production_packagings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_runs_cost_center_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_runs_issue_warehouse_fkey] FOREIGN KEY ([issueWarehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_runs_receipt_warehouse_fkey] FOREIGN KEY ([receiptWarehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [production_runs_one_active_per_order_idx] ON [dbo].[production_runs]([companyId], [branchId], [productionOrderId]) WHERE [status] IN (N'READY', N'RUNNING', N'PAUSED') AND [deletedAt] IS NULL;
CREATE UNIQUE NONCLUSTERED INDEX [production_runs_one_active_per_line_idx] ON [dbo].[production_runs]([companyId], [branchId], [productionLineId]) WHERE [status] IN (N'READY', N'RUNNING', N'PAUSED') AND [deletedAt] IS NULL;
CREATE INDEX [production_runs_tenant_status_time_idx] ON [dbo].[production_runs]([companyId], [branchId], [status], [createdAt]);
CREATE INDEX [production_runs_tenant_order_status_idx] ON [dbo].[production_runs]([companyId], [branchId], [productionOrderId], [status]);
CREATE INDEX [production_runs_tenant_line_machine_status_idx] ON [dbo].[production_runs]([companyId], [branchId], [productionLineId], [machineId], [status]);
CREATE INDEX [production_runs_tenant_started_idx] ON [dbo].[production_runs]([companyId], [branchId], [startedAt]);
CREATE INDEX [production_runs_order_idx] ON [dbo].[production_runs]([productionOrderId]);
CREATE INDEX [production_runs_shift_idx] ON [dbo].[production_runs]([shiftId]);
CREATE INDEX [production_runs_shift_assignment_idx] ON [dbo].[production_runs]([shiftAssignmentId]);
CREATE INDEX [production_runs_operational_assignment_idx] ON [dbo].[production_runs]([operationalAssignmentId]);
CREATE INDEX [production_runs_person_idx] ON [dbo].[production_runs]([operationalPersonId]);
CREATE INDEX [production_runs_unit_idx] ON [dbo].[production_runs]([productionUnitId]);
CREATE INDEX [production_runs_line_idx] ON [dbo].[production_runs]([productionLineId]);
CREATE INDEX [production_runs_machine_idx] ON [dbo].[production_runs]([machineId]);
CREATE INDEX [production_runs_product_idx] ON [dbo].[production_runs]([productionProductDefinitionId]);
CREATE INDEX [production_runs_version_idx] ON [dbo].[production_runs]([productionVersionId]);
CREATE INDEX [production_runs_packaging_idx] ON [dbo].[production_runs]([productionPackagingId]);
CREATE INDEX [production_runs_cost_center_idx] ON [dbo].[production_runs]([costCenterId]);
CREATE INDEX [production_runs_issue_warehouse_idx] ON [dbo].[production_runs]([issueWarehouseId]);
CREATE INDEX [production_runs_receipt_warehouse_idx] ON [dbo].[production_runs]([receiptWarehouseId]);

CREATE TABLE [dbo].[production_run_sessions] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [productionRunId] NVARCHAR(1000) NOT NULL,
  [startedAt] DATETIME2 NOT NULL,
  [closedAt] DATETIME2 NULL,
  [startedById] NVARCHAR(1000) NULL,
  [closedById] NVARCHAR(1000) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_run_sessions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [production_run_sessions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_run_sessions_interval_ck] CHECK ([closedAt] IS NULL OR [closedAt] >= [startedAt]),
  CONSTRAINT [production_run_sessions_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_run_sessions_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_run_sessions_run_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_run_sessions_tenant_run_time_idx] ON [dbo].[production_run_sessions]([companyId], [branchId], [productionRunId], [startedAt]);
CREATE INDEX [production_run_sessions_run_idx] ON [dbo].[production_run_sessions]([productionRunId]);

CREATE TABLE [dbo].[production_run_transitions] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [productionRunId] NVARCHAR(1000) NOT NULL,
  [fromStatus] NVARCHAR(1000) NOT NULL,
  [toStatus] NVARCHAR(1000) NOT NULL,
  [action] NVARCHAR(1000) NOT NULL,
  [actorId] NVARCHAR(1000) NOT NULL,
  [reason] NVARCHAR(1000) NULL,
  [requestId] NVARCHAR(1000) NOT NULL,
  [readinessEvidence] NVARCHAR(MAX) NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_run_transitions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [production_run_transitions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_run_transitions_request_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [productionRunId], [requestId]),
  CONSTRAINT [production_run_transitions_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_run_transitions_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_run_transitions_run_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_run_transitions_tenant_run_time_idx] ON [dbo].[production_run_transitions]([companyId], [branchId], [productionRunId], [createdAt]);
CREATE INDEX [production_run_transitions_tenant_action_time_idx] ON [dbo].[production_run_transitions]([companyId], [branchId], [action], [createdAt]);

CREATE TABLE [dbo].[production_measurement_points] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [code] NVARCHAR(1000) NOT NULL,
  [name] NVARCHAR(1000) NOT NULL,
  [description] NVARCHAR(1000) NULL,
  [productionLineId] NVARCHAR(1000) NOT NULL,
  [machineId] NVARCHAR(1000) NULL,
  [machineComponentId] NVARCHAR(1000) NULL,
  [productionUnitId] NVARCHAR(1000) NOT NULL,
  [role] NVARCHAR(1000) NOT NULL CONSTRAINT [production_measurement_points_role_df] DEFAULT N'FINAL_OUTPUT',
  [source] NVARCHAR(1000) NOT NULL CONSTRAINT [production_measurement_points_source_df] DEFAULT N'MANUAL',
  [unit] NVARCHAR(1000) NOT NULL,
  [isAuthoritativeFinal] BIT NOT NULL CONSTRAINT [production_measurement_points_authoritative_df] DEFAULT 0,
  [counterModulus] DECIMAL(18,4) NULL,
  [effectiveFrom] DATETIME2 NOT NULL,
  [effectiveTo] DATETIME2 NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_measurement_points_status_df] DEFAULT N'DRAFT',
  [createdById] NVARCHAR(1000) NOT NULL,
  [updatedById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_measurement_points_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [production_measurement_points_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_measurement_points_tenant_code_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [code]),
  CONSTRAINT [production_measurement_points_role_ck] CHECK ([role] IN (N'INPUT', N'INTERMEDIATE', N'FINAL_OUTPUT', N'WASTE', N'REWORK')),
  CONSTRAINT [production_measurement_points_source_ck] CHECK ([source] IN (N'MANUAL', N'COUNTER')),
  CONSTRAINT [production_measurement_points_unit_ck] CHECK ([unit] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH')),
  CONSTRAINT [production_measurement_points_status_ck] CHECK ([status] IN (N'DRAFT', N'ACTIVE', N'INACTIVE')),
  CONSTRAINT [production_measurement_points_effective_ck] CHECK ([effectiveTo] IS NULL OR [effectiveTo] >= [effectiveFrom]),
  CONSTRAINT [production_measurement_points_modulus_ck] CHECK ([counterModulus] IS NULL OR [counterModulus] > 0),
  CONSTRAINT [production_measurement_points_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_measurement_points_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_measurement_points_line_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_measurement_points_machine_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_measurement_points_component_fkey] FOREIGN KEY ([machineComponentId]) REFERENCES [dbo].[machine_components]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_measurement_points_unit_ref_fkey] FOREIGN KEY ([productionUnitId]) REFERENCES [dbo].[production_units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [production_measurement_points_one_authoritative_per_line_idx] ON [dbo].[production_measurement_points]([companyId], [branchId], [productionLineId]) WHERE [isAuthoritativeFinal] = 1 AND [status] = N'ACTIVE' AND [deletedAt] IS NULL;
CREATE INDEX [production_measurement_points_tenant_status_role_idx] ON [dbo].[production_measurement_points]([companyId], [branchId], [status], [role]);
CREATE INDEX [production_measurement_points_tenant_line_machine_status_idx] ON [dbo].[production_measurement_points]([companyId], [branchId], [productionLineId], [machineId], [status]);
CREATE INDEX [production_measurement_points_tenant_authoritative_status_idx] ON [dbo].[production_measurement_points]([companyId], [branchId], [isAuthoritativeFinal], [status]);
CREATE INDEX [production_measurement_points_line_idx] ON [dbo].[production_measurement_points]([productionLineId]);
CREATE INDEX [production_measurement_points_machine_idx] ON [dbo].[production_measurement_points]([machineId]);
CREATE INDEX [production_measurement_points_component_idx] ON [dbo].[production_measurement_points]([machineComponentId]);
CREATE INDEX [production_measurement_points_unit_idx] ON [dbo].[production_measurement_points]([productionUnitId]);

CREATE TABLE [dbo].[production_output_events] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [productionRunId] NVARCHAR(1000) NOT NULL,
  [measurementPointId] NVARCHAR(1000) NOT NULL,
  [eventType] NVARCHAR(1000) NOT NULL CONSTRAINT [production_output_events_type_df] DEFAULT N'PRODUCTION',
  [classification] NVARCHAR(1000) NOT NULL,
  [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [production_output_events_source_type_df] DEFAULT N'MANUAL',
  [quantity] DECIMAL(18,4) NOT NULL,
  [goodQuantity] DECIMAL(18,4) NOT NULL,
  [rejectQuantity] DECIMAL(18,4) NOT NULL,
  [unit] NVARCHAR(1000) NOT NULL,
  [occurredAt] DATETIME2 NOT NULL,
  [requestId] NVARCHAR(1000) NOT NULL,
  [sourceEventId] NVARCHAR(1000) NULL,
  [previousRawCount] DECIMAL(18,4) NULL,
  [rawCount] DECIMAL(18,4) NULL,
  [resetValue] DECIMAL(18,4) NULL,
  [correctsEventId] NVARCHAR(1000) NULL,
  [reason] NVARCHAR(1000) NULL,
  [notes] NVARCHAR(1000) NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_output_events_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [production_output_events_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_output_events_tenant_request_key] UNIQUE NONCLUSTERED ([companyId], [requestId]),
  CONSTRAINT [production_output_events_type_ck] CHECK ([eventType] IN (N'PRODUCTION', N'CORRECTION', N'RESET')),
  CONSTRAINT [production_output_events_classification_ck] CHECK ([classification] IN (N'INPUT', N'INTERMEDIATE', N'FINAL_OUTPUT', N'WASTE', N'REWORK')),
  CONSTRAINT [production_output_events_source_type_ck] CHECK ([sourceType] IN (N'MANUAL', N'COUNTER')),
  CONSTRAINT [production_output_events_unit_ck] CHECK ([unit] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH')),
  CONSTRAINT [production_output_events_quantities_ck] CHECK ([quantity] >= 0 AND [goodQuantity] >= 0 AND [rejectQuantity] >= 0 AND [goodQuantity] + [rejectQuantity] <= [quantity]),
  CONSTRAINT [production_output_events_correction_ck] CHECK ([eventType] <> N'CORRECTION' OR [correctsEventId] IS NOT NULL),
  CONSTRAINT [production_output_events_production_ck] CHECK ([eventType] <> N'PRODUCTION' OR [correctsEventId] IS NULL),
  CONSTRAINT [production_output_events_reset_ck] CHECK ([eventType] <> N'RESET' OR ([resetValue] IS NOT NULL AND [quantity] = 0)),
  CONSTRAINT [production_output_events_counter_ck] CHECK ([sourceType] <> N'COUNTER' OR [rawCount] IS NOT NULL),
  CONSTRAINT [production_output_events_manual_ck] CHECK ([sourceType] <> N'MANUAL' OR [rawCount] IS NULL),
  CONSTRAINT [production_output_events_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_output_events_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_output_events_run_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_output_events_point_fkey] FOREIGN KEY ([measurementPointId]) REFERENCES [dbo].[production_measurement_points]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_output_events_corrects_fkey] FOREIGN KEY ([correctsEventId]) REFERENCES [dbo].[production_output_events]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_output_events_tenant_run_time_idx] ON [dbo].[production_output_events]([companyId], [branchId], [productionRunId], [occurredAt]);
CREATE INDEX [production_output_events_tenant_run_classification_time_idx] ON [dbo].[production_output_events]([companyId], [branchId], [productionRunId], [classification], [occurredAt]);
CREATE INDEX [production_output_events_tenant_point_time_idx] ON [dbo].[production_output_events]([companyId], [branchId], [measurementPointId], [occurredAt]);
CREATE INDEX [production_output_events_tenant_source_idx] ON [dbo].[production_output_events]([companyId], [branchId], [sourceEventId]);
CREATE INDEX [production_output_events_run_idx] ON [dbo].[production_output_events]([productionRunId]);
CREATE INDEX [production_output_events_point_idx] ON [dbo].[production_output_events]([measurementPointId]);
CREATE INDEX [production_output_events_corrects_idx] ON [dbo].[production_output_events]([correctsEventId]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;