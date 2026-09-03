-- COST-R1B-B2 follow-up corrective migration: rate_ck reversal zero-rate contract.
-- PURPOSE / PROVENANCE: The applied migration 20260903010000_cost_r1b_b2_legacy_check_repair
-- is immutable. Its original applied `rate_ck` (recorded checksum d7b89fec...) allowed
-- rate = 0 ONLY for canonical PRIMARY_COST + ACTUAL + MATERIAL. A real-path live proof
-- showed a canonical material REVERSAL legitimately INHERITS the original material's
-- rate of 0 and was therefore blocked by that constraint. The correction is represented
-- HERE as a NEW migration, never by editing the applied migration history.
--
-- Final rate contract (rate_ck):
--   - rate > 0 generally;
--   - canonical ACTUAL material PRIMARY_COST: rate = 0 ALLOWED (amount authority = totalCost);
--   - canonical material REVERSAL: inherited rate = 0 ALLOWED;
--   - RATE_DERIVED downtime: rate > 0 REQUIRED.
-- No global weakening; no business rows are modified.
--
-- This migration is idempotent/guarded: it drops the constraint only if present and
-- re-creates it with the final canonical definition, regardless of whether the live
-- constraint currently carries the manual ALTER (from the interim state) or the strict
-- original definition. Safe against the currently-correct live state and on a fresh DB.

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

IF OBJECT_ID(N'dbo.operational_cost_transactions_rate_ck') IS NOT NULL
  ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_rate_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH NOCHECK ADD CONSTRAINT [operational_cost_transactions_rate_ck] CHECK
(
  [rate]>(0) OR
  ([entryRole]=N'REVERSAL' AND [rate]=(0)) OR
  ([entryRole]=N'PRIMARY_COST' AND [costNature]=N'ACTUAL' AND [eventType]=N'MATERIAL' AND [rate]=(0))
);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;

