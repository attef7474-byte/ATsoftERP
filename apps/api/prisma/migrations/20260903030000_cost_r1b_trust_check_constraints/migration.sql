-- COST-R1B-B3 final DB trust: re-trust existing CHECK constraints.
-- PURPOSE / PROVENANCE: Migrations 20260903010000 (legacy check repair) and
-- 20260903020000 (rate_ck reversal zero-rate) re-created five CHECK constraints
-- on [dbo].[operational_cost_transactions] using `WITH NOCHECK`, which leaves them
-- marked `is_not_trusted = 1`. The table is currently EMPTY (verified count = 0),
-- so there is no existing business data to convert. This additive migration
-- re-trusts those constraints with SQL Server's proper `WITH CHECK CHECK CONSTRAINT`
-- pattern, which validates existing rows (none) and marks the constraints trusted.
--
-- Requirements honored:
--   - No edit to 010000 or 020000 (they remain immutable).
--   - No constraint recreation of business logic; trust restored directly.
--   - No constraint disabled.
--   - No WITH NOCHECK.
--   - Definitions are NOT changed, only the trust flag.
--
-- Five constraints re-trusted:
--   rate_ck, amount_sign_ck, quantity_sign_ck, reversal_link_ck, source_type_ck

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK CHECK CONSTRAINT [operational_cost_transactions_rate_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK CHECK CONSTRAINT [operational_cost_transactions_amount_sign_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK CHECK CONSTRAINT [operational_cost_transactions_quantity_sign_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK CHECK CONSTRAINT [operational_cost_transactions_reversal_link_ck];
ALTER TABLE [dbo].[operational_cost_transactions] WITH CHECK CHECK CONSTRAINT [operational_cost_transactions_source_type_ck];

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
