SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- Phase 2 Batch 2A — stage C (tenant gate + tenant-scoped uniqueness).
-- APPLIES ONLY WHEN THE STAGE B GATE PASSES. The guards below abort this
-- migration (full rollback, DB left at stage B state) if ANY of the following
-- still holds:
--   1. a cost_centers row has a NULL companyId (unresolved tenant ownership),
--   2. a (companyId, code) pair is duplicated (would violate the new key),
--   3. a parent/child cost center pair crosses company boundaries,
--   4. a cost center is its own parent.
-- After passing the gates this migration: makes companyId NOT NULL, drops the
-- global code uniqueness and replaces it with tenant-scoped uniqueness
-- (companyId, code). All other indexes already exist and are preserved.

IF EXISTS (SELECT 1 FROM [dbo].[cost_centers] WHERE [companyId] IS NULL)
    THROW 51001, N'2A stage C gate failed: cost_centers rows still have a NULL companyId. Backfill stage B is unresolved; do not apply stage C.', 1;

IF EXISTS (
    SELECT 1 FROM [dbo].[cost_centers]
    GROUP BY [companyId], [code]
    HAVING COUNT(*) > 1
)
    THROW 51002, N'2A stage C gate failed: duplicate (companyId, code) pairs exist. Resolve them before applying stage C.', 1;

IF EXISTS (
    SELECT 1
    FROM [dbo].[cost_centers] c
    JOIN [dbo].[cost_centers] p ON p.[id] = c.[parentId]
    WHERE c.[companyId] <> p.[companyId]
)
    THROW 51003, N'2A stage C gate failed: cross-tenant cost center hierarchy exists. Resolve before applying stage C.', 1;

IF EXISTS (SELECT 1 FROM [dbo].[cost_centers] WHERE [parentId] = [id])
    THROW 51004, N'2A stage C gate failed: a cost center is its own parent. Resolve before applying stage C.', 1;

-- SQL Server does not permit changing column nullability while indexes depend
-- on that column. Drop only the three known supporting indexes inside this
-- transaction and recreate them immediately after the ALTER.
DROP INDEX [cost_centers_companyId_idx] ON [dbo].[cost_centers];
DROP INDEX [cost_centers_companyId_status_idx] ON [dbo].[cost_centers];
DROP INDEX [cost_centers_companyId_parentId_status_idx] ON [dbo].[cost_centers];

-- Tenant ownership becomes mandatory.
ALTER TABLE [dbo].[cost_centers] ALTER COLUMN [companyId] NVARCHAR(1000) NOT NULL;

CREATE NONCLUSTERED INDEX [cost_centers_companyId_idx] ON [dbo].[cost_centers]([companyId]);
CREATE NONCLUSTERED INDEX [cost_centers_companyId_status_idx] ON [dbo].[cost_centers]([companyId], [status]);
CREATE NONCLUSTERED INDEX [cost_centers_companyId_parentId_status_idx] ON [dbo].[cost_centers]([companyId], [parentId], [status]);

-- Replace global code uniqueness with tenant-scoped uniqueness.
ALTER TABLE [dbo].[cost_centers] DROP CONSTRAINT [cost_centers_code_key];
ALTER TABLE [dbo].[cost_centers] ADD CONSTRAINT [cost_centers_companyId_code_key] UNIQUE NONCLUSTERED ([companyId], [code]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
