BEGIN TRY
BEGIN TRAN;

-- VAL-R1G-A: add cost boundary columns to production_runs
-- Nullable columns only; existing runs remain untouched.
ALTER TABLE [dbo].[production_runs] ADD
    [costClosedAt]   DATETIME2      NULL,
    [costClosedById] NVARCHAR(1000) NULL;

-- VAL-R1G-A: Production Run Cost Boundary Snapshot
--
-- Creates the immutable production_run_cost_snapshots table that stores the
-- frozen material cost boundary for a ProductionRun. This is purely ADDITIVE
-- and NON-DESTRUCTIVE:
--
--   * It does NOT backfill historical cost.
--   * It does NOT insert valuation rows for existing runs.
--   * It does NOT alter existing production_runs behavior.
--   * The costSnapshot relation on production_runs is nullable, so existing
--     runs are untouched.
--
-- The unique (companyId, branchId, productionRunId) is the idempotency guard:
-- a second cost close for the same run is rejected rather than silently
-- overwritten.

CREATE TABLE [dbo].[production_run_cost_snapshots] (
    [id]               NVARCHAR(191)  NOT NULL,
    [companyId]        NVARCHAR(1000) NOT NULL,
    [branchId]         NVARCHAR(1000) NOT NULL,
    [productionRunId]  NVARCHAR(1000) NOT NULL,
    [finalProductId]   NVARCHAR(1000) NOT NULL,
    [finalGoodQuantity] DECIMAL(18, 4) NOT NULL,
    [netMaterialValue] DECIMAL(19, 4) NOT NULL,
    [currencyCode]     NVARCHAR(10)  NOT NULL,
    [costBasis]        NVARCHAR(100) NOT NULL,
    [closedAt]         DATETIME2      NOT NULL CONSTRAINT [df_production_run_cost_snapshots_closed_at] DEFAULT GETUTCDATE(),
    [closedById]       NVARCHAR(1000) NULL,
    [createdById]      NVARCHAR(1000) NULL,
    [createdAt]        DATETIME2      NOT NULL CONSTRAINT [df_production_run_cost_snapshots_created_at] DEFAULT GETUTCDATE(),
    CONSTRAINT [pk_production_run_cost_snapshots] PRIMARY KEY ([id]),
    CONSTRAINT [fk_production_run_cost_snapshots_company] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [fk_production_run_cost_snapshots_branch] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [fk_production_run_cost_snapshots_run] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [fk_production_run_cost_snapshots_product] FOREIGN KEY ([finalProductId]) REFERENCES [dbo].[products] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- Idempotency guard: one snapshot per run per tenant
CREATE UNIQUE NONCLUSTERED INDEX [uq_production_run_cost_snapshots_tenant_run]
    ON [dbo].[production_run_cost_snapshots] ([companyId], [branchId], [productionRunId]);

-- R1G-A: productionRunId is globally unique (matches Prisma @unique).
-- This is the authoritative DB-level guarantee that duplication for the same
-- run is impossible regardless of companyId/branchId values.
ALTER TABLE [dbo].[production_run_cost_snapshots]
    ADD CONSTRAINT [uq_production_run_cost_snapshots_run] UNIQUE NONCLUSTERED ([productionRunId]);

-- Query support
CREATE NONCLUSTERED INDEX [ix_production_run_cost_snapshots_tenant]
    ON [dbo].[production_run_cost_snapshots] ([companyId], [branchId]);

CREATE NONCLUSTERED INDEX [ix_production_run_cost_snapshots_run]
    ON [dbo].[production_run_cost_snapshots] ([productionRunId]);

CREATE NONCLUSTERED INDEX [ix_production_run_cost_snapshots_product]
    ON [dbo].[production_run_cost_snapshots] ([finalProductId]);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
