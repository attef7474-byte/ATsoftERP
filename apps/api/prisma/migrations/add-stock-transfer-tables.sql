-- Safe migration: Add InventoryStockTransfer and InventoryStockTransferLine tables
-- Non-destructive, additive only. All ID columns NVARCHAR(1000) to match existing schema.

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inventory_stock_transfers]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[inventory_stock_transfers] (
    [id]                      NVARCHAR(1000) NOT NULL,
    [code]                    NVARCHAR(1000) NOT NULL,
    [companyId]               NVARCHAR(1000) NOT NULL,
    [branchId]                NVARCHAR(1000) NULL,
    [status]                  NVARCHAR(1000) NOT NULL DEFAULT N'DRAFT',
    [documentDate]            DATETIME2 NOT NULL DEFAULT GETDATE(),
    [sourceWarehouseId]       NVARCHAR(1000) NOT NULL,
    [sourceLocationId]        NVARCHAR(1000) NULL,
    [destinationWarehouseId]  NVARCHAR(1000) NOT NULL,
    [destinationLocationId]   NVARCHAR(1000) NULL,
    [reason]                  NVARCHAR(MAX) NOT NULL DEFAULT N'',
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
    [createdAt]               DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updatedAt]               DATETIME2 NOT NULL DEFAULT GETDATE(),
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

  ALTER TABLE [dbo].[inventory_stock_transfers] ADD CONSTRAINT [FK_inventory_stock_transfers_company] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]);
  ALTER TABLE [dbo].[inventory_stock_transfers] ADD CONSTRAINT [FK_inventory_stock_transfers_src_warehouse] FOREIGN KEY ([sourceWarehouseId]) REFERENCES [dbo].[warehouses]([id]);
  ALTER TABLE [dbo].[inventory_stock_transfers] ADD CONSTRAINT [FK_inventory_stock_transfers_dst_warehouse] FOREIGN KEY ([destinationWarehouseId]) REFERENCES [dbo].[warehouses]([id]);

  PRINT 'Created table: inventory_stock_transfers';
END
ELSE
BEGIN
  PRINT 'Table already exists: inventory_stock_transfers';
END

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
    [createdAt]              DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updatedAt]              DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [PK_inventory_stock_transfer_lines] PRIMARY KEY ([id])
  );

  CREATE INDEX [IX_inventory_stock_transfer_lines_transferId] ON [dbo].[inventory_stock_transfer_lines] ([transferId]);
  CREATE INDEX [IX_inventory_stock_transfer_lines_productId] ON [dbo].[inventory_stock_transfer_lines] ([productId]);
  CREATE INDEX [IX_inventory_stock_transfer_lines_transferOutMovementId] ON [dbo].[inventory_stock_transfer_lines] ([transferOutMovementId]);
  CREATE INDEX [IX_inventory_stock_transfer_lines_transferInMovementId] ON [dbo].[inventory_stock_transfer_lines] ([transferInMovementId]);

  ALTER TABLE [dbo].[inventory_stock_transfer_lines] ADD CONSTRAINT [FK_inventory_stock_transfer_lines_transfer] FOREIGN KEY ([transferId]) REFERENCES [dbo].[inventory_stock_transfers]([id]);
  ALTER TABLE [dbo].[inventory_stock_transfer_lines] ADD CONSTRAINT [FK_inventory_stock_transfer_lines_product] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]);

  PRINT 'Created table: inventory_stock_transfer_lines';
END
ELSE
BEGIN
  PRINT 'Table already exists: inventory_stock_transfer_lines';
END

PRINT 'Stock transfer migration completed successfully.';
GO
