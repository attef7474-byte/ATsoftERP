import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (entry.resetAt <= now) loginAttempts.delete(key);
  }
}, 60_000);

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';
    const email = request.body?.email || 'unknown';
    const key = `${ip}:${email}`;
    const now = Date.now();

    let entry = loginAttempts.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      loginAttempts.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > MAX_ATTEMPTS) {
      throw new HttpException(
        { messageKey: 'auth.tooManyAttempts', message: 'Too many login attempts. Please try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
