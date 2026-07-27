BEGIN TRY
BEGIN TRAN;

-- Add inventory_stock_transfers table if not exists
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inventory_stock_transfers]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[inventory_stock_transfers] (
    [id]                      NVARCHAR(1000) NOT NULL,
    [code]                    NVARCHAR(1000) NOT NULL,
    [companyId]               NVARCHAR(1000) NOT NULL,
    [branchId]                NVARCHAR(1000) NULL,
    [status]                  NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_stock_transfers_status_df] DEFAULT N'DRAFT',
    [documentDate]            DATETIME2 NOT NULL CONSTRAINT [inventory_stock_transfers_documentDate_df] DEFAULT GETDATE(),
    [sourceWarehouseId]       NVARCHAR(1000) NOT NULL,
    [sourceLocationId]        NVARCHAR(1000) NULL,
    [destinationWarehouseId]  NVARCHAR(1000) NOT NULL,
    [destinationLocationId]   NVARCHAR(1000) NULL,
    [reason]                  NVARCHAR(MAX) NOT NULL CONSTRAINT [inventory_stock_transfers_reason_df] DEFAULT N'',
    [notes]                   NVARCHAR(MAX) NULL,
    [submittedAt]             DATETIME2 NULL,
    [submittedById]           NVARCHAR(1000) NULL,
    [approvedAt]              DATETIME2 NULL,
    [approvedById]            NVARCHAR(1000) NULL,
    [postedAt]                DATETIME2 NULL,
    [postedById]              NVARCHAR(1000) NULL,
    [rejectedAt]              DATETIME2 NULL,
    [rejectedById]            NVARCHAR(1000) NULL,
    [cancelledAt]             DATETIME2 NULL,
    [cancelledById]           NVARCHAR(1000) NULL,
    [createdById]             NVARCHAR(1000) NULL,
    [updatedById]             NVARCHAR(1000) NULL,
    [createdAt]               DATETIME2 NOT NULL CONSTRAINT [inventory_stock_transfers_createdAt_df] DEFAULT GETDATE(),
    [updatedAt]               DATETIME2 NOT NULL CONSTRAINT [inventory_stock_transfers_updatedAt_df] DEFAULT GETDATE(),
    [deletedAt]               DATETIME2 NULL,
    CONSTRAINT [PK_inventory_stock_transfers] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_inventory_stock_transfers_code] UNIQUE ([code])
  );

  CREATE INDEX [IX_inventory_stock_transfers_companyId] ON [dbo].[inventory_stock_transfers] ([companyId]);
  CREATE INDEX [IX_inventory_stock_transfers_branchId] ON [dbo].[inventory_stock_transfers] ([branchId]);
  CREATE INDEX [IX_inventory_stock_transfers_sourceWarehouseId] ON [dbo].[inventory_stock_transfers] ([sourceWarehouseId]);
  CREATE INDEX [IX_inventory_stock_transfers_destinationWarehouseId] ON [dbo].[inventory_stock_transfers] ([destinationWarehouseId]);
  CREATE INDEX [IX_inventory_stock_transfers_status] ON [dbo].[inventory_stock_transfers] ([status]);
  CREATE INDEX [IX_inventory_stock_transfers_documentDate] ON [dbo].[inventory_stock_transfers] ([documentDate]);
  CREATE INDEX [IX_inventory_stock_transfers_code] ON [dbo].[inventory_stock_transfers] ([code]);
  CREATE INDEX [IX_inventory_stock_transfers_createdAt] ON [dbo].[inventory_stock_transfers] ([createdAt]);

  ALTER TABLE [dbo].[inventory_stock_transfers] ADD CONSTRAINT [FK_inventory_stock_transfers_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_stock_transfers] ADD CONSTRAINT [FK_inventory_stock_transfers_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_stock_transfers] ADD CONSTRAINT [FK_inventory_stock_transfers_sourceWarehouseId_fkey] FOREIGN KEY ([sourceWarehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_stock_transfers] ADD CONSTRAINT [FK_inventory_stock_transfers_destinationWarehouseId_fkey] FOREIGN KEY ([destinationWarehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END

-- Add inventory_stock_transfer_lines table if not exists
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inventory_stock_transfer_lines]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[inventory_stock_transfer_lines] (
    [id]                     NVARCHAR(1000) NOT NULL,
    [transferId]             NVARCHAR(1000) NOT NULL,
    [productId]              NVARCHAR(1000) NOT NULL,
    [quantity]               FLOAT NOT NULL,
    [notes]                  NVARCHAR(MAX) NULL,
    [transferOutMovementId]  NVARCHAR(1000) NULL,
    [transferInMovementId]   NVARCHAR(1000) NULL,
    [createdAt]              DATETIME2 NOT NULL CONSTRAINT [inventory_stock_transfer_lines_createdAt_df] DEFAULT GETDATE(),
    [updatedAt]              DATETIME2 NOT NULL CONSTRAINT [inventory_stock_transfer_lines_updatedAt_df] DEFAULT GETDATE(),
    CONSTRAINT [PK_inventory_stock_transfer_lines] PRIMARY KEY ([id])
  );

  CREATE INDEX [IX_inventory_stock_transfer_lines_transferId] ON [dbo].[inventory_stock_transfer_lines] ([transferId]);
  CREATE INDEX [IX_inventory_stock_transfer_lines_productId] ON [dbo].[inventory_stock_transfer_lines] ([productId]);
  CREATE INDEX [IX_inventory_stock_transfer_lines_transferOutMovementId] ON [dbo].[inventory_stock_transfer_lines] ([transferOutMovementId]);
  CREATE INDEX [IX_inventory_stock_transfer_lines_transferInMovementId] ON [dbo].[inventory_stock_transfer_lines] ([transferInMovementId]);

  ALTER TABLE [dbo].[inventory_stock_transfer_lines] ADD CONSTRAINT [FK_inventory_stock_transfer_lines_transferId_fkey] FOREIGN KEY ([transferId]) REFERENCES [dbo].[inventory_stock_transfers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[inventory_stock_transfer_lines] ADD CONSTRAINT [FK_inventory_stock_transfer_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
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
