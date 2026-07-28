import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException({ messageKey: 'auth.noUserFound', message: 'No user found' });

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
    if (!hasAll) throw new ForbiddenException({ messageKey: 'auth.insufficientPermissions', message: 'Insufficient permissions' });
    return true;
  }
}
