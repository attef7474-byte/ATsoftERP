-- Personnel/Maintenance Phase 3: additive planning foundation only.
-- Existing-data impact: nullable line warehouse; new assignment table initially empty.
-- No backfill: legacy header warehouse and assignedToId remain untouched; User ->
-- MaintenancePersonnel mapping is not guaranteed one-to-one and must not be guessed.
-- Identifier lengths match the referenced NVARCHAR(1000) keys exactly.
-- Actual CUID lengths are preflighted; new assignment keys are constrained to
-- 100 characters so composite index values stay within SQL Server key limits.
-- Indexes cover scoped assignment history, personnel/actor FKs and warehouse lookup.
-- Tenant consistency is revalidated inside serialized assignment transactions.
-- Apply with QUOTED_IDENTIFIER ON for the filtered active uniqueness index.
-- Recovery: roll back application; retain additive structures/data. A future reviewed
-- down migration may remove new empty structures only after verifying no dependents.
-- Never drop history, reset, or modify any earlier migration.
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[maintenance_work_order_parts] ADD [warehouseId] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[maintenance_work_order_assignments] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [workOrderId] NVARCHAR(1000) NOT NULL,
    [maintenancePersonnelId] NVARCHAR(1000) NOT NULL,
    [assignedById] NVARCHAR(1000) NOT NULL,
    [cancelledById] NVARCHAR(1000),
    [assignedAt] DATETIME2 NOT NULL CONSTRAINT [maintenance_work_order_assignments_assignedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [cancelledAt] DATETIME2,
    [notes] NVARCHAR(1000),
    CONSTRAINT [maintenance_work_order_assignments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
EXEC(N'CREATE NONCLUSTERED INDEX [maintenance_work_order_assignments_companyId_branchId_workOrderId_cancelledAt_idx] ON [dbo].[maintenance_work_order_assignments]([companyId], [branchId], [workOrderId], [cancelledAt]);');

-- CreateIndex
EXEC(N'CREATE NONCLUSTERED INDEX [maintenance_work_order_assignments_maintenancePersonnelId_idx] ON [dbo].[maintenance_work_order_assignments]([maintenancePersonnelId]);');

-- CreateIndex
EXEC(N'CREATE NONCLUSTERED INDEX [maintenance_work_order_assignments_assignedById_idx] ON [dbo].[maintenance_work_order_assignments]([assignedById]);');

-- CreateIndex
EXEC(N'CREATE NONCLUSTERED INDEX [maintenance_work_order_assignments_cancelledById_idx] ON [dbo].[maintenance_work_order_assignments]([cancelledById]);');

-- CreateIndex
EXEC(N'CREATE NONCLUSTERED INDEX [maintenance_work_order_parts_warehouseId_idx] ON [dbo].[maintenance_work_order_parts]([warehouseId]);');

-- AddForeignKey
EXEC(N'ALTER TABLE [dbo].[maintenance_work_order_parts] ADD CONSTRAINT [maintenance_work_order_parts_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;');

-- AddForeignKey
EXEC(N'ALTER TABLE [dbo].[maintenance_work_order_assignments] ADD CONSTRAINT [maintenance_work_order_assignments_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;');

-- AddForeignKey
EXEC(N'ALTER TABLE [dbo].[maintenance_work_order_assignments] ADD CONSTRAINT [maintenance_work_order_assignments_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;');

-- AddForeignKey
EXEC(N'ALTER TABLE [dbo].[maintenance_work_order_assignments] ADD CONSTRAINT [maintenance_work_order_assignments_workOrderId_fkey] FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[maintenance_work_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;');

-- AddForeignKey
EXEC(N'ALTER TABLE [dbo].[maintenance_work_order_assignments] ADD CONSTRAINT [maintenance_work_order_assignments_maintenancePersonnelId_fkey] FOREIGN KEY ([maintenancePersonnelId]) REFERENCES [dbo].[maintenance_personnel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;');

-- AddForeignKey
EXEC(N'ALTER TABLE [dbo].[maintenance_work_order_assignments] ADD CONSTRAINT [maintenance_work_order_assignments_assignedById_fkey] FOREIGN KEY ([assignedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;');

-- AddForeignKey
EXEC(N'ALTER TABLE [dbo].[maintenance_work_order_assignments] ADD CONSTRAINT [maintenance_work_order_assignments_cancelledById_fkey] FOREIGN KEY ([cancelledById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;');

ALTER TABLE [dbo].[maintenance_work_order_assignments] ADD CONSTRAINT [maintenance_work_order_assignments_key_lengths] CHECK (LEN([id])<=100 AND LEN([companyId])<=100 AND LEN([branchId])<=100 AND LEN([workOrderId])<=100 AND LEN([maintenancePersonnelId])<=100 AND LEN([assignedById])<=100 AND ([cancelledById] IS NULL OR LEN([cancelledById])<=100));

EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [maintenance_work_order_assignments_active_key] ON [dbo].[maintenance_work_order_assignments] ([workOrderId], [maintenancePersonnelId]) WHERE [cancelledAt] IS NULL;');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
