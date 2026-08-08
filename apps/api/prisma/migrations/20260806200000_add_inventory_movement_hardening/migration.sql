-- Phase 2 operational deepening — InventoryMovement posting hardening
-- Additive only: tenant-scoped idempotency key + reversal self-reference.
--
-- NOTE: idempotency uniqueness is a SQL Server FILTERED unique index (WHERE
-- [requestId] IS NOT NULL). A plain unique constraint on a nullable column would
-- permit only ONE NULL requestId per (companyId, branchId), breaking every legacy
-- movement that has no requestId. The filtered index enforces at most one committed
-- row per (companyId, branchId, requestId) while leaving NULL requestIds untouched.

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- AlterTable: add the tenant-scoped idempotency token.
ALTER TABLE [dbo].[inventory_movements] ADD [requestId] NVARCHAR(1000);

-- AlterTable: add the reversal self-reference (points at the compensated movement).
ALTER TABLE [dbo].[inventory_movements] ADD [reversesMovementId] NVARCHAR(1000);

-- SQL Server compiles index/FK statements against this pre-existing table
-- before the preceding ALTER TABLE statements have added the new columns.
-- Compile all consumers only after requestId/reversesMovementId exist.
EXEC sys.sp_executesql N'
CREATE UNIQUE NONCLUSTERED INDEX [inventory_movements_companyId_branchId_requestId_key]
  ON [dbo].[inventory_movements] ([companyId],[branchId],[requestId])
  WHERE [requestId] IS NOT NULL;

ALTER TABLE [dbo].[inventory_movements] ADD CONSTRAINT [inventory_movements_reversesMovementId_fkey] FOREIGN KEY ([reversesMovementId]) REFERENCES [dbo].[inventory_movements] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [inventory_movements_reversesMovementId_idx] ON [dbo].[inventory_movements] ([reversesMovementId]);
';

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
