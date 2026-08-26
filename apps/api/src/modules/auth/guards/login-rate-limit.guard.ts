import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { SecurityService } from '../../settings/security/security.service';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (entry.resetAt <= now) loginAttempts.delete(key);
  }
}, 60_000);
cleanupTimer.unref?.();

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly securityService: SecurityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';
    const email = String(request.body?.email || 'unknown').trim().toLowerCase();
    const key = `${ip}:${email}`;
    const now = Date.now();
    const settings = await this.securityService.get();
    const maxAttempts = Math.min(20, Math.max(3, settings.maxLoginAttempts));
    const windowMs = Math.min(1440, Math.max(1, settings.lockoutMinutes)) * 60 * 1000;

    let entry = loginAttempts.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      loginAttempts.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > maxAttempts) {
      throw new HttpException(
        { messageKey: 'auth.tooManyAttempts', message: 'Too many login attempts. Please try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
