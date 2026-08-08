SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- Phase 2 Batch 2A — stage B (tenant-ownership backfill).
-- Populates CostCenter.companyId where it is currently NULL using ONLY
-- authoritative FK relations (the tables below reference cost_centers.id and
-- carry their own tenant companyId). Rows whose references are absent or point
-- to more than one company are left NULL and reported — NEVER guessed.
-- The report printed at the end of this migration is the input to the stage C
-- gate: stage C must remain unapplied while any cost_center row still has a
-- NULL companyId or any (companyId, code) / cross-tenant hierarchy violation
-- exists.

-- Collect every authoritative (cost_center, company) pair from live referencing rows.
IF OBJECT_ID(N'tempdb..#cc_tenant_candidates') IS NOT NULL DROP TABLE #cc_tenant_candidates;

SELECT src.costCenterId, src.companyId
INTO #cc_tenant_candidates
FROM (
    SELECT [costCenterId], [companyId] FROM [dbo].[production_orders] WHERE [costCenterId] IS NOT NULL AND [companyId] IS NOT NULL AND [deletedAt] IS NULL
    UNION ALL
    SELECT [costCenterId], [companyId] FROM [dbo].[production_runs] WHERE [costCenterId] IS NOT NULL AND [companyId] IS NOT NULL AND [deletedAt] IS NULL
    UNION ALL
    SELECT [costCenterId], [companyId] FROM [dbo].[production_lines] WHERE [costCenterId] IS NOT NULL AND [companyId] IS NOT NULL AND [deletedAt] IS NULL
    UNION ALL
    SELECT [defaultCostCenterId], [companyId] FROM [dbo].[machines] WHERE [defaultCostCenterId] IS NOT NULL AND [companyId] IS NOT NULL AND [deletedAt] IS NULL
    UNION ALL
    SELECT [defaultCostCenterId], [companyId] FROM [dbo].[production_product_definitions] WHERE [defaultCostCenterId] IS NOT NULL AND [companyId] IS NOT NULL AND [deletedAt] IS NULL
    UNION ALL
    SELECT [costCenterId], [companyId] FROM [dbo].[production_quality_plans] WHERE [costCenterId] IS NOT NULL AND [companyId] IS NOT NULL AND [deletedAt] IS NULL
    UNION ALL
    SELECT [costCenterId], [companyId] FROM [dbo].[production_inspections] WHERE [costCenterId] IS NOT NULL AND [companyId] IS NOT NULL AND [deletedAt] IS NULL
    UNION ALL
    SELECT [costCenterId], [companyId] FROM [dbo].[operational_cost_rates] WHERE [costCenterId] IS NOT NULL AND [companyId] IS NOT NULL AND [deletedAt] IS NULL
    UNION ALL
    SELECT [costCenterId], [companyId] FROM [dbo].[operational_standard_cost_snapshots] WHERE [costCenterId] IS NOT NULL AND [companyId] IS NOT NULL AND [deletedAt] IS NULL
    UNION ALL
    SELECT [costCenterId], [companyId] FROM [dbo].[operational_cost_transactions] WHERE [costCenterId] IS NOT NULL AND [companyId] IS NOT NULL
) AS src;

-- Backfill only rows whose references agree on exactly one company.
UPDATE [dbo].[cost_centers]
SET [companyId] = t.[companyId]
FROM [dbo].[cost_centers] cc
JOIN (
    SELECT [costCenterId], MIN([companyId]) AS [companyId]
    FROM #cc_tenant_candidates
    GROUP BY [costCenterId]
    HAVING COUNT(DISTINCT [companyId]) = 1
) t ON t.[costCenterId] = cc.[id]
WHERE cc.[companyId] IS NULL;

-- ── Backfill report (inspect-only; stage C gate input) ─────────────
DECLARE @backfilled INT = (SELECT COUNT(*) FROM [dbo].[cost_centers] WHERE [companyId] IS NOT NULL);

PRINT N'[2A stage B] Cost centers with a companyId after backfill: ' + CAST(@backfilled AS NVARCHAR(20));

DECLARE @unresolved INT = (SELECT COUNT(*) FROM [dbo].[cost_centers] WHERE [companyId] IS NULL);
PRINT N'[2A stage B] Cost centers still unresolved (no companyId): ' + CAST(@unresolved AS NVARCHAR(20));

PRINT N'[2A stage B] Unresolved rows without any authoritative reference (report only, left untouched):';
SELECT cc.[id], cc.[code], cc.[name]
FROM [dbo].[cost_centers] cc
WHERE cc.[companyId] IS NULL
  AND NOT EXISTS (SELECT 1 FROM #cc_tenant_candidates c WHERE c.[costCenterId] = cc.[id]);

PRINT N'[2A stage B] Unresolved rows whose references disagree across companies (report only, left untouched):';
SELECT [costCenterId], COUNT(DISTINCT [companyId]) AS [companyCount], COUNT(*) AS [referenceCount]
FROM #cc_tenant_candidates
WHERE [costCenterId] IN (SELECT [id] FROM [dbo].[cost_centers] WHERE [companyId] IS NULL)
GROUP BY [costCenterId]
HAVING COUNT(DISTINCT [companyId]) > 1;

PRINT N'[2A stage B] Rows whose existing companyId disagrees with an authoritative reference (report only):';
SELECT cc.[id], cc.[code], cc.[companyId] AS [storedCompanyId], src.[companyId] AS [referencingCompanyId]
FROM [dbo].[cost_centers] cc
JOIN (
    SELECT [costCenterId], MIN([companyId]) AS [companyId]
    FROM #cc_tenant_candidates
    GROUP BY [costCenterId]
) src ON src.[costCenterId] = cc.[id]
WHERE cc.[companyId] IS NOT NULL AND cc.[companyId] <> src.[companyId];

PRINT N'[2A stage B] Duplicate (companyId, code) pairs that would violate the stage C unique key:';
SELECT [companyId], [code], COUNT(*) AS [rowCount]
FROM [dbo].[cost_centers]
WHERE [companyId] IS NOT NULL
GROUP BY [companyId], [code]
HAVING COUNT(*) > 1;

PRINT N'[2A stage B] Cross-tenant hierarchy pairs (parent/child company mismatch) that would violate the stage C gate:';
SELECT c.[id] AS [childId], c.[code] AS [childCode], c.[companyId] AS [childCompanyId], p.[id] AS [parentId], p.[code] AS [parentCode], p.[companyId] AS [parentCompanyId]
FROM [dbo].[cost_centers] c
JOIN [dbo].[cost_centers] p ON p.[id] = c.[parentId]
WHERE c.[companyId] IS NOT NULL AND p.[companyId] IS NOT NULL AND c.[companyId] <> p.[companyId];

DROP TABLE #cc_tenant_candidates;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
