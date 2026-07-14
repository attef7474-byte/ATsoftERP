import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('No user found');

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    const userPermissionKeys = new Set<string>();
    for (const ur of userRoles) {
      if (ur.role.status !== 'ACTIVE') continue;
      if (ur.role.code === 'SUPER_ADMIN') return true;
      for (const rp of ur.role.permissions) {
        if (rp.permission.status === 'ACTIVE') {
          userPermissionKeys.add(rp.permission.key);
        }
      }
    }

    const hasAll = requiredPermissions.every((p) => userPermissionKeys.has(p));
    if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
