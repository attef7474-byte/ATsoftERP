-- Unified Inventory Receipt — Phase 2: operational receipt classification metadata.
--
-- ADDITIVE ONLY. Adds two nullable document-metadata columns to
-- dbo.inventory_operational_receipts. No row is backfilled, no existing value is
-- changed, no movement/balance/SparePart/order/run is touched. NULL is a valid
-- legacy state meaning "native operational receipt / source unspecified".
--
-- These columns are NOT stock quantities and are NOT a second receipt authority.
-- They exist so the single "إذن استلام" list can show and filter a normalized
-- type/source without deriving business facts from mutable Product.itemType.
-- SQL Server compiles a batch before execution, so statements referencing the
-- new columns run in a later sp_executesql batch.

BEGIN TRY
BEGIN TRAN;

IF COL_LENGTH('dbo.inventory_operational_receipts', 'receiptType') IS NULL
  ALTER TABLE [dbo].[inventory_operational_receipts] ADD [receiptType] NVARCHAR(1000) NULL;

IF COL_LENGTH('dbo.inventory_operational_receipts', 'receiptSource') IS NULL
  ALTER TABLE [dbo].[inventory_operational_receipts] ADD [receiptSource] NVARCHAR(1000) NULL;

EXEC sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''operational_receipt_type_ck'' AND parent_object_id = OBJECT_ID(N''dbo.inventory_operational_receipts''))
  ALTER TABLE [dbo].[inventory_operational_receipts] WITH CHECK ADD CONSTRAINT [operational_receipt_type_ck]
    CHECK ([receiptType] IS NULL OR [receiptType] IN (
      N''RAW_MATERIAL'', N''SPARE_PART'',
      N''PACKAGING_MATERIAL'', N''CONSUMABLE'', N''GENERAL''));
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''operational_receipt_type_ck'' AND parent_object_id = OBJECT_ID(N''dbo.inventory_operational_receipts''))
  ALTER TABLE [dbo].[inventory_operational_receipts] CHECK CONSTRAINT [operational_receipt_type_ck];
';

EXEC sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''operational_receipt_source_ck'' AND parent_object_id = OBJECT_ID(N''dbo.inventory_operational_receipts''))
  ALTER TABLE [dbo].[inventory_operational_receipts] WITH CHECK ADD CONSTRAINT [operational_receipt_source_ck]
    CHECK ([receiptSource] IS NULL OR [receiptSource] IN (
      N''SUPPLIER'', N''RETURN'', N''INTERNAL'', N''OTHER''));
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''operational_receipt_source_ck'' AND parent_object_id = OBJECT_ID(N''dbo.inventory_operational_receipts''))
  ALTER TABLE [dbo].[inventory_operational_receipts] CHECK CONSTRAINT [operational_receipt_source_ck];
';

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
