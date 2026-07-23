BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[machines] ADD [defaultCostCenterId] NVARCHAR(1000),
[operationTypeId] NVARCHAR(1000),
[productionLineId] NVARCHAR(1000),
[technicalAdministrationId] NVARCHAR(1000),
[technicalDepartmentId] NVARCHAR(1000);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_productionLineId_idx] ON [dbo].[machines]([productionLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_operationTypeId_idx] ON [dbo].[machines]([operationTypeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_defaultCostCenterId_idx] ON [dbo].[machines]([defaultCostCenterId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_technicalAdministrationId_idx] ON [dbo].[machines]([technicalAdministrationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machines_technicalDepartmentId_idx] ON [dbo].[machines]([technicalDepartmentId]);

-- AddForeignKey
ALTER TABLE [dbo].[machines] ADD CONSTRAINT [machines_productionLineId_fkey] FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machines] ADD CONSTRAINT [machines_operationTypeId_fkey] FOREIGN KEY ([operationTypeId]) REFERENCES [dbo].[operation_types]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machines] ADD CONSTRAINT [machines_defaultCostCenterId_fkey] FOREIGN KEY ([defaultCostCenterId]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machines] ADD CONSTRAINT [machines_technicalAdministrationId_fkey] FOREIGN KEY ([technicalAdministrationId]) REFERENCES [dbo].[administrations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machines] ADD CONSTRAINT [machines_technicalDepartmentId_fkey] FOREIGN KEY ([technicalDepartmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
