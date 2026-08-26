-- Authentication recovery hardening (additive and backward compatible).
-- Existing users receive authVersion = 0. Legacy JWTs are treated as version 0
-- until that individual user's password is changed/reset or the user logs out.
-- Rollback requires first deploying code that no longer reads these columns;
-- only then may the two columns/default constraint be removed in a separate,
-- reviewed migration.

ALTER TABLE [dbo].[users]
ADD [authVersion] INT NOT NULL
    CONSTRAINT [users_authVersion_df] DEFAULT 0;

ALTER TABLE [dbo].[users]
ADD [passwordChangedAt] DATETIME2 NULL;

-- Define the explicit administrative reset permission for deployed databases.
-- The existing SUPER_ADMIN bypass remains, while this row supports deliberate
-- delegation to a narrower administrative role.
IF NOT EXISTS (
    SELECT 1 FROM [dbo].[permissions]
    WHERE [key] = N'user:reset-password'
)
BEGIN
    INSERT INTO [dbo].[permissions]
        ([id], [key], [module], [action], [description], [status], [createdAt], [updatedAt])
    VALUES
        (CONVERT(NVARCHAR(36), NEWID()), N'user:reset-password', N'user', N'reset-password',
         N'Reset another user password within the authorized operational context',
         N'ACTIVE', SYSUTCDATETIME(), SYSUTCDATETIME());
END;

INSERT INTO [dbo].[role_permissions] ([roleId], [permissionId])
SELECT role_row.[id], permission_row.[id]
FROM [dbo].[roles] AS role_row
CROSS JOIN [dbo].[permissions] AS permission_row
WHERE role_row.[code] = N'SUPER_ADMIN'
  AND permission_row.[key] = N'user:reset-password'
  AND NOT EXISTS (
      SELECT 1
      FROM [dbo].[role_permissions] AS existing_assignment
      WHERE existing_assignment.[roleId] = role_row.[id]
        AND existing_assignment.[permissionId] = permission_row.[id]
  );
