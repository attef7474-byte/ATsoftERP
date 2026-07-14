export interface CrudPermissions {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canActivate: boolean;
  isSuperAdmin: boolean;
}

export function checkCrudPermissions(
  userPermissions: string[],
  isSuperAdmin: boolean,
  modulePrefix: string,
): CrudPermissions {
  if (isSuperAdmin) {
    return { canCreate: true, canRead: true, canUpdate: true, canDelete: true, canActivate: true, isSuperAdmin: true };
  }

  return {
    canCreate: userPermissions.includes(`${modulePrefix}:create`),
    canRead: userPermissions.includes(`${modulePrefix}:read`),
    canUpdate: userPermissions.includes(`${modulePrefix}:update`),
    canDelete: userPermissions.includes(`${modulePrefix}:delete`),
    canActivate: userPermissions.includes(`${modulePrefix}:update`),
    isSuperAdmin: false,
  };
}
