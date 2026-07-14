BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[inventory_counts] (
    [id] NVARCHAR(1000) NOT NULL,
    [countNumber] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000),
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_counts_status_df] DEFAULT 'DRAFT',
    [countDate] DATETIME2 NOT NULL CONSTRAINT [inventory_counts_countDate_df] DEFAULT CURRENT_TIMESTAMP,
    [startedAt] DATETIME2,
    [completedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [createdById] NVARCHAR(1000),
    [startedById] NVARCHAR(1000),
    [completedById] NVARCHAR(1000),
    [cancelledById] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_counts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [inventory_counts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_counts_countNumber_key] UNIQUE NONCLUSTERED ([countNumber])
);

-- CreateTable
CREATE TABLE [dbo].[inventory_count_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [countId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [warehouseLocationId] NVARCHAR(1000),
    [systemQty] FLOAT(53) NOT NULL CONSTRAINT [inventory_count_lines_systemQty_df] DEFAULT 0,
    [countedQty] FLOAT(53),
    [differenceQty] FLOAT(53),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_count_lines_status_df] DEFAULT 'PENDING',
    [countedAt] DATETIME2,
    [verifiedAt] DATETIME2,
    [countedById] NVARCHAR(1000),
    [verifiedById] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_count_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [inventory_count_lines_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_count_lines_countId_productId_warehouseLocationId_key] UNIQUE NONCLUSTERED ([countId],[productId],[warehouseLocationId])
);

-- CreateTable
CREATE TABLE [dbo].[inventory_movements] (
    [id] NVARCHAR(1000) NOT NULL,
    [movementNumber] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000),
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [movementType] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_movements_status_df] DEFAULT 'DRAFT',
    [sourceType] NVARCHAR(1000),
    [sourceId] NVARCHAR(1000),
    [movementDate] DATETIME2 NOT NULL CONSTRAINT [inventory_movements_movementDate_df] DEFAULT CURRENT_TIMESTAMP,
    [postedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [createdById] NVARCHAR(1000),
    [postedById] NVARCHAR(1000),
    [cancelledById] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_movements_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [inventory_movements_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_movements_movementNumber_key] UNIQUE NONCLUSTERED ([movementNumber])
);

-- CreateTable
CREATE TABLE [dbo].[inventory_movement_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [movementId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [warehouseLocationId] NVARCHAR(1000),
    [quantity] FLOAT(53) NOT NULL,
    [unit] NVARCHAR(1000),
    [direction] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_movement_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [inventory_movement_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[inventory_adjustments] (
    [id] NVARCHAR(1000) NOT NULL,
    [adjustmentNumber] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000),
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [inventoryCountId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_adjustments_status_df] DEFAULT 'DRAFT',
    [reason] NVARCHAR(1000),
    [adjustmentDate] DATETIME2 NOT NULL CONSTRAINT [inventory_adjustments_adjustmentDate_df] DEFAULT CURRENT_TIMESTAMP,
    [postedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [createdById] NVARCHAR(1000),
    [postedById] NVARCHAR(1000),
    [cancelledById] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_adjustments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [inventory_adjustments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_adjustments_adjustmentNumber_key] UNIQUE NONCLUSTERED ([adjustmentNumber])
);

-- CreateTable
CREATE TABLE [dbo].[inventory_adjustment_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [adjustmentId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [warehouseLocationId] NVARCHAR(1000),
    [systemQty] FLOAT(53) NOT NULL,
    [countedQty] FLOAT(53) NOT NULL,
    [differenceQty] FLOAT(53) NOT NULL,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_adjustment_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [inventory_adjustment_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_counts_companyId_idx] ON [dbo].[inventory_counts]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_counts_branchId_idx] ON [dbo].[inventory_counts]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_counts_warehouseId_idx] ON [dbo].[inventory_counts]([warehouseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_counts_status_idx] ON [dbo].[inventory_counts]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_counts_countDate_idx] ON [dbo].[inventory_counts]([countDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_count_lines_countId_idx] ON [dbo].[inventory_count_lines]([countId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_count_lines_productId_idx] ON [dbo].[inventory_count_lines]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_count_lines_warehouseLocationId_idx] ON [dbo].[inventory_count_lines]([warehouseLocationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_count_lines_status_idx] ON [dbo].[inventory_count_lines]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movements_companyId_idx] ON [dbo].[inventory_movements]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movements_branchId_idx] ON [dbo].[inventory_movements]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movements_warehouseId_idx] ON [dbo].[inventory_movements]([warehouseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movements_movementType_idx] ON [dbo].[inventory_movements]([movementType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movements_status_idx] ON [dbo].[inventory_movements]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movements_movementDate_idx] ON [dbo].[inventory_movements]([movementDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movement_lines_movementId_idx] ON [dbo].[inventory_movement_lines]([movementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movement_lines_productId_idx] ON [dbo].[inventory_movement_lines]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_movement_lines_warehouseLocationId_idx] ON [dbo].[inventory_movement_lines]([warehouseLocationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustments_companyId_idx] ON [dbo].[inventory_adjustments]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustments_branchId_idx] ON [dbo].[inventory_adjustments]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustments_warehouseId_idx] ON [dbo].[inventory_adjustments]([warehouseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustments_inventoryCountId_idx] ON [dbo].[inventory_adjustments]([inventoryCountId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustments_status_idx] ON [dbo].[inventory_adjustments]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustments_adjustmentDate_idx] ON [dbo].[inventory_adjustments]([adjustmentDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustment_lines_adjustmentId_idx] ON [dbo].[inventory_adjustment_lines]([adjustmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustment_lines_productId_idx] ON [dbo].[inventory_adjustment_lines]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_adjustment_lines_warehouseLocationId_idx] ON [dbo].[inventory_adjustment_lines]([warehouseLocationId]);

-- AddForeignKey
ALTER TABLE [dbo].[inventory_counts] ADD CONSTRAINT [inventory_counts_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_counts] ADD CONSTRAINT [inventory_counts_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_counts] ADD CONSTRAINT [inventory_counts_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_count_lines] ADD CONSTRAINT [inventory_count_lines_countId_fkey] FOREIGN KEY ([countId]) REFERENCES [dbo].[inventory_counts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_count_lines] ADD CONSTRAINT [inventory_count_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_count_lines] ADD CONSTRAINT [inventory_count_lines_warehouseLocationId_fkey] FOREIGN KEY ([warehouseLocationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_movements] ADD CONSTRAINT [inventory_movements_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_movements] ADD CONSTRAINT [inventory_movements_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_movements] ADD CONSTRAINT [inventory_movements_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_movement_lines] ADD CONSTRAINT [inventory_movement_lines_movementId_fkey] FOREIGN KEY ([movementId]) REFERENCES [dbo].[inventory_movements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_movement_lines] ADD CONSTRAINT [inventory_movement_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_movement_lines] ADD CONSTRAINT [inventory_movement_lines_warehouseLocationId_fkey] FOREIGN KEY ([warehouseLocationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_adjustments] ADD CONSTRAINT [inventory_adjustments_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_adjustments] ADD CONSTRAINT [inventory_adjustments_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_adjustments] ADD CONSTRAINT [inventory_adjustments_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_adjustments] ADD CONSTRAINT [inventory_adjustments_inventoryCountId_fkey] FOREIGN KEY ([inventoryCountId]) REFERENCES [dbo].[inventory_counts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_adjustment_lines] ADD CONSTRAINT [inventory_adjustment_lines_adjustmentId_fkey] FOREIGN KEY ([adjustmentId]) REFERENCES [dbo].[inventory_adjustments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_adjustment_lines] ADD CONSTRAINT [inventory_adjustment_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_adjustment_lines] ADD CONSTRAINT [inventory_adjustment_lines_warehouseLocationId_fkey] FOREIGN KEY ([warehouseLocationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
