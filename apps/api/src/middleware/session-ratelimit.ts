import type { Context, Next } from 'hono';
import { checkSessionRateLimit } from '../ratelimit';
import { getTrustedClientIp } from '../lib/ip';

/**
 * Rate-limit a session-authenticated route by userId + IP (audit H3/M3).
 * Must run AFTER sessionAuth so `userSession` is set.
 */
export function sessionRateLimit(scope: string, limit: number, windowSeconds = 60) {
  return async (c: Context, next: Next) => {
    const { userId } = c.get('userSession');
    const ok = await checkSessionRateLimit(scope, userId, getTrustedClientIp(c), limit, windowSeconds);
    if (!ok) {
      return c.json(
        { error: { message: 'rate limit exceeded', type: 'rate_limit_error', code: 'rate_limit_exceeded' } },
        429,
      );
    }
    await next();
  };
}
