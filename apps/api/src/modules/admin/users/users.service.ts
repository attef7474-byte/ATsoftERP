import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../modules/audit/audit.service';
import { PasswordCredentialService } from '../../settings/security/password-credential.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private passwordCredentials: PasswordCredentialService,
  ) {}

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

    const { passwordHash } = await this.passwordCredentials.preparePassword(
      dto.password,
      dto.password,
      {
        passwordField: 'password',
        confirmationField: 'password',
      },
    );
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

  async resetPassword(
    id: string,
    dto: ResetUserPasswordDto,
    actorId: string,
    ctx: ActiveOperationalContext,
  ) {
    if (id === actorId) {
      throw new BadRequestException({
        messageKey: 'auth.adminResetSelfDenied',
        message: 'Use self-service password change for your own account',
      });
    }

    this.passwordCredentials.assertConfirmation(
      dto.newPassword,
      dto.confirmNewPassword,
    );

    const target = await this.prisma.user.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        deletedAt: null,
      },
      include: {
        roles: {
          include: {
            role: { select: { code: true, status: true, deletedAt: true } },
          },
        },
      },
    });
    if (!target) {
      throw new NotFoundException({
        messageKey: 'organization.userNotFound',
        message: 'User not found',
      });
    }
    if (target.status !== 'ACTIVE') {
      throw new BadRequestException({
        messageKey: 'auth.adminResetTargetInactive',
        message: 'An inactive account password cannot be reset',
      });
    }

    const targetIsSuperAdmin = target.roles.some(
      (assignment) =>
        assignment.role.code === 'SUPER_ADMIN' &&
        assignment.role.status === 'ACTIVE' &&
        assignment.role.deletedAt === null,
    );
    if (targetIsSuperAdmin) {
      const actorIsSuperAdmin = await this.prisma.userRole.findFirst({
        where: {
          userId: actorId,
          role: {
            code: 'SUPER_ADMIN',
            status: 'ACTIVE',
            deletedAt: null,
          },
        },
        select: { userId: true },
      });
      if (!actorIsSuperAdmin) {
        throw new ForbiddenException({
          messageKey: 'auth.privilegedResetRequiresSuperAdmin',
          message: 'Resetting a SUPER_ADMIN account requires a SUPER_ADMIN caller',
        });
      }
    }

    const { passwordHash } = await this.passwordCredentials.preparePassword(
      dto.newPassword,
      dto.confirmNewPassword,
    );
    const passwordChangedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      const currentTarget = await tx.user.findFirst({
        where: {
          id: target.id,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        include: {
          roles: {
            include: {
              role: { select: { code: true, status: true, deletedAt: true } },
            },
          },
        },
      });
      if (!currentTarget) {
        throw new NotFoundException({
          messageKey: 'organization.userNotFound',
          message: 'User not found',
        });
      }

      const currentTargetIsSuperAdmin = currentTarget.roles.some(
        (assignment) =>
          assignment.role.code === 'SUPER_ADMIN' &&
          assignment.role.status === 'ACTIVE' &&
          assignment.role.deletedAt === null,
      );
      if (currentTargetIsSuperAdmin) {
        const actorIsSuperAdmin = await tx.userRole.findFirst({
          where: {
            userId: actorId,
            role: {
              code: 'SUPER_ADMIN',
              status: 'ACTIVE',
              deletedAt: null,
            },
          },
          select: { userId: true },
        });
        if (!actorIsSuperAdmin) {
          throw new ForbiddenException({
            messageKey: 'auth.privilegedResetRequiresSuperAdmin',
            message: 'Resetting a SUPER_ADMIN account requires a SUPER_ADMIN caller',
          });
        }
      }

      const update = await tx.user.updateMany({
        where: {
          id: currentTarget.id,
          passwordHash: currentTarget.passwordHash,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        data: {
          passwordHash,
          passwordChangedAt,
          authVersion: { increment: 1 },
        },
      });
      if (update.count !== 1) {
        throw new BadRequestException({
          messageKey: 'auth.credentialChangedRetry',
          message: 'The credential changed while the request was in progress',
        });
      }

      await this.auditService.logWithClient(tx, {
        userId: actorId,
        action: 'ADMIN_PASSWORD_RESET',
        entity: 'user-credential',
        entityId: currentTarget.id,
        details: {
          source: 'AUTHENTICATED_ADMIN',
          targetUserId: currentTarget.id,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          sessionsRevoked: true,
        },
      });
    });

    return {
      messageKey: 'auth.adminPasswordResetSuccess',
      message: 'Password reset successfully',
      targetUserId: target.id,
      sessionsRevoked: true,
    };
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
