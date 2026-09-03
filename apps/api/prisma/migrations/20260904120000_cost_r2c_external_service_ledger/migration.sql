-- COST-R2C-B: canonical external maintenance service costs in the Unified Cost Ledger.
--
-- Existing-data impact: constraint-only additive vocabulary extension. No source or
-- ledger row is inserted, updated, deleted, or backfilled. Existing MATERIAL, LABOR,
-- MACHINE, OVERHEAD and DOWNTIME contracts are preserved exactly. The zero
-- quantity/rate representation is limited to EXTERNAL_SERVICE rows backed by an
-- exact MaintenanceWorkOrderCostEntry, with the authoritative amount carried only
-- by amount and unit AMOUNT.
--
-- Recovery: every constraint replacement is in one transaction. Any failure rolls
-- the whole migration back. Every CHECK is created WITH CHECK and explicitly enabled.

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_event_type_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK ADD CONSTRAINT [operational_cost_transactions_event_type_ck] CHECK
(
  [eventType] IN (N'MATERIAL', N'LABOR', N'MACHINE', N'OVERHEAD', N'DOWNTIME', N'EXTERNAL_SERVICE')
);
ALTER TABLE [dbo].[operational_cost_transactions] CHECK CONSTRAINT [operational_cost_transactions_event_type_ck];

ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_rate_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK ADD CONSTRAINT [operational_cost_transactions_rate_ck] CHECK
(
  [rate] > (0) OR
  ([entryRole] = N'REVERSAL' AND [rate] = (0)) OR
  ([entryRole] = N'PRIMARY_COST' AND [costNature] = N'ACTUAL' AND [eventType] = N'MATERIAL' AND [rate] = (0)) OR
  ([entryRole] = N'PRIMARY_COST' AND [costNature] = N'MANUAL_ASSERTED_ACTUAL'
    AND [eventType] = N'LABOR' AND [sourceType] = N'MAINTENANCE_WORK_ORDER_COST_ENTRY'
    AND [unit] = N'AMOUNT' AND [rate] = (0)) OR
  ([entryRole] = N'PRIMARY_COST' AND [costNature] = N'MANUAL_ASSERTED_ACTUAL'
    AND [eventType] = N'EXTERNAL_SERVICE' AND [sourceType] = N'MAINTENANCE_WORK_ORDER_COST_ENTRY'
    AND [unit] = N'AMOUNT' AND [rate] = (0))
);
ALTER TABLE [dbo].[operational_cost_transactions] CHECK CONSTRAINT [operational_cost_transactions_rate_ck];

ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_quantity_sign_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK ADD CONSTRAINT [operational_cost_transactions_quantity_sign_ck] CHECK
(
  ([entryRole] = N'PRIMARY_COST' AND [quantity] > (0)) OR
  ([entryRole] = N'REVERSAL' AND [quantity] < (0)) OR
  ([entryRole] = N'PRIMARY_COST' AND [costNature] = N'MANUAL_ASSERTED_ACTUAL'
    AND [eventType] = N'LABOR' AND [sourceType] = N'MAINTENANCE_WORK_ORDER_COST_ENTRY'
    AND [unit] = N'AMOUNT' AND [quantity] = (0)) OR
  ([entryRole] = N'REVERSAL' AND [eventType] = N'LABOR'
    AND [sourceType] = N'MAINTENANCE_WORK_ORDER_COST_ENTRY' AND [unit] = N'AMOUNT'
    AND [quantity] = (0)) OR
  ([entryRole] = N'PRIMARY_COST' AND [costNature] = N'MANUAL_ASSERTED_ACTUAL'
    AND [eventType] = N'EXTERNAL_SERVICE' AND [sourceType] = N'MAINTENANCE_WORK_ORDER_COST_ENTRY'
    AND [unit] = N'AMOUNT' AND [quantity] = (0)) OR
  ([entryRole] = N'REVERSAL' AND [eventType] = N'EXTERNAL_SERVICE'
    AND [sourceType] = N'MAINTENANCE_WORK_ORDER_COST_ENTRY' AND [unit] = N'AMOUNT'
    AND [quantity] = (0)) OR
  ([entryRole] IS NULL AND (([status] = N'POSTED' AND [quantity] > (0)) OR ([status] = N'REVERSED' AND [quantity] < (0))))
);
ALTER TABLE [dbo].[operational_cost_transactions] CHECK CONSTRAINT [operational_cost_transactions_quantity_sign_ck];

ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK ADD CONSTRAINT [operational_cost_transactions_external_service_shape_ck] CHECK
(
  [eventType] <> N'EXTERNAL_SERVICE' OR
  (
    [sourceType] = N'MAINTENANCE_WORK_ORDER_COST_ENTRY' AND
    [costNature] = N'MANUAL_ASSERTED_ACTUAL' AND
    [costPurpose] = N'MAINTENANCE' AND
    [entryRole] IN (N'PRIMARY_COST', N'REVERSAL') AND
    [unit] = N'AMOUNT' AND
    [quantity] = (0) AND
    [rate] = (0)
  )
);
ALTER TABLE [dbo].[operational_cost_transactions] CHECK CONSTRAINT [operational_cost_transactions_external_service_shape_ck];

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
