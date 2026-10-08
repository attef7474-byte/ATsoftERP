import { ForbiddenException } from '@nestjs/common';

/**
 * Single source of truth for "may this actor perform these guarded actions?".
 *
 * This exists because a controller-level `@Permissions(...)` decorator can only express a
 * fixed key set for a whole route, while an orchestration route performs several guarded
 * actions in one call whose required keys depend on the request body (for example creating
 * a system login, or attaching a maintenance capability). Checking those keys inside the
 * service keeps the per-domain segmentation instead of collapsing to one umbrella key.
 *
 * Semantics deliberately mirror `PermissionsGuard`: an ACTIVE `SUPER_ADMIN` role short
 * circuits to allow, otherwise every required key must be present as an ACTIVE permission
 * on at least one ACTIVE role. A missing actor is denied rather than trusted.
 *
 * Must be called with a transaction client when the checks guard writes, so the permission
 * state and the writes it authorises share one atomic unit.
 */
export async function assertUserPermissions(
  client: any,
  userId: string | undefined,
  requiredPermissions: string[],
): Promise<void> {
  if (requiredPermissions.length === 0) return;

  if (!userId) {
    throw new ForbiddenException({
      messageKey: 'auth.insufficientPermissions',
      message: 'Insufficient permissions',
    });
  }

  const userRoles = await client.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });

  const granted = new Set<string>();
  for (const userRole of userRoles) {
    if (userRole.role?.status !== 'ACTIVE') continue;
    if (userRole.role.code === 'SUPER_ADMIN') return;
    for (const rolePermission of userRole.role.permissions ?? []) {
      if (rolePermission.permission?.status === 'ACTIVE') granted.add(rolePermission.permission.key);
    }
  }

  if (!requiredPermissions.every((permission) => granted.has(permission))) {
    throw new ForbiddenException({
      messageKey: 'auth.insufficientPermissions',
      message: 'Insufficient permissions',
    });
  }
}