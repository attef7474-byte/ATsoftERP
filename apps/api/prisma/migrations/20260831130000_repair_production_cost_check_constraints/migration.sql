BEGIN TRY
BEGIN TRAN;

-- Production Cost Database Contract Repair R1.
--
-- Background / defect:
--   The backend contract (production-cost.constants.ts) legitimately supports
--   DOWNTIME as a COST_TYPES / COST_TRANSACTION_SOURCE_TYPES value and BRANCH as a
--   COST_CALCULATION_SCOPE_TYPES value. The SQL Server CHECK constraints shipped in
--   the historical additive migrations were stricter and rejected those values,
--   causing source-to-database drift (SOURCE_DB_DRIFT = CONFIRMED).
--
-- This migration repairs exactly five stale CHECK constraints so the LIVE database
-- contract matches the already-implemented backend contract. No redesign of
-- production costing, no model change, no data rewrite, and no privilege change.
--
-- Constraint replacement strategy:
--   - Each stale constraint is DROPPED and recreated WITH THE SAME canonical name so
--     no duplicate/ambiguous constraint metadata is introduced.
--   - Recreation uses `WITH CHECK ADD CONSTRAINT` and `CHECK CONSTRAINT ...` which
--     guarantees the new constraint is both ENABLED and TRUSTED (no WITH NOCHECK).
--   - All existing data (zero rows at time of repair) and any future rows that carry
--     values in the original subsets remain valid because the target value sets are
--     strict supersets of the previously allowed sets. No BACKFILL is required.
--
-- Recovery: the transaction rolls back every object if any statement fails.

-- A. operational_cost_rates.costType -> + DOWNTIME
ALTER TABLE [dbo].[operational_cost_rates] DROP CONSTRAINT [operational_cost_rates_cost_type_ck];
ALTER TABLE [dbo].[operational_cost_rates] WITH CHECK ADD CONSTRAINT [operational_cost_rates_cost_type_ck]
  CHECK ([costType] IN (N'MATERIAL', N'LABOR', N'MACHINE', N'OVERHEAD', N'DOWNTIME'));
ALTER TABLE [dbo].[operational_cost_rates] CHECK CONSTRAINT [operational_cost_rates_cost_type_ck];

-- B. operational_standard_cost_snapshots.costType -> + DOWNTIME
ALTER TABLE [dbo].[operational_standard_cost_snapshots] DROP CONSTRAINT [operational_standard_cost_snapshots_cost_type_ck];
ALTER TABLE [dbo].[operational_standard_cost_snapshots] WITH CHECK ADD CONSTRAINT [operational_standard_cost_snapshots_cost_type_ck]
  CHECK ([costType] IN (N'MATERIAL', N'LABOR', N'MACHINE', N'OVERHEAD', N'DOWNTIME'));
ALTER TABLE [dbo].[operational_standard_cost_snapshots] CHECK CONSTRAINT [operational_standard_cost_snapshots_cost_type_ck];

-- C. operational_cost_transactions.eventType -> + DOWNTIME
ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_event_type_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK ADD CONSTRAINT [operational_cost_transactions_event_type_ck]
  CHECK ([eventType] IN (N'MATERIAL', N'LABOR', N'MACHINE', N'OVERHEAD', N'DOWNTIME'));
ALTER TABLE [dbo].[operational_cost_transactions] CHECK CONSTRAINT [operational_cost_transactions_event_type_ck];

-- D. operational_cost_transactions.sourceType -> + DOWNTIME
ALTER TABLE [dbo].[operational_cost_transactions] DROP CONSTRAINT [operational_cost_transactions_source_type_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK ADD CONSTRAINT [operational_cost_transactions_source_type_ck]
  CHECK ([sourceType] IN (N'PRODUCTION_ORDER', N'PRODUCTION_RUN', N'OUTPUT_EVENT', N'FG_RECEIPT', N'MATERIAL_DOCUMENT', N'QUALITY_DISPOSITION', N'DOWNTIME', N'REVERSAL', N'MANUAL'));
ALTER TABLE [dbo].[operational_cost_transactions] CHECK CONSTRAINT [operational_cost_transactions_source_type_ck];

-- E. operational_cost_calculations.scopeType -> + BRANCH
ALTER TABLE [dbo].[operational_cost_calculations] DROP CONSTRAINT [operational_cost_calculations_scope_type_ck];
ALTER TABLE [dbo].[operational_cost_calculations] WITH CHECK ADD CONSTRAINT [operational_cost_calculations_scope_type_ck]
  CHECK ([scopeType] IN (N'BRANCH', N'ORDER', N'RUN'));
ALTER TABLE [dbo].[operational_cost_calculations] CHECK CONSTRAINT [operational_cost_calculations_scope_type_ck];

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
