import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../modules/audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  async create(dto: CreateUserDto, ctx: ActiveOperationalContext) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw this.validationError('email', 'validation.duplicateValue', 'Email already in use');

    if (dto.roleIds?.length) {
      await this.assertRolesExist(dto.roleIds);
    }
    if (dto.departmentId) {
      await this.assertDepartmentInContext(dto.departmentId, ctx);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { password, roleIds, companyId: _companyId, branchId: _branchId, ...rest } = dto;

    const user = await this.prisma.user.create({
      data: {
        ...rest,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
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

  async findAll(query: UsersQueryDto, ctx: ActiveOperationalContext) {
    const { page = 1, limit = 10, search, status, roleId, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId, branchId: ctx.branchId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (status) where.status = status;
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

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      select: {
        id: true, email: true, name: true, phone: true, avatar: true, status: true,
        companyId: true, branchId: true, departmentId: true,
        lastLoginAt: true, createdAt: true, updatedAt: true,
        roles: { include: { role: { select: { id: true, code: true, name: true } } } },
      },
    });
    if (!user) {
      throw new NotFoundException({ messageKey: 'organization.userNotFound', message: 'User not found' });
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto, ctx: ActiveOperationalContext) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
    if (!user) {
      throw new NotFoundException({ messageKey: 'organization.userNotFound', message: 'User not found' });
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw this.validationError('email', 'validation.duplicateValue', 'Email already in use');
    }

    if (dto.roleIds?.length) {
      await this.assertRolesExist(dto.roleIds);
    }
    if (dto.departmentId) {
      await this.assertDepartmentInContext(dto.departmentId, ctx);
    }

    const { roleIds, companyId: _companyId, branchId: _branchId, ...rest } = dto as any;
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

  async remove(id: string, ctx: ActiveOperationalContext) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
    if (!user) {
      throw new NotFoundException({ messageKey: 'organization.userNotFound', message: 'User not found' });
    }
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'User deleted successfully' };
  }

  async assignRoles(id: string, roleIds: string[], actorId: string | undefined, ctx: ActiveOperationalContext) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
    if (!user) {
      throw new NotFoundException({ messageKey: 'organization.userNotFound', message: 'User not found' });
    }

    if (roleIds.length) {
      await this.assertRolesExist(roleIds);
    }

    const hasSuperAdmin = await this.prisma.userRole.findFirst({
      where: { userId: id, role: { code: 'SUPER_ADMIN' } },
    });
    const willHaveSuperAdmin = roleIds.includes(
      (await this.prisma.role.findFirst({ where: { code: 'SUPER_ADMIN' } }))?.id ?? '',
    );

    if (hasSuperAdmin && !willHaveSuperAdmin) {
      const adminCount = await this.prisma.userRole.count({
        where: { role: { code: 'SUPER_ADMIN' }, user: { deletedAt: null, status: 'ACTIVE' } },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException({
          messageKey: 'organization.cannotRemoveLastSuperAdmin',
          message: 'Cannot remove the last SUPER_ADMIN role. System would have no administrator.',
        });
      }
    }

    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    await this.prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId: id, roleId })),
    });

    if (actorId) {
      await this.auditService.log({
        userId: actorId,
        action: 'UPDATE',
        entity: 'user-roles',
        entityId: id,
        details: JSON.stringify({ userEmail: user.email, roleCount: roleIds.length }),
      });
    }

    return this.findOne(id, ctx);
  }

  private async assertRolesExist(roleIds: string[]): Promise<void> {
    const existingRoles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingRoles.map((r) => r.id));
    const invalidIds = roleIds.filter((rid) => !existingIds.has(rid));
    if (invalidIds.length > 0) {
      throw this.validationError('roleIds', 'validation.invalidReference', `Roles not found: ${invalidIds.join(', ')}`);
    }
  }

  private async assertDepartmentInContext(departmentId: string, ctx: ActiveOperationalContext): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!department) {
      throw this.validationError('departmentId', 'validation.invalidReference', 'Department not found in active context');
    }
  }
}
