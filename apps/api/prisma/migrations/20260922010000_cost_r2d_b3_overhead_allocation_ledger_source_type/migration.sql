-- COST-R2D-B3: canonical overhead-allocation ledger posting source vocabulary.
--
-- Existing-data impact: constraint-only additive vocabulary extension. No row is
-- inserted, updated, deleted or backfilled. Every existing sourceType value is
-- preserved exactly. The single new value N'OVERHEAD_ALLOCATION_LINE' allows the
-- B3 adapter (sourceType OVERHEAD_ALLOCATION_LINE, sourceId = allocation id,
-- sourceLineId = allocation line id) to write canonical PRIMARY_COST/REVERSAL
-- entries through the existing Unified Cost Ledger writer. The generic public
-- posting DTO is unchanged and does NOT accept this value.
--
-- Recovery: every constraint replacement is inside one transaction. Any failure
-- rolls the complete migration back. The CHECK is recreated WITH CHECK and
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
    N'INVENTORY_MOVEMENT_LINE', N'DOWNTIME_EVENT', N'MAINTENANCE_WORK_ORDER_COST_ENTRY',
    N'OVERHEAD_ALLOCATION_LINE'
  )
);
ALTER TABLE [dbo].[operational_cost_transactions] CHECK CONSTRAINT [operational_cost_transactions_source_type_ck];

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;