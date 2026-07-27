BEGIN TRY
BEGIN TRAN;

-- CreateTable inventory_opening_balances
CREATE TABLE [dbo].[inventory_opening_balances] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000),
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [locationId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_opening_balances_status_df] DEFAULT 'DRAFT',
    [documentDate] DATETIME2 NOT NULL CONSTRAINT [inventory_opening_balances_documentDate_df] DEFAULT CURRENT_TIMESTAMP,
    [reason] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_opening_balances_reason_df] DEFAULT '',
    [notes] NVARCHAR(1000),
    [submittedAt] DATETIME2,
    [submittedById] NVARCHAR(1000),
    [approvedAt] DATETIME2,
    [approvedById] NVARCHAR(1000),
    [postedAt] DATETIME2,
    [postedById] NVARCHAR(1000),
    [rejectedAt] DATETIME2,
    [rejectedById] NVARCHAR(1000),
    [cancelledAt] DATETIME2,
    [cancelledById] NVARCHAR(1000),
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_opening_balances_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [inventory_opening_balances_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_opening_balances_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable inventory_opening_balance_lines
CREATE TABLE [dbo].[inventory_opening_balance_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [openingBalanceId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [locationId] NVARCHAR(1000),
    [quantity] FLOAT(53) NOT NULL,
    [movementId] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_opening_balance_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [inventory_opening_balance_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable inventory_stock_adjustments
CREATE TABLE [dbo].[inventory_stock_adjustments] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000),
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [locationId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_stock_adjustments_status_df] DEFAULT 'DRAFT',
    [documentDate] DATETIME2 NOT NULL CONSTRAINT [inventory_stock_adjustments_documentDate_df] DEFAULT CURRENT_TIMESTAMP,
    [reason] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_stock_adjustments_reason_df] DEFAULT '',
    [notes] NVARCHAR(1000),
    [submittedAt] DATETIME2,
    [submittedById] NVARCHAR(1000),
    [approvedAt] DATETIME2,
    [approvedById] NVARCHAR(1000),
    [postedAt] DATETIME2,
    [postedById] NVARCHAR(1000),
    [rejectedAt] DATETIME2,
    [rejectedById] NVARCHAR(1000),
    [cancelledAt] DATETIME2,
    [cancelledById] NVARCHAR(1000),
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_stock_adjustments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [inventory_stock_adjustments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_stock_adjustments_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable inventory_stock_adjustment_lines
CREATE TABLE [dbo].[inventory_stock_adjustment_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [adjustmentId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [locationId] NVARCHAR(1000),
    [adjustmentType] NVARCHAR(1000) NOT NULL,
    [quantity] FLOAT(53) NOT NULL,
    [movementId] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_stock_adjustment_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [inventory_stock_adjustment_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [inventory_opening_balances_companyId_idx] ON [dbo].[inventory_opening_balances]([companyId]);
CREATE NONCLUSTERED INDEX [inventory_opening_balances_branchId_idx] ON [dbo].[inventory_opening_balances]([branchId]);
CREATE NONCLUSTERED INDEX [inventory_opening_balances_warehouseId_idx] ON [dbo].[inventory_opening_balances]([warehouseId]);
CREATE NONCLUSTERED INDEX [inventory_opening_balances_status_idx] ON [dbo].[inventory_opening_balances]([status]);
CREATE NONCLUSTERED INDEX [inventory_opening_balances_documentDate_idx] ON [dbo].[inventory_opening_balances]([documentDate]);
CREATE NONCLUSTERED INDEX [inventory_opening_balances_code_idx] ON [dbo].[inventory_opening_balances]([code]);
CREATE NONCLUSTERED INDEX [inventory_opening_balances_createdAt_idx] ON [dbo].[inventory_opening_balances]([createdAt]);

CREATE NONCLUSTERED INDEX [inventory_opening_balance_lines_openingBalanceId_idx] ON [dbo].[inventory_opening_balance_lines]([openingBalanceId]);
CREATE NONCLUSTERED INDEX [inventory_opening_balance_lines_productId_idx] ON [dbo].[inventory_opening_balance_lines]([productId]);
CREATE NONCLUSTERED INDEX [inventory_opening_balance_lines_movementId_idx] ON [dbo].[inventory_opening_balance_lines]([movementId]);

CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_companyId_idx] ON [dbo].[inventory_stock_adjustments]([companyId]);
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_branchId_idx] ON [dbo].[inventory_stock_adjustments]([branchId]);
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_warehouseId_idx] ON [dbo].[inventory_stock_adjustments]([warehouseId]);
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_status_idx] ON [dbo].[inventory_stock_adjustments]([status]);
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_documentDate_idx] ON [dbo].[inventory_stock_adjustments]([documentDate]);
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_code_idx] ON [dbo].[inventory_stock_adjustments]([code]);
CREATE NONCLUSTERED INDEX [inventory_stock_adjustments_createdAt_idx] ON [dbo].[inventory_stock_adjustments]([createdAt]);

CREATE NONCLUSTERED INDEX [inventory_stock_adjustment_lines_adjustmentId_idx] ON [dbo].[inventory_stock_adjustment_lines]([adjustmentId]);
CREATE NONCLUSTERED INDEX [inventory_stock_adjustment_lines_productId_idx] ON [dbo].[inventory_stock_adjustment_lines]([productId]);
CREATE NONCLUSTERED INDEX [inventory_stock_adjustment_lines_movementId_idx] ON [dbo].[inventory_stock_adjustment_lines]([movementId]);
CREATE NONCLUSTERED INDEX [inventory_stock_adjustment_lines_adjustmentType_idx] ON [dbo].[inventory_stock_adjustment_lines]([adjustmentType]);

-- AddForeignKey
ALTER TABLE [dbo].[inventory_opening_balances] ADD CONSTRAINT [inventory_opening_balances_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_opening_balances] ADD CONSTRAINT [inventory_opening_balances_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_opening_balances] ADD CONSTRAINT [inventory_opening_balances_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_opening_balances] ADD CONSTRAINT [inventory_opening_balances_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[inventory_opening_balance_lines] ADD CONSTRAINT [inventory_opening_balance_lines_openingBalanceId_fkey] FOREIGN KEY ([openingBalanceId]) REFERENCES [dbo].[inventory_opening_balances]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_opening_balance_lines] ADD CONSTRAINT [inventory_opening_balance_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_opening_balance_lines] ADD CONSTRAINT [inventory_opening_balance_lines_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[inventory_stock_adjustments] ADD CONSTRAINT [inventory_stock_adjustments_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_stock_adjustments] ADD CONSTRAINT [inventory_stock_adjustments_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_stock_adjustments] ADD CONSTRAINT [inventory_stock_adjustments_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_stock_adjustments] ADD CONSTRAINT [inventory_stock_adjustments_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[inventory_stock_adjustment_lines] ADD CONSTRAINT [inventory_stock_adjustment_lines_adjustmentId_fkey] FOREIGN KEY ([adjustmentId]) REFERENCES [dbo].[inventory_stock_adjustments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_stock_adjustment_lines] ADD CONSTRAINT [inventory_stock_adjustment_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_stock_adjustment_lines] ADD CONSTRAINT [inventory_stock_adjustment_lines_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW
END CATCH
