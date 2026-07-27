BEGIN TRY
BEGIN TRAN;

-- Add inventory_operational_receipts table if not exists
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inventory_operational_receipts]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[inventory_operational_receipts] (
    [id]            NVARCHAR(1000) NOT NULL,
    [code]          NVARCHAR(1000) NOT NULL,
    [companyId]     NVARCHAR(1000) NOT NULL,
    [branchId]      NVARCHAR(1000) NULL,
    [warehouseId]   NVARCHAR(1000) NOT NULL,
    [locationId]    NVARCHAR(1000) NULL,
    [status]        NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_operational_receipts_status_df] DEFAULT N'DRAFT',
    [documentDate]  DATETIME2 NOT NULL CONSTRAINT [inventory_operational_receipts_documentDate_df] DEFAULT GETDATE(),
    [reason]        NVARCHAR(MAX) NOT NULL CONSTRAINT [inventory_operational_receipts_reason_df] DEFAULT N'',
    [notes]         NVARCHAR(MAX) NULL,
    [supplierName]  NVARCHAR(1000) NULL,
    [supplierDoc]   NVARCHAR(1000) NULL,
    [submittedAt]   DATETIME2 NULL,
    [submittedById] NVARCHAR(1000) NULL,
    [approvedAt]    DATETIME2 NULL,
    [approvedById]  NVARCHAR(1000) NULL,
    [rejectedAt]    DATETIME2 NULL,
    [rejectedById]  NVARCHAR(1000) NULL,
    [postedAt]      DATETIME2 NULL,
    [postedById]    NVARCHAR(1000) NULL,
    [cancelledAt]   DATETIME2 NULL,
    [cancelledById] NVARCHAR(1000) NULL,
    [createdById]   NVARCHAR(1000) NOT NULL,
    [createdAt]     DATETIME2 NOT NULL CONSTRAINT [inventory_operational_receipts_createdAt_df] DEFAULT GETDATE(),
    [updatedAt]     DATETIME2 NOT NULL CONSTRAINT [inventory_operational_receipts_updatedAt_df] DEFAULT GETDATE(),
    [deletedAt]     DATETIME2 NULL,
    CONSTRAINT [PK_inventory_operational_receipts] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_inventory_operational_receipts_code] UNIQUE ([code])
  );

  CREATE INDEX [IX_inventory_operational_receipts_companyId] ON [dbo].[inventory_operational_receipts] ([companyId]);
  CREATE INDEX [IX_inventory_operational_receipts_branchId] ON [dbo].[inventory_operational_receipts] ([branchId]);
  CREATE INDEX [IX_inventory_operational_receipts_warehouseId] ON [dbo].[inventory_operational_receipts] ([warehouseId]);
  CREATE INDEX [IX_inventory_operational_receipts_status] ON [dbo].[inventory_operational_receipts] ([status]);
  CREATE INDEX [IX_inventory_operational_receipts_documentDate] ON [dbo].[inventory_operational_receipts] ([documentDate]);
  CREATE INDEX [IX_inventory_operational_receipts_code] ON [dbo].[inventory_operational_receipts] ([code]);
  CREATE INDEX [IX_inventory_operational_receipts_createdAt] ON [dbo].[inventory_operational_receipts] ([createdAt]);

  ALTER TABLE [dbo].[inventory_operational_receipts] ADD CONSTRAINT [FK_inventory_operational_receipts_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_operational_receipts] ADD CONSTRAINT [FK_inventory_operational_receipts_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_operational_receipts] ADD CONSTRAINT [FK_inventory_operational_receipts_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_operational_receipts] ADD CONSTRAINT [FK_inventory_operational_receipts_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END

-- Add inventory_operational_receipt_lines table if not exists
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inventory_operational_receipt_lines]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[inventory_operational_receipt_lines] (
    [id]        NVARCHAR(1000) NOT NULL,
    [receiptId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [quantity]  FLOAT NOT NULL,
    [notes]     NVARCHAR(MAX) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_operational_receipt_lines_createdAt_df] DEFAULT GETDATE(),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [inventory_operational_receipt_lines_updatedAt_df] DEFAULT GETDATE(),
    CONSTRAINT [PK_inventory_operational_receipt_lines] PRIMARY KEY ([id])
  );

  CREATE INDEX [IX_inventory_operational_receipt_lines_receiptId] ON [dbo].[inventory_operational_receipt_lines] ([receiptId]);
  CREATE INDEX [IX_inventory_operational_receipt_lines_productId] ON [dbo].[inventory_operational_receipt_lines] ([productId]);

  ALTER TABLE [dbo].[inventory_operational_receipt_lines] ADD CONSTRAINT [FK_inventory_operational_receipt_lines_receiptId_fkey] FOREIGN KEY ([receiptId]) REFERENCES [dbo].[inventory_operational_receipts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_operational_receipt_lines] ADD CONSTRAINT [FK_inventory_operational_receipt_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
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
