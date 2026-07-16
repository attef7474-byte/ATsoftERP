import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { page?: number; limit?: number; search?: string; module?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { key: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }
    if (query.module) where.module = query.module;

    const [data, total] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ module: 'asc' }, { action: 'asc' }],
      }),
      this.prisma.permission.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const permission = await this.prisma.permission.findUnique({ where: { id } });
    if (!permission) throw new NotFoundException('Permission not found');
    return permission;
  }

  async getModules() {
    const modules = await this.prisma.permission.findMany({
      select: { module: true },
      distinct: ['module'],
      orderBy: { module: 'asc' },
    });
    return modules.map((m) => m.module);
  }

  async getGrouped(roleId?: string) {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    const rolePermissionIds = roleId
      ? (await this.prisma.rolePermission.findMany({
          where: { roleId },
          select: { permissionId: true },
        })).map((rp) => rp.permissionId)
      : [];

    const rolePermissionSet = new Set(rolePermissionIds);

    const grouped: Record<string, { module: string; permissions: any[] }> = {};
    for (const perm of permissions) {
      if (!grouped[perm.module]) {
        grouped[perm.module] = { module: perm.module, permissions: [] };
      }
      grouped[perm.module].permissions.push({
        ...perm,
        assigned: rolePermissionSet.has(perm.id),
      });
    }

    return Object.values(grouped);
  }

  async getMatrix() {
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });

    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
      select: { id: true, key: true, module: true, action: true },
    });

    const rolePermissions = await this.prisma.rolePermission.findMany({
      select: { roleId: true, permissionId: true },
    });

    const matrix: Record<string, Set<string>> = {};
    for (const rp of rolePermissions) {
      if (!matrix[rp.permissionId]) matrix[rp.permissionId] = new Set();
      matrix[rp.permissionId].add(rp.roleId);
    }

    const rows = permissions.map((perm) => ({
      ...perm,
      roles: roles.map((r) => ({ roleId: r.id, assigned: matrix[perm.id]?.has(r.id) ?? false })),
    }));

    return { roles, permissions: rows };
  }
}
