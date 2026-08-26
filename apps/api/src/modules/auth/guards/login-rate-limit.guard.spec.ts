import { HttpException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { SecurityService } from '../../settings/security/security.service';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

describe('LoginRateLimitGuard', () => {
  it('enforces the configured attempt limit without weakening browser login protection', async () => {
    const security = {
      get: jest.fn().mockResolvedValue({ maxLoginAttempts: 3, lockoutMinutes: 15 }),
    };
    const guard = new LoginRateLimitGuard(security as unknown as SecurityService);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: 'unit-test-ip',
          body: { email: 'rate-limit@example.test' },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);
    expect(security.get).toHaveBeenCalledTimes(4);
  });
});
