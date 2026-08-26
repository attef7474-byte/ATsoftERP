import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConstants } from '../constants/auth.constants';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CurrentUserType } from '../types/current-user.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: any): Promise<CurrentUserType> {
    const userId = payload?.sub || payload?.id;
    if (!userId) {
      throw new UnauthorizedException({ messageKey: 'auth.tokenInvalid', message: 'Invalid or expired token' });
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        companyId: true,
        branchId: true,
        departmentId: true,
        status: true,
        authVersion: true,
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ messageKey: 'auth.userNotFound', message: 'User not found or inactive' });
    }
    const tokenAuthVersion = payload.authVersion === undefined
      ? 0
      : payload.authVersion;
    if (
      !Number.isInteger(tokenAuthVersion) ||
      tokenAuthVersion < 0 ||
      tokenAuthVersion !== user.authVersion
    ) {
      throw new UnauthorizedException({
        messageKey: 'auth.sessionRevoked',
        message: 'The session has been revoked',
      });
    }
    return {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      branchId: user.branchId,
      departmentId: user.departmentId,
    };
  }
}
