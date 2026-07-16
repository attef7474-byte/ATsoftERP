import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  async create(dto: CreateRoleDto, userId?: string) {
    const existing = await this.prisma.role.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Role code already exists');

    const { permissionIds, ...rest } = dto;
    const role = await this.prisma.role.create({
      data: {
        ...rest,
        permissions: permissionIds?.length
          ? { create: permissionIds.map((permissionId) => ({ permissionId })) }
          : undefined,
      },
      include: { permissions: { include: { permission: true } } },
    });

    if (userId) {
      await this.auditService.log(userId, 'CREATE', 'role', role.id, { code: role.code, name: role.name });
    }
    return role;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      }),
      this.prisma.role.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async update(id: string, dto: UpdateRoleDto, userId?: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ForbiddenException('Cannot modify system role');

    const { permissionIds, ...rest } = dto as any;
    const data: any = { ...rest };

    if (permissionIds) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      data.permissions = { create: permissionIds.map((permissionId: string) => ({ permissionId })) };
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data,
      include: { permissions: { include: { permission: true } } },
    });

    if (userId) {
      await this.auditService.log(userId, 'UPDATE', 'role', id, { name: dto.name, code: dto.code });
    }
    return updated;
  }

  async remove(id: string, userId?: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ConflictException('Cannot delete system role');

    const userCount = await this.prisma.userRole.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new ConflictException('Cannot delete role with assigned users. Remove all users first.');
    }

    await this.prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });

    if (userId) {
      await this.auditService.log(userId, 'DELETE', 'role', id, { code: role.code, name: role.name });
    }
    return { message: 'Role deleted successfully' };
  }

  async getUsers(id: string, query: { page?: number; limit?: number }) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { roleId: id },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true, email: true, name: true, phone: true, status: true,
              lastLoginAt: true, createdAt: true,
            },
          },
        },
      }),
      this.prisma.userRole.count({ where: { roleId: id } }),
    ]);

    return {
      data: data.map((ur) => ur.user),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async assignPermissions(id: string, permissionIds: string[], userId?: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    const existingPermissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingPermissions.map((p) => p.id));
    const invalidIds = permissionIds.filter((pid) => !existingIds.has(pid));
    if (invalidIds.length > 0) {
      throw new NotFoundException(`Permissions not found: ${invalidIds.join(', ')}`);
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
    });

    if (userId) {
      await this.auditService.log(userId, 'UPDATE', 'role-permissions', id, {
        roleCode: role.code,
        permissionCount: permissionIds.length,
      });
    }

    return this.findOne(id);
  }
}
