import type { Context, Next } from 'hono';
import { checkSessionRateLimitDetailed } from '../ratelimit';
import { getTrustedClientIp } from '../lib/ip';

/**
 * Rate-limit a session-authenticated route by userId + IP (audit H3/M3, FIX-P1-04).
 * Emits standard `X-RateLimit-*` and `Retry-After` headers.
 * Must run AFTER sessionAuth so `userSession` is set.
 */
export function sessionRateLimit(scope: string, limit: number, windowSeconds = 60) {
  return async (c: Context, next: Next) => {
    const { userId } = c.get('userSession');
    const rl = await checkSessionRateLimitDetailed(
      scope,
      userId,
      getTrustedClientIp(c),
      limit,
      windowSeconds,
    );
    c.header('X-RateLimit-Limit-Requests', String(limit));
    c.header('X-RateLimit-Remaining-Requests', String(rl.remaining));
    if (!rl.ok) {
      c.header('Retry-After', String(rl.retryAfter));
      return c.json(
        { error: { message: 'rate limit exceeded', type: 'rate_limit_error', code: 'rate_limit_exceeded' } },
        429,
      );
    }
    await next();
  };
}
