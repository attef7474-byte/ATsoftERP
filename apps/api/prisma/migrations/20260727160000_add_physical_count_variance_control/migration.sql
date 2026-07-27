BEGIN TRY
BEGIN TRAN;

-- Add inventory_physical_counts table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inventory_physical_counts]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[inventory_physical_counts] (
    [id]              NVARCHAR(1000) NOT NULL,
    [countNumber]     NVARCHAR(1000) NOT NULL,
    [companyId]       NVARCHAR(1000) NOT NULL,
    [branchId]        NVARCHAR(1000) NULL,
    [warehouseId]     NVARCHAR(1000) NOT NULL,
    [status]          NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_physical_counts_status_df] DEFAULT N'DRAFT',
    [countDate]       DATETIME2 NOT NULL CONSTRAINT [inventory_physical_counts_countDate_df] DEFAULT GETDATE(),
    [frozenAt]        DATETIME2 NULL,
    [submittedAt]     DATETIME2 NULL,
    [submittedById]   NVARCHAR(1000) NULL,
    [approvedAt]      DATETIME2 NULL,
    [approvedById]    NVARCHAR(1000) NULL,
    [rejectedAt]      DATETIME2 NULL,
    [rejectedById]    NVARCHAR(1000) NULL,
    [rejectedReason]  NVARCHAR(MAX) NULL,
    [postedAt]        DATETIME2 NULL,
    [postedById]      NVARCHAR(1000) NULL,
    [cancelledAt]     DATETIME2 NULL,
    [cancelledById]   NVARCHAR(1000) NULL,
    [notes]           NVARCHAR(MAX) NULL,
    [createdById]     NVARCHAR(1000) NULL,
    [createdAt]       DATETIME2 NOT NULL CONSTRAINT [inventory_physical_counts_createdAt_df] DEFAULT GETDATE(),
    [updatedAt]       DATETIME2 NOT NULL CONSTRAINT [inventory_physical_counts_updatedAt_df] DEFAULT GETDATE(),
    [deletedAt]       DATETIME2 NULL,
    CONSTRAINT [PK_inventory_physical_counts] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_inventory_physical_counts_countNumber] UNIQUE ([countNumber])
  );

  CREATE INDEX [IX_inventory_physical_counts_companyId] ON [dbo].[inventory_physical_counts] ([companyId]);
  CREATE INDEX [IX_inventory_physical_counts_branchId] ON [dbo].[inventory_physical_counts] ([branchId]);
  CREATE INDEX [IX_inventory_physical_counts_warehouseId] ON [dbo].[inventory_physical_counts] ([warehouseId]);
  CREATE INDEX [IX_inventory_physical_counts_status] ON [dbo].[inventory_physical_counts] ([status]);
  CREATE INDEX [IX_inventory_physical_counts_countDate] ON [dbo].[inventory_physical_counts] ([countDate]);
  CREATE INDEX [IX_inventory_physical_counts_countNumber] ON [dbo].[inventory_physical_counts] ([countNumber]);
  CREATE INDEX [IX_inventory_physical_counts_createdAt] ON [dbo].[inventory_physical_counts] ([createdAt]);
  CREATE INDEX [IX_inventory_physical_counts_warehouseId_status] ON [dbo].[inventory_physical_counts] ([warehouseId], [status]);
  CREATE INDEX [IX_inventory_physical_counts_status_createdAt] ON [dbo].[inventory_physical_counts] ([status], [createdAt]);

  ALTER TABLE [dbo].[inventory_physical_counts] ADD CONSTRAINT [FK_inventory_physical_counts_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_physical_counts] ADD CONSTRAINT [FK_inventory_physical_counts_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_physical_counts] ADD CONSTRAINT [FK_inventory_physical_counts_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END

-- Add inventory_physical_count_lines table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inventory_physical_count_lines]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[inventory_physical_count_lines] (
    [id]                  NVARCHAR(1000) NOT NULL,
    [physicalCountId]     NVARCHAR(1000) NOT NULL,
    [productId]           NVARCHAR(1000) NOT NULL,
    [warehouseLocationId] NVARCHAR(1000) NULL,
    [systemQty]           FLOAT NOT NULL CONSTRAINT [inventory_physical_count_lines_systemQty_df] DEFAULT 0,
    [countedQty]          FLOAT NULL,
    [varianceQty]         FLOAT NULL,
    [notes]               NVARCHAR(MAX) NULL,
    [createdAt]           DATETIME2 NOT NULL CONSTRAINT [inventory_physical_count_lines_createdAt_df] DEFAULT GETDATE(),
    [updatedAt]           DATETIME2 NOT NULL CONSTRAINT [inventory_physical_count_lines_updatedAt_df] DEFAULT GETDATE(),
    CONSTRAINT [PK_inventory_physical_count_lines] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_inventory_physical_count_lines_count_product_location] UNIQUE ([physicalCountId], [productId], [warehouseLocationId])
  );

  CREATE INDEX [IX_inventory_physical_count_lines_physicalCountId] ON [dbo].[inventory_physical_count_lines] ([physicalCountId]);
  CREATE INDEX [IX_inventory_physical_count_lines_productId] ON [dbo].[inventory_physical_count_lines] ([productId]);
  CREATE INDEX [IX_inventory_physical_count_lines_warehouseLocationId] ON [dbo].[inventory_physical_count_lines] ([warehouseLocationId]);
  CREATE INDEX [IX_inventory_physical_count_lines_count_product] ON [dbo].[inventory_physical_count_lines] ([physicalCountId], [productId]);

  ALTER TABLE [dbo].[inventory_physical_count_lines] ADD CONSTRAINT [FK_inventory_physical_count_lines_physicalCountId_fkey] FOREIGN KEY ([physicalCountId]) REFERENCES [dbo].[inventory_physical_counts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_physical_count_lines] ADD CONSTRAINT [FK_inventory_physical_count_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_physical_count_lines] ADD CONSTRAINT [FK_inventory_physical_count_lines_warehouseLocationId_fkey] FOREIGN KEY ([warehouseLocationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END

COMMIT TRAN;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW
END CATCH
