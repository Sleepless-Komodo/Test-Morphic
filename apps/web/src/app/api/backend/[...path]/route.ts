import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sessionExpiredResponse } from '@/lib/session-expired-response';
import { MAX_API_KEYS_PER_USER } from '@/lib/gateway-limits';

interface AllowedRoute {
  prefix: string;
  methods: string[];
}

const ALLOWED_ROUTES: AllowedRoute[] = [
  { prefix: '/v1/payments', methods: ['GET', 'POST'] },
  { prefix: '/v1/account', methods: ['GET'] },
  { prefix: '/v1/redeem', methods: ['POST'] },
  { prefix: '/v1/keys', methods: ['GET', 'POST', 'DELETE'] },
  { prefix: '/v1/catalog', methods: ['GET'] },
];

function isRouteAllowed(path: string, method: string): boolean {
  for (const route of ALLOWED_ROUTES) {
    if (!route.methods.includes(method)) continue;
    if (path === route.prefix || path.startsWith(`${route.prefix}/`)) {
      return true;
    }
  }
  return false;
}

// In-Memory proxy rate limiter per IP: max 60 req/min
const proxyRateLimitMap = new Map<string, { count: number; expiresAt: number }>();

function checkProxyRateLimit(ip: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  if (proxyRateLimitMap.size > 2000) {
    for (const [k, v] of proxyRateLimitMap.entries()) {
      if (v.expiresAt <= now) proxyRateLimitMap.delete(k);
    }
  }
  const key = `${ip}:${Math.floor(now / windowMs)}`;
  const entry = proxyRateLimitMap.get(key);
  if (!entry || entry.expiresAt <= now) {
    proxyRateLimitMap.set(key, { count: 1, expiresAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

async function proxyRequest(req: NextRequest) {
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/api\/backend/, '') || '/';

  // 1. IP Rate Limiting Before any DB or Session Check
  const forwardedFor = req.headers.get('x-forwarded-for');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');

  if (!checkProxyRateLimit(clientIp, 60, 60_000)) {
    return NextResponse.json(
      { error: { message: 'Too Many Requests to API proxy, please slow down.', code: 'proxy_rate_limited' } },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  // 2. Path Traversal & Encoding Check
  let decodedForCheck: string;
  try {
    decodedForCheck = decodeURIComponent(rawPath).toLowerCase();
  } catch {
    return NextResponse.json(
      { error: { message: 'Invalid request path', code: 'bad_path' } },
      { status: 400 }
    );
  }

  if (decodedForCheck.includes('..') || decodedForCheck.includes('%2e%2e')) {
    return NextResponse.json(
      { error: { message: 'Invalid request path', code: 'bad_path' } },
      { status: 400 }
    );
  }

  // 3. Allowlist Check (Path & Method)
  if (!isRouteAllowed(rawPath, req.method)) {
    return NextResponse.json(
      { error: { message: 'Not found', code: 'not_found' } },
      { status: 404 }
    );
  }

  // 4. CSRF / Origin Validation for Non-GET Requests
  const NON_GET_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (NON_GET_METHODS.includes(req.method)) {
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');

    const reqOrigin = req.nextUrl.origin;
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
      : null;

    let requestSourceOrigin: string | null = null;
    if (origin) {
      try {
        requestSourceOrigin = new URL(origin).origin;
      } catch {}
    } else if (referer) {
      try {
        requestSourceOrigin = new URL(referer).origin;
      } catch {}
    }

    const isValidOrigin =
      requestSourceOrigin &&
      (requestSourceOrigin === reqOrigin ||
        (configuredAppUrl && requestSourceOrigin === configuredAppUrl));

    if (!isValidOrigin) {
      return NextResponse.json(
        { error: { message: 'CSRF validation failed: Invalid origin', code: 'csrf_forbidden' } },
        { status: 403 }
      );
    }
  }

  // 4. Require Valid Session & Re-derive Authorization Header
  const reqHeaders = new Headers(req.headers);
  reqHeaders.delete('host');
  reqHeaders.delete('cookie');
  reqHeaders.delete('authorization');

  // Reads may trust the 5-minute signed cookie cache. Writes always ask the database, so a
  // session that was revoked or expired is refused at once instead of up to 5 minutes later.
  const isWrite = NON_GET_METHODS.includes(req.method);

  let sessionToken: string | undefined;
  let authedUserId: string | undefined;
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
      query: isWrite ? { disableCookieCache: true } : undefined,
    });
    sessionToken = session?.session?.token;
    authedUserId = session?.user?.id;
  } catch {
    // Session lookup error
  }

  if (!sessionToken) {
    return sessionExpiredResponse(req);
  }

  reqHeaders.set('authorization', `Bearer ${sessionToken}`);

  // Enforce the per-account API key cap on creation
  if (rawPath === '/v1/keys' && req.method === 'POST' && authedUserId) {
    try {
      const { db, schema: s } = await import('@morphic/db');
      const { eq, sql } = await import('drizzle-orm');
      const [kc] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(s.apiKeys)
        .where(eq(s.apiKeys.userId, authedUserId));
      if ((kc?.count ?? 0) >= MAX_API_KEYS_PER_USER) {
        return NextResponse.json(
          {
            error: {
              message: `Batas maksimal ${MAX_API_KEYS_PER_USER} API key telah tercapai (${MAX_API_KEYS_PER_USER}/${MAX_API_KEYS_PER_USER}). Hapus key lama yang tidak terpakai untuk membuat key baru.`,
              code: 'max_keys_exceeded',
            },
          },
          { status: 400 },
        );
      }
    } catch (err) {
      console.warn('[proxy] Error checking api_keys count:', err);
    }
  }

  // 5. Proxy Request to Backend Target URL
  const defaultTarget = `http://localhost:${process.env.API_PORT || 8787}`;
  let configuredTarget =
    process.env.INTERNAL_API_URL ||
    (process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_API_URL : null) ||
    defaultTarget;

  configuredTarget = configuredTarget.replace(/\/+$/, '');

  // Guard against circular proxy loop if target is accidentally set to the web app itself
  const targetBase =
    configuredTarget === req.nextUrl.origin
      ? defaultTarget
      : configuredTarget;

  const targetUrl = `${targetBase}${rawPath}${url.search}`;

  try {
    const isBodyAllowed = req.method !== 'GET' && req.method !== 'HEAD';
    const body = isBodyAllowed ? await req.blob() : undefined;

    const res = await fetch(targetUrl, {
      method: req.method,
      headers: reqHeaders,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    // The bearer token comes from a session this proxy just accepted, so a 401 here means the
    // gateway no longer honours it. Treat it like any other expired session.
    if (res.status === 401) {
      void res.body?.cancel();
      return sessionExpiredResponse(req);
    }

    const resHeaders = new Headers(res.headers);
    resHeaders.delete('content-encoding');
    resHeaders.delete('content-length');

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return NextResponse.json(
        { error: { message: 'Backend request timed out', code: 'gateway_timeout' } },
        { status: 504 }
      );
    }

    console.error('[proxy] backend request failed:', err);
    return NextResponse.json(
      { error: { message: 'Service temporarily unavailable', code: 'proxy_error' } },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
export const OPTIONS = proxyRequest;

