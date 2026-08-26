import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

jest.mock('../constants/auth.constants', () => ({
  jwtConstants: { secret: 'unit-test-jwt-secret', expiresIn: '1d' },
}));

import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy session revocation', () => {
  let prisma: { user: { findFirst: jest.Mock } };
  let strategy: JwtStrategy;

  const user = (authVersion: number, status = 'ACTIVE') => ({
    id: 'user-a',
    email: 'user@example.test',
    name: 'User',
    companyId: 'company-a',
    branchId: 'branch-a',
    departmentId: null,
    status,
    authVersion,
  });

  beforeEach(() => {
    prisma = { user: { findFirst: jest.fn() } };
    strategy = new JwtStrategy(prisma as unknown as PrismaService);
  });

  it('accepts a matching token version', async () => {
    prisma.user.findFirst.mockResolvedValue(user(4));
    await expect(
      strategy.validate({ sub: 'user-a', authVersion: 4 }),
    ).resolves.toMatchObject({ id: 'user-a', email: 'user@example.test' });
  });

  it('accepts a legacy token only while the user remains at version zero', async () => {
    prisma.user.findFirst.mockResolvedValue(user(0));
    await expect(strategy.validate({ sub: 'user-a' })).resolves.toMatchObject({
      id: 'user-a',
    });
  });

  it('rejects an old token immediately after password reset increments the version', async () => {
    prisma.user.findFirst.mockResolvedValue(user(1));
    await expect(
      strategy.validate({ sub: 'user-a', authVersion: 0 }),
    ).rejects.toMatchObject({
      response: { messageKey: 'auth.sessionRevoked' },
    });
  });

  it('rejects malformed versions and inactive users', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(user(0));
    await expect(
      strategy.validate({ sub: 'user-a', authVersion: '0' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.user.findFirst.mockResolvedValueOnce(user(0, 'INACTIVE'));
    await expect(
      strategy.validate({ sub: 'user-a', authVersion: 0 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
