-- COST-R1B Unified Cost Ledger foundation (additive, nullable).
-- Existing-data impact: additive only; no existing row is altered or deleted.
-- No backfill, no destructive DDL, no currency defaults. All new columns are
-- NULL for legacy rows; canonical ledger entries fully populate them.
--
-- 1. OperationalCostTransaction: 8 additive canonical dimensions:
--    costNature, costPurpose, entryRole (ledger semantic authority),
--    sourceLineId (line-level source identity), postedAt, departmentId,
--    maintenanceWorkOrderId, maintenanceRequestId.
-- 2. Two SQL Server filtered unique idempotency indexes:
--    - per (tenant, sourceType, sourceId, sourceLineId) for PRIMARY_COST lines,
--    - sourceFingerprint index already exists; the line-level index closes the
--      gap for line-scoped material sources that never carry a sourceFingerprint.
-- 3. Non-clustered query indexes matching the Prisma schema.

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- ============ OperationalCostTransaction canonical dimensions ============
ALTER TABLE [dbo].[operational_cost_transactions] ADD [costNature] NVARCHAR(1000);
ALTER TABLE [dbo].[operational_cost_transactions] ADD [costPurpose] NVARCHAR(1000);
ALTER TABLE [dbo].[operational_cost_transactions] ADD [entryRole] NVARCHAR(1000);
ALTER TABLE [dbo].[operational_cost_transactions] ADD [sourceLineId] NVARCHAR(1000);
ALTER TABLE [dbo].[operational_cost_transactions] ADD [postedAt] DATETIME2;
ALTER TABLE [dbo].[operational_cost_transactions] ADD [departmentId] NVARCHAR(1000);
ALTER TABLE [dbo].[operational_cost_transactions] ADD [maintenanceWorkOrderId] NVARCHAR(1000);
ALTER TABLE [dbo].[operational_cost_transactions] ADD [maintenanceRequestId] NVARCHAR(1000);

-- SQL Server compiles a batch before ALTER-added columns are visible; the FK +
-- index statements for the three new relations must run in a dynamic batch.
EXEC sys.sp_executesql N'
ALTER TABLE [dbo].[operational_cost_transactions] ADD CONSTRAINT [operational_cost_transactions_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[operational_cost_transactions] ADD CONSTRAINT [operational_cost_transactions_maintenanceWorkOrderId_fkey] FOREIGN KEY ([maintenanceWorkOrderId]) REFERENCES [dbo].[maintenance_work_orders] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[operational_cost_transactions] ADD CONSTRAINT [operational_cost_transactions_maintenanceRequestId_fkey] FOREIGN KEY ([maintenanceRequestId]) REFERENCES [dbo].[maintenance_requests] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [operational_cost_transactions_departmentId_idx] ON [dbo].[operational_cost_transactions] ([departmentId]);
CREATE NONCLUSTERED INDEX [operational_cost_transactions_maintenanceWorkOrderId_idx] ON [dbo].[operational_cost_transactions] ([maintenanceWorkOrderId]);
CREATE NONCLUSTERED INDEX [operational_cost_transactions_maintenanceRequestId_idx] ON [dbo].[operational_cost_transactions] ([maintenanceRequestId]);

-- Line-level idempotency: at most one live PRIMARY_COST entry per
-- (tenant, source type, source id, source line). Filters keep the index live-only
-- so a corrected re-valuation is allowed after its reversal while a concurrent
-- duplicate source event is prevented at the database. A REVERSAL row carries
-- entryRole = N''REVERSAL'' and never collides with a PRIMARY_COST row.
CREATE UNIQUE NONCLUSTERED INDEX [operational_cost_transactions_canonical_line_key]
  ON [dbo].[operational_cost_transactions] ([companyId],[branchId],[sourceType],[sourceId],[sourceLineId],[entryRole])
  WHERE [sourceLineId] IS NOT NULL AND [entryRole] = N''PRIMARY_COST'' AND [status] = N''POSTED'' AND [reversedAt] IS NULL;
';

-- Query indexes matching the Prisma schema (COST-R1B).
CREATE NONCLUSTERED INDEX [operational_cost_transactions_tenant_canonsource_line_idx] ON [dbo].[operational_cost_transactions] ([companyId], [branchId], [sourceType], [sourceId], [sourceLineId]);
CREATE NONCLUSTERED INDEX [operational_cost_transactions_tenant_nature_time_idx] ON [dbo].[operational_cost_transactions] ([companyId], [branchId], [costNature], [occurredAt]);
CREATE NONCLUSTERED INDEX [operational_cost_transactions_tenant_purpose_time_idx] ON [dbo].[operational_cost_transactions] ([companyId], [branchId], [costPurpose], [occurredAt]);
CREATE NONCLUSTERED INDEX [operational_cost_transactions_tenant_role_time_idx] ON [dbo].[operational_cost_transactions] ([companyId], [branchId], [entryRole], [occurredAt]);
CREATE NONCLUSTERED INDEX [operational_cost_transactions_tenant_posted_idx] ON [dbo].[operational_cost_transactions] ([companyId], [branchId], [postedAt]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
