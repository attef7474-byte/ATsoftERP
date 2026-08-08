BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[downtime_logs] ADD [branchId] NVARCHAR(1000),
[companyId] NVARCHAR(1000),
[correctionReason] NVARCHAR(1000),
[correctsLogId] NVARCHAR(1000),
[occurrenceType] NVARCHAR(1000),
[productionLineId] NVARCHAR(1000),
[productionOrderId] NVARCHAR(1000),
[productionRunId] NVARCHAR(1000),
[severity] NVARCHAR(1000),
[shiftId] NVARCHAR(1000),
[sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [downtime_logs_sourceType_df] DEFAULT 'MAINTENANCE',
[status] NVARCHAR(1000) NOT NULL CONSTRAINT [downtime_logs_status_df] DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE [dbo].[operational_loss_reasons] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [nameAr] NVARCHAR(1000) NOT NULL,
    [nameEn] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [parentId] NVARCHAR(1000),
    [lossCategory] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_loss_reasons_lossCategory_df] DEFAULT 'OTHER',
    [plannedDefault] BIT NOT NULL CONSTRAINT [operational_loss_reasons_plannedDefault_df] DEFAULT 0,
    [severityDefault] NVARCHAR(1000),
    [maintenanceRequestPolicy] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_loss_reasons_maintenanceRequestPolicy_df] DEFAULT 'OPTIONAL',
    [effectiveFrom] DATETIME2 NOT NULL CONSTRAINT [operational_loss_reasons_effectiveFrom_df] DEFAULT CURRENT_TIMESTAMP,
    [effectiveTo] DATETIME2,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [operational_loss_reasons_status_df] DEFAULT 'DRAFT',
    [createdById] NVARCHAR(1000) NOT NULL,
    [updatedById] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [operational_loss_reasons_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [operational_loss_reasons_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [operational_loss_reasons_companyId_branchId_code_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[downtime_segments] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [downtimeLogId] NVARCHAR(1000) NOT NULL,
    [productionRunId] NVARCHAR(1000),
    [productionOrderId] NVARCHAR(1000),
    [shiftId] NVARCHAR(1000),
    [productionLineId] NVARCHAR(1000),
    [machineId] NVARCHAR(1000),
    [startedAt] DATETIME2 NOT NULL,
    [endedAt] DATETIME2,
    [durationMinutes] DECIMAL(18,4) NOT NULL,
    [reasonId] NVARCHAR(1000),
    [planned] BIT NOT NULL CONSTRAINT [downtime_segments_planned_df] DEFAULT 0,
    [severity] NVARCHAR(1000) NOT NULL CONSTRAINT [downtime_segments_severity_df] DEFAULT 'MINOR',
    [ownerDomain] NVARCHAR(1000) NOT NULL CONSTRAINT [downtime_segments_ownerDomain_df] DEFAULT 'PRODUCTION',
    [maintenanceRequestId] NVARCHAR(1000),
    [maintenanceWorkOrderId] NVARCHAR(1000),
    [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [downtime_segments_sourceType_df] DEFAULT 'MANUAL',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [downtime_segments_status_df] DEFAULT 'OPEN',
    [requestId] NVARCHAR(1000),
    [correctsSegmentId] NVARCHAR(1000),
    [correctionReason] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [recordedById] NVARCHAR(1000) NOT NULL,
    [closedById] NVARCHAR(1000),
    [cancelledById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [downtime_segments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [downtime_segments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [downtime_segments_companyId_branchId_requestId_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[requestId])
);

-- CreateTable
CREATE TABLE [dbo].[production_loss_quantity_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [productionRunId] NVARCHAR(1000),
    [productionOrderId] NVARCHAR(1000),
    [outputEventId] NVARCHAR(1000),
    [type] NVARCHAR(1000) NOT NULL,
    [stage] NVARCHAR(1000),
    [productionLineId] NVARCHAR(1000),
    [machineId] NVARCHAR(1000),
    [measurementPointId] NVARCHAR(1000),
    [productId] NVARCHAR(1000),
    [productCodeSnapshot] NVARCHAR(1000),
    [productNameSnapshot] NVARCHAR(1000),
    [versionLabelSnapshot] NVARCHAR(1000),
    [packagingLabelSnapshot] NVARCHAR(1000),
    [unit] NVARCHAR(1000) NOT NULL,
    [quantity] DECIMAL(18,4) NOT NULL,
    [reason] NVARCHAR(1000),
    [reasonId] NVARCHAR(1000),
    [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [production_loss_quantity_events_sourceType_df] DEFAULT 'MANUAL',
    [requestId] NVARCHAR(1000) NOT NULL,
    [sourceEventId] NVARCHAR(1000),
    [correctsEventId] NVARCHAR(1000),
    [correctionReason] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [recordedById] NVARCHAR(1000) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_loss_quantity_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_loss_quantity_events_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_loss_quantity_events_companyId_branchId_requestId_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[requestId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [operational_loss_reasons_companyId_branchId_lossCategory_status_idx] ON [dbo].[operational_loss_reasons]([companyId], [branchId], [lossCategory], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [operational_loss_reasons_companyId_branchId_status_effectiveFrom_idx] ON [dbo].[operational_loss_reasons]([companyId], [branchId], [status], [effectiveFrom]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [operational_loss_reasons_parentId_idx] ON [dbo].[operational_loss_reasons]([parentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_companyId_branchId_downtimeLogId_idx] ON [dbo].[downtime_segments]([companyId], [branchId], [downtimeLogId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_companyId_branchId_productionRunId_startedAt_idx] ON [dbo].[downtime_segments]([companyId], [branchId], [productionRunId], [startedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_companyId_branchId_machineId_startedAt_idx] ON [dbo].[downtime_segments]([companyId], [branchId], [machineId], [startedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_companyId_branchId_reasonId_startedAt_idx] ON [dbo].[downtime_segments]([companyId], [branchId], [reasonId], [startedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_downtimeLogId_idx] ON [dbo].[downtime_segments]([downtimeLogId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_productionRunId_idx] ON [dbo].[downtime_segments]([productionRunId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_productionOrderId_idx] ON [dbo].[downtime_segments]([productionOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_shiftId_idx] ON [dbo].[downtime_segments]([shiftId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_productionLineId_idx] ON [dbo].[downtime_segments]([productionLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_machineId_idx] ON [dbo].[downtime_segments]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_reasonId_idx] ON [dbo].[downtime_segments]([reasonId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_maintenanceRequestId_idx] ON [dbo].[downtime_segments]([maintenanceRequestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_maintenanceWorkOrderId_idx] ON [dbo].[downtime_segments]([maintenanceWorkOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_segments_correctsSegmentId_idx] ON [dbo].[downtime_segments]([correctsSegmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_companyId_branchId_productionRunId_occurredAt_idx] ON [dbo].[production_loss_quantity_events]([companyId], [branchId], [productionRunId], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_companyId_branchId_productionRunId_type_occurredAt_idx] ON [dbo].[production_loss_quantity_events]([companyId], [branchId], [productionRunId], [type], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_companyId_branchId_measurementPointId_occurredAt_idx] ON [dbo].[production_loss_quantity_events]([companyId], [branchId], [measurementPointId], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_companyId_branchId_reasonId_occurredAt_idx] ON [dbo].[production_loss_quantity_events]([companyId], [branchId], [reasonId], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_productionRunId_idx] ON [dbo].[production_loss_quantity_events]([productionRunId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_productionOrderId_idx] ON [dbo].[production_loss_quantity_events]([productionOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_outputEventId_idx] ON [dbo].[production_loss_quantity_events]([outputEventId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_productionLineId_idx] ON [dbo].[production_loss_quantity_events]([productionLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_machineId_idx] ON [dbo].[production_loss_quantity_events]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_measurementPointId_idx] ON [dbo].[production_loss_quantity_events]([measurementPointId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_reasonId_idx] ON [dbo].[production_loss_quantity_events]([reasonId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_sourceEventId_idx] ON [dbo].[production_loss_quantity_events]([sourceEventId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_loss_quantity_events_correctsEventId_idx] ON [dbo].[production_loss_quantity_events]([correctsEventId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_companyId_branchId_startTime_idx] ON [dbo].[downtime_logs]([companyId], [branchId], [startTime]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_productionRunId_idx] ON [dbo].[downtime_logs]([productionRunId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_productionOrderId_idx] ON [dbo].[downtime_logs]([productionOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_productionLineId_idx] ON [dbo].[downtime_logs]([productionLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_shiftId_idx] ON [dbo].[downtime_logs]([shiftId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_status_idx] ON [dbo].[downtime_logs]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [downtime_logs_correctsLogId_idx] ON [dbo].[downtime_logs]([correctsLogId]);

-- AddForeignKey
ALTER TABLE [dbo].[downtime_logs] ADD CONSTRAINT [downtime_logs_productionRunId_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_logs] ADD CONSTRAINT [downtime_logs_productionOrderId_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_logs] ADD CONSTRAINT [downtime_logs_productionLineId_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_logs] ADD CONSTRAINT [downtime_logs_shiftId_fkey] FOREIGN KEY ([shiftId]) REFERENCES [dbo].[production_shifts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_logs] ADD CONSTRAINT [downtime_logs_correctsLogId_fkey] FOREIGN KEY ([correctsLogId]) REFERENCES [dbo].[downtime_logs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[operational_loss_reasons] ADD CONSTRAINT [operational_loss_reasons_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[operational_loss_reasons] ADD CONSTRAINT [operational_loss_reasons_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[operational_loss_reasons] ADD CONSTRAINT [operational_loss_reasons_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[operational_loss_reasons]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_downtimeLogId_fkey] FOREIGN KEY ([downtimeLogId]) REFERENCES [dbo].[downtime_logs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_productionRunId_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_productionOrderId_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_shiftId_fkey] FOREIGN KEY ([shiftId]) REFERENCES [dbo].[production_shifts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_productionLineId_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_reasonId_fkey] FOREIGN KEY ([reasonId]) REFERENCES [dbo].[operational_loss_reasons]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_maintenanceRequestId_fkey] FOREIGN KEY ([maintenanceRequestId]) REFERENCES [dbo].[maintenance_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_maintenanceWorkOrderId_fkey] FOREIGN KEY ([maintenanceWorkOrderId]) REFERENCES [dbo].[maintenance_work_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[downtime_segments] ADD CONSTRAINT [downtime_segments_correctsSegmentId_fkey] FOREIGN KEY ([correctsSegmentId]) REFERENCES [dbo].[downtime_segments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_loss_quantity_events] ADD CONSTRAINT [production_loss_quantity_events_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_loss_quantity_events] ADD CONSTRAINT [production_loss_quantity_events_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_loss_quantity_events] ADD CONSTRAINT [production_loss_quantity_events_productionRunId_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_loss_quantity_events] ADD CONSTRAINT [production_loss_quantity_events_productionOrderId_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_loss_quantity_events] ADD CONSTRAINT [production_loss_quantity_events_outputEventId_fkey] FOREIGN KEY ([outputEventId]) REFERENCES [dbo].[production_output_events]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_loss_quantity_events] ADD CONSTRAINT [production_loss_quantity_events_productionLineId_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_loss_quantity_events] ADD CONSTRAINT [production_loss_quantity_events_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_loss_quantity_events] ADD CONSTRAINT [production_loss_quantity_events_measurementPointId_fkey] FOREIGN KEY ([measurementPointId]) REFERENCES [dbo].[production_measurement_points]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_loss_quantity_events] ADD CONSTRAINT [production_loss_quantity_events_reasonId_fkey] FOREIGN KEY ([reasonId]) REFERENCES [dbo].[operational_loss_reasons]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_loss_quantity_events] ADD CONSTRAINT [production_loss_quantity_events_sourceEventId_fkey] FOREIGN KEY ([sourceEventId]) REFERENCES [dbo].[production_loss_quantity_events]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_loss_quantity_events] ADD CONSTRAINT [production_loss_quantity_events_correctsEventId_fkey] FOREIGN KEY ([correctsEventId]) REFERENCES [dbo].[production_loss_quantity_events]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
