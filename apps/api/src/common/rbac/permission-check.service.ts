import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Reusable, backend-only permission resolution that mirrors the canonical
 * `PermissionsGuard` semantics (ACTIVE roles, ACTIVE permissions, explicit
 * SUPER_ADMIN bypass). Used by composite operations that must enforce a
 * secondary domain permission *inside* a single transaction/endpoint, without
 * duplicating role logic or trusting the client.
 */
@Injectable()
export class PermissionCheckService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string): Promise<{ isSuperAdmin: boolean; keys: Set<string> }> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const keys = new Set<string>();
    for (const ur of userRoles) {
      if (ur.role.status !== 'ACTIVE') continue;
      if (ur.role.code === 'SUPER_ADMIN') return { isSuperAdmin: true, keys };
      for (const rp of ur.role.permissions) {
        if (rp.permission.status === 'ACTIVE') keys.add(rp.permission.key);
      }
    }
    return { isSuperAdmin: false, keys };
  }

  async hasAll(userId: string, required: string[]): Promise<boolean> {
    if (!required || required.length === 0) return true;
    const { isSuperAdmin, keys } = await this.resolve(userId);
    if (isSuperAdmin) return true;
    return required.every((key) => keys.has(key));
  }

  async assertAll(userId: string, required: string[]): Promise<void> {
    if (!required || required.length === 0) return;
    if (!(await this.hasAll(userId, required))) {
      throw new ForbiddenException({
        messageKey: 'auth.insufficientPermissions',
        message: 'Insufficient permissions',
      });
    }
  }
}
