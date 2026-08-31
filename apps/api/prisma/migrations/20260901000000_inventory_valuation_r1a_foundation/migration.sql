BEGIN TRY
BEGIN TRAN;

-- Inventory Valuation Foundation R1A.
--
-- Val-R1A is a strict, additive schema foundation ONLY. It introduces the
-- monetary authority models and nullable snapshot columns that downstream
-- VAL-R1B/R1C phases will use. It implements NO valuation engine, NO policy
-- activation path, and NO monetary posting:
--   * ZERO rows are seeded into inventory_valuation_policies / balances.
--   * All new movement / opening / receipt columns are NULLABLE and unpopulated.
--   * No existing row is updated, re-written, or deleted.
--   * The currency code carries NO database default (it is the policy's own
--     frozen authority; SystemSetting company.currencyCode is future-prefill only).
--
-- Every new CHECK constraint is created with WITH CHECK ADD CONSTRAINT followed
-- by CHECK CONSTRAINT, guaranteeing it is ENABLED and TRUSTED (no WITH NOCHECK).
-- The whole change is atomic: any failure rolls back all objects.

-- 1. Warehouse valuation policy (one per company+warehouse).
CREATE TABLE [dbo].[inventory_valuation_policies] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [method] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_valuation_policies_method_df] DEFAULT 'WEIGHTED_AVERAGE',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [inventory_valuation_policies_status_df] DEFAULT 'DRAFT',
    [currencyCode] NVARCHAR(1000) NOT NULL,
    [activatedById] NVARCHAR(1000),
    [activatedAt] DATETIME2,
    [initializedById] NVARCHAR(1000),
    [initializedAt] DATETIME2,
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_valuation_policies_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [inventory_valuation_policies_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_valuation_policies_companyId_warehouseId_key] UNIQUE NONCLUSTERED ([companyId],[warehouseId])
);

-- Valuation policy method is the canonical R1 method only.
ALTER TABLE [dbo].[inventory_valuation_policies] WITH CHECK ADD CONSTRAINT [inventory_valuation_policies_method_ck]
  CHECK ([method] IN (N'WEIGHTED_AVERAGE'));
ALTER TABLE [dbo].[inventory_valuation_policies] CHECK CONSTRAINT [inventory_valuation_policies_method_ck];

-- Valuation policy lifecycle. R1A creates no ACTIVE policy (no activation API),
-- but SQL must know the complete future lifecycle.
ALTER TABLE [dbo].[inventory_valuation_policies] WITH CHECK ADD CONSTRAINT [inventory_valuation_policies_status_ck]
  CHECK ([status] IN (N'DRAFT', N'INITIALIZING', N'ACTIVE', N'RETIRED'));
ALTER TABLE [dbo].[inventory_valuation_policies] CHECK CONSTRAINT [inventory_valuation_policies_status_ck];

-- 2. Current monetary state (one per company+warehouse+product).
CREATE TABLE [dbo].[inventory_valuation_balances] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [warehouseId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [averageUnitCost] DECIMAL(19,8) NOT NULL,
    [inventoryValue] DECIMAL(19,4) NOT NULL,
    [lastHistoricalUnitCost] DECIMAL(19,8),
    [version] INT NOT NULL CONSTRAINT [inventory_valuation_balances_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [inventory_valuation_balances_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [inventory_valuation_balances_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [inventory_valuation_balances_companyId_warehouseId_productId_key] UNIQUE NONCLUSTERED ([companyId],[warehouseId],[productId])
);

-- 3. Nullable monetary snapshot foundation on inventory movement lines.
--    All four columns are NULLABLE in R1A; historical rows remain NULL and are
--    never backfilled. valuationOrigin/source deferred to R1C.
ALTER TABLE [dbo].[inventory_movement_lines] ADD [currencyCode] NVARCHAR(1000),
[totalCost] DECIMAL(19,4),
[unitCost] DECIMAL(19,6),
[valuationMethod] NVARCHAR(1000);

-- 4. Nullable quantityBase foundation on opening & operational receipt lines.
ALTER TABLE [dbo].[inventory_opening_balance_lines] ADD [quantityBase] DECIMAL(18,4);
ALTER TABLE [dbo].[inventory_operational_receipt_lines] ADD [quantityBase] DECIMAL(18,4);

-- 5. Policy standalone indexes (warehouseId; companyId,status; status).
CREATE NONCLUSTERED INDEX [inventory_valuation_policies_warehouseId_idx] ON [dbo].[inventory_valuation_policies]([warehouseId]);
CREATE NONCLUSTERED INDEX [inventory_valuation_policies_companyId_status_idx] ON [dbo].[inventory_valuation_policies]([companyId], [status]);
CREATE NONCLUSTERED INDEX [inventory_valuation_policies_status_idx] ON [dbo].[inventory_valuation_policies]([status]);

-- 6. Balance standalone indexes (warehouseId,productId; productId; updatedAt).
--    (companyId,warehouseId) needs no dedicated index: it is a prefix of the
--    unique key (companyId,warehouseId,productId).
CREATE NONCLUSTERED INDEX [inventory_valuation_balances_warehouseId_productId_idx] ON [dbo].[inventory_valuation_balances]([warehouseId], [productId]);
CREATE NONCLUSTERED INDEX [inventory_valuation_balances_productId_idx] ON [dbo].[inventory_valuation_balances]([productId]);
CREATE NONCLUSTERED INDEX [inventory_valuation_balances_updatedAt_idx] ON [dbo].[inventory_valuation_balances]([updatedAt]);

-- 7. Foreign keys.
--    Policy: company, warehouse, and audit user relations.
ALTER TABLE [dbo].[inventory_valuation_policies] ADD CONSTRAINT [inventory_valuation_policies_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_valuation_policies] ADD CONSTRAINT [inventory_valuation_policies_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_valuation_policies] ADD CONSTRAINT [inventory_valuation_policies_activatedById_fkey] FOREIGN KEY ([activatedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_valuation_policies] ADD CONSTRAINT [inventory_valuation_policies_initializedById_fkey] FOREIGN KEY ([initializedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_valuation_policies] ADD CONSTRAINT [inventory_valuation_policies_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_valuation_policies] ADD CONSTRAINT [inventory_valuation_policies_updatedById_fkey] FOREIGN KEY ([updatedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

--    Balance: company, warehouse, product.
ALTER TABLE [dbo].[inventory_valuation_balances] ADD CONSTRAINT [inventory_valuation_balances_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_valuation_balances] ADD CONSTRAINT [inventory_valuation_balances_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[inventory_valuation_balances] ADD CONSTRAINT [inventory_valuation_balances_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- 8. Movement valuation method CHECK: future valued rows use WEIGHTED_AVERAGE;
--    historical/unvalued rows remain NULL. Enabled + trusted.
--    NOTE: this CHECK references a column (valuationMethod) added by ALTER TABLE
--    earlier in the SAME batch. SQL Server batch-compiles and cannot resolve a
--    same-batch-added column in a static DDL statement, so it is issued through
--    dynamic SQL (EXEC) which compiles as a separate inner batch. GO is avoided
--    to preserve the Prisma single-batch migration contract.
EXEC(N'
  ALTER TABLE [dbo].[inventory_movement_lines] WITH CHECK ADD CONSTRAINT [inventory_movement_lines_valuation_method_ck]
    CHECK ([valuationMethod] IS NULL OR [valuationMethod] IN (N''WEIGHTED_AVERAGE''));
  ALTER TABLE [dbo].[inventory_movement_lines] CHECK CONSTRAINT [inventory_movement_lines_valuation_method_ck];
');

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
