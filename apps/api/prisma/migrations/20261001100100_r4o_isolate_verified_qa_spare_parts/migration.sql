-- R4O TASK 3: isolate two proven QA/test SparePart artifacts from production selection.
--
-- WHAT THIS DOES. Soft-deletes exactly two rows of spare_parts by setting the
-- existing deletedAt column, and writes the matching DELETE audit events. It
-- deletes no row, touches no other table, and changes no production item.
--
-- WHY THESE TWO ROWS AND NOT THE OTHERS. A measured read-only survey of all 11
-- spare_parts rows produced this classification:
--
--   VERIFIED_QA_ARTIFACT, already isolated (deletedAt IS NOT NULL) - 7 rows:
--     SP-000001 "API Test Part 1201355225"
--     SP-000002 "API Test Part 86871148"
--     SP-000003 "API Proof Part 1933748639"
--     SP-000004 "QA-SYS-SPARE-1787574769207-EDITED"
--     SP-000007 "QA-SYS-SPARE-1787575340641-EDITED"
--     SP-000008 "QA-SYS-SPARE-1787576173284-EDITED"
--     SP-000009 "QA-SYS-SPARE-1787582384716-EDITED"
--     These already carry the supported isolation flag. Re-applying deletedAt
--     would be a no-op, so they are excluded from this script by design.
--
--   VERIFIED_QA_ARTIFACT, still selectable - 2 rows, handled below:
--     SP-000005 "QA-SYS-SPARE-E2-1787574931198"  id cmt77ykuz003sc895l8uiksvq
--     SP-000006 "QA-SYS-SPARE-E2-1787574992510"  id cmt77zw3m003xc895igxx39v3
--
--   VERIFIED_PRODUCTION_ITEM - 2 rows, untouched:
--     SP001 "Bearing SKF 6205" - linked to product cmrvb4coj0001no95rd2e7kep with
--            1 work-order part, 2 condition balances and 4 condition movements.
--     SP002 Arabic conveyor-belt item, category NOK, partNumber 001-1250,
--            technicalClassification MECHANICAL. No QA provenance exists for it,
--            so it is a real catalog item that simply has not been consumed yet.
--            An unused real item is not a defect and must not be isolated.
--
-- PROOF THAT THE TWO TARGETS ARE TEST ARTIFACTS, NOT DATA:
--   * Their names carry the QA-SYS prefix used by the seven already-isolated
--     rows, and embed a JavaScript Date.now() token. The token is not decoration:
--     1787574931198 ms and 1787574992510 ms decode to 2026-08-24 12:35:31.198Z
--     and 2026-08-24 12:36:32.510Z, matching each row's own createdAt to the
--     millisecond. The name is a timestamp of the QA run that created the row.
--   * They were created by the same SUPER_ADMIN operator during the same
--     automated QA-SYS run that created and then deleted the QA-SYS machines and
--     components reconciled in R4O TASK 2.
--   * Dependency counts are 0 across all 13 measured relationships:
--     machine_spare_parts, component_spare_parts, machine_parts,
--     maintenance_bom_items, maintenance_part_accountability,
--     maintenance_request_required_parts, maintenance_work_order_parts,
--     preventive_spare_part_plan_items, spare_part_condition_balances,
--     spare_part_condition_movements, inventory_locks, and both
--     spare_part_replacement_histories columns (old_spare_part_id and
--     new_spare_part_id).
--
-- WHY SOFT DELETE AND NOT STATUS. The supported isolation mechanism that
-- actually removes a row from every selection surface is deletedAt: it is what
-- SparePartsService.remove() sets, it is what every SparePartsService.findAll()
-- query filters, and it is what both applicability-link validators test. Setting
-- status='INACTIVE' alone would NOT have achieved the goal: the catalog list and
-- the F9 sparePartAdapter do not filter on status, so an INACTIVE test row would
-- still have been offered for selection. The status mechanism is a business
-- toggle, not an isolation mechanism.
--
-- SAFETY GUARDS. The script refuses to proceed unless BOTH target codes are
-- present and each still matches the exact measured identity (code, name,
-- status='ACTIVE'). A row that is already soft-deleted by a previous run is
-- accepted as-is and simply skipped, which is what makes the script idempotent.
-- A missing row, a renamed row, or a status change is treated as "the data has
-- moved on": the script THROWS and the transaction rolls back, so this can never
-- silently isolate something that is no longer what was proven, nor silently
-- skip a target that has disappeared. No INSERT is performed except the audit
-- rows.
--
-- AUDIT. The audit rows reproduce exactly the shape written by
-- SparePartsService.remove(): entity='SparePart', action='DELETE', entityId set
-- to the part id, details = {"message":"Deleted spare part: <id>"}. They are
-- attributed to the SUPER_ADMIN operator account that created these artifacts,
-- since that is the verified human actor on the existing trail for this data;
-- R4O executed the isolation as an approved corrective action on their behalf.
-- The audit ids are deterministic so rerunning cannot duplicate an event.
--
-- RECOVERY. The script is fully idempotent. A first run soft-deletes both rows
-- and writes both audit events. A rerun finds each row already carrying
-- deletedAt from this same migration, skips both the update and the audit
-- inserts, and produces no duplicate row and no duplicate audit event.

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

DECLARE @actor NVARCHAR(1000) = N'cmrl31v0g0004ok95wxhdi9lm';
DECLARE @now DATETIME2(7) = SYSUTCDATETIME();

BEGIN TRY
BEGIN TRAN;

-- Guard 1a: both target codes must still exist. A vanished target must abort the
-- run rather than silently applying to only the survivor.
IF (SELECT COUNT(*) FROM [dbo].[spare_parts] WHERE [code] = N'SP-000005') <> 1
BEGIN
    THROW 51001, 'R4O aborted: SP-000005 is missing or duplicated; refusing to proceed.', 1;
END;

IF (SELECT COUNT(*) FROM [dbo].[spare_parts] WHERE [code] = N'SP-000006') <> 1
BEGIN
    THROW 51002, 'R4O aborted: SP-000006 is missing or duplicated; refusing to proceed.', 1;
END;

-- Guard 1b: identity check. The name and status must still be the proven values.
-- deletedAt is deliberately NOT part of this check: a non-NULL value means a
-- previous run of this migration already isolated the row, which is a valid
-- idempotent no-op rather than a conflict.
IF EXISTS (
    SELECT 1 FROM [dbo].[spare_parts]
    WHERE [code] = N'SP-000005'
      AND ([name] <> N'QA-SYS-SPARE-E2-1787574931198' OR [status] <> N'ACTIVE')
)
BEGIN
    THROW 51003, 'R4O aborted: SP-000005 no longer matches the proven QA artifact identity.', 1;
END;

IF EXISTS (
    SELECT 1 FROM [dbo].[spare_parts]
    WHERE [code] = N'SP-000006'
      AND ([name] <> N'QA-SYS-SPARE-E2-1787574992510' OR [status] <> N'ACTIVE')
)
BEGIN
    THROW 51004, 'R4O aborted: SP-000006 no longer matches the proven QA artifact identity.', 1;
END;

-- @targets holds only the rows this run still has to isolate.
DECLARE @targets TABLE ([id] NVARCHAR(1000) NOT NULL, [code] NVARCHAR(100) NOT NULL);
INSERT INTO @targets ([id], [code])
SELECT [id], [code] FROM [dbo].[spare_parts]
WHERE [code] IN (N'SP-000005', N'SP-000006') AND [deletedAt] IS NULL;

-- Guard 2: the target rows must still have zero operational references.
IF (SELECT COUNT(*) FROM @targets) > 0
   AND (
        (SELECT COUNT(*) FROM [dbo].[machine_spare_parts]                     WHERE [sparePartId] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[component_spare_parts]                  WHERE [sparePartId] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[machine_parts]                           WHERE [sparePartId] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[maintenance_bom_items]                   WHERE [sparePartId] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[maintenance_part_accountability]         WHERE [sparePartId] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[maintenance_request_required_parts]       WHERE [sparePartId] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[maintenance_work_order_parts]             WHERE [sparePartId] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[preventive_spare_part_plan_items]         WHERE [sparePartId] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[spare_part_condition_balances]            WHERE [sparePartId] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[spare_part_condition_movements]           WHERE [sparePartId] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[inventory_locks]                          WHERE [sparePartId] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[spare_part_replacement_histories]         WHERE [old_spare_part_id] IN (SELECT [id] FROM @targets)) > 0
     OR (SELECT COUNT(*) FROM [dbo].[spare_part_replacement_histories]         WHERE [new_spare_part_id] IN (SELECT [id] FROM @targets)) > 0
   )
BEGIN
    THROW 51005, 'R4O aborted: a target QA artifact now has an operational reference; isolation is unsafe.', 1;
END;

-- 1. Isolate: set the existing soft-delete flag. No row is deleted.
UPDATE [dbo].[spare_parts]
SET [deletedAt] = @now
WHERE [id] IN (SELECT [id] FROM @targets);

-- 2. Audit, in the exact shape written by SparePartsService.remove().
INSERT INTO [dbo].[audit_logs] ([id], [userId], [action], [entity], [entityId], [details], [createdAt])
SELECT N'r4o-isolate-' + REPLACE(t.[code], N'-', N''),
       @actor,
       N'DELETE',
       N'SparePart',
       t.[id],
       N'{"message":"Deleted spare part: ' + t.[id] + N'"}',
       @now
FROM @targets AS t
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[audit_logs] AS a
    WHERE a.[id] = N'r4o-isolate-' + REPLACE(t.[code], N'-', N'')
);

-- Guard 3: after the statements above, both targets must be isolated and both
-- audit events must be present. This makes a partial or skipped application a
-- hard failure that rolls back, rather than something the caller has to notice.
IF (SELECT COUNT(*) FROM [dbo].[spare_parts]
    WHERE [code] IN (N'SP-000005', N'SP-000006') AND [deletedAt] IS NOT NULL) <> 2
BEGIN
    THROW 51006, 'R4O aborted: post-apply verification failed; a target is not isolated.', 1;
END;

IF (SELECT COUNT(*) FROM [dbo].[audit_logs]
    WHERE [id] IN (N'r4o-isolate-SP000005', N'r4o-isolate-SP000006')) <> 2
BEGIN
    THROW 51007, 'R4O aborted: post-apply verification failed; an audit event is missing.', 1;
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;

-- ---------------------------------------------------------------------------
-- POST-APPLY VERIFICATION (read-only). Expected on the measured baseline:
--   spare_parts_total        11   (unchanged; nothing was deleted)
--   live_before               4 -> live_after 2
--   verified_production_live  2   (SP001, SP002)
--   qa_live                   0
--   r4o_audit_events          2
-- ---------------------------------------------------------------------------
SET NOCOUNT ON;

SELECT
    (SELECT COUNT(*) FROM [dbo].[spare_parts])                                              AS spare_parts_total,
    (SELECT COUNT(*) FROM [dbo].[spare_parts] WHERE [deletedAt] IS NULL)                    AS live_after,
    (SELECT COUNT(*) FROM [dbo].[spare_parts] WHERE [deletedAt] IS NOT NULL)                AS isolated_total,
    (SELECT COUNT(*) FROM [dbo].[spare_parts] WHERE [deletedAt] IS NULL AND [name] LIKE N'QA-SYS-%') AS qa_still_live,
    (SELECT COUNT(*) FROM [dbo].[spare_parts] WHERE [deletedAt] IS NULL AND [code] IN (N'SP001', N'SP002')) AS production_still_live,
    (SELECT COUNT(*) FROM [dbo].[audit_logs] WHERE [id] IN (N'r4o-isolate-SP000005', N'r4o-isolate-SP000006')) AS r4o_audit_events;

SELECT [code], [name], [status], [deletedAt] FROM [dbo].[spare_parts] ORDER BY [code];