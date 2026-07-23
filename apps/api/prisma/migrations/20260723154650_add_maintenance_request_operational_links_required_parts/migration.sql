BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[maintenance_requests] ADD [costCenterId] NVARCHAR(1000),
[machineComponentId] NVARCHAR(1000),
[operationTypeId] NVARCHAR(1000),
[productionLineId] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[maintenance_request_required_parts] (
    [id] NVARCHAR(1000) NOT NULL,
    [maintenanceRequestId] NVARCHAR(1000) NOT NULL,
    [sparePartId] NVARCHAR(1000) NOT NULL,
    [machineComponentId] NVARCHAR(1000),
    [machineId] NVARCHAR(1000),
    [quantity] FLOAT(53) NOT NULL,
    [unit] NVARCHAR(1000),
    [usageNote] NVARCHAR(1000),
    [isPrimary] BIT NOT NULL CONSTRAINT [maintenance_request_required_parts_isPrimary_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [maintenance_request_required_parts_status_df] DEFAULT 'REQUESTED',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_request_required_parts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [maintenance_request_required_parts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [maintenance_request_required_parts_maintenanceRequestId_sparePartId_key] UNIQUE NONCLUSTERED ([maintenanceRequestId],[sparePartId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_maintenanceRequestId_idx] ON [dbo].[maintenance_request_required_parts]([maintenanceRequestId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_sparePartId_idx] ON [dbo].[maintenance_request_required_parts]([sparePartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_machineComponentId_idx] ON [dbo].[maintenance_request_required_parts]([machineComponentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_machineId_idx] ON [dbo].[maintenance_request_required_parts]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_request_required_parts_status_idx] ON [dbo].[maintenance_request_required_parts]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_productionLineId_idx] ON [dbo].[maintenance_requests]([productionLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_machineComponentId_idx] ON [dbo].[maintenance_requests]([machineComponentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_operationTypeId_idx] ON [dbo].[maintenance_requests]([operationTypeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [maintenance_requests_costCenterId_idx] ON [dbo].[maintenance_requests]([costCenterId]);

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_requests] ADD CONSTRAINT [maintenance_requests_productionLineId_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_requests] ADD CONSTRAINT [maintenance_requests_machineComponentId_fkey] FOREIGN KEY ([machineComponentId]) REFERENCES [dbo].[machine_components]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_requests] ADD CONSTRAINT [maintenance_requests_operationTypeId_fkey] FOREIGN KEY ([operationTypeId]) REFERENCES [dbo].[operation_types]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_requests] ADD CONSTRAINT [maintenance_requests_costCenterId_fkey] FOREIGN KEY ([costCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_request_required_parts] ADD CONSTRAINT [maintenance_request_required_parts_maintenanceRequestId_fkey] FOREIGN KEY ([maintenanceRequestId]) REFERENCES [dbo].[maintenance_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_request_required_parts] ADD CONSTRAINT [maintenance_request_required_parts_sparePartId_fkey] FOREIGN KEY ([sparePartId]) REFERENCES [dbo].[spare_parts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_request_required_parts] ADD CONSTRAINT [maintenance_request_required_parts_machineComponentId_fkey] FOREIGN KEY ([machineComponentId]) REFERENCES [dbo].[machine_components]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[maintenance_request_required_parts] ADD CONSTRAINT [maintenance_request_required_parts_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
