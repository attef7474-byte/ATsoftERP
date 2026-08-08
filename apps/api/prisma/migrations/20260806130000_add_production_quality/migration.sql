SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- Phase 1.8 Production Quality (plans, characteristics, sampling points,
-- inspections, results, dispositions, nonconformances).
-- Existing-data impact: additive only; no existing table, column or row is altered.
-- Backfill/default behavior: not applicable because all nine tables are new.
-- Recovery: the transaction rolls back every object when any statement fails.
-- Runtime compatibility: Phases 1.1-1.7 remain unchanged; Phase 1.8 application
-- code must be deployed only after this migration is independently reviewed/applied.
-- Check constraints below enforce: characteristic limit order (lower <= upper),
-- typed result one-value rule, positive disposition quantity, NCR lifecycle order,
-- and attachment tenant anchoring. Filtered unique indexes enforce one OPEN/COMPLETED/
-- HELD disposition chain per inspection and one current result per characteristic.

CREATE TABLE [dbo].[production_quality_plans] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [code] NVARCHAR(1000) NOT NULL,
  [revision] INT NOT NULL CONSTRAINT [production_quality_plans_revision_df] DEFAULT 1,
  [productionProductDefinitionId] NVARCHAR(1000) NOT NULL,
  [productionVersionId] NVARCHAR(1000) NULL,
  [productionPackagingId] NVARCHAR(1000) NULL,
  [productionLineId] NVARCHAR(1000) NULL,
  [machineId] NVARCHAR(1000) NULL,
  [costCenterId] NVARCHAR(1000) NULL,
  [effectiveFrom] DATETIME2 NOT NULL,
  [effectiveTo] DATETIME2 NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_quality_plans_status_df] DEFAULT N'DRAFT',
  [approvedById] NVARCHAR(1000) NULL,
  [approvedAt] DATETIME2 NULL,
  [rejectedById] NVARCHAR(1000) NULL,
  [rejectedAt] DATETIME2 NULL,
  [rejectionReason] NVARCHAR(1000) NULL,
  [deactivatedById] NVARCHAR(1000) NULL,
  [deactivatedAt] DATETIME2 NULL,
  [deactivationReason] NVARCHAR(1000) NULL,
  [notes] NVARCHAR(1000) NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [updatedById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_quality_plans_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [production_quality_plans_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_quality_plans_tenant_code_revision_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [code], [revision]),
  CONSTRAINT [production_quality_plans_status_ck] CHECK ([status] IN (N'DRAFT', N'PENDING', N'APPROVED', N'INACTIVE', N'SUPERSEDED')),
  CONSTRAINT [production_quality_plans_revision_ck] CHECK ([revision] >= 1),
  CONSTRAINT [production_quality_plans_dates_ck] CHECK ([effectiveTo] IS NULL OR [effectiveTo] >= [effectiveFrom]),
  CONSTRAINT [production_quality_plans_approved_ck] CHECK ([approvedAt] IS NULL OR ([approvedById] IS NOT NULL AND [status] IN (N'APPROVED', N'INACTIVE', N'SUPERSEDED'))),
  CONSTRAINT [production_quality_plans_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_plans_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_plans_product_fkey] FOREIGN KEY ([productionProductDefinitionId]) REFERENCES [dbo].[production_product_definitions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_plans_version_fkey] FOREIGN KEY ([productionVersionId]) REFERENCES [dbo].[production_versions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_plans_packaging_fkey] FOREIGN KEY ([productionPackagingId]) REFERENCES [dbo].[production_packagings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_plans_line_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_plans_machine_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_plans_cost_center_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- One APPROVED plan per (tenant, product, version, packaging, line, machine) at any point in time.
CREATE UNIQUE NONCLUSTERED INDEX [production_quality_plans_one_approved_idx] ON [dbo].[production_quality_plans]([companyId], [branchId], [productionProductDefinitionId], [productionVersionId], [productionPackagingId], [productionLineId], [machineId]) WHERE [status] = N'APPROVED' AND [deletedAt] IS NULL;
CREATE INDEX [production_quality_plans_tenant_product_status_idx] ON [dbo].[production_quality_plans]([companyId], [branchId], [productionProductDefinitionId], [productionVersionId], [productionPackagingId], [status]);
CREATE INDEX [production_quality_plans_tenant_status_dates_idx] ON [dbo].[production_quality_plans]([companyId], [branchId], [status], [effectiveFrom], [effectiveTo]);
CREATE INDEX [production_quality_plans_tenant_line_machine_idx] ON [dbo].[production_quality_plans]([companyId], [branchId], [productionLineId], [machineId]);
CREATE INDEX [production_quality_plans_product_idx] ON [dbo].[production_quality_plans]([productionProductDefinitionId]);
CREATE INDEX [production_quality_plans_version_idx] ON [dbo].[production_quality_plans]([productionVersionId]);
CREATE INDEX [production_quality_plans_packaging_idx] ON [dbo].[production_quality_plans]([productionPackagingId]);
CREATE INDEX [production_quality_plans_line_idx] ON [dbo].[production_quality_plans]([productionLineId]);
CREATE INDEX [production_quality_plans_machine_idx] ON [dbo].[production_quality_plans]([machineId]);
CREATE INDEX [production_quality_plans_cost_center_idx] ON [dbo].[production_quality_plans]([costCenterId]);

CREATE TABLE [dbo].[quality_characteristics] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [planId] NVARCHAR(1000) NOT NULL,
  [sequence] INT NOT NULL,
  [nameAr] NVARCHAR(1000) NOT NULL,
  [nameEn] NVARCHAR(1000) NOT NULL,
  [characteristicType] NVARCHAR(1000) NOT NULL CONSTRAINT [quality_characteristics_type_df] DEFAULT N'NUMERIC',
  [unit] NVARCHAR(1000) NULL,
  [productionUnitId] NVARCHAR(1000) NULL,
  [lowerLimit] DECIMAL(18,4) NULL,
  [targetValue] DECIMAL(18,4) NULL,
  [upperLimit] DECIMAL(18,4) NULL,
  [criticality] NVARCHAR(1000) NOT NULL CONSTRAINT [quality_characteristics_criticality_df] DEFAULT N'MAJOR',
  [samplingRule] NVARCHAR(1000) NULL,
  [isRequired] BIT NOT NULL CONSTRAINT [quality_characteristics_required_df] DEFAULT 0,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [quality_characteristics_status_df] DEFAULT N'ACTIVE',
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [quality_characteristics_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [quality_characteristics_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [quality_characteristics_plan_sequence_key] UNIQUE NONCLUSTERED ([planId], [sequence]),
  CONSTRAINT [quality_characteristics_type_ck] CHECK ([characteristicType] IN (N'NUMERIC', N'BOOLEAN', N'TEXT', N'CHOICE')),
  CONSTRAINT [quality_characteristics_criticality_ck] CHECK ([criticality] IN (N'CRITICAL', N'MAJOR', N'MINOR')),
  CONSTRAINT [quality_characteristics_status_ck] CHECK ([status] IN (N'ACTIVE', N'INACTIVE')),
  CONSTRAINT [quality_characteristics_sequence_ck] CHECK ([sequence] >= 1),
  CONSTRAINT [quality_characteristics_limit_order_ck] CHECK ([lowerLimit] IS NULL OR [upperLimit] IS NULL OR [lowerLimit] <= [upperLimit]),
  CONSTRAINT [quality_characteristics_target_in_limits_ck] CHECK ([targetValue] IS NULL OR ([lowerLimit] IS NULL OR [targetValue] >= [lowerLimit]) AND ([upperLimit] IS NULL OR [targetValue] <= [upperLimit])),
  CONSTRAINT [quality_characteristics_numeric_limits_ck] CHECK ([characteristicType] <> N'NUMERIC' OR [lowerLimit] IS NOT NULL OR [targetValue] IS NOT NULL OR [upperLimit] IS NOT NULL),
  CONSTRAINT [quality_characteristics_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [quality_characteristics_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [quality_characteristics_plan_fkey] FOREIGN KEY ([planId]) REFERENCES [dbo].[production_quality_plans]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [quality_characteristics_unit_fkey] FOREIGN KEY ([productionUnitId]) REFERENCES [dbo].[production_units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [quality_characteristics_tenant_plan_status_idx] ON [dbo].[quality_characteristics]([companyId], [branchId], [planId], [status]);
CREATE INDEX [quality_characteristics_unit_idx] ON [dbo].[quality_characteristics]([productionUnitId]);

CREATE TABLE [dbo].[quality_sampling_points] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [planId] NVARCHAR(1000) NOT NULL,
  [stage] NVARCHAR(1000) NOT NULL CONSTRAINT [quality_sampling_points_stage_df] DEFAULT N'FINAL_OUTPUT',
  [measurementPointId] NVARCHAR(1000) NULL,
  [productionLineId] NVARCHAR(1000) NULL,
  [machineId] NVARCHAR(1000) NULL,
  [appliesToMaterial] BIT NOT NULL CONSTRAINT [quality_sampling_points_material_df] DEFAULT 0,
  [appliesToFinishedGoods] BIT NOT NULL CONSTRAINT [quality_sampling_points_fg_df] DEFAULT 1,
  [sampleFrequency] NVARCHAR(1000) NULL,
  [sampleSize] DECIMAL(18,4) NULL,
  [sortOrder] INT NOT NULL CONSTRAINT [quality_sampling_points_sort_df] DEFAULT 0,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [quality_sampling_points_status_df] DEFAULT N'ACTIVE',
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [quality_sampling_points_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [quality_sampling_points_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [quality_sampling_points_plan_stage_sort_key] UNIQUE NONCLUSTERED ([planId], [stage], [sortOrder]),
  CONSTRAINT [quality_sampling_points_stage_ck] CHECK ([stage] IN (N'INCOMING', N'IN_PROCESS', N'FINAL_OUTPUT')),
  CONSTRAINT [quality_sampling_points_status_ck] CHECK ([status] IN (N'ACTIVE', N'INACTIVE')),
  CONSTRAINT [quality_sampling_points_sample_size_ck] CHECK ([sampleSize] IS NULL OR [sampleSize] > 0),
  CONSTRAINT [quality_sampling_points_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [quality_sampling_points_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [quality_sampling_points_plan_fkey] FOREIGN KEY ([planId]) REFERENCES [dbo].[production_quality_plans]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [quality_sampling_points_point_fkey] FOREIGN KEY ([measurementPointId]) REFERENCES [dbo].[production_measurement_points]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [quality_sampling_points_line_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [quality_sampling_points_machine_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [quality_sampling_points_tenant_plan_status_idx] ON [dbo].[quality_sampling_points]([companyId], [branchId], [planId], [status]);
CREATE INDEX [quality_sampling_points_point_idx] ON [dbo].[quality_sampling_points]([measurementPointId]);
CREATE INDEX [quality_sampling_points_line_idx] ON [dbo].[quality_sampling_points]([productionLineId]);
CREATE INDEX [quality_sampling_points_machine_idx] ON [dbo].[quality_sampling_points]([machineId]);

CREATE TABLE [dbo].[production_inspections] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [inspectionNumber] NVARCHAR(1000) NOT NULL,
  [clientRequestId] NVARCHAR(1000) NOT NULL,
  [planId] NVARCHAR(1000) NOT NULL,
  [planCodeSnapshot] NVARCHAR(1000) NOT NULL,
  [planRevisionSnapshot] INT NOT NULL,
  [productionOrderId] NVARCHAR(1000) NULL,
  [productionRunId] NVARCHAR(1000) NULL,
  [outputEventId] NVARCHAR(1000) NULL,
  [finishedGoodsReceiptId] NVARCHAR(1000) NULL,
  [finishedGoodsReceiptLineId] NVARCHAR(1000) NULL,
  [samplingPointId] NVARCHAR(1000) NULL,
  [productId] NVARCHAR(1000) NULL,
  [productCodeSnapshot] NVARCHAR(1000) NULL,
  [productNameSnapshot] NVARCHAR(1000) NULL,
  [productionLineId] NVARCHAR(1000) NULL,
  [machineId] NVARCHAR(1000) NULL,
  [shiftId] NVARCHAR(1000) NULL,
  [costCenterId] NVARCHAR(1000) NULL,
  [sampledQuantity] DECIMAL(18,4) NOT NULL,
  [unit] NVARCHAR(1000) NOT NULL,
  [inspectedAt] DATETIME2 NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_inspections_status_df] DEFAULT N'OPEN',
  [inspectedById] NVARCHAR(1000) NULL,
  [inspectedAtConfirmed] DATETIME2 NULL,
  [notes] NVARCHAR(1000) NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_inspections_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [production_inspections_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_inspections_tenant_number_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [inspectionNumber]),
  CONSTRAINT [production_inspections_tenant_request_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [clientRequestId]),
  CONSTRAINT [production_inspections_status_ck] CHECK ([status] IN (N'OPEN', N'COMPLETED', N'HELD', N'DISPOSITIONED')),
  CONSTRAINT [production_inspections_unit_ck] CHECK ([unit] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH')),
  CONSTRAINT [production_inspections_sampled_quantity_ck] CHECK ([sampledQuantity] > 0),
  CONSTRAINT [production_inspections_plan_revision_ck] CHECK ([planRevisionSnapshot] >= 1),
  CONSTRAINT [production_inspections_inspected_ck] CHECK ([inspectedAtConfirmed] IS NULL OR [inspectedById] IS NOT NULL),
  CONSTRAINT [production_inspections_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_plan_fkey] FOREIGN KEY ([planId]) REFERENCES [dbo].[production_quality_plans]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_order_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_run_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_output_event_fkey] FOREIGN KEY ([outputEventId]) REFERENCES [dbo].[production_output_events]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_receipt_fkey] FOREIGN KEY ([finishedGoodsReceiptId]) REFERENCES [dbo].[production_finished_goods_receipts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_receipt_line_fkey] FOREIGN KEY ([finishedGoodsReceiptLineId]) REFERENCES [dbo].[production_finished_goods_receipt_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_sampling_point_fkey] FOREIGN KEY ([samplingPointId]) REFERENCES [dbo].[quality_sampling_points]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_product_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_line_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_machine_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_shift_fkey] FOREIGN KEY ([shiftId]) REFERENCES [dbo].[production_shifts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspections_cost_center_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_inspections_tenant_status_time_idx] ON [dbo].[production_inspections]([companyId], [branchId], [status], [inspectedAt]);
CREATE INDEX [production_inspections_tenant_order_run_idx] ON [dbo].[production_inspections]([companyId], [branchId], [productionOrderId], [productionRunId]);
CREATE INDEX [production_inspections_tenant_plan_status_idx] ON [dbo].[production_inspections]([companyId], [branchId], [planId], [status]);
CREATE INDEX [production_inspections_tenant_product_time_idx] ON [dbo].[production_inspections]([companyId], [branchId], [productId], [inspectedAt]);
CREATE INDEX [production_inspections_order_idx] ON [dbo].[production_inspections]([productionOrderId]);
CREATE INDEX [production_inspections_run_idx] ON [dbo].[production_inspections]([productionRunId]);
CREATE INDEX [production_inspections_output_event_idx] ON [dbo].[production_inspections]([outputEventId]);
CREATE INDEX [production_inspections_receipt_idx] ON [dbo].[production_inspections]([finishedGoodsReceiptId]);
CREATE INDEX [production_inspections_receipt_line_idx] ON [dbo].[production_inspections]([finishedGoodsReceiptLineId]);
CREATE INDEX [production_inspections_sampling_point_idx] ON [dbo].[production_inspections]([samplingPointId]);
CREATE INDEX [production_inspections_line_idx] ON [dbo].[production_inspections]([productionLineId]);
CREATE INDEX [production_inspections_machine_idx] ON [dbo].[production_inspections]([machineId]);
CREATE INDEX [production_inspections_shift_idx] ON [dbo].[production_inspections]([shiftId]);
CREATE INDEX [production_inspections_cost_center_idx] ON [dbo].[production_inspections]([costCenterId]);

CREATE TABLE [dbo].[production_inspection_results] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [inspectionId] NVARCHAR(1000) NOT NULL,
  [characteristicId] NVARCHAR(1000) NOT NULL,
  [characteristicSequenceSnapshot] INT NOT NULL,
  [characteristicNameArSnapshot] NVARCHAR(1000) NOT NULL,
  [characteristicNameEnSnapshot] NVARCHAR(1000) NOT NULL,
  [characteristicTypeSnapshot] NVARCHAR(1000) NOT NULL,
  [unitSnapshot] NVARCHAR(1000) NULL,
  [lowerLimitSnapshot] DECIMAL(18,4) NULL,
  [targetSnapshot] DECIMAL(18,4) NULL,
  [upperLimitSnapshot] DECIMAL(18,4) NULL,
  [valueNumeric] DECIMAL(18,4) NULL,
  [valueBoolean] BIT NULL,
  [valueText] NVARCHAR(1000) NULL,
  [valueChoice] NVARCHAR(1000) NULL,
  [pass] BIT NOT NULL,
  [method] NVARCHAR(1000) NULL,
  [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [production_inspection_results_source_df] DEFAULT N'MANUAL',
  [correctsResultId] NVARCHAR(1000) NULL,
  [correctionReason] NVARCHAR(1000) NULL,
  [recordedById] NVARCHAR(1000) NOT NULL,
  [recordedAt] DATETIME2 NOT NULL CONSTRAINT [production_inspection_results_recorded_at_df] DEFAULT CURRENT_TIMESTAMP,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_inspection_results_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [production_inspection_results_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_inspection_results_type_ck] CHECK ([characteristicTypeSnapshot] IN (N'NUMERIC', N'BOOLEAN', N'TEXT', N'CHOICE')),
  CONSTRAINT [production_inspection_results_source_ck] CHECK ([sourceType] IN (N'MANUAL', N'DEVICE', N'DERIVED')),
  CONSTRAINT [production_inspection_results_numeric_value_ck] CHECK ([characteristicTypeSnapshot] <> N'NUMERIC' OR [valueNumeric] IS NOT NULL),
  CONSTRAINT [production_inspection_results_numeric_only_ck] CHECK ([characteristicTypeSnapshot] = N'NUMERIC' OR [valueNumeric] IS NULL),
  CONSTRAINT [production_inspection_results_boolean_value_ck] CHECK ([characteristicTypeSnapshot] <> N'BOOLEAN' OR [valueBoolean] IS NOT NULL),
  CONSTRAINT [production_inspection_results_boolean_only_ck] CHECK ([characteristicTypeSnapshot] = N'BOOLEAN' OR [valueBoolean] IS NULL),
  CONSTRAINT [production_inspection_results_text_value_ck] CHECK ([characteristicTypeSnapshot] <> N'TEXT' OR [valueText] IS NOT NULL),
  CONSTRAINT [production_inspection_results_text_only_ck] CHECK ([characteristicTypeSnapshot] = N'TEXT' OR [valueText] IS NULL),
  CONSTRAINT [production_inspection_results_choice_value_ck] CHECK ([characteristicTypeSnapshot] <> N'CHOICE' OR [valueChoice] IS NOT NULL),
  CONSTRAINT [production_inspection_results_choice_only_ck] CHECK ([characteristicTypeSnapshot] = N'CHOICE' OR [valueChoice] IS NULL),
  CONSTRAINT [production_inspection_results_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspection_results_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspection_results_inspection_fkey] FOREIGN KEY ([inspectionId]) REFERENCES [dbo].[production_inspections]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspection_results_characteristic_fkey] FOREIGN KEY ([characteristicId]) REFERENCES [dbo].[quality_characteristics]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_inspection_results_corrects_fkey] FOREIGN KEY ([correctsResultId]) REFERENCES [dbo].[production_inspection_results]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- One current (non-corrected) result per inspection characteristic; corrections append new rows.
CREATE UNIQUE NONCLUSTERED INDEX [production_inspection_results_one_current_idx] ON [dbo].[production_inspection_results]([inspectionId], [characteristicId]) WHERE [correctsResultId] IS NULL;
CREATE INDEX [production_inspection_results_inspection_idx] ON [dbo].[production_inspection_results]([inspectionId]);
CREATE INDEX [production_inspection_results_characteristic_idx] ON [dbo].[production_inspection_results]([characteristicId]);
CREATE INDEX [production_inspection_results_tenant_recorded_idx] ON [dbo].[production_inspection_results]([companyId], [branchId], [recordedAt]);
CREATE INDEX [production_inspection_results_corrects_idx] ON [dbo].[production_inspection_results]([correctsResultId]);

CREATE TABLE [dbo].[production_quality_dispositions] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [inspectionId] NVARCHAR(1000) NOT NULL,
  [action] NVARCHAR(1000) NOT NULL,
  [quantity] DECIMAL(18,4) NOT NULL,
  [unit] NVARCHAR(1000) NOT NULL,
  [reason] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_quality_dispositions_status_df] DEFAULT N'PENDING',
  [requestedById] NVARCHAR(1000) NOT NULL,
  [approvedById] NVARCHAR(1000) NULL,
  [approvedAt] DATETIME2 NULL,
  [rejectionReason] NVARCHAR(1000) NULL,
  [outputEventId] NVARCHAR(1000) NULL,
  [finishedGoodsReceiptId] NVARCHAR(1000) NULL,
  [materialDocumentId] NVARCHAR(1000) NULL,
  [inventoryLockId] NVARCHAR(1000) NULL,
  [notes] NVARCHAR(1000) NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_quality_dispositions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [production_quality_dispositions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_quality_dispositions_action_ck] CHECK ([action] IN (N'RELEASE', N'REJECT', N'REWORK', N'SCRAP')),
  CONSTRAINT [production_quality_dispositions_status_ck] CHECK ([status] IN (N'PENDING', N'APPROVED', N'REJECTED')),
  CONSTRAINT [production_quality_dispositions_quantity_ck] CHECK ([quantity] > 0),
  CONSTRAINT [production_quality_dispositions_unit_ck] CHECK ([unit] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH')),
  CONSTRAINT [production_quality_dispositions_approved_ck] CHECK ([approvedAt] IS NULL OR ([approvedById] IS NOT NULL AND [status] = N'APPROVED')),
  CONSTRAINT [production_quality_dispositions_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_dispositions_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_dispositions_inspection_fkey] FOREIGN KEY ([inspectionId]) REFERENCES [dbo].[production_inspections]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_dispositions_output_event_fkey] FOREIGN KEY ([outputEventId]) REFERENCES [dbo].[production_output_events]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_dispositions_receipt_fkey] FOREIGN KEY ([finishedGoodsReceiptId]) REFERENCES [dbo].[production_finished_goods_receipts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_dispositions_material_document_fkey] FOREIGN KEY ([materialDocumentId]) REFERENCES [dbo].[production_material_documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_quality_dispositions_lock_fkey] FOREIGN KEY ([inventoryLockId]) REFERENCES [dbo].[inventory_locks]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_quality_dispositions_tenant_inspection_idx] ON [dbo].[production_quality_dispositions]([companyId], [branchId], [inspectionId]);
CREATE INDEX [production_quality_dispositions_tenant_status_time_idx] ON [dbo].[production_quality_dispositions]([companyId], [branchId], [status], [createdAt]);
CREATE INDEX [production_quality_dispositions_inspection_idx] ON [dbo].[production_quality_dispositions]([inspectionId]);
CREATE INDEX [production_quality_dispositions_output_event_idx] ON [dbo].[production_quality_dispositions]([outputEventId]);
CREATE INDEX [production_quality_dispositions_receipt_idx] ON [dbo].[production_quality_dispositions]([finishedGoodsReceiptId]);
CREATE INDEX [production_quality_dispositions_material_document_idx] ON [dbo].[production_quality_dispositions]([materialDocumentId]);
CREATE INDEX [production_quality_dispositions_lock_idx] ON [dbo].[production_quality_dispositions]([inventoryLockId]);

CREATE TABLE [dbo].[production_nonconformances] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [ncrNumber] NVARCHAR(1000) NOT NULL,
  [clientRequestId] NVARCHAR(1000) NOT NULL,
  [inspectionId] NVARCHAR(1000) NULL,
  [dispositionId] NVARCHAR(1000) NULL,
  [severity] NVARCHAR(1000) NOT NULL CONSTRAINT [production_nonconformances_severity_df] DEFAULT N'MAJOR',
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_nonconformances_status_df] DEFAULT N'OPEN',
  [description] NVARCHAR(1000) NOT NULL,
  [rootCause] NVARCHAR(1000) NULL,
  [correctiveAction] NVARCHAR(1000) NULL,
  [ownerUserId] NVARCHAR(1000) NULL,
  [detectionDate] DATETIME2 NOT NULL CONSTRAINT [production_nonconformances_detection_df] DEFAULT CURRENT_TIMESTAMP,
  [targetDate] DATETIME2 NULL,
  [verifiedAt] DATETIME2 NULL,
  [verifiedById] NVARCHAR(1000) NULL,
  [closedAt] DATETIME2 NULL,
  [closedById] NVARCHAR(1000) NULL,
  [createdById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_nonconformances_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  [deletedAt] DATETIME2 NULL,
  CONSTRAINT [production_nonconformances_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_nonconformances_tenant_number_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [ncrNumber]),
  CONSTRAINT [production_nonconformances_tenant_request_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [clientRequestId]),
  CONSTRAINT [production_nonconformances_severity_ck] CHECK ([severity] IN (N'MINOR', N'MAJOR', N'CRITICAL')),
  CONSTRAINT [production_nonconformances_status_ck] CHECK ([status] IN (N'OPEN', N'INVESTIGATING', N'ACTION_REQUIRED', N'VERIFIED', N'CLOSED')),
  CONSTRAINT [production_nonconformances_verified_ck] CHECK ([verifiedAt] IS NULL OR [verifiedById] IS NOT NULL),
  CONSTRAINT [production_nonconformances_closed_ck] CHECK ([closedAt] IS NULL OR [closedById] IS NOT NULL),
  CONSTRAINT [production_nonconformances_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_nonconformances_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_nonconformances_inspection_fkey] FOREIGN KEY ([inspectionId]) REFERENCES [dbo].[production_inspections]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_nonconformances_disposition_fkey] FOREIGN KEY ([dispositionId]) REFERENCES [dbo].[production_quality_dispositions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_nonconformances_tenant_status_time_idx] ON [dbo].[production_nonconformances]([companyId], [branchId], [status], [detectionDate]);
CREATE INDEX [production_nonconformances_tenant_severity_status_idx] ON [dbo].[production_nonconformances]([companyId], [branchId], [severity], [status]);
CREATE INDEX [production_nonconformances_inspection_idx] ON [dbo].[production_nonconformances]([inspectionId]);
CREATE INDEX [production_nonconformances_disposition_idx] ON [dbo].[production_nonconformances]([dispositionId]);

CREATE TABLE [dbo].[production_nonconformance_transitions] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [nonconformanceId] NVARCHAR(1000) NOT NULL,
  [fromStatus] NVARCHAR(1000) NOT NULL,
  [toStatus] NVARCHAR(1000) NOT NULL,
  [action] NVARCHAR(1000) NOT NULL,
  [actorId] NVARCHAR(1000) NOT NULL,
  [reason] NVARCHAR(1000) NULL,
  [requestId] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_nonconformance_transitions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [production_nonconformance_transitions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_nonconformance_transitions_ncr_request_key] UNIQUE NONCLUSTERED ([nonconformanceId], [requestId]),
  CONSTRAINT [production_nonconformance_transitions_from_ck] CHECK ([fromStatus] IN (N'OPEN', N'INVESTIGATING', N'ACTION_REQUIRED', N'VERIFIED', N'CLOSED')),
  CONSTRAINT [production_nonconformance_transitions_to_ck] CHECK ([toStatus] IN (N'OPEN', N'INVESTIGATING', N'ACTION_REQUIRED', N'VERIFIED', N'CLOSED')),
  CONSTRAINT [production_nonconformance_transitions_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_nonconformance_transitions_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_nonconformance_transitions_ncr_fkey] FOREIGN KEY ([nonconformanceId]) REFERENCES [dbo].[production_nonconformances]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_nonconformance_transitions_tenant_ncr_time_idx] ON [dbo].[production_nonconformance_transitions]([companyId], [branchId], [nonconformanceId], [createdAt]);
CREATE INDEX [production_nonconformance_transitions_tenant_action_time_idx] ON [dbo].[production_nonconformance_transitions]([companyId], [branchId], [action], [createdAt]);

CREATE TABLE [dbo].[production_nonconformance_attachments] (
  [id] NVARCHAR(1000) NOT NULL,
  [companyId] NVARCHAR(1000) NOT NULL,
  [branchId] NVARCHAR(1000) NOT NULL,
  [nonconformanceId] NVARCHAR(1000) NOT NULL,
  [attachmentId] NVARCHAR(1000) NOT NULL,
  [uploadedById] NVARCHAR(1000) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_nonconformance_attachments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [production_nonconformance_attachments_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [production_nonconformance_attachments_ncr_attachment_key] UNIQUE NONCLUSTERED ([nonconformanceId], [attachmentId]),
  CONSTRAINT [production_nonconformance_attachments_company_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_nonconformance_attachments_branch_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_nonconformance_attachments_ncr_fkey] FOREIGN KEY ([nonconformanceId]) REFERENCES [dbo].[production_nonconformances]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [production_nonconformance_attachments_attachment_fkey] FOREIGN KEY ([attachmentId]) REFERENCES [dbo].[attachments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [production_nonconformance_attachments_tenant_ncr_time_idx] ON [dbo].[production_nonconformance_attachments]([companyId], [branchId], [nonconformanceId], [createdAt]);
CREATE INDEX [production_nonconformance_attachments_attachment_idx] ON [dbo].[production_nonconformance_attachments]([attachmentId]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
