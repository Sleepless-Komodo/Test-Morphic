import type { Context, Next } from 'hono';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Origins allowed to send cookie-authenticated mutations. */
export function allowedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const out = new Set<string>();
  const raw = env.NEXT_PUBLIC_APP_URL || (env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
  if (raw) {
    try {
      out.add(new URL(raw).origin);
    } catch {
      // invalid URL: leave the set empty so every cookie-only mutation is rejected
    }
  }
  return out;
}

export interface MutationRequestInfo {
  method: string;
  authorization?: string;
  cookie?: string;
  origin?: string;
  referer?: string;
}

/** False only for a cookie-only mutation whose Origin/Referer is missing or not allowed. */
export function isMutationAllowed(info: MutationRequestInfo, allowed: Set<string>): boolean {
  if (SAFE_METHODS.has(info.method.toUpperCase())) return true;
  if (info.authorization?.startsWith('Bearer ')) return true;
  if (!info.cookie) return true; // nothing ambient to abuse; sessionAuth will answer 401
  const source = info.origin || info.referer;
  if (!source) return false;
  try {
    return allowed.has(new URL(source).origin);
  } catch {
    return false;
  }
}

export async function cookieOriginGuard(c: Context, next: Next) {
  const ok = isMutationAllowed(
    {
      method: c.req.method,
      authorization: c.req.header('authorization'),
      cookie: c.req.header('cookie'),
      origin: c.req.header('origin'),
      referer: c.req.header('referer'),
    },
    allowedOrigins(),
  );
  if (!ok) {
    return c.json(
      { error: { message: 'cross-origin request rejected', type: 'auth_error', code: 'origin_not_allowed' } },
      403,
    );
  }
  await next();
}
