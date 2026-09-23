-- REPAIR-D2B: align audit_logs.details storage with the declared Prisma model.
--
-- The AuditLog model declares `details String?` (nvarchar(max)); the column was
-- physically created NVARCHAR(1000) in 20260714042111_init_core_foundation.
-- Business PATCH audits (e.g. ProductionOrder UPDATE) persist previous AND new
-- snapshots as a single JSON document. Measured full-order UPDATE payloads reach
-- ~1220 characters, which exceeds NVARCHAR(1000) and caused
-- "String or binary data would be truncated." This migration widens the column
-- to NVARCHAR(MAX) only — no row is inserted, updated or deleted, and no
-- existing details value is truncated (largest recorded LEN is far below 1000).
--
-- Recovery: the statement is atomic and idempotent; rerunning it after it has
-- already applied is a no-op.

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[audit_logs] ALTER COLUMN [details] NVARCHAR(MAX) NULL;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;