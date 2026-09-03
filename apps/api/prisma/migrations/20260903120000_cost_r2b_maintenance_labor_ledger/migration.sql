-- COST-R2B-LABOR: manual asserted maintenance labor in the Unified Cost Ledger.
--
-- Existing-data impact: constraint-only additive vocabulary extension. No row is
-- inserted, updated, deleted or backfilled. Existing MATERIAL and DOWNTIME rows
-- retain their exact accepted contracts. The new zero quantity/rate allowance is
-- narrowly limited to MANUAL_ASSERTED_ACTUAL LABOR rows sourced from an exact
-- MaintenanceWorkOrderCostEntry and represented with unit AMOUNT.
--
-- Recovery: every constraint replacement is inside one transaction. Any failure
-- rolls the complete migration back. All constraints are recreated WITH CHECK and
-- explicitly enabled and trusted; no untrusted creation mode is used.

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_source_type_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK ADD CONSTRAINT [operational_cost_transactions_source_type_ck] CHECK
(
  [sourceType] IN (
    N'PRODUCTION_ORDER', N'PRODUCTION_RUN', N'OUTPUT_EVENT', N'FG_RECEIPT',
    N'MATERIAL_DOCUMENT', N'QUALITY_DISPOSITION', N'DOWNTIME', N'REVERSAL', N'MANUAL',
    N'INVENTORY_MOVEMENT_LINE', N'DOWNTIME_EVENT', N'MAINTENANCE_WORK_ORDER_COST_ENTRY'
  )
);
ALTER TABLE [dbo].[operational_cost_transactions] CHECK CONSTRAINT [operational_cost_transactions_source_type_ck];

ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_unit_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK ADD CONSTRAINT [operational_cost_transactions_unit_ck] CHECK
(
  [unit] IN (N'PACK', N'UNIT', N'KG', N'TON', N'LITER', N'BATCH', N'HOUR', N'MINUTE', N'AMOUNT')
);
ALTER TABLE [dbo].[operational_cost_transactions] CHECK CONSTRAINT [operational_cost_transactions_unit_ck];

ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_rate_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK ADD CONSTRAINT [operational_cost_transactions_rate_ck] CHECK
(
  [rate] > (0) OR
  ([entryRole] = N'REVERSAL' AND [rate] = (0)) OR
  ([entryRole] = N'PRIMARY_COST' AND [costNature] = N'ACTUAL' AND [eventType] = N'MATERIAL' AND [rate] = (0)) OR
  ([entryRole] = N'PRIMARY_COST' AND [costNature] = N'MANUAL_ASSERTED_ACTUAL'
    AND [eventType] = N'LABOR' AND [sourceType] = N'MAINTENANCE_WORK_ORDER_COST_ENTRY'
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
  ([entryRole] IS NULL AND (([status] = N'POSTED' AND [quantity] > (0)) OR ([status] = N'REVERSED' AND [quantity] < (0))))
);
ALTER TABLE [dbo].[operational_cost_transactions] CHECK CONSTRAINT [operational_cost_transactions_quantity_sign_ck];

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
