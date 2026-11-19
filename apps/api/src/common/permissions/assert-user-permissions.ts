import { ForbiddenException } from '@nestjs/common';

export interface UserPermissionSnapshot {
  isSuperAdmin: boolean;
  permissions: Set<string>;
}

/**
 * Read-only permission snapshot used by orchestration services that must apply
 * different native permissions to different parts of one aggregated response.
 * The actor id is never trusted by itself: roles and permissions must be ACTIVE.
 */
export async function getUserPermissionSnapshot(
  client: any,
  userId: string | undefined,
): Promise<UserPermissionSnapshot> {
  if (!userId) return { isSuperAdmin: false, permissions: new Set<string>() };

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

  const permissions = new Set<string>();
  let isSuperAdmin = false;
  for (const userRole of userRoles) {
    if (userRole.role?.status !== 'ACTIVE') continue;
    if (userRole.role.code === 'SUPER_ADMIN') {
      isSuperAdmin = true;
      continue;
    }
    for (const rolePermission of userRole.role.permissions ?? []) {
      if (rolePermission.permission?.status === 'ACTIVE') permissions.add(rolePermission.permission.key);
    }
  }
  return { isSuperAdmin, permissions };
}

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

  const snapshot = await getUserPermissionSnapshot(client, userId);
  if (snapshot.isSuperAdmin) return;
  const granted = snapshot.permissions;

  if (!requiredPermissions.every((permission) => granted.has(permission))) {
    throw new ForbiddenException({
      messageKey: 'auth.insufficientPermissions',
      message: 'Insufficient permissions',
    });
  }
}

/**
 * OR-semantics variant for read-only orchestration endpoints that aggregate more
 * than one native authority (for example the unified Receipt Voucher list).
 *
 * This deliberately does NOT create a new umbrella permission: the actor must
 * hold at least one of the existing, seeded native read keys. Write actions are
 * still guarded by their own domain-specific create/update/post permissions.
 * Mirrors PermissionsGuard's ACTIVE role / ACTIVE permission / SUPER_ADMIN rules.
 */
export async function assertUserHasAnyPermission(
  client: any,
  userId: string | undefined,
  candidatePermissions: string[],
): Promise<void> {
  if (candidatePermissions.length === 0) return;
  const snapshot = await getUserPermissionSnapshot(client, userId);
  if (snapshot.isSuperAdmin) return;

  if (!candidatePermissions.some((permission) => snapshot.permissions.has(permission))) {
    throw new ForbiddenException({ messageKey: 'auth.insufficientPermissions', message: 'Insufficient permissions' });
  }
}