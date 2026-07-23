-- Backfill Administrations for existing departments
-- Creates a default "General Administration" for each branch that has departments
-- and links existing departments to it.

BEGIN TRY
    BEGIN TRAN;

    -- Create a temp table to hold branches that need administrations
    DECLARE @Branches TABLE (
        branchId NVARCHAR(1000),
        branchCode NVARCHAR(1000),
        branchName NVARCHAR(1000),
        companyName NVARCHAR(1000)
    );

    INSERT INTO @Branches
    SELECT DISTINCT
        b.id,
        b.code,
        b.name,
        c.name
    FROM branches b
    INNER JOIN companies c ON c.id = b.companyId
    WHERE EXISTS (SELECT 1 FROM departments d WHERE d.branchId = b.id AND d.administrationId IS NULL)
      AND NOT EXISTS (SELECT 1 FROM administrations a WHERE a.branchId = b.id);

    DECLARE @branchId NVARCHAR(1000), @branchCode NVARCHAR(1000), @branchName NVARCHAR(1000), @companyName NVARCHAR(1000);
    DECLARE @adminId NVARCHAR(1000);

    DECLARE branch_cursor CURSOR FOR
        SELECT branchId, branchCode, branchName, companyName FROM @Branches;

    OPEN branch_cursor;
    FETCH NEXT FROM branch_cursor INTO @branchId, @branchCode, @branchName, @companyName;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @adminId = NEWID();

        -- Insert default General Administration
        INSERT INTO administrations (id, branchId, code, name, description, status, createdAt, updatedAt)
        VALUES (@adminId, @branchId, @branchCode + '_GEN', N'General Administration',
                N'Default administration for ' + @branchName, 'ACTIVE', GETDATE(), GETDATE());

        -- Link all departments in this branch to the new administration
        UPDATE departments
        SET administrationId = @adminId
        WHERE branchId = @branchId AND administrationId IS NULL;

        PRINT 'Created administration for branch: ' + @branchName + ' (' + @companyName + ')';

        FETCH NEXT FROM branch_cursor INTO @branchId, @branchCode, @branchName, @companyName;
    END;

    CLOSE branch_cursor;
    DEALLOCATE branch_cursor;

    -- Handle departments without branchId (orphan)
    DECLARE @OrphanDepts TABLE (deptId NVARCHAR(1000), deptName NVARCHAR(1000), companyId NVARCHAR(1000));

    INSERT INTO @OrphanDepts
    SELECT id, name, companyId
    FROM departments
    WHERE branchId IS NULL AND administrationId IS NULL;

    DECLARE @deptId NVARCHAR(1000), @deptName NVARCHAR(1000), @companyId NVARCHAR(1000);

    DECLARE orphan_cursor CURSOR FOR
        SELECT deptId, deptName, companyId FROM @OrphanDepts;

    OPEN orphan_cursor;
    FETCH NEXT FROM orphan_cursor INTO @deptId, @deptName, @companyId;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Try to find first administration in any branch of this company
        SELECT TOP 1 @adminId = a.id
        FROM administrations a
        INNER JOIN branches b ON b.id = a.branchId
        WHERE b.companyId = @companyId
        ORDER BY a.createdAt;

        IF @adminId IS NULL
        BEGIN
            -- Create a branch for this company if none exists, or use first branch
            DECLARE @firstBranchId NVARCHAR(1000);
            SELECT TOP 1 @firstBranchId = id FROM branches WHERE companyId = @companyId ORDER BY createdAt;

            IF @firstBranchId IS NOT NULL
            BEGIN
                SET @adminId = NEWID();
                INSERT INTO administrations (id, branchId, code, name, description, status, createdAt, updatedAt)
                VALUES (@adminId, @firstBranchId, 'GEN', N'General Administration',
                        N'Default administration', 'ACTIVE', GETDATE(), GETDATE());
            END;
        END;

        IF @adminId IS NOT NULL
        BEGIN
            UPDATE departments SET administrationId = @adminId WHERE id = @deptId;
            PRINT 'Linked orphan department: ' + @deptName;
        END;

        FETCH NEXT FROM orphan_cursor INTO @deptId, @deptName, @companyId;
    END;

    CLOSE orphan_cursor;
    DEALLOCATE orphan_cursor;

    -- Verify
    DECLARE @unlinked INT;
    SELECT @unlinked = COUNT(*) FROM departments WHERE administrationId IS NULL;

    DECLARE @totalAdmins INT;
    SELECT @totalAdmins = COUNT(*) FROM administrations;

    DECLARE @totalDepts INT;
    SELECT @totalDepts = COUNT(*) FROM departments;

    PRINT '--- Summary ---';
    PRINT 'Total administrations: ' + CAST(@totalAdmins AS NVARCHAR);
    PRINT 'Total departments: ' + CAST(@totalDepts AS NVARCHAR);
    PRINT 'Unlinked departments: ' + CAST(@unlinked AS NVARCHAR);

    IF @unlinked > 0
    BEGIN
        PRINT 'WARNING: Some departments still lack administrationId';
    END
    ELSE
    BEGIN
        PRINT 'All departments have administrationId';
    END;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;
    THROW;
END CATCH;
GO
