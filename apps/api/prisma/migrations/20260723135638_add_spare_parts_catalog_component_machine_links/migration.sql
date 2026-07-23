BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[spare_parts] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [category] NVARCHAR(1000),
    [specification] NVARCHAR(1000),
    [unit] NVARCHAR(1000),
    [manufacturer] NVARCHAR(1000),
    [model] NVARCHAR(1000),
    [partNumber] NVARCHAR(1000),
    [barcode] NVARCHAR(1000),
    [minRecommendedStock] FLOAT(53),
    [maxRecommendedStock] FLOAT(53),
    [reorderPoint] FLOAT(53),
    [isCritical] BIT NOT NULL CONSTRAINT [spare_parts_isCritical_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [spare_parts_status_df] DEFAULT 'ACTIVE',
    [productId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [spare_parts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [spare_parts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [spare_parts_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[component_spare_parts] (
    [id] NVARCHAR(1000) NOT NULL,
    [componentId] NVARCHAR(1000) NOT NULL,
    [sparePartId] NVARCHAR(1000) NOT NULL,
    [quantity] FLOAT(53) NOT NULL,
    [unit] NVARCHAR(1000),
    [usageNote] NVARCHAR(1000),
    [isPrimary] BIT NOT NULL CONSTRAINT [component_spare_parts_isPrimary_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [component_spare_parts_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [component_spare_parts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [component_spare_parts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [component_spare_parts_componentId_sparePartId_key] UNIQUE NONCLUSTERED ([componentId],[sparePartId])
);

-- CreateTable
CREATE TABLE [dbo].[machine_spare_parts] (
    [id] NVARCHAR(1000) NOT NULL,
    [machineId] NVARCHAR(1000) NOT NULL,
    [sparePartId] NVARCHAR(1000) NOT NULL,
    [quantity] FLOAT(53) NOT NULL,
    [unit] NVARCHAR(1000),
    [usageNote] NVARCHAR(1000),
    [isPrimary] BIT NOT NULL CONSTRAINT [machine_spare_parts_isPrimary_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [machine_spare_parts_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [machine_spare_parts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [machine_spare_parts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [machine_spare_parts_machineId_sparePartId_key] UNIQUE NONCLUSTERED ([machineId],[sparePartId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [spare_parts_code_idx] ON [dbo].[spare_parts]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [spare_parts_name_idx] ON [dbo].[spare_parts]([name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [spare_parts_category_idx] ON [dbo].[spare_parts]([category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [spare_parts_partNumber_idx] ON [dbo].[spare_parts]([partNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [spare_parts_barcode_idx] ON [dbo].[spare_parts]([barcode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [spare_parts_status_idx] ON [dbo].[spare_parts]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [spare_parts_isCritical_idx] ON [dbo].[spare_parts]([isCritical]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [spare_parts_productId_idx] ON [dbo].[spare_parts]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [component_spare_parts_componentId_idx] ON [dbo].[component_spare_parts]([componentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [component_spare_parts_sparePartId_idx] ON [dbo].[component_spare_parts]([sparePartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [component_spare_parts_status_idx] ON [dbo].[component_spare_parts]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_spare_parts_machineId_idx] ON [dbo].[machine_spare_parts]([machineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_spare_parts_sparePartId_idx] ON [dbo].[machine_spare_parts]([sparePartId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_spare_parts_status_idx] ON [dbo].[machine_spare_parts]([status]);

-- AddForeignKey
ALTER TABLE [dbo].[spare_parts] ADD CONSTRAINT [spare_parts_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[component_spare_parts] ADD CONSTRAINT [component_spare_parts_componentId_fkey] FOREIGN KEY ([componentId]) REFERENCES [dbo].[machine_components]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[component_spare_parts] ADD CONSTRAINT [component_spare_parts_sparePartId_fkey] FOREIGN KEY ([sparePartId]) REFERENCES [dbo].[spare_parts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machine_spare_parts] ADD CONSTRAINT [machine_spare_parts_machineId_fkey] FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machine_spare_parts] ADD CONSTRAINT [machine_spare_parts_sparePartId_fkey] FOREIGN KEY ([sparePartId]) REFERENCES [dbo].[spare_parts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
