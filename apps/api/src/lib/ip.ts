import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

let warnedLoopback = false;

export function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

/** Reset warning flag (used by unit tests) */
export function _resetWarnedLoopback(): void {
  warnedLoopback = false;
}

/**
 * Client IP that a caller cannot spoof by sending their own X-Forwarded-For.
 * Order: Cloudflare's CF-Connecting-IP (only if TRUST_CF_CONNECTING_IP === '1'),
 * then the LAST X-Forwarded-For hop (the one our own edge proxy appended),
 * then the socket address.
 */
export function getTrustedClientIp(c: Context): string {
  if (process.env.TRUST_CF_CONNECTING_IP === '1') {
    const cf = c.req.header('cf-connecting-ip')?.trim();
    if (cf) return cf;
  }
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const last = xff.split(',').map((p) => p.trim()).filter(Boolean).pop();
    if (last) return last;
  }
  let resolved = 'unknown';
  try {
    resolved = getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    resolved = 'unknown'; // no socket (e.g. app.request in tests)
  }

  if (process.env.NODE_ENV === 'production' && isLoopbackIp(resolved) && !warnedLoopback) {
    warnedLoopback = true;
    console.warn('[ip] client IP resolved to loopback behind a reverse proxy; check nginx X-Forwarded-For');
  }

  return resolved;
}
