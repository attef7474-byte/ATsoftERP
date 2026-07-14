import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
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

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    const { permissionIds, ...rest } = dto as any;
    const data: any = { ...rest };

    if (permissionIds) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      data.permissions = { create: permissionIds.map((permissionId: string) => ({ permissionId })) };
    }

    return this.prisma.role.update({
      where: { id },
      data,
      include: { permissions: { include: { permission: true } } },
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ConflictException('Cannot delete system role');
    await this.prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Role deleted successfully' };
  }

  async assignPermissions(id: string, permissionIds: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
    });

    return this.findOne(id);
  }
}
