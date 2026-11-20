import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import ws from 'ws';
import * as schema from './schema.ts';

try {
  dns.setDefaultResultOrder('ipv4first');
  setDefaultAutoSelectFamilyAttemptTimeout(3000);
} catch {
  // Ignore in environments without node:dns / node:net
}

class IPv4WebSocket extends ws {
  constructor(address: any, protocols?: any, options?: any) {
    const opts = typeof options === 'object' && options !== null ? { ...options, family: 4 } : { family: 4 };
    super(address, protocols, opts);
  }
}

if (typeof globalThis !== 'undefined') {
  neonConfig.webSocketConstructor = IPv4WebSocket;
}

// ---------------------------------------------------------------------------
// Neon HTTP driver — stateless queries (select/insert/update/delete)
// Neon Pool driver — interactive transactions (db.transaction / withTransaction)
// ---------------------------------------------------------------------------

// Tests create users, providers and models. Refuse a non-local DATABASE_URL under the node test
// runner here, not only in apps/api's test-guard, which a test run outside `pnpm test` (IDE runner,
// `tsx --test` with the root .env) skips and then writes fixtures into production.
function assertNotTestAgainstRemote(url: string): void {
  const underTestRunner = !!process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a.startsWith('--test'));
  if (!underTestRunner) return;
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  } catch {}
  const allowed = ['localhost', '127.0.0.1', '::1', ...(process.env.TEST_DB_HOST_ALLOWLIST ?? '').split(',').map((h) => h.trim())];
  if (!host || host.endsWith('.neon.tech') || !allowed.includes(host)) {
    throw new Error(`[db] Refusing to connect to '${host || 'invalid url'}' from a test run; use a local *_test database`);
  }
}

export function getConnectionString(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL ?? 'postgresql://unset:unset@localhost:5432/unset';
  assertNotTestAgainstRemote(url);
  return url;
}

export function getFallbackConnectionString(env: NodeJS.ProcessEnv = process.env): string | null {
  const val = env.DATABASE_URL_FALLBACK?.trim();
  return val ? val : null;
}

/**
 * Neon speaks HTTP/WebSocket on :443; a plain Postgres server speaks the wire
 * protocol on :5432. Pick the driver from the host so the same DATABASE_URL works
 * against Neon in production and against docker-compose / Termux Postgres.
 */
export function isNeonConnection(connectionString: string = getConnectionString()): boolean {
  try {
    const host = new URL(connectionString).hostname;
    return host.endsWith('.neon.tech') || host.includes('neon');
  } catch {
    return false;
  }
}

export function isFailoverEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DB_FAILOVER_ENABLED !== 'false' && Boolean(getFallbackConnectionString(env));
}

// Reused TLS sockets to Neon's HTTP endpoint. Node's default agent drops idle sockets after 5s,
// so every page opened after a short pause paid a fresh TCP + TLS handshake per parallel query
// (about 2.6s for six queries from Indonesia vs 0.3s warm). Neon keeps idle sockets open for at
// least 2 minutes; a socket it closes first fails fast and resilientFetch retries on a new one.
const neonAgent = new https.Agent({ keepAlive: true, maxSockets: 32, timeout: 120_000 });

function nativeIPv4Fetch(urlInput: string | URL | Request, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    try {
      const urlStr = typeof urlInput === 'string' ? urlInput : urlInput instanceof URL ? urlInput.toString() : urlInput.url;
      const u = new URL(urlStr);
      const transport = u.protocol === 'https:' ? https : http;

      const headers: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, init.headers);
        }
      }

      const bodyStr = typeof init?.body === 'string' ? init.body : init?.body ? String(init.body) : undefined;
      if (bodyStr && !headers['Content-Length'] && !headers['content-length']) {
        headers['Content-Length'] = String(Buffer.byteLength(bodyStr));
      }

      const req = transport.request(
        u,
        {
          method: init?.method || 'GET',
          headers,
          agent: u.protocol === 'https:' ? neonAgent : undefined,
          family: 4, // 100% FORCE IPv4 Socket at OS level
          timeout: 15000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const bodyBuffer = Buffer.concat(chunks);
            const responseHeaders = new Headers();
            for (const [key, val] of Object.entries(res.headers)) {
              if (Array.isArray(val)) {
                val.forEach((v) => responseHeaders.append(key, v));
              } else if (val) {
                responseHeaders.set(key, val);
              }
            }
            resolve(
              new Response(bodyBuffer, {
                status: res.statusCode || 200,
                statusText: res.statusMessage || '',
                headers: responseHeaders,
              }),
            );
          });
        },
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy(new Error('Connection timeout'));
      });

      if (bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Resilient fetch wrapper for Neon HTTP queries.
 * Automatically retries transient network drops up to 4 times with backoff before throwing.
 * Uses native node:https with family: 4 to force IPv4 OS sockets directly.
 */
async function resilientFetch(urlInput: string | URL | Request, init?: RequestInit): Promise<Response> {
  const maxRetries = isFailoverEnabled() ? 2 : 4;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await nativeIPv4Fetch(urlInput, init);
      // Do not burn retries on explicit quota/rate-limit/unavailable HTTP responses when fallback is configured
      if (isFailoverEnabled() && (res.status === 402 || res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504)) {
        return res;
      }
      return res;
    } catch (err: unknown) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 200 * Math.pow(1.5, attempt - 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

neonConfig.fetchFunction = resilientFetch;

// ---------------------------------------------------------------------------
// Error classification & Sticky Auto-Failover state (Neon -> Fallback PG)
// ---------------------------------------------------------------------------

export type DbTargetMode = 'primary' | 'fallback';

export interface DbFailoverEvent {
  previousTarget: DbTargetMode;
  activeTarget: DbTargetMode;
  reason: string;
  triggeredAt: string;
  errorMessage?: string;
  errorCode?: string;
}

export interface DbFailoverState {
  activeTarget: DbTargetMode;
  fallbackConfigured: boolean;
  failoverEnabled: boolean;
  failedOverAt: string | null;
  failoverReason: string | null;
  lastErrorMessage: string | null;
}

const FAILOVER_PG_CODES = new Set([
  '53300', // too_many_connections
  '53400', // configuration_limit_exceeded
  '53100', // disk_full
  '53200', // out_of_memory
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08006', // connection_failure
  '08007', // transaction_resolution_unknown
  '08P01', // protocol_violation
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
]);

const FAILOVER_NET_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const FAILOVER_HTTP_STATUSES = new Set([402, 429, 502, 503, 504]);

const FAILOVER_MESSAGE_REGEX =
  /compute time quota|data transfer quota|written data quota|storage quota|project_size_limit|exceeded.*quota|exceeded.*limit|usage limit|account.*suspended|endpoint.*disabled|compute.*suspended|connection timeout|too many connections|server closed the connection unexpectedly|terminating connection due to administrator command|websocket.*closed|error connecting to database|fetch failed|econnrefused|etimedout|enotfound|http status (402|429|502|503|504)/i;

function collectErrorSignals(err: unknown): {
  messages: string[];
  codes: string[];
  statuses: number[];
  names: string[];
} {
  const messages: string[] = [];
  const codes: string[] = [];
  const statuses: number[] = [];
  const names: string[] = [];
  const visited = new Set<unknown>();
  const queue: Array<{ val: unknown; depth: number }> = [{ val: err, depth: 0 }];

  while (queue.length > 0) {
    const item = queue.shift()!;
    const { val, depth } = item;
    if (!val || depth > 5 || visited.has(val)) continue;
    visited.add(val);

    if (typeof val === 'string') {
      messages.push(val);
      continue;
    }
    if (typeof val !== 'object') continue;

    const rec = val as Record<string, unknown>;
    if (typeof rec.name === 'string') names.push(rec.name);
    if (typeof rec.message === 'string') messages.push(rec.message);
    if (typeof rec.code === 'string') codes.push(rec.code);
    if (typeof rec.errno === 'string') codes.push(rec.errno);
    if (typeof rec.status === 'number') statuses.push(rec.status);
    if (typeof rec.statusCode === 'number') statuses.push(rec.statusCode);
    if (typeof rec.httpStatus === 'number') statuses.push(rec.httpStatus);

    if (rec.cause) queue.push({ val: rec.cause, depth: depth + 1 });
    if (rec.sourceError) queue.push({ val: rec.sourceError, depth: depth + 1 });
    if (Array.isArray(rec.errors)) {
      for (const inner of rec.errors) {
        queue.push({ val: inner, depth: depth + 1 });
      }
    }
  }

  return { messages, codes, statuses, names };
}

/**
 * Log-safe error description. Drizzle wraps driver errors as
 * "Failed query: <sql>\nparams: <values>" and the values can be session tokens, OAuth
 * tokens or password hashes, so SQL and params are NEVER returned. Prefers the driver
 * message (deepest cause), prefixes the SQLSTATE/network code, masks URLs, caps length.
 */
export function sanitizeErrorForLog(err: unknown, maxLen = 300): string {
  const { messages, codes } = collectErrorSignals(err);
  // Skip empty messages (e.g. AggregateError has message="" with real errors in .errors)
  const driverMessage = messages.find((m) => m.trim().length > 0 && !/^failed query/i.test(m));
  let msg =
    driverMessage ??
    (messages.length > 0 ? 'query failed' : typeof err === 'string' ? err : 'unknown error');
  msg = msg.replace(/\s*\bparams:[\s\S]*$/i, '');
  msg = msg.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, '<url>');
  msg = msg.replace(/\s+/g, ' ').trim();
  if (msg.length > maxLen) msg = `${msg.slice(0, maxLen)}…`;
  const code = codes[0];
  return code ? `[${code}] ${msg}` : msg;
}

/**
 * Distinguishes Neon quota/limit/connectivity failures (which should trigger fallback)
 * from normal SQL or domain errors (unique violations, syntax errors, insufficient credits).
 */
export function isNeonFailoverError(err: unknown): boolean {
  if (!err) return false;
  const { messages, codes, statuses, names } = collectErrorSignals(err);

  if (names.includes('InsufficientCreditsError')) return false;

  // Never failover on application-level SQL errors (data, constraints, syntax, serialization/deadlock)
  for (const code of codes) {
    if (/^(22|23|42|40001|40P01)/.test(code)) {
      return false;
    }
  }

  for (const code of codes) {
    if (FAILOVER_PG_CODES.has(code) || FAILOVER_NET_CODES.has(code)) {
      return true;
    }
  }

  for (const status of statuses) {
    if (FAILOVER_HTTP_STATUSES.has(status)) {
      return true;
    }
  }

  for (const msg of messages) {
    if (FAILOVER_MESSAGE_REGEX.test(msg)) {
      return true;
    }
  }

  return false;
}

type FailoverListener = (event: DbFailoverEvent) => void | Promise<void>;

let _activeTarget: DbTargetMode = 'primary';
let _failedOverAt: string | null = null;
let _failoverReason: string | null = null;
let _lastErrorMessage: string | null = null;
const _failoverListeners = new Set<FailoverListener>();

function resolveActiveTarget(): DbTargetMode {
  if (_activeTarget === 'fallback' && getFallbackConnectionString()) {
    return 'fallback';
  }
  if (process.env.DB_FORCE_FALLBACK === 'true' && getFallbackConnectionString()) {
    return 'fallback';
  }
  return 'primary';
}

export function getDbFailoverState(): DbFailoverState {
  const fallbackConfigured = Boolean(getFallbackConnectionString());
  const activeTarget = resolveActiveTarget();
  return {
    activeTarget,
    fallbackConfigured,
    failoverEnabled: isFailoverEnabled(),
    failedOverAt:
      _failedOverAt ?? (activeTarget === 'fallback' && process.env.DB_FORCE_FALLBACK === 'true' ? 'forced-by-env' : null),
    failoverReason:
      _failoverReason ?? (activeTarget === 'fallback' && process.env.DB_FORCE_FALLBACK === 'true' ? 'DB_FORCE_FALLBACK=true' : null),
    lastErrorMessage: _lastErrorMessage,
  };
}

export function onDbFailover(listener: FailoverListener): () => void {
  _failoverListeners.add(listener);
  return () => {
    _failoverListeners.delete(listener);
  };
}

export function triggerManualFailover(
  reason: string,
  err?: unknown,
  options?: { force?: boolean },
): boolean {
  if (!getFallbackConnectionString()) {
    return false;
  }
  if (!options?.force && !isFailoverEnabled()) {
    return false;
  }
  if (resolveActiveTarget() === 'fallback') {
    return false;
  }

  const signals = err ? collectErrorSignals(err) : { messages: [], codes: [] };
  const errorMessage = err ? sanitizeErrorForLog(err) : undefined;
  const errorCode = signals.codes[0];
  const triggeredAt = new Date().toISOString();

  _activeTarget = 'fallback';
  _failedOverAt = triggeredAt;
  _failoverReason = reason;
  _lastErrorMessage = errorMessage ?? null;

  console.warn(`[db] FAILOVER ACTIVATED -> switching to fallback database (${reason})${errorMessage ? `: ${errorMessage}` : ''}`);

  const event: DbFailoverEvent = {
    previousTarget: 'primary',
    activeTarget: 'fallback',
    reason,
    triggeredAt,
    errorMessage,
    errorCode,
  };

  for (const listener of _failoverListeners) {
    Promise.resolve()
      .then(() => listener(event))
      .catch((listenerErr) => {
        console.error('[db] failover listener error:', listenerErr);
      });
  }

  return true;
}

export function resetFailoverToPrimary(): void {
  _activeTarget = 'primary';
  _failedOverAt = null;
  _failoverReason = null;
  _lastErrorMessage = null;
}

export function extractExecuteRows<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object') {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}

export interface DbHandle {
  db: NeonHttpDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;
  isNeon: boolean;
  close: () => Promise<void>;
}

export function createDbHandle(connectionString: string, opts?: { max?: number }): DbHandle {
  if (isNeonConnection(connectionString)) {
    const sqlClient = neon(connectionString);
    return {
      db: drizzle(sqlClient, { schema }),
      isNeon: true,
      close: async () => {},
    };
  }
  const client = postgres(connectionString, {
    max: opts?.max ?? 4,
    idle_timeout: 15,
    connect_timeout: 10,
  });
  return {
    db: drizzlePostgres(client, { schema }),
    isNeon: false,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}

let _instance: NeonHttpDatabase<typeof schema> | null = null;
let _poolDb: NeonDatabase<typeof schema> | null = null;
let _localDb: PostgresJsDatabase<typeof schema> | null = null;
let _fallbackDb: NeonHttpDatabase<typeof schema> | PostgresJsDatabase<typeof schema> | null = null;
let _fallbackUrlCached: string | null = null;

function getLocalDb(): PostgresJsDatabase<typeof schema> {
  if (_localDb) return _localDb;

  const client = postgres(getConnectionString(), {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  _localDb = drizzlePostgres(client, { schema });

  return _localDb;
}

function getFallbackDb(): NeonHttpDatabase<typeof schema> {
  const fallbackUrl = getFallbackConnectionString();
  if (!fallbackUrl) {
    throw new Error('[db] DATABASE_URL_FALLBACK is not configured');
  }

  if (_fallbackDb && _fallbackUrlCached === fallbackUrl) {
    return _fallbackDb as unknown as NeonHttpDatabase<typeof schema>;
  }

  if (isNeonConnection(fallbackUrl)) {
    _fallbackDb = drizzle(neon(fallbackUrl), { schema });
  } else {
    const client = postgres(fallbackUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    _fallbackDb = drizzlePostgres(client, { schema });
  }
  _fallbackUrlCached = fallbackUrl;

  return _fallbackDb as unknown as NeonHttpDatabase<typeof schema>;
}

function getPrimaryDb(): NeonHttpDatabase<typeof schema> {
  if (!isNeonConnection()) {
    return getLocalDb() as unknown as NeonHttpDatabase<typeof schema>;
  }

  if (_instance) return _instance;

  const sqlClient = neon(getConnectionString());
  _instance = drizzle(sqlClient, { schema });

  return _instance;
}

function getDb(): NeonHttpDatabase<typeof schema> {
  if (resolveActiveTarget() === 'fallback') {
    return getFallbackDb();
  }
  return getPrimaryDb();
}

function getPoolDb(): NeonDatabase<typeof schema> {
  if (resolveActiveTarget() === 'fallback') {
    return getFallbackDb() as unknown as NeonDatabase<typeof schema>;
  }

  if (!isNeonConnection()) {
    return getLocalDb() as unknown as NeonDatabase<typeof schema>;
  }

  if (_poolDb) return _poolDb;

  const pool = new Pool({
    connectionString: getConnectionString(),
    max: 5, // Free tier friendly pool limit
    idleTimeoutMillis: 10_000, // Close idle sockets after 10s
    connectionTimeoutMillis: 10_000, // Timeout connection attempts after 10s
  });

  // Attach error handler to prevent unhandled EventEmitter error crashes when Neon auto-suspends or resets idle sockets
  pool.on('error', (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[db] Neon pool error (handled):', msg);
  });

  _poolDb = drizzleServerless(pool, { schema });

  return _poolDb;
}

// ---------------------------------------------------------------------------
// Drizzle query chain proxy for seamless Primary -> Fallback retry
// ---------------------------------------------------------------------------

type ReplayStep =
  | { kind: 'prop'; prop: PropertyKey }
  | { kind: 'call'; prop: PropertyKey; args: unknown[] };

function isBuilderOrPromise(val: unknown): val is object {
  if (!val || (typeof val !== 'object' && typeof val !== 'function')) return false;
  return (
    'then' in val ||
    'from' in val ||
    'set' in val ||
    'values' in val ||
    'where' in val ||
    'returning' in val ||
    'execute' in val ||
    'select' in val ||
    'insert' in val ||
    'update' in val ||
    'delete' in val
  );
}

function isRelationalTableBuilder(prop: PropertyKey, steps: ReplayStep[], val: unknown): boolean {
  if (!val || typeof val !== 'object') return false;
  return (
    steps.length === 1 &&
    steps[0]?.kind === 'prop' &&
    steps[0].prop === 'query' &&
    typeof prop === 'string' &&
    ('findFirst' in val || 'findMany' in val)
  );
}

function replayChain(root: unknown, steps: ReplayStep[]): unknown {
  let target: unknown = root;
  for (const step of steps) {
    if (target === null || target === undefined) {
      throw new Error(`[db] Fallback replay failed before ${String(step.prop)}`);
    }
    const rec = target as Record<PropertyKey, unknown>;
    if (step.kind === 'prop') {
      target = rec[step.prop];
    } else {
      const fn = rec[step.prop];
      if (typeof fn !== 'function') {
        throw new Error(`[db] Fallback replay failed: ${String(step.prop)} is not a function`);
      }
      target = (fn as (...args: unknown[]) => unknown).apply(target, step.args);
    }
  }
  return target;
}

function wrapFailoverChain<T extends object>(
  currentTarget: T,
  steps: ReplayStep[],
): T {
  const proxy: T = new Proxy(currentTarget, {
    get(target, prop) {
      const targetRec = target as Record<PropertyKey, unknown>;
      if (prop === 'then' && typeof targetRec.then === 'function') {
        return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(target)
            .catch(async (err) => {
              if (isFailoverEnabled() && isNeonFailoverError(err)) {
                triggerManualFailover('neon_runtime_error', err);
                return await replayChain(getFallbackDb(), steps);
              }
              throw err;
            })
            .then(onFulfilled, onRejected);
      }

      if (prop === 'catch' && typeof targetRec.then === 'function') {
        return (onRejected?: (e: unknown) => unknown) =>
          (proxy as unknown as Promise<unknown>).then(undefined, onRejected);
      }

      if (prop === 'finally' && typeof targetRec.then === 'function') {
        return (onFinally?: () => void) =>
          (proxy as unknown as Promise<unknown>).then(
            (v) => {
              onFinally?.();
              return v;
            },
            (e) => {
              onFinally?.();
              throw e;
            },
          );
      }

      const val = Reflect.get(target, prop, target);
      if (typeof val === 'function') {
        return (...args: unknown[]) => {
          const nextTarget = (val as (...a: unknown[]) => unknown).apply(target, args);
          if (isBuilderOrPromise(nextTarget)) {
            return wrapFailoverChain(nextTarget, [...steps, { kind: 'call', prop, args }]);
          }
          return nextTarget;
        };
      }

      if (isRelationalTableBuilder(prop, steps, val)) {
        return wrapFailoverChain(val as object, [...steps, { kind: 'prop', prop }]);
      }

      return val;
    },
  });

  return proxy;
}

// ---------------------------------------------------------------------------
// Interactive Transactions — Routed to Neon WebSocket Pool (or Fallback PG)
// ---------------------------------------------------------------------------
export async function withTransaction<T>(
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  if (resolveActiveTarget() === 'fallback') {
    return (getFallbackDb() as unknown as NeonDatabase<typeof schema>).transaction(fn);
  }
  try {
    return await getPoolDb().transaction(fn);
  } catch (err) {
    if (isFailoverEnabled() && isNeonFailoverError(err)) {
      triggerManualFailover('neon_transaction_error', err);
      return (getFallbackDb() as unknown as NeonDatabase<typeof schema>).transaction(fn);
    }
    throw err;
  }
}

// Proxy so `db.select()` etc. uses neon-http, `db.transaction()` routes to Neon Pool,
// and Neon quota/connectivity failures fail over automatically to DATABASE_URL_FALLBACK!
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_t, prop) {
    if (prop === 'transaction') {
      return withTransaction;
    }
    const activeDb = getDb();
    const val = Reflect.get(activeDb, prop);
    if (resolveActiveTarget() === 'primary' && isFailoverEnabled()) {
      if (typeof val === 'function') {
        return (...args: unknown[]) => {
          const nextTarget = (val as (...a: unknown[]) => unknown).apply(activeDb, args);
          if (isBuilderOrPromise(nextTarget)) {
            return wrapFailoverChain(nextTarget, [{ kind: 'call', prop, args }]);
          }
          return nextTarget;
        };
      }
      if (prop === 'query' && val && typeof val === 'object') {
        return wrapFailoverChain(val as object, [{ kind: 'prop', prop }]);
      }
    }
    return val;
  },
});

export { schema };
export * from './schema.ts';
export * from './parity.ts';
export * from './sync.ts';
