-- COST-R1B-B2 Legacy DB constraint compatibility repair.
-- PURPOSE: align legacy SQL Server CHECK constraints with the canonical unified
-- cost ledger contract (COST-R1B) whose semantic authority is `entryRole`.
-- The live table is EMPTY (verified count = 0) so no data is affected; only
-- CHECK constraints are dropped and re-created. No business data is modified.
--
-- Contract frozen:
--   source_type_ck   += INVENTORY_MOVEMENT_LINE, DOWNTIME_EVENT (canonical), legacy retained
--   event_type_ck     unchanged: MATERIAL and DOWNTIME already allowed
--   rate_ck           rate > 0 generally; rate = 0 ALLOWED only for canonical
--                      PRIMARY_COST + ACTUAL + MATERIAL (amount authority = totalCost)
--                      and for canonical REVERSAL rows (a reversal inherits the
--                      original's rate, which is legitimately 0 for material)
--   quantity/amount_sign_ck  key on entryRole: PRIMARY_COST positive, REVERSAL negative,
--                      legacy (entryRole IS NULL) rows keep the prior status-based rule
--   reversal_link_ck  canonical REVERSAL requires reversalOfId; PRIMARY_COST has none;
--                      legacy rows keep the prior status-based rule
-- Invariants preserved: no FX, no amount precision change, amount NOT NULL,
-- controlled (non-free-form) source/event/unit vocabularies retained.

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

IF OBJECT_ID(N'dbo.operational_cost_transactions_source_type_ck') IS NOT NULL
  ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_source_type_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH NOCHECK ADD CONSTRAINT [operational_cost_transactions_source_type_ck] CHECK
(
  [sourceType]=N'MANUAL' OR [sourceType]=N'REVERSAL' OR [sourceType]=N'DOWNTIME' OR
  [sourceType]=N'DOWNTIME_EVENT' OR [sourceType]=N'INVENTORY_MOVEMENT_LINE' OR
  [sourceType]=N'QUALITY_DISPOSITION' OR [sourceType]=N'MATERIAL_DOCUMENT' OR
  [sourceType]=N'FG_RECEIPT' OR [sourceType]=N'OUTPUT_EVENT' OR [sourceType]=N'PRODUCTION_RUN' OR
  [sourceType]=N'PRODUCTION_ORDER'
);

IF OBJECT_ID(N'dbo.operational_cost_transactions_rate_ck') IS NOT NULL
  ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_rate_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH NOCHECK ADD CONSTRAINT [operational_cost_transactions_rate_ck] CHECK
(
  [rate]>(0) OR
  ([entryRole]=N'REVERSAL' AND [rate]=(0)) OR
  ([entryRole]=N'PRIMARY_COST' AND [costNature]=N'ACTUAL' AND [eventType]=N'MATERIAL' AND [rate]=(0))
);

IF OBJECT_ID(N'dbo.operational_cost_transactions_quantity_sign_ck') IS NOT NULL
  ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_quantity_sign_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH NOCHECK ADD CONSTRAINT [operational_cost_transactions_quantity_sign_ck] CHECK
(
  ([entryRole]=N'PRIMARY_COST' AND [quantity]>(0)) OR
  ([entryRole]=N'REVERSAL' AND [quantity]<(0)) OR
  ([entryRole] IS NULL AND (([status]=N'POSTED' AND [quantity]>(0)) OR ([status]=N'REVERSED' AND [quantity]<(0))))
);

IF OBJECT_ID(N'dbo.operational_cost_transactions_amount_sign_ck') IS NOT NULL
  ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_amount_sign_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH NOCHECK ADD CONSTRAINT [operational_cost_transactions_amount_sign_ck] CHECK
(
  ([entryRole]=N'PRIMARY_COST' AND [amount]>(0)) OR
  ([entryRole]=N'REVERSAL' AND [amount]<(0)) OR
  ([entryRole] IS NULL AND (([status]=N'POSTED' AND [amount]>(0)) OR ([status]=N'REVERSED' AND [amount]<(0))))
);

IF OBJECT_ID(N'dbo.operational_cost_transactions_reversal_link_ck') IS NOT NULL
  ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_reversal_link_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH NOCHECK ADD CONSTRAINT [operational_cost_transactions_reversal_link_ck] CHECK
(
  ([entryRole]=N'REVERSAL' AND [reversalOfId] IS NOT NULL) OR
  ([entryRole]=N'PRIMARY_COST' AND [reversalOfId] IS NULL) OR
  ([entryRole] IS NULL AND (([status]=N'POSTED' AND [reversalOfId] IS NULL) OR ([status]=N'REVERSED' AND [reversalOfId] IS NOT NULL)))
);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
