BEGIN TRY
BEGIN TRAN;

-- Inventory Valuation R1C: atomic perpetual weighted moving-average engine.
--
-- VAL-R1C builds strictly on VAL-R1A/VAL-R1B (closed and unmodified). It does
-- NOT backfill any historical cost, does NOT insert valuation rows, and does NOT
-- touch inventory_valuation_policies (activation metadata already shipped). It
-- only hardens the monetary snapshot contract at the database level:
--
--   1. A CHECK constraint on inventory_movement_lines enforcing that the R1A
--      monetary snapshot quartet (unitCost, totalCost, currencyCode,
--      valuationMethod) is written ATOMICALLY: either ALL FOUR are set together
--      (a valued movement line written by the moving-average engine) or ALL
--      FOUR are NULL (an unvalued legacy line). A partially-populated snapshot
--      can never be persisted, so the engine guarantees the monetary record is
--      never torn behind a crash or a failed multi-statement write.
--
-- The statement uses the existing R1A columns, so static DDL is sufficient --
-- no EXEC indirection is required. No new index is added: the valuation-balance
-- aggregation path (warehouseId, productId) is already covered by the unique
-- (companyId, warehouseId, productId) and the existing (warehouseId, productId)
-- index on inventory_valuation_balances, and the policy lookup is covered by
-- the (companyId, warehouseId) unique, so any added index would be redundant.

-- 1. Monetary snapshot quartet must be all-present or all-absent (atomic write).
ALTER TABLE [dbo].[inventory_movement_lines] WITH CHECK ADD CONSTRAINT [inventory_movement_lines_valuation_quartet_ck]
  CHECK (
    ([unitCost] IS NULL AND [totalCost] IS NULL AND [currencyCode] IS NULL AND [valuationMethod] IS NULL)
    OR
    ([unitCost] IS NOT NULL AND [totalCost] IS NOT NULL AND [currencyCode] IS NOT NULL AND [valuationMethod] IS NOT NULL)
  );
ALTER TABLE [dbo].[inventory_movement_lines] CHECK CONSTRAINT [inventory_movement_lines_valuation_quartet_ck];

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
