BEGIN TRY
BEGIN TRAN;

-- Inventory Valuation R1D: valuable Warehouse Transfer, Stock Adjustment, and
-- Physical Count flows for ACTIVE valuation warehouses.
--
-- VAL-R1D values the three remaining in-scope InventoryBalance mutators that were
-- BLOCKED_WHEN_ACTIVE in VAL-R1C (STOCK_TRANSFER_POST, STOCK_ADJUSTMENT_POST,
-- PHYSICAL_COUNT_POST). It is purely ADDITIVE and NON-DESTRUCTIVE:
--
--   * It does NOT backfill historical cost.
--   * It does NOT insert valuation rows.
--   * It does NOT alter the R1C monetary quartet CHECK on inventory_movement_lines.
--   * Every new column is NULLABLE, so existing rows are untouched and the three
--     flows keep their legacy (unvalued) behavior for warehouses with no ACTIVE
--     valuation policy.
--
-- New nullable monetary-source columns (all optional; populated ONLY by the
-- VAL-R1D valuation engine / authorized cost-input during a valued post):
--
--   1. inventory_stock_transfer_lines.transferTotalValue   Decimal(19,4)  -> the ONE
--      authoritative value used for both the source decrement and the destination
--      increment of a valued transfer (value conservation).
--   2. inventory_stock_adjustment_lines: unitCost Decimal(19,6),
--      currencyCode, valuationReason  -> explicit cost + currency + reason for an
--      ADJUSTMENT_IN into an ACTIVE valuation warehouse (requires the valuation
--      cost-input permission and the ACTIVE policy currency).
--   3. inventory_physical_count_lines: unitCost Decimal(19,6), currencyCode,
--      valuationReason  -> explicit cost + currency + reason for a count surplus
--      (variance > 0) on an ACTIVE valuation warehouse.
--
-- Precision contract (matches the R1B/R1C money rules): unitCost 19,6;
-- transferTotalValue 19,4. No CHECK constraints are added here so the additive
-- columns cannot reject any legacy row; runtime validation is the single source
-- of truth for the valued flows.

-- 1. Stock transfer lines: single authoritative transferTotalValue.
IF COL_LENGTH('dbo.inventory_stock_transfer_lines', 'transferTotalValue') IS NULL
BEGIN
  ALTER TABLE [dbo].[inventory_stock_transfer_lines] ADD [transferTotalValue] DECIMAL(19, 4) NULL;
END

-- 2. Stock adjustment lines: explicit monetary source for ADJUSTMENT_IN.
IF COL_LENGTH('dbo.inventory_stock_adjustment_lines', 'unitCost') IS NULL
BEGIN
  ALTER TABLE [dbo].[inventory_stock_adjustment_lines] ADD [unitCost] DECIMAL(19, 6) NULL;
END
IF COL_LENGTH('dbo.inventory_stock_adjustment_lines', 'currencyCode') IS NULL
BEGIN
  ALTER TABLE [dbo].[inventory_stock_adjustment_lines] ADD [currencyCode] NVARCHAR(10) NULL;
END
IF COL_LENGTH('dbo.inventory_stock_adjustment_lines', 'valuationReason') IS NULL
BEGIN
  ALTER TABLE [dbo].[inventory_stock_adjustment_lines] ADD [valuationReason] NVARCHAR(500) NULL;
END

-- 3. Physical count lines: explicit monetary source for count surplus.
IF COL_LENGTH('dbo.inventory_physical_count_lines', 'unitCost') IS NULL
BEGIN
  ALTER TABLE [dbo].[inventory_physical_count_lines] ADD [unitCost] DECIMAL(19, 6) NULL;
END
IF COL_LENGTH('dbo.inventory_physical_count_lines', 'currencyCode') IS NULL
BEGIN
  ALTER TABLE [dbo].[inventory_physical_count_lines] ADD [currencyCode] NVARCHAR(10) NULL;
END
IF COL_LENGTH('dbo.inventory_physical_count_lines', 'valuationReason') IS NULL
BEGIN
  ALTER TABLE [dbo].[inventory_physical_count_lines] ADD [valuationReason] NVARCHAR(500) NULL;
END

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
