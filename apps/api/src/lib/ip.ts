import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

/**
 * Client IP that a caller cannot spoof by sending their own X-Forwarded-For.
 * Order: Cloudflare's CF-Connecting-IP, then the LAST X-Forwarded-For hop (the one our own
 * edge proxy appended; earlier hops are client-controlled), then the socket address.
 * ponytail: assumes exactly one trusted proxy hop; behind a proxy chain, read hop N from the
 * end via a TRUSTED_PROXY_HOPS setting instead.
 */
export function getTrustedClientIp(c: Context): string {
  const cf = c.req.header('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const last = xff.split(',').map((p) => p.trim()).filter(Boolean).pop();
    if (last) return last;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown'; // no socket (e.g. app.request in tests)
  }
}
