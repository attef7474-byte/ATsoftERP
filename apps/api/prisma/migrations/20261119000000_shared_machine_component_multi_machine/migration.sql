-- Shared MachineComponent / multi-machine association foundation.
--
-- Purpose
--   ONE logical MachineComponent may be associated with MANY Machines through
--   the explicit join entity `machine_component_machines`. Machine-specific
--   attributes (locationInMachine, serialNumber) are backfilled onto the
--   association. Legacy columns are retained but are no longer authoritative.
--
-- Safety contract
--   * Additive only: no existing column is dropped, no business row is
--     physically deleted, no applied migration is edited.
--   * Proven duplicates (batch audit correlation) are soft-deleted and merged
--     into the oldest canonical row. Ambiguous duplicate groups are NOT merged;
--     the migration raises an error and must be resolved before production.
--   * All work is one transaction; rollback = ROLLBACK before commit, or
--     restore the verified pre-migration backup after commit.
--   * SQL Server compiles a batch before executing its DDL. Every statement
--     that depends on a column/table created by this migration is therefore
--     executed in a later sp_executesql batch.
BEGIN TRY
  BEGIN TRAN;

  -- 1. Additive direct tenant ownership on the component. No client input is
  --    accepted; values are backfilled from the currently authoritative Machine.
  EXEC sp_executesql N'
    IF COL_LENGTH(''dbo.machine_components'', ''companyId'') IS NULL
      ALTER TABLE [dbo].[machine_components] ADD [companyId] NVARCHAR(1000) NULL;
    IF COL_LENGTH(''dbo.machine_components'', ''branchId'') IS NULL
      ALTER TABLE [dbo].[machine_components] ADD [branchId] NVARCHAR(1000) NULL;
  ';

  -- 2. Create the canonical association table.
  EXEC sp_executesql N'
    IF OBJECT_ID(''dbo.machine_component_machines'', ''U'') IS NULL
    BEGIN
      CREATE TABLE [dbo].[machine_component_machines] (
        [id]                NVARCHAR(1000) NOT NULL,
        [componentId]       NVARCHAR(1000) NOT NULL,
        [machineId]         NVARCHAR(1000) NOT NULL,
        [companyId]         NVARCHAR(1000) NULL,
        [branchId]          NVARCHAR(1000) NULL,
        [status]            NVARCHAR(1000) NOT NULL
          CONSTRAINT [machine_component_machines_status_df] DEFAULT ''ACTIVE'',
        [linkedAt]          DATETIME2 NOT NULL
          CONSTRAINT [machine_component_machines_linkedAt_df] DEFAULT CURRENT_TIMESTAMP,
        [unlinkedAt]        DATETIME2 NULL,
        [locationInMachine] NVARCHAR(1000) NULL,
        [serialNumber]      NVARCHAR(1000) NULL,
        [createdAt]         DATETIME2 NOT NULL
          CONSTRAINT [machine_component_machines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        [updatedAt]         DATETIME2 NOT NULL,
        CONSTRAINT [machine_component_machines_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [machine_component_machines_component_machine_key]
          UNIQUE NONCLUSTERED ([componentId], [machineId])
      );
    END;
  ';

  -- 3. Indexes and foreign keys. Executed only after the columns/table above
  --    exist in an earlier dynamic batch.
  EXEC sp_executesql N'
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''machine_component_machines_machine_status_idx'' AND object_id = OBJECT_ID(''dbo.machine_component_machines''))
      CREATE NONCLUSTERED INDEX [machine_component_machines_machine_status_idx]
        ON [dbo].[machine_component_machines]([machineId], [status]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''machine_component_machines_component_status_idx'' AND object_id = OBJECT_ID(''dbo.machine_component_machines''))
      CREATE NONCLUSTERED INDEX [machine_component_machines_component_status_idx]
        ON [dbo].[machine_component_machines]([componentId], [status]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''machine_component_machines_tenant_idx'' AND object_id = OBJECT_ID(''dbo.machine_component_machines''))
      CREATE NONCLUSTERED INDEX [machine_component_machines_tenant_idx]
        ON [dbo].[machine_component_machines]([companyId], [branchId]);

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''machine_component_machines_componentId_fkey'')
      ALTER TABLE [dbo].[machine_component_machines] ADD CONSTRAINT [machine_component_machines_componentId_fkey]
        FOREIGN KEY ([componentId]) REFERENCES [dbo].[machine_components]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''machine_component_machines_machineId_fkey'')
      ALTER TABLE [dbo].[machine_component_machines] ADD CONSTRAINT [machine_component_machines_machineId_fkey]
        FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''machine_component_machines_companyId_fkey'')
      ALTER TABLE [dbo].[machine_component_machines] ADD CONSTRAINT [machine_component_machines_companyId_fkey]
        FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''machine_component_machines_branchId_fkey'')
      ALTER TABLE [dbo].[machine_component_machines] ADD CONSTRAINT [machine_component_machines_branchId_fkey]
        FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''machine_components_companyId_fkey'')
      ALTER TABLE [dbo].[machine_components] ADD CONSTRAINT [machine_components_companyId_fkey]
        FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''machine_components_branchId_fkey'')
      ALTER TABLE [dbo].[machine_components] ADD CONSTRAINT [machine_components_branchId_fkey]
        FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''machine_components_tenant_scope_idx'' AND object_id = OBJECT_ID(''dbo.machine_components''))
      CREATE NONCLUSTERED INDEX [machine_components_tenant_scope_idx]
        ON [dbo].[machine_components]([companyId], [branchId], [deletedAt]);
  ';

  -- 4. Identify PROVEN batch duplicates from the legacy batch audit record.
  --    Same batchCorrelationId + same code is strong provenance; name is NEVER
  --    used as merge evidence. Canonical row = oldest createdAt, tie-break id.
  SELECT [oldId], [correlationId], [code], [canonicalId]
  INTO #merge_map
  FROM (
    SELECT
      a.[entityId] AS [oldId],
      JSON_VALUE(a.[details], '$.batchCorrelationId') AS [correlationId],
      c.[code] AS [code],
      FIRST_VALUE(a.[entityId]) OVER (
        PARTITION BY JSON_VALUE(a.[details], '$.batchCorrelationId'), c.[code]
        ORDER BY c.[createdAt], CAST(c.[id] AS NVARCHAR(100))
      ) AS [canonicalId]
    FROM [dbo].[audit_logs] a
    INNER JOIN [dbo].[machine_components] c ON c.[id] = a.[entityId]
    WHERE a.[entity] = N'MachineComponent'
      AND a.[action] = N'CREATE'
      AND ISJSON(a.[details]) = 1
      AND JSON_VALUE(a.[details], '$.batch') = N'true'
  ) ranked
  WHERE [oldId] <> [canonicalId];

  -- 5. Backfill ownership and create one association per legacy component.
  EXEC sp_executesql N'
    UPDATE c
      SET [companyId] = m.[companyId], [branchId] = m.[branchId]
    FROM [dbo].[machine_components] c
    INNER JOIN [dbo].[machines] m ON m.[id] = c.[machineId]
    WHERE c.[companyId] IS NULL AND c.[branchId] IS NULL;

    INSERT INTO [dbo].[machine_component_machines]
      ([id], [componentId], [machineId], [companyId], [branchId], [status],
       [linkedAt], [unlinkedAt], [locationInMachine], [serialNumber], [createdAt], [updatedAt])
    SELECT
      CONCAT(N''mcml_'', c.[id]), c.[id], c.[machineId], c.[companyId], c.[branchId],
      N''ACTIVE'', c.[createdAt], NULL, c.[locationInMachine], c.[serialNumber],
      c.[createdAt], ISNULL(c.[updatedAt], c.[createdAt])
    FROM [dbo].[machine_components] c
    WHERE NOT EXISTS (
      SELECT 1 FROM [dbo].[machine_component_machines] l
      WHERE l.[componentId] = c.[id] AND l.[machineId] = c.[machineId]
    );
  ';

  -- 5a. Never merge siblings that disagree on shared component attributes.
  IF EXISTS (
    SELECT 1
    FROM #merge_map mm
    INNER JOIN [dbo].[machine_components] s ON s.[id] = mm.[oldId]
    INNER JOIN [dbo].[machine_components] k ON k.[id] = mm.[canonicalId]
    WHERE ISNULL(s.[name], N'') <> ISNULL(k.[name], N'')
       OR ISNULL(s.[componentType], N'') <> ISNULL(k.[componentType], N'')
       OR ISNULL(s.[manufacturer], N'') <> ISNULL(k.[manufacturer], N'')
       OR ISNULL(s.[model], N'') <> ISNULL(k.[model], N'')
       OR ISNULL(s.[criticality], N'') <> ISNULL(k.[criticality], N'')
       OR ISNULL(s.[description], N'') <> ISNULL(k.[description], N'')
  )
    THROW 50001, 'MachineComponent merge blocked: proven batch siblings disagree on component-level attributes; resolve explicitly before migration.', 1;

  -- 5b. Never repoint downstream foreign keys blindly. If a proven duplicate
  --     group has downstream references, block for explicit reconciliation.
  IF EXISTS (
    SELECT 1 FROM [dbo].[maintenance_requests] t WHERE t.[machineComponentId] IN (SELECT [oldId] FROM #merge_map)
    UNION ALL SELECT 1 FROM [dbo].[maintenance_work_orders] t WHERE t.[machineComponentId] IN (SELECT [oldId] FROM #merge_map)
    UNION ALL SELECT 1 FROM [dbo].[maintenance_request_required_parts] t WHERE t.[machineComponentId] IN (SELECT [oldId] FROM #merge_map)
    UNION ALL SELECT 1 FROM [dbo].[maintenance_part_accountability] t WHERE t.[machineComponentId] IN (SELECT [oldId] FROM #merge_map)
    UNION ALL SELECT 1 FROM [dbo].[maintenance_tasks] t WHERE t.[machineComponentId] IN (SELECT [oldId] FROM #merge_map)
    UNION ALL SELECT 1 FROM [dbo].[machine_installed_parts] t WHERE t.[machine_component_id] IN (SELECT [oldId] FROM #merge_map)
    UNION ALL SELECT 1 FROM [dbo].[spare_part_replacement_histories] t WHERE t.[machine_component_id] IN (SELECT [oldId] FROM #merge_map)
    UNION ALL SELECT 1 FROM [dbo].[spare_part_repair_orders] t WHERE t.[machine_component_id] IN (SELECT [oldId] FROM #merge_map)
    UNION ALL SELECT 1 FROM [dbo].[maintenance_boms] t WHERE t.[componentId] IN (SELECT [oldId] FROM #merge_map)
    UNION ALL SELECT 1 FROM [dbo].[component_spare_parts] t WHERE t.[componentId] IN (SELECT [oldId] FROM #merge_map)
    UNION ALL SELECT 1 FROM [dbo].[production_measurement_points] t WHERE t.[machineComponentId] IN (SELECT [oldId] FROM #merge_map)
  )
    THROW 50002, 'MachineComponent merge blocked: a proven duplicate has downstream foreign keys; explicit FK reconciliation required before migration.', 1;

  -- 5c. Add an association from the canonical component to every machine of a
  --     merged sibling, preserving per-machine location and serial values.
  EXEC sp_executesql N'
    INSERT INTO [dbo].[machine_component_machines]
      ([id], [componentId], [machineId], [companyId], [branchId], [status],
       [linkedAt], [unlinkedAt], [locationInMachine], [serialNumber], [createdAt], [updatedAt])
    SELECT
      CONCAT(N''mcmmerged_'', s.[id]), k.[id], s.[machineId], k.[companyId], k.[branchId],
      N''ACTIVE'', s.[createdAt], NULL, s.[locationInMachine], s.[serialNumber],
      s.[createdAt], ISNULL(s.[updatedAt], s.[createdAt])
    FROM #merge_map mm
    INNER JOIN [dbo].[machine_components] s ON s.[id] = mm.[oldId]
    INNER JOIN [dbo].[machine_components] k ON k.[id] = mm.[canonicalId]
    WHERE NOT EXISTS (
      SELECT 1 FROM [dbo].[machine_component_machines] l
      WHERE l.[componentId] = k.[id] AND l.[machineId] = s.[machineId]
    );
  ';

  UPDATE l
    SET [locationInMachine] = ISNULL(l.[locationInMachine], s.[locationInMachine]),
        [serialNumber] = ISNULL(l.[serialNumber], s.[serialNumber])
  FROM [dbo].[machine_component_machines] l
  INNER JOIN #merge_map mm ON mm.[canonicalId] = l.[componentId]
  INNER JOIN [dbo].[machine_components] s ON s.[id] = mm.[oldId] AND s.[machineId] = l.[machineId];

  -- 5d. Retire proven duplicate rows softly. They remain for historical
  --     traceability but are no longer active independent components.
  UPDATE c
    SET [deletedAt] = ISNULL(c.[deletedAt], SYSUTCDATETIME())
  FROM #merge_map mm
  INNER JOIN [dbo].[machine_components] c ON c.[id] = mm.[oldId];

  -- 6. Canonical active-code uniqueness per ownership scope. Ambiguous groups
  --    block index creation rather than being silently merged.
  EXEC sp_executesql N'
    IF EXISTS (
      SELECT [companyId], [branchId], [code]
      FROM [dbo].[machine_components]
      WHERE [deletedAt] IS NULL
      GROUP BY [companyId], [branchId], [code]
      HAVING COUNT(*) > 1
    )
      THROW 50003, ''MachineComponent canonical uniqueness blocked: ambiguous active duplicate codes exist; supply a reconciliation report before migration.'', 1;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''machine_components_active_code_scope_uq'' AND object_id = OBJECT_ID(''dbo.machine_components''))
      CREATE UNIQUE INDEX [machine_components_active_code_scope_uq]
        ON [dbo].[machine_components]([companyId], [branchId], [code])
        WHERE [deletedAt] IS NULL;
  ';

  DROP TABLE #merge_map;

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
