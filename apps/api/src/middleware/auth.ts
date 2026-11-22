import { createHash } from 'node:crypto';
import type { Context, Next } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { db, schema as s } from '@morphic/db';
import { eq, and } from 'drizzle-orm';
import { anthropicError } from '@morphic/shared/anthropic';
import { checkRateLimit, trackConcurrency, releaseConcurrency } from '../ratelimit';
import { getTrustedClientIp } from '../lib/ip';
import { getInternalCallContext } from '../lib/internal-context';

export interface AuthedKey {
  keyId: string;
  userId: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    apiKey: AuthedKey;
  }
}

export type ErrorEnvelopeFormat = 'openai' | 'anthropic';

export interface ApiKeyAuthOptions {
  /** Also accept Anthropic-style `x-api-key`. Inference routes only. */
  allowXApiKey?: boolean;
  /** Protocol-specific error envelope format (defaults to `'openai'`). */
  errorFormat?: ErrorEnvelopeFormat;
}

function authFailed(
  c: Context,
  status: 401 | 403,
  message: string,
  code: string,
  format: ErrorEnvelopeFormat = 'openai',
) {
  if (format === 'anthropic') {
    const type = status === 403 ? 'permission_error' : 'authentication_error';
    return c.json(anthropicError(type, message), status as ContentfulStatusCode);
  }
  return c.json({ error: { message, type: 'auth_error', code } }, status);
}

interface CachedKeyAuth {
  keyId: string;
  userId: string;
  expiresAt: Date | null;
  suspended: boolean;
  cachedAt: number;
  touchedAt: number;
}

// Valid keys only, keyed by SHA-256 hash, so random-key floods never evict real entries.
// Suspend/revoke written by apps/web (another process) take effect within the TTL.
const AUTH_CACHE_MAX_ENTRIES = 2000;
const LAST_USED_DEBOUNCE_MS = 60_000;
const authCache = new Map<string, CachedKeyAuth>();

function authCacheTtlMs(): number {
  const n = Number(process.env.API_KEY_AUTH_CACHE_TTL_MS ?? 30_000);
  return Number.isFinite(n) && n >= 0 ? n : 30_000;
}

/** Drop cached auth for one key (rotate/delete in this process), or everything. */
export function invalidateApiKeyAuthCache(keyId?: string): void {
  if (keyId === undefined) {
    authCache.clear();
    return;
  }
  for (const [hash, entry] of authCache) {
    if (entry.keyId === keyId) authCache.delete(hash);
  }
}

async function lookupKeyAuth(hash: string): Promise<CachedKeyAuth | null> {
  const now = Date.now();
  const cached = authCache.get(hash);
  if (cached && now - cached.cachedAt < authCacheTtlMs()) return cached;

  const [row] = await db
    .select({
      id: s.apiKeys.id,
      userId: s.apiKeys.userId,
      expiresAt: s.apiKeys.expiresAt,
      suspended: s.users.suspended,
    })
    .from(s.apiKeys)
    .leftJoin(s.users, eq(s.users.id, s.apiKeys.userId))
    .where(and(eq(s.apiKeys.keyHash, hash), eq(s.apiKeys.status, 'active')))
    .limit(1);

  authCache.delete(hash);
  if (!row) return null;

  const entry: CachedKeyAuth = {
    keyId: row.id,
    userId: row.userId,
    expiresAt: row.expiresAt,
    // A missing user row is treated like a suspended account, as before.
    suspended: row.suspended ?? true,
    cachedAt: now,
    touchedAt: cached?.keyId === row.id ? cached.touchedAt : 0,
  };
  if (authCache.size >= AUTH_CACHE_MAX_ENTRIES) {
    const oldest = authCache.keys().next().value;
    if (oldest !== undefined) authCache.delete(oldest);
  }
  authCache.set(hash, entry);
  return entry;
}

/** mp-* key (Bearer, or `x-api-key` when allowed) → SHA-256 lookup → user. */
export function apiKeyAuth(options: ApiKeyAuthOptions = {}) {
  const format = options.errorFormat ?? 'openai';
  return async (c: Context, next: Next) => {
    const bearer = c.req.header('authorization');
    const apiKeyHeader = options.allowXApiKey ? c.req.header('x-api-key') : undefined;
    const raw = bearer?.startsWith('Bearer mp-')
      ? bearer.slice('Bearer '.length).trim()
      : apiKeyHeader?.startsWith('mp-')
        ? apiKeyHeader.trim()
        : null;

    if (!raw) {
      return authFailed(c, 401, 'missing or invalid api key', 'missing_api_key', format);
    }

    const hash = createHash('sha256').update(raw).digest('hex');

    const key = await lookupKeyAuth(hash);

    if (!key) {
      return authFailed(c, 401, 'invalid or revoked api key', 'invalid_api_key', format);
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      return authFailed(c, 401, 'api key has expired', 'api_key_expired', format);
    }

    if (key.suspended) {
      return authFailed(c, 403, 'account suspended', 'account_suspended', format);
    }

    // Debounced and not awaited: at most one write per key per minute keeps pending writes bounded.
    const now = Date.now();
    if (now - key.touchedAt >= LAST_USED_DEBOUNCE_MS) {
      key.touchedAt = now;
      db.update(s.apiKeys)
        .set({ lastUsedAt: new Date(now) })
        .where(eq(s.apiKeys.id, key.keyId))
        .catch(() => {});
    }

    c.set('apiKey', { keyId: key.keyId, userId: key.userId });
    await next();
  };
}

function rateLimited(
  c: Context,
  message: string,
  code: string,
  retryAfter: number,
  format: ErrorEnvelopeFormat = 'openai',
) {
  c.header('Retry-After', String(retryAfter));
  if (format === 'anthropic') {
    return c.json(anthropicError('rate_limit_error', message), 429);
  }
  return c.json({ error: { message, type: 'rate_limit_error', code } }, 429);
}

function resolveIpRpm(): number {
  const n = Number(process.env.GATEWAY_IP_RPM ?? 300);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 300;
}

/** Per-IP flood guard factory; emits standard `X-RateLimit-*` + `Retry-After` headers (FIX-P1-04). */
export function createIpRateLimit(options: { errorFormat?: ErrorEnvelopeFormat } = {}) {
  const format = options.errorFormat ?? 'openai';
  return async (c: Context, next: Next) => {
    if (!getInternalCallContext(c)?.ipRateLimited) {
      const ip = getTrustedClientIp(c);
      // No resolvable IP means every such caller would share one bucket; skip rather than block them all.
      if (ip !== 'unknown') {
        const rpm = resolveIpRpm();
        const rl = await checkRateLimit(ip, rpm, 'rlip');
        c.header('X-RateLimit-Limit-Requests', String(rpm));
        c.header('X-RateLimit-Remaining-Requests', String(rl.remaining));
        if (!rl.ok) {
          return rateLimited(
            c,
            'too many requests from this IP address',
            'ip_rate_limit_exceeded',
            rl.retryAfter,
            format,
          );
        }
      }
    }
    await next();
  };
}

/** Default OpenAI-format per-IP flood guard for the gateway. */
export const ipRateLimit = createIpRateLimit();

export function gatewayGuards(limit: {
  rpm: number;
  concurrency: number;
  errorFormat?: ErrorEnvelopeFormat;
}) {
  const format = limit.errorFormat ?? 'openai';
  return async (c: Context, next: Next) => {
    const { keyId } = c.get('apiKey');

    const rl = await checkRateLimit(keyId, limit.rpm);
    c.header('X-RateLimit-Limit-Requests', String(limit.rpm));
    c.header('X-RateLimit-Remaining-Requests', String(rl.remaining));
    if (!rl.ok) {
      return rateLimited(
        c,
        `rate limit exceeded, please retry after ${rl.retryAfter} seconds`,
        'rate_limit_exceeded',
        rl.retryAfter,
        format,
      );
    }

    const slot = await trackConcurrency(keyId, limit.concurrency);
    if (!slot.acquired) {
      return rateLimited(c, 'concurrency limit exceeded', 'concurrency_limit_exceeded', 1, format);
    }
    try {
      await next();
    } finally {
      await releaseConcurrency(keyId, slot.token);
    }
  };
}
