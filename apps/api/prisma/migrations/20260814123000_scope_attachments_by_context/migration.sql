-- Additive ownership columns for operational attachments. Existing rows are
-- backfilled only when a tenant-owned link proves one unambiguous owner.
ALTER TABLE [attachments] ADD [companyId] NVARCHAR(1000) NULL;
ALTER TABLE [attachments] ADD [branchId] NVARCHAR(1000) NULL;

WITH [AttachmentOwners] AS (
    SELECT [attachmentId], [companyId], [branchId]
    FROM [production_order_attachments]
    UNION ALL
    SELECT [attachmentId], [companyId], [branchId]
    FROM [production_nonconformance_attachments]
),
[DeterministicOwners] AS (
    SELECT
        [attachmentId],
        MIN([companyId]) AS [companyId],
        MIN([branchId]) AS [branchId]
    FROM [AttachmentOwners]
    GROUP BY [attachmentId]
    HAVING COUNT(DISTINCT [companyId]) = 1
       AND COUNT(DISTINCT [branchId]) = 1
)
UPDATE [a]
SET [a].[companyId] = [o].[companyId],
    [a].[branchId] = [o].[branchId]
FROM [attachments] AS [a]
INNER JOIN [DeterministicOwners] AS [o]
    ON [o].[attachmentId] = [a].[id]
WHERE [a].[companyId] IS NULL
  AND [a].[branchId] IS NULL;

CREATE INDEX [attachments_companyId_branchId_createdAt_idx]
    ON [attachments]([companyId], [branchId], [createdAt]);
CREATE INDEX [attachments_companyId_branchId_entityName_entityId_idx]
    ON [attachments]([companyId], [branchId], [entityName], [entityId]);
