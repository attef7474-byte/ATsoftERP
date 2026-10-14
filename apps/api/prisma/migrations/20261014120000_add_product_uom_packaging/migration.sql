-- Product multi-UOM / packaging hierarchy (ADDITIVE, NON-DESTRUCTIVE).
--
-- Adds:
--   1) product_uoms table (one base inventory unit + ordered packaging levels)
--   2) a filtered unique index enforcing exactly one base row per product
--   3) historical transaction-UOM snapshot columns on inventory_movement_lines
--   4) base product_uoms rows backfilled for existing products with a proven unitId
--
-- Preserves: products, inventory_balances, inventory_movements, barcodes, units.
-- No drop, no truncate, no NOT NULL on legacy columns, no stock recalculation.
--
-- Prisma sends migration.sql as ONE batch and does not honor GO, so every statement
-- that references an object created earlier in this same batch is deferred through
-- sys.sp_executesql (runtime recompile), matching the existing project convention.

BEGIN TRY

BEGIN TRAN;

-- 1) New table: product_uoms
CREATE TABLE [dbo].[product_uoms] (
    [id] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [unitId] NVARCHAR(1000) NOT NULL,
    [isBase] BIT NOT NULL CONSTRAINT [product_uoms_isBase_df] DEFAULT 0,
    [parentProductUomId] NVARCHAR(1000),
    [quantityPerParent] DECIMAL(18,6) NOT NULL CONSTRAINT [product_uoms_quantityPerParent_df] DEFAULT 1,
    [conversionToBase] DECIMAL(18,6) NOT NULL,
    [barcode] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [product_uoms_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [product_uoms_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [product_uoms_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- 3) Historical transaction-UOM snapshot on movement lines
ALTER TABLE [dbo].[inventory_movement_lines] ADD [enteredUnitId] NVARCHAR(1000);
ALTER TABLE [dbo].[inventory_movement_lines] ADD [productUomId] NVARCHAR(1000);
ALTER TABLE [dbo].[inventory_movement_lines] ADD [enteredQuantity] DECIMAL(18,4);
ALTER TABLE [dbo].[inventory_movement_lines] ADD [conversionApplied] DECIMAL(18,6);

-- 2) Indexes, FKs, filtered unique constraint (deferred)
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [product_uoms_productId_idx] ON [dbo].[product_uoms]([productId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [product_uoms_unitId_idx] ON [dbo].[product_uoms]([unitId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [product_uoms_parentProductUomId_idx] ON [dbo].[product_uoms]([parentProductUomId])';
EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [product_uoms_barcode_idx] ON [dbo].[product_uoms]([barcode])';
EXEC sys.sp_executesql N'CREATE UNIQUE NONCLUSTERED INDEX [product_uoms_productId_unitId_key] ON [dbo].[product_uoms]([productId],[unitId])';
EXEC sys.sp_executesql N'CREATE UNIQUE NONCLUSTERED INDEX [product_uoms_one_base_per_product] ON [dbo].[product_uoms]([productId]) WHERE [isBase] = 1';

EXEC sys.sp_executesql N'ALTER TABLE [dbo].[product_uoms] ADD CONSTRAINT [product_uoms_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[product_uoms] ADD CONSTRAINT [product_uoms_unitId_fkey] FOREIGN KEY ([unitId]) REFERENCES [dbo].[units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';
EXEC sys.sp_executesql N'ALTER TABLE [dbo].[product_uoms] ADD CONSTRAINT [product_uoms_parentProductUomId_fkey] FOREIGN KEY ([parentProductUomId]) REFERENCES [dbo].[product_uoms]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION';

EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX [inventory_movement_lines_productUomId_idx] ON [dbo].[inventory_movement_lines]([productUomId])';

-- 4) Backfill one base ProductUom per existing product that has a proven global unit.
--    All existing products resolve to PCS (verified in production-baseline.json).
EXEC sys.sp_executesql N'
INSERT INTO [dbo].[product_uoms] ([id],[productId],[unitId],[isBase],[parentProductUomId],[quantityPerParent],[conversionToBase],[barcode],[isActive],[createdAt],[updatedAt])
SELECT CONCAT(''puom-base-'', p.[id]), p.[id], p.[unitId], 1, NULL, 1, 1, NULL, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM [dbo].[products] p
WHERE p.[unitId] IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM [dbo].[product_uoms] u WHERE u.[productId] = p.[id] AND u.[isBase] = 1)';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
