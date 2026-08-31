import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { COST_PURPOSE_OVERRIDE_PERMISSION } from './cost-purpose.constants';

/**
 * Returns true when the given user holds the canonical Cost Purpose override
 * permission (or is SUPER_ADMIN). Pure check: never throws. Follows the same
 * role/permission aggregation as PermissionsGuard and person-assignments.
 */
export async function userCanOverrideCostPurpose(
  client: PrismaService | any,
  userId: string | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const userRoles = await (client as any).userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });
  for (const userRole of userRoles) {
    if (userRole.role?.status !== 'ACTIVE') continue;
    if (userRole.role.code === 'SUPER_ADMIN') return true;
    for (const rolePermission of userRole.role?.permissions ?? []) {
      if (rolePermission.permission?.status === 'ACTIVE' && rolePermission.permission.key === COST_PURPOSE_OVERRIDE_PERMISSION) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Asserts the user holds the canonical Cost Purpose override permission.
 * Throws ForbiddenException otherwise. Used only when an override is requested.
 */
export async function assertCostPurposeOverrideAllowed(client: PrismaService | any, userId: string | undefined): Promise<void> {
  const allowed = await userCanOverrideCostPurpose(client, userId);
  if (!allowed) {
    throw new ForbiddenException({ messageKey: 'auth.insufficientPermissions', message: 'Insufficient permissions' });
  }
}
