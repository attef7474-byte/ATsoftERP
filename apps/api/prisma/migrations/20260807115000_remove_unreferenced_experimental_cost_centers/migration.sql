SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- Phase 2 Batch 2A — owner-authorized cleanup of five experimental legacy
-- CostCenter rows before the stage-C tenant gate.
--
-- These exact rows were already soft-deleted, have no deterministic tenant
-- owner, and were proven to have no operational references. The owner
-- confirmed on 2026-08-08 that all application data is experimental and
-- authorized the safe remediation needed to complete Phase 2.
--
-- This migration deliberately does NOT guess a company, weaken the required
-- CostCenter.companyId contract, or delete audit_logs. It is fail-closed: a
-- row is deleted only when its exact id/code still identifies a soft-deleted,
-- tenant-null record and every possible CostCenter reference is absent.
-- Other environments remain safe: missing ids are a no-op, while any other
-- unresolved CostCenter is still blocked by the following stage-C gate.

DECLARE @experimentalTargets TABLE (
  [id]   NVARCHAR(1000) NOT NULL PRIMARY KEY,
  [code] NVARCHAR(1000) NOT NULL
);

INSERT INTO @experimentalTargets ([id], [code]) VALUES
  (N'cmrx06j2o000cqw95jk9u5hn0', N'DEVELOPMENT-GENERAL'),
  (N'cmrx06j2d000bqw95et4s2a4q', N'PROJECTS-GENERAL'),
  (N'cmrx06j3a000eqw953y4z1h46', N'QUALITY-GENERAL'),
  (N'cmrx0rf4v00043895lpz9hn2q', N'Updated CC PW 1784783977687'),
  (N'cmrx06j2z000dqw95og2c67kp', N'UTILITIES-GENERAL');

-- Never act when an expected id has been repurposed or restored to live use.
IF EXISTS (
  SELECT 1
  FROM [dbo].[cost_centers] cc
  JOIN @experimentalTargets t ON t.[id] = cc.[id]
  WHERE cc.[code] <> t.[code]
     OR cc.[deletedAt] IS NULL
)
  THROW 51011, N'Experimental CostCenter cleanup blocked: a target id/code no longer identifies the expected soft-deleted row.', 1;

-- Never delete a target that has gained an operational or hierarchy reference.
IF EXISTS (
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[cost_centers] child ON child.[parentId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[production_lines] x ON x.[costCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[machines] x ON x.[defaultCostCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[maintenance_requests] x ON x.[costCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[production_product_definitions] x ON x.[defaultCostCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[production_orders] x ON x.[costCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[production_runs] x ON x.[costCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[production_quality_plans] x ON x.[costCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[production_inspections] x ON x.[costCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[operational_cost_rates] x ON x.[costCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[operational_standard_cost_snapshots] x ON x.[costCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[operational_cost_transactions] x ON x.[costCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
  UNION ALL
  SELECT 1 FROM [dbo].[cost_centers] cc JOIN @experimentalTargets t ON t.[id] = cc.[id]
    JOIN [dbo].[operational_cost_center_assignments] x ON x.[costCenterId] = cc.[id]
    WHERE cc.[companyId] IS NULL
)
  THROW 51012, N'Experimental CostCenter cleanup blocked: a target row has an operational or hierarchy reference.', 1;

DELETE cc
FROM [dbo].[cost_centers] cc
JOIN @experimentalTargets t ON t.[id] = cc.[id] AND t.[code] = cc.[code]
WHERE cc.[companyId] IS NULL
  AND cc.[deletedAt] IS NOT NULL;

DECLARE @deletedCount INT = @@ROWCOUNT;
PRINT N'[2A experimental cleanup] Soft-deleted, unreferenced tenant-null CostCenters removed: ' + CAST(@deletedCount AS NVARCHAR(20));

IF EXISTS (
  SELECT 1
  FROM [dbo].[cost_centers] cc
  JOIN @experimentalTargets t ON t.[id] = cc.[id]
  WHERE cc.[companyId] IS NULL
)
  THROW 51013, N'Experimental CostCenter cleanup postcondition failed: a targeted tenant-null row remains.', 1;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
