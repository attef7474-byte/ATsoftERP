import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ActiveContextService } from '../../common/operational-context/active-context.service';
import { ValidateOperationalContextDto } from './dto/validate-operational-context.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private activeContextService: ActiveContextService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: loginDto.email, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException({ messageKey: 'auth.invalidCredentials', message: 'Invalid credentials' });

    if (user.status !== 'ACTIVE') throw new UnauthorizedException({ messageKey: 'auth.userInactive', message: 'Account is inactive' });

    const valid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException({ messageKey: 'auth.invalidCredentials', message: 'Invalid credentials' });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        status: true,
        companyId: true,
        branchId: true,
        departmentId: true,
        lastLoginAt: true,
        createdAt: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!profile) {
      throw new UnauthorizedException({
        messageKey: 'auth.userNotFound',
        message: 'User not found or inactive',
      });
    }

    const activeRoleAssignments = profile.roles
      .filter(
        (assignment) =>
          assignment.role.status === 'ACTIVE' &&
          assignment.role.deletedAt === null,
      )
      .map((assignment) => ({
        ...assignment,
        role: {
          ...assignment.role,
          permissions: assignment.role.permissions.filter(
            (rolePermission) =>
              rolePermission.permission.status === 'ACTIVE',
          ),
        },
      }));
    const [authorization, contextResult] = await Promise.all([
      this.activeContextService.getAuthorization(userId),
      this.activeContextService.getAllowedContexts(userId),
    ]);

    const user = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      avatar: profile.avatar,
      status: profile.status,
      companyId: profile.companyId,
      branchId: profile.branchId,
      departmentId: profile.departmentId,
      lastLoginAt: profile.lastLoginAt,
      createdAt: profile.createdAt,
    };

    return {
      ...user,
      user,
      roles: activeRoleAssignments,
      permissions: authorization.permissions,
      isSuperAdmin: authorization.isSuperAdmin,
      allowedContexts: contextResult.contexts,
      defaultContext: contextResult.defaultContext,
      currentContextStatus:
        contextResult.contexts.length === 0
          ? 'NO_CONTEXT'
          : contextResult.contexts.length === 1
            ? 'AUTO_SELECT'
            : 'SELECTION_REQUIRED',
    };
  }

  async getUserPermissions(userId: string) {
    const roles = await this.prisma.userRole.findMany({
      where: {
        userId,
        role: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
              where: { permission: { status: 'ACTIVE' } },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();
    let isSuperAdmin = false;

    for (const ur of roles) {
      if (ur.role.status !== 'ACTIVE' || ur.role.deletedAt !== null) continue;
      if (ur.role.code === 'SUPER_ADMIN') isSuperAdmin = true;
      for (const rp of ur.role.permissions) {
        permissions.add(rp.permission.key);
      }
    }

    return {
      roles: roles.map((r) => ({ id: r.role.id, code: r.role.code, name: r.role.name })),
      permissions: Array.from(permissions),
      isSuperAdmin,
    };
  }

  async getAllowedContexts(userId: string) {
    return this.activeContextService.getAllowedContexts(userId);
  }

  async validateOperationalContext(
    userId: string,
    dto: ValidateOperationalContextDto,
  ) {
    const context = await this.activeContextService.validate(userId, dto);
    return { valid: true, context };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }
}
