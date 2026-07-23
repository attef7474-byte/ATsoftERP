-- Seed administration permissions and number sequence for existing database

BEGIN TRY
    BEGIN TRAN;

    -- Add administration permissions
    DECLARE @adminRoleId NVARCHAR(1000);
    SELECT TOP 1 @adminRoleId = id FROM roles WHERE name = 'Admin' ORDER BY createdAt;

    -- Insert permissions if they don't exist
    DECLARE @perms TABLE (permKey NVARCHAR(1000), permModule NVARCHAR(1000), permAction NVARCHAR(1000));
    INSERT INTO @perms VALUES
        ('administration:create', 'administration', 'create'),
        ('administration:read', 'administration', 'read'),
        ('administration:update', 'administration', 'update'),
        ('administration:delete', 'administration', 'delete');

    DECLARE @key NVARCHAR(1000), @module NVARCHAR(1000), @action NVARCHAR(1000), @permId NVARCHAR(1000);

    DECLARE perm_cursor CURSOR FOR SELECT permKey, permModule, permAction FROM @perms;
    OPEN perm_cursor;
    FETCH NEXT FROM perm_cursor INTO @key, @module, @action;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Upsert permission
        IF NOT EXISTS (SELECT 1 FROM permissions WHERE [key] = @key)
        BEGIN
            SET @permId = NEWID();
            INSERT INTO permissions (id, [key], module, action, status, createdAt, updatedAt)
            VALUES (@permId, @key, @module, @action, 'ACTIVE', GETDATE(), GETDATE());

            -- Assign to Admin role
            IF @adminRoleId IS NOT NULL
            BEGIN
                INSERT INTO role_permissions (roleId, permissionId)
                VALUES (@adminRoleId, @permId);
            END;
            PRINT 'Created permission: ' + @key;
        END;
        FETCH NEXT FROM perm_cursor INTO @key, @module, @action;
    END;
    CLOSE perm_cursor;
    DEALLOCATE perm_cursor;

    -- Add ADMINISTRATION number sequence if not exists
    IF NOT EXISTS (SELECT 1 FROM number_sequences WHERE code = 'ADMINISTRATION')
    BEGIN
        INSERT INTO number_sequences (id, code, name, operationName, modelName, domain, prefix, padding, [scope], resetPolicy, status, createdAt, updatedAt)
        VALUES (NEWID(), 'ADMINISTRATION', 'Administration', 'Administration', 'Administration', 'core', 'ADM-', 6, 'GLOBAL', 'NEVER', 'ACTIVE', GETDATE(), GETDATE());
        PRINT 'Created ADMINISTRATION number sequence';
    END;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;
    THROW;
END CATCH;
GO
