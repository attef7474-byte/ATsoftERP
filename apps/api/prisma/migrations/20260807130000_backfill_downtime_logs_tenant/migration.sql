-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 DB baseline remediation — downtime_logs tenant-ownership backfill
-- ─────────────────────────────────────────────────────────────────────────────
-- PURPOSE
--   Backfill authoritative multi-company tenant ownership (companyId, branchId)
--   on legacy dbo.downtime_logs rows that are still NULL after migration
--   20260806000000_add_production_losses_downtime added the nullable tenant
--   columns. Tenant isolation is a mandatory security boundary (AGENTS.md §3);
--   NULL-tenant rows on a live table violate that boundary for every scoped
--   read/update/search/report on those rows.
--
-- AUTHORITATIVE TENANT SOURCE (single source of truth, never guessed)
--   downtime_logs.machineId -> machines.id -> machines.companyId / machines.branchId
--   No client-supplied identifier is ever used. Rows whose machine cannot
--   resolve a deterministic tenant are rejected, never guessed.
--
-- EXISTING-DATA IMPACT
--   UPDATE-only backfill. Only rows requiring tenant backfill (companyId IS NULL
--   OR branchId IS NULL) are touched; already-resolved rows are preserved via
--   COALESCE and are never overwritten. No table, column, constraint, index or
--   other row is created, altered, dropped or deleted.
--
-- FAIL-CLOSED BEHAVIOR
--   This migration aborts with a full transaction rollback if ANY precondition
--   or postcondition fails (see numbered guards below). It never partially
--   migrates: BEGIN TRAN / COMMIT wrapped in BEGIN TRY / BEGIN CATCH with
--   ROLLBACK + THROW.
--
-- ROLLBACK / RECOVERY
--   1. If this migration fails before COMMIT, the enclosing transaction rolls
--      back automatically; the database is left at the pre-migration state.
--   2. After a successful committed deployment, the authoritative recovery
--      path is the pre-deployment verified SQL Server backup (phase-2 baseline
--      apply window). Manually nulling tenant fields after deployment is NOT a
--      primary recovery strategy.
--
-- TENANT IMPACT
--   Rows receive the tenant of their authoritative machine. Deterministic,
--   auditable, idempotent: re-running after full resolution is a no-op.
--
-- RUNTIME COMPATIBILITY
--   SQL Server only (provider = mssql). Explicit [dbo] references. Requires the
--   columns added by 20260806000000_add_production_losses_downtime to exist, so
--   this migration must be dated after it in the deploy order.
--
-- DEPENDENCY
--   20260806000000_add_production_losses_downtime (adds nullable companyId,
--   branchId to dbo.downtime_logs and the production reference columns).
-- ─────────────────────────────────────────────────────────────────────────────

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- ── Precondition 1 — machine must resolve a deterministic tenant ──────────────
-- Every downtime_logs row requiring tenant backfill (companyId IS NULL OR
-- branchId IS NULL) must have an existing machine that itself carries both a
-- non-null companyId and a non-null branchId. Any missing machine or missing
-- machine tenant aborts the migration (fail-closed).
IF EXISTS (
    SELECT 1
    FROM [dbo].[downtime_logs] dl
    LEFT JOIN [dbo].[machines] m ON m.[id] = dl.[machineId]
    WHERE (dl.[companyId] IS NULL OR dl.[branchId] IS NULL)
      AND (m.[id] IS NULL OR m.[companyId] IS NULL OR m.[branchId] IS NULL)
)
    THROW 51101, N'downtime_logs tenant backfill aborted: a row requiring tenant backfill has no resolvable machine tenant (machine missing or machine companyId/branchId NULL). Resolve before deploying.', 1;

-- ── Precondition 2 — branch/company integrity ────────────────────────────────
-- For every candidate machine used as a tenant source, the referenced branch
-- must exist and must belong to the machine's company. A missing branch or a
-- branch belonging to a different company aborts the migration.
IF EXISTS (
    SELECT 1
    FROM [dbo].[downtime_logs] dl
    JOIN [dbo].[machines] m ON m.[id] = dl.[machineId]
    LEFT JOIN [dbo].[branches] b ON b.[id] = m.[branchId]
    WHERE (dl.[companyId] IS NULL OR dl.[branchId] IS NULL)
      AND m.[companyId] IS NOT NULL
      AND m.[branchId] IS NOT NULL
      AND (b.[id] IS NULL OR b.[companyId] <> m.[companyId])
)
    THROW 51102, N'downtime_logs tenant backfill aborted: a candidate machine references a missing branch or a branch owned by a different company. Resolve before deploying.', 1;

-- ── Precondition 3 — existing tenant conflict ─────────────────────────────────
-- Never overwrite a previously resolved tenant value that conflicts with the
-- machine-derived tenant. Any existing non-null companyId/branchId that differs
-- from the machine's tenant aborts the migration.
IF EXISTS (
    SELECT 1
    FROM [dbo].[downtime_logs] dl
    JOIN [dbo].[machines] m ON m.[id] = dl.[machineId]
    WHERE m.[companyId] IS NOT NULL
      AND m.[branchId] IS NOT NULL
      AND (
        (dl.[companyId] IS NOT NULL AND dl.[companyId] <> m.[companyId])
        OR (dl.[branchId] IS NOT NULL AND dl.[branchId] <> m.[branchId])
      )
)
    THROW 51103, N'downtime_logs tenant backfill aborted: an existing downtime_logs tenant conflicts with its machine-derived tenant. Do not overwrite resolved ownership; resolve before deploying.', 1;

-- ── Precondition 4 — production-context conflict ──────────────────────────────
-- Where a downtime_logs row carries production references, the referenced
-- production context must not contradict the machine-derived tenant. A missing
-- referenced row, or a referenced production_run/production_order/
-- production_line belonging to a different company/branch, aborts the migration.
IF EXISTS (
    SELECT 1
    FROM [dbo].[downtime_logs] dl
    JOIN [dbo].[machines] m ON m.[id] = dl.[machineId]
    LEFT JOIN [dbo].[production_runs] pr ON pr.[id] = dl.[productionRunId]
    LEFT JOIN [dbo].[production_orders] po ON po.[id] = dl.[productionOrderId]
    LEFT JOIN [dbo].[production_lines] pl ON pl.[id] = dl.[productionLineId]
    WHERE m.[companyId] IS NOT NULL
      AND m.[branchId] IS NOT NULL
      AND (
        (dl.[productionRunId] IS NOT NULL AND (pr.[id] IS NULL OR pr.[companyId] <> m.[companyId] OR pr.[branchId] <> m.[branchId]))
        OR (dl.[productionOrderId] IS NOT NULL AND (po.[id] IS NULL OR po.[companyId] <> m.[companyId] OR po.[branchId] <> m.[branchId]))
        OR (dl.[productionLineId] IS NOT NULL AND (pl.[id] IS NULL OR pl.[companyId] <> m.[companyId] OR pl.[branchId] <> m.[branchId]))
      )
)
    THROW 51104, N'downtime_logs tenant backfill aborted: production context on a downtime_logs row contradicts the machine-derived tenant. Resolve before deploying.', 1;

-- ── Backfill UPDATE ───────────────────────────────────────────────────────────
-- Update ONLY rows requiring tenant backfill, deriving tenant from the
-- authoritative machine. COALESCE preserves an already-correct non-null value
-- while filling the missing one; the guards above guarantee no conflicting
-- value is ever overwritten.
UPDATE dl
SET dl.[companyId] = COALESCE(dl.[companyId], m.[companyId]),
    dl.[branchId]  = COALESCE(dl.[branchId],  m.[branchId])
FROM [dbo].[downtime_logs] dl
JOIN [dbo].[machines] m ON m.[id] = dl.[machineId]
WHERE (dl.[companyId] IS NULL OR dl.[branchId] IS NULL)
  AND m.[companyId] IS NOT NULL
  AND m.[branchId] IS NOT NULL;

-- ── Postcondition 1 — no targeted row remains unresolved ──────────────────────
-- No row that required tenant backfill may remain with a NULL companyId or
-- branchId while its machine carries both.
IF EXISTS (
    SELECT 1
    FROM [dbo].[downtime_logs] dl
    JOIN [dbo].[machines] m ON m.[id] = dl.[machineId]
    WHERE m.[companyId] IS NOT NULL
      AND m.[branchId] IS NOT NULL
      AND (dl.[companyId] IS NULL OR dl.[branchId] IS NULL)
)
    THROW 51201, N'downtime_logs tenant backfill postcondition failed: a backfilled row still has a NULL tenant field despite a resolvable machine.', 1;

-- ── Postcondition 2 — no tenant differs from machine tenant ──────────────────
IF EXISTS (
    SELECT 1
    FROM [dbo].[downtime_logs] dl
    JOIN [dbo].[machines] m ON m.[id] = dl.[machineId]
    WHERE m.[companyId] IS NOT NULL
      AND m.[branchId] IS NOT NULL
      AND (dl.[companyId] <> m.[companyId] OR dl.[branchId] <> m.[branchId])
)
    THROW 51202, N'downtime_logs tenant backfill postcondition failed: a downtime_logs tenant differs from its machine-derived tenant.', 1;

-- ── Postcondition 3 — no branch belongs to a different company ───────────────
IF EXISTS (
    SELECT 1
    FROM [dbo].[downtime_logs] dl
    LEFT JOIN [dbo].[branches] b ON b.[id] = dl.[branchId]
    WHERE dl.[branchId] IS NOT NULL
      AND (b.[id] IS NULL OR b.[companyId] <> dl.[companyId])
)
    THROW 51203, N'downtime_logs tenant backfill postcondition failed: a downtime_logs branch is missing or belongs to a different company than its companyId.', 1;

-- ── Postcondition 4 — no production-context contradiction remains ────────────
IF EXISTS (
    SELECT 1
    FROM [dbo].[downtime_logs] dl
    JOIN [dbo].[machines] m ON m.[id] = dl.[machineId]
    LEFT JOIN [dbo].[production_runs] pr ON pr.[id] = dl.[productionRunId]
    LEFT JOIN [dbo].[production_orders] po ON po.[id] = dl.[productionOrderId]
    LEFT JOIN [dbo].[production_lines] pl ON pl.[id] = dl.[productionLineId]
    WHERE m.[companyId] IS NOT NULL
      AND m.[branchId] IS NOT NULL
      AND (
        (dl.[productionRunId] IS NOT NULL AND (pr.[id] IS NULL OR pr.[companyId] <> dl.[companyId] OR pr.[branchId] <> dl.[branchId]))
        OR (dl.[productionOrderId] IS NOT NULL AND (po.[id] IS NULL OR po.[companyId] <> dl.[companyId] OR po.[branchId] <> dl.[branchId]))
        OR (dl.[productionLineId] IS NOT NULL AND (pl.[id] IS NULL OR pl.[companyId] <> dl.[companyId] OR pl.[branchId] <> dl.[branchId]))
      )
)
    THROW 51204, N'downtime_logs tenant backfill postcondition failed: production context contradicts the backfilled tenant.', 1;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
