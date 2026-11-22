import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { getInternalCallContext } from './internal-context';

let warnedLoopback = false;

export function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

/**
 * Number of trusted reverse proxies in front of this process. The client IP is the Nth entry from
 * the right of X-Forwarded-For. Unset: 1 outside production (legacy behaviour), 0 in production
 * (fail closed: ignore X-Forwarded-For and use the socket address). Invalid values fail closed.
 */
export function trustedProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.TRUSTED_PROXY_HOPS?.trim();
  if (raw === undefined || raw === '') return env.NODE_ENV === 'production' ? 0 : 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : 0;
}

/** Log once at startup when production has no explicit proxy-trust configuration. */
export function warnIfProxyTrustUnset(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  if (env.TRUST_CF_CONNECTING_IP === '1') return;
  if (env.TRUSTED_PROXY_HOPS !== undefined && env.TRUSTED_PROXY_HOPS.trim() !== '') return;
  console.warn(
    '[ip] production has neither TRUST_CF_CONNECTING_IP=1 nor TRUSTED_PROXY_HOPS set: X-Forwarded-For is ignored and per-IP limits will see the proxy address',
  );
}

/**
 * Client IP that a caller cannot spoof by sending their own X-Forwarded-For.
 * Order: Cloudflare's CF-Connecting-IP (only if TRUST_CF_CONNECTING_IP === '1'),
 * then the Nth X-Forwarded-For hop from the right when TRUSTED_PROXY_HOPS > 0
 * (defaults to 1 outside production, 0 in production), then the socket address.
 */
export function getTrustedClientIp(c: Context): string {
  if (process.env.TRUST_CF_CONNECTING_IP === '1') {
    const cf = c.req.header('cf-connecting-ip')?.trim();
    if (cf) return cf;
  }
  const hops = trustedProxyHops();
  const xff = c.req.header('x-forwarded-for');
  if (hops > 0 && xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= hops) return parts[parts.length - hops]!;
  }
  let resolved = 'unknown';
  try {
    resolved = getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    resolved = 'unknown'; // no socket (e.g. app.request in tests)
  }
  if (resolved === 'unknown') {
    const inheritedIp = getInternalCallContext(c)?.clientIp;
    if (inheritedIp) resolved = inheritedIp;
  }

  if (process.env.NODE_ENV === 'production' && isLoopbackIp(resolved) && !warnedLoopback) {
    warnedLoopback = true;
    console.warn('[ip] client IP resolved to loopback behind a reverse proxy; check nginx X-Forwarded-For');
  }

  return resolved;
}
