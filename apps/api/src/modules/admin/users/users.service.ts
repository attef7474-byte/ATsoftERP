import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { password, roleIds, ...rest } = dto;

    const user = await this.prisma.user.create({
      data: {
        ...rest,
        passwordHash,
        roles: roleIds?.length
          ? { create: roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      include: { roles: { include: { role: true } } },
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async findAll(query: UsersQueryDto) {
    const { page = 1, limit = 10, search, status, companyId, roleId, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;
    if (roleId) {
      where.roles = { some: { roleId } };
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true, email: true, name: true, phone: true, status: true,
          companyId: true, branchId: true, departmentId: true,
          lastLoginAt: true, createdAt: true, updatedAt: true,
          roles: { include: { role: { select: { id: true, code: true, name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, phone: true, avatar: true, status: true,
        companyId: true, branchId: true, departmentId: true,
        lastLoginAt: true, createdAt: true, updatedAt: true,
        roles: { include: { role: { select: { id: true, code: true, name: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const { roleIds, ...rest } = dto as any;
    const data: any = { ...rest };

    if (roleIds) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      data.roles = { create: roleIds.map((roleId: string) => ({ roleId })) };
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: { roles: { include: { role: { select: { id: true, code: true, name: true } } } } },
    });

    const { passwordHash: _, ...result } = updated;
    return result;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'User deleted successfully' };
  }

  async assignRoles(id: string, roleIds: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    await this.prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId: id, roleId })),
    });

    return this.findOne(id);
  }
}
