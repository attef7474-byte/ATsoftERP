import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: loginDto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is inactive');

    const valid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

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
    return this.prisma.user.findUnique({
      where: { id: userId },
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
  }

  async getUserPermissions(userId: string) {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
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
}
