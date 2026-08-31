BEGIN TRY
BEGIN TRAN;

-- Inventory Valuation R1B: explicit monetary input + legacy stock initialization.
--
-- VAL-R1B builds strictly on VAL-R1A (which is CLOSED and unmodified). It adds:
--   1. Nullable explicit monetary input columns (unitCost, currencyCode,
--      valuationReason) to opening-balance and operational-receipt lines so each
--      legacy line can carry its captured cost. Historical/unvalued rows stay NULL.
--   2. An immutable InventoryValuationInitialization evidence table (one row per
--      company+warehouse+product) that is the authoritative source of record for
--      legacy-stock monetary initialization.
--   3. No moving-average engine, no ACTIVE transition, no automatic valuation
--      writes, and zero data rows are inserted or modified.
--
-- Every CHECK is created WITH CHECK ADD CONSTRAINT followed by CHECK CONSTRAINT so
-- it is ENABLED and TRUSTED (no WITH NOCHECK). Checks that reference columns added
-- by ALTER TABLE in the same batch go through EXEC (dynamic SQL) because SQL Server
-- cannot reference a same-batch ALTER-added column in static DDL. GO is forbidden.

-- 1. Opening-balance lines: nullable explicit monetary input.
ALTER TABLE [dbo].[inventory_opening_balance_lines] ADD [unitCost] DECIMAL(19,6),
[currencyCode] NVARCHAR(1000),
[valuationReason] NVARCHAR(1000);

-- 2. Operational-receipt lines: nullable explicit monetary input.
ALTER TABLE [dbo].[inventory_operational_receipt_lines] ADD [unitCost] DECIMAL(19,6),
[currencyCode] NVARCHAR(1000),
[valuationReason] NVARCHAR(1000);

-- 3. Immutable initialization evidence.
CREATE TABLE [dbo].[inventory_valuation_initializations] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [policyId] NVARCHAR(1000) NOT NULL,
    [quantitySnapshot] DECIMAL(18,4) NOT NULL,
    [unitCost] DECIMAL(19,6) NOT NULL,
    [totalValue] DECIMAL(19,4) NOT NULL,
    [currencyCode] NVARCHAR(1000) NOT NULL,
    [reason] NVARCHAR(1000),
    [createdById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_valuation_initializations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [inventory_valuation_initializations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_valuation_initializations_companyId_warehouseId_productId_key] UNIQUE NONCLUSTERED ([companyId],[warehouseId],[productId])
);

-- 4. Non-negativity constraints on the evidence table (enabled + trusted).
ALTER TABLE [dbo].[inventory_valuation_initializations] WITH CHECK ADD CONSTRAINT [inventory_valuation_initializations_quantitySnapshot_ck]
  CHECK ([quantitySnapshot] >= 0);
ALTER TABLE [dbo].[inventory_valuation_initializations] CHECK CONSTRAINT [inventory_valuation_initializations_quantitySnapshot_ck];

ALTER TABLE [dbo].[inventory_valuation_initializations] WITH CHECK ADD CONSTRAINT [inventory_valuation_initializations_unitCost_ck]
  CHECK ([unitCost] >= 0);
ALTER TABLE [dbo].[inventory_valuation_initializations] CHECK CONSTRAINT [inventory_valuation_initializations_unitCost_ck];

ALTER TABLE [dbo].[inventory_valuation_initializations] WITH CHECK ADD CONSTRAINT [inventory_valuation_initializations_totalValue_ck]
  CHECK ([totalValue] >= 0);
ALTER TABLE [dbo].[inventory_valuation_initializations] CHECK CONSTRAINT [inventory_valuation_initializations_totalValue_ck];

-- 5. Non-negativity + non-empty checks on the same-batch ALTER-added monetary
--    columns. Because these reference columns added by ALTER in this same batch,
--    they are created through dynamic SQL (EXEC), which compiles as an inner batch.
EXEC(N'
  ALTER TABLE [dbo].[inventory_opening_balance_lines] WITH CHECK ADD CONSTRAINT [inventory_opening_balance_lines_unitCost_ck]
    CHECK ([unitCost] IS NULL OR [unitCost] >= 0);
  ALTER TABLE [dbo].[inventory_opening_balance_lines] CHECK CONSTRAINT [inventory_opening_balance_lines_unitCost_ck];

  ALTER TABLE [dbo].[inventory_opening_balance_lines] WITH CHECK ADD CONSTRAINT [inventory_opening_balance_lines_currencyCode_ck]
    CHECK ([currencyCode] IS NULL OR LEN(LTRIM(RTRIM([currencyCode]))) > 0);
  ALTER TABLE [dbo].[inventory_opening_balance_lines] CHECK CONSTRAINT [inventory_opening_balance_lines_currencyCode_ck];

  ALTER TABLE [dbo].[inventory_operational_receipt_lines] WITH CHECK ADD CONSTRAINT [inventory_operational_receipt_lines_unitCost_ck]
    CHECK ([unitCost] IS NULL OR [unitCost] >= 0);
  ALTER TABLE [dbo].[inventory_operational_receipt_lines] CHECK CONSTRAINT [inventory_operational_receipt_lines_unitCost_ck];

  ALTER TABLE [dbo].[inventory_operational_receipt_lines] WITH CHECK ADD CONSTRAINT [inventory_operational_receipt_lines_currencyCode_ck]
    CHECK ([currencyCode] IS NULL OR LEN(LTRIM(RTRIM([currencyCode]))) > 0);
  ALTER TABLE [dbo].[inventory_operational_receipt_lines] CHECK CONSTRAINT [inventory_operational_receipt_lines_currencyCode_ck];
');

-- 6. Standalone indexes on the initialization table.
CREATE NONCLUSTERED INDEX [inventory_valuation_initializations_warehouseId_productId_idx] ON [dbo].[inventory_valuation_initializations]([warehouseId], [productId]);
CREATE NONCLUSTERED INDEX [inventory_valuation_initializations_productId_idx] ON [dbo].[inventory_valuation_initializations]([productId]);
CREATE NONCLUSTERED INDEX [inventory_valuation_initializations_policyId_idx] ON [dbo].[inventory_valuation_initializations]([policyId]);

-- 7. Foreign keys.
ALTER TABLE [dbo].[inventory_valuation_initializations] ADD CONSTRAINT [inventory_valuation_initializations_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_valuation_initializations] ADD CONSTRAINT [inventory_valuation_initializations_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_valuation_initializations] ADD CONSTRAINT [inventory_valuation_initializations_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_valuation_initializations] ADD CONSTRAINT [inventory_valuation_initializations_policyId_fkey] FOREIGN KEY ([policyId]) REFERENCES [dbo].[inventory_valuation_policies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_valuation_initializations] ADD CONSTRAINT [inventory_valuation_initializations_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
