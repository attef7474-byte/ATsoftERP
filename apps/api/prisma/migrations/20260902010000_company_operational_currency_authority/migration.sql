BEGIN TRY
BEGIN TRAN;

-- COST-R1A-C: one explicitly configured operational ledger currency per company.
-- The column is deliberately nullable and has no default or data backfill:
-- existing companies continue legacy non-ledger operations until an authorized
-- administrator explicitly selects an ISO-4217 currency.
ALTER TABLE [dbo].[companies]
  ADD [operationalCurrencyCode] NVARCHAR(3) NULL;

-- Database normalization guard. Full ISO-4217 membership is enforced by the API
-- validator; this trusted CHECK prevents lowercase, whitespace, or malformed codes
-- from bypassing the application contract through another database client.
--
-- The constraint is created through dynamic SQL so the CHECK expression is
-- compiled AFTER the added column exists in the same transaction. Referencing a
-- column added earlier in the same batch from a static CHECK constraint fails
-- with "invalid column name" under deferred name resolution; dynamic SQL avoids
-- that while keeping the whole migration atomic inside one transaction.
EXEC(N'
  ALTER TABLE [dbo].[companies] WITH CHECK ADD CONSTRAINT [companies_operationalCurrencyCode_ck]
    CHECK (
      [operationalCurrencyCode] IS NULL
      OR (
        LEN([operationalCurrencyCode]) = 3
        AND [operationalCurrencyCode] COLLATE Latin1_General_100_BIN2 NOT LIKE N''%[^A-Z]%''
      )
    );
');
ALTER TABLE [dbo].[companies] CHECK CONSTRAINT [companies_operationalCurrencyCode_ck];

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
