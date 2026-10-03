-- R4O: give MachinePart an additive, NULLABLE tenant ownership reference.
--
-- Adds exactly two ADDITIVE, NULLABLE columns to machine_parts:
--     companyId NVARCHAR(1000) NULL  ->  companies(id)
--     branchId  NVARCHAR(1000) NULL  ->  branches(id)
-- plus one nonclustered index and two foreign keys.
--
-- WHY THIS IS NEEDED. machine_parts had NO tenant column at all; the only tenant
-- evidence was the optional machineId. A row with machineId NULL therefore had
-- NO possible owner, and the application resolved that absence as "belongs to
-- everybody": MachinePartsService.findAll matched { machineId: null } for every
-- company/branch, and partAccess performed no tenant test when machineId was
-- null. Every unbound part-list row was consequently readable, editable and
-- deletable by every tenant in the system. This is a cross-tenant isolation
-- defect, not a cosmetic gap, so it is corrected here.
--
-- DATA SAFETY. Strictly additive and non-destructive:
--   * Both columns are NULLABLE, so every existing row initially receives NULL.
--   * No row is inserted or deleted by this script.
--   * Nothing is truncated, renamed or reinterpreted.
--   * onDelete/onUpdate are NO_ACTION, matching every existing FK in this
--     database, so the constraints can never cascade-delete catalog or history.
--   * NVARCHAR(1000) NULL matches companies.id, branches.id and the existing
--     machine_parts FK columns (measured from sys.columns: nvarchar, max_length
--     2000 bytes = 1000 characters).
--
-- BACKFILL IS EVIDENCE-GATED, NOT INFERRED. Only rows whose machineId points at
-- an existing Machine receive ownership, because machines.companyId /
-- machines.branchId is a foreign-key-backed, tenant-authoritative fact about the
-- row: a bound part-list entry cannot exist outside its machine's tenant. A
-- measured read-only survey of all 889 machine_parts rows found:
--   * 722 rows bound to a Machine. Every one of them resolves to exactly one
--     company (COM-000042) and one branch (BRN-000002), and 0 bound rows point at
--     a machine with a NULL companyId. These are backfilled.
--   * 167 rows are unbound, carry quantity 0, minStock 0, no productId, no
--     partNumber and no sparePartId, and are referenced by ZERO audit-log rows.
--     They were created in a single 23-second bulk window (2026-09-30
--     04:32:05 - 04:32:28) that interleaved their codes with bound rows, but
--     code adjacency inside one import run is circumstantial, not proof of which
--     tenant the rows belong to. They are recorded as UNKNOWN_OWNERSHIP and
--     deliberately LEFT NULL.
--   * Assigning a company to those 167 rows based on the fact that the majority
--     of existing rows belong to COM-000042 would be a guess presented as data.
--     It is refused. NULL therefore means ownership is UNPROVEN.
--
-- APPLICATION CONTRACT FOR A NULL OWNERSHIP COLUMN.
--   * On create, ownership is always derived from the authenticated operational
--     context (or from an authorized Machine), never from client input.
--   * On link-to-machine, ownership is re-derived from the authorized Machine.
--   * On unlink-from-machine, ownership is CLEARED to NULL, because ownership
--     after an unlink is genuinely unproven again.
--   * Rows with NULL ownership are visible to SUPER_ADMIN only, so an operator can
--     still reconcile them. They are never visible to an ordinary tenant.
--
-- RECOVERY. Every DDL statement is guarded by an existence check, so rerunning
-- the script after it has already applied is a no-op: the columns, index and
-- foreign keys already exist, and the backfill UPDATE matches no further rows.
-- The whole body is one transaction; any failure, including the post-apply
-- invariant guard, rolls back completely.

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- 1. Additive nullable tenant ownership columns.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[machine_parts]')
      AND name = N'companyId'
)
BEGIN
    ALTER TABLE [dbo].[machine_parts] ADD [companyId] NVARCHAR(1000) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[machine_parts]')
      AND name = N'branchId'
)
BEGIN
    ALTER TABLE [dbo].[machine_parts] ADD [branchId] NVARCHAR(1000) NULL;
END;

-- 2. Query-path index for tenant scoping (the R4O list/ownership predicate).
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[machine_parts]')
      AND name = N'machine_parts_company_branch_idx'
)
BEGIN
    CREATE NONCLUSTERED INDEX [machine_parts_company_branch_idx]
        ON [dbo].[machine_parts] ([companyId], [branchId]);
END;

-- 3. Referential integrity to the tenant records, NO_ACTION both directions.
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'machine_parts_companyId_fkey'
      AND parent_object_id = OBJECT_ID(N'[dbo].[machine_parts]')
)
BEGIN
    ALTER TABLE [dbo].[machine_parts]
        ADD CONSTRAINT [machine_parts_companyId_fkey]
        FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies] ([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'machine_parts_branchId_fkey'
      AND parent_object_id = OBJECT_ID(N'[dbo].[machine_parts]')
)
BEGIN
    ALTER TABLE [dbo].[machine_parts]
        ADD CONSTRAINT [machine_parts_branchId_fkey]
        FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches] ([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

-- 4. Evidence-gated backfill: ownership ONLY from the Machine foreign key.
--    The WHERE guard never fabricates a tenant: it copies the machine's own
--    company when present, and leaves a machine without a company unresolved
--    rather than inventing one.
--
--    DYNAMIC SQL IS REQUIRED HERE. SQL Server compiles the whole batch against the
--    schema as it existed when the batch was submitted, so a static UPDATE that
--    references [companyId] fails with "Invalid column name 'companyId'" even
--    though the ALTER TABLE above it succeeded in the same batch. Wrapping the
--    post-DDL statements in EXEC defers their compilation until after the columns
--    exist. The transaction still wraps them, so EXEC does not break atomicity.
EXEC sp_executesql N'
UPDATE mp
SET mp.[companyId] = m.[companyId],
    mp.[branchId]  = m.[branchId]
FROM [dbo].[machine_parts] AS mp
INNER JOIN [dbo].[machines] AS m
        ON m.[id] = mp.[machineId]
WHERE mp.[companyId] IS NULL
  AND mp.[machineId] IS NOT NULL
  AND m.[companyId] IS NOT NULL;
';

-- 5. Post-apply invariant guard. After the backfill, every part-list row bound to
--    a Machine that has an authoritative company must carry that company, and it
--    must agree with the Machine. If the backfill silently affected fewer rows
--    than expected, this aborts and rolls the whole script back instead of
--    leaving rows that no tenant could see. A Machine with a NULL companyId is
--    excluded, because such a Machine carries no authoritative company to copy.
--    Dynamic SQL for the same reason as step 4.
IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[machine_parts]')
      AND name = N'companyId'
)
BEGIN
    EXEC sp_executesql N'
IF EXISTS (
    SELECT 1
    FROM [dbo].[machine_parts] AS mp
    INNER JOIN [dbo].[machines] AS m ON m.[id] = mp.[machineId]
    WHERE m.[companyId] IS NOT NULL
      AND (mp.[companyId] IS NULL OR mp.[companyId] <> m.[companyId])
)
    THROW 51010, ''R4O aborted: post-apply verification failed; a bound MachinePart does not match its Machine company.'', 1;
';
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;

-- ---------------------------------------------------------------------------
-- POST-APPLY VERIFICATION (read-only). Expected on the measured baseline:
--   machine_parts_total                       889
--   ownership_proven_from_machine_fk          722
--   unresolved_ownership_left_null            167
--   bound_rows_with_null_ownership              0
--   unbound_rows_wrongly_assigned               0
-- ---------------------------------------------------------------------------
SET NOCOUNT ON;

-- Wrapped for the same reason as the backfill: these read the columns the batch
-- above created, so they must be compiled after the DDL has run.
EXEC sp_executesql N'
SELECT
    (SELECT COUNT(*) FROM [dbo].[machine_parts])                                                        AS machine_parts_total,
    (SELECT COUNT(*) FROM [dbo].[machine_parts] WHERE [companyId] IS NOT NULL)                          AS ownership_proven_from_machine_fk,
    (SELECT COUNT(*) FROM [dbo].[machine_parts] WHERE [companyId] IS NULL)                              AS unresolved_ownership_left_null,
    (SELECT COUNT(*) FROM [dbo].[machine_parts] mp
        INNER JOIN [dbo].[machines] m ON m.[id] = mp.[machineId]
      WHERE mp.[companyId] IS NULL)                                                                     AS bound_rows_with_null_ownership,
    (SELECT COUNT(*) FROM [dbo].[machine_parts] mp
        INNER JOIN [dbo].[machines] m ON m.[id] = mp.[machineId]
      WHERE m.[companyId] IS NOT NULL AND mp.[companyId] IS NOT NULL AND mp.[companyId] <> m.[companyId]) AS bound_rows_with_conflicting_company;
';

-- Unresolved ownership (expected: the 167 rows with no authoritative machine).
EXEC sp_executesql N'
SELECT TOP (200) mp.[code], mp.[name], mp.[unit], mp.[quantity], mp.[minStock], mp.[machineId]
FROM [dbo].[machine_parts] AS mp
WHERE mp.[companyId] IS NULL
ORDER BY mp.[code];
';