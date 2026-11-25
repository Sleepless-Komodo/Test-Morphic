import http from 'node:http';
import https from 'node:https';

export const CONNECT_TIMEOUT_MS = 5_000;
export const IDLE_TIMEOUT_MS = 15_000;
export const RETRY_BUDGET_MS = 30_000;
export const MAX_ATTEMPTS = 3;

// Reused TLS sockets to Neon's HTTP endpoint. Node's default agent drops idle sockets after 5s,
// so every page opened after a short pause paid a fresh TCP + TLS handshake per parallel query
// (about 2.6s for six queries from Indonesia vs 0.3s warm). Reads only: a socket Neon closed
// while this process was frozen fails the request after it was sent, and only a read may be resent.
const readAgent = new https.Agent({ keepAlive: true, maxSockets: 32, timeout: 120_000 });

// Node leaves `req.reusedSocket` false when a queued request is handed a freed keep-alive socket,
// and such a socket never emits `secureConnect` again.
const establishedSockets = new WeakSet<object>();

/** `connect`: the request never left this host. `request`: the server may have executed it. */
export type NeonFailurePhase = 'connect' | 'request';

export class NeonRequestError extends Error {
  readonly phase: NeonFailurePhase;
  readonly code?: string;

  constructor(cause: Error, phase: NeonFailurePhase) {
    super(cause.message, { cause });
    this.name = cause.name;
    this.phase = phase;
    this.code = (cause as NodeJS.ErrnoException).code;
  }
}

export interface DbConnectionIssue {
  source: 'http' | 'transaction';
  kind: 'read' | 'write';
  attempts: number;
  error: unknown;
}

type IssueListener = (issue: DbConnectionIssue) => void | Promise<void>;
const issueListeners = new Set<IssueListener>();

/** Called when a primary-database request finally fails for connectivity reasons. */
export function onDbConnectionIssue(listener: IssueListener): () => void {
  issueListeners.add(listener);
  return () => {
    issueListeners.delete(listener);
  };
}

/** Listener failures are logged and never reach the query that triggered them. */
export function emitDbConnectionIssue(issue: DbConnectionIssue): void {
  for (const listener of issueListeners) {
    Promise.resolve()
      .then(() => listener(issue))
      .catch(() => console.error('[db] connection issue listener failed'));
  }
}

const SIDE_EFFECT_RE =
  /\b(nextval|setval|set_config|pg_advisory\w*|pg_try_advisory\w*|pg_notify|pg_cancel_backend|pg_terminate_backend|dblink\w*|lo_\w+)\s*\(/i;
const LOCK_RE = /\bfor\s+(?:no\s+key\s+update|update|key\s+share|share)\b/i;

/** Conservative: anything not recognised as a plain single SELECT counts as a write. */
export function isReadOnlySql(query: string): boolean {
  const q = query.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '');
  if (!/^select\b/i.test(q)) return false;
  if (/;\s*\S/.test(q)) return false;
  return !/\binto\b/i.test(q) && !LOCK_RE.test(q) && !SIDE_EFFECT_RE.test(q);
}

/** Body of Neon's HTTP API: `{query, params}`, or `{queries: [...]}` for a batch. */
export function isReadOnlyBody(body: string | undefined): boolean {
  if (!body) return false;
  try {
    const parsed = JSON.parse(body) as { query?: unknown; queries?: unknown };
    if (Array.isArray(parsed.queries)) {
      return (
        parsed.queries.length > 0 &&
        parsed.queries.every((q) => typeof q?.query === 'string' && isReadOnlySql(q.query))
      );
    }
    return typeof parsed.query === 'string' && isReadOnlySql(parsed.query);
  } catch {
    return false;
  }
}

export interface SendOptions {
  readOnly: boolean;
  idleTimeoutMs: number;
  connectTimeoutMs: number;
}

/** One attempt over an IPv4 socket. Rejects with NeonRequestError. */
export function sendOnce(
  urlInput: string | URL | Request,
  init: RequestInit | undefined,
  opts: SendOptions,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const urlStr = typeof urlInput === 'string' ? urlInput : urlInput instanceof URL ? urlInput.toString() : urlInput.url;
    const u = new URL(urlStr);
    const secure = u.protocol === 'https:';
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const body = typeof init?.body === 'string' ? init.body : init?.body ? String(init.body) : undefined;
    if (body && !headers['content-length']) headers['content-length'] = String(Buffer.byteLength(body));

    let connected = false;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    const markConnected = () => {
      connected = true;
      clearTimeout(connectTimer);
    };
    const fail = (err: Error) => {
      clearTimeout(connectTimer);
      reject(new NeonRequestError(err, connected ? 'request' : 'connect'));
    };

    const req = (secure ? https : http).request(
      u,
      {
        method: init?.method || 'GET',
        headers,
        agent: opts.readOnly && secure ? readAgent : false,
        family: 4,
        timeout: opts.idleTimeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('error', fail);
        res.on('end', () => {
          const responseHeaders = new Headers();
          for (const [key, val] of Object.entries(res.headers)) {
            if (Array.isArray(val)) val.forEach((v) => responseHeaders.append(key, v));
            else if (val) responseHeaders.set(key, val);
          }
          const status = res.statusCode || 200;
          const bodyless = status === 204 || status === 205 || status === 304;
          resolve(
            new Response(bodyless ? null : Buffer.concat(chunks), {
              status,
              statusText: res.statusMessage || '',
              headers: responseHeaders,
            }),
          );
        });
      },
    );

    req.on('socket', (socket) => {
      if (req.reusedSocket || establishedSockets.has(socket)) {
        markConnected();
        return;
      }
      connectTimer = setTimeout(() => {
        req.destroy(Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' }));
      }, opts.connectTimeoutMs);
      socket.once(secure ? 'secureConnect' : 'connect', () => {
        establishedSockets.add(socket);
        markConnected();
      });
    });
    req.on('error', fail);
    req.on('timeout', () => {
      req.destroy(Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' }));
    });

    if (body) req.write(body);
    req.end();
  });
}

export interface NeonFetchOptions {
  connectTimeoutMs?: number;
  idleTimeoutMs?: number;
  budgetMs?: number;
  maxAttempts?: number;
}

/** Randomised so queries that failed together do not all reconnect together. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = 200 * attempt;
  return base + Math.floor(random() * base);
}

/**
 * Fetch for Neon's HTTP driver. A write whose outcome is unknown is never resent: the server may
 * have committed it. Reads, and anything that failed before connecting, are retried within a budget.
 */
export function createNeonFetch(options: NeonFetchOptions = {}) {
  const connectTimeoutMs = options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;
  const idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
  const budgetMs = options.budgetMs ?? RETRY_BUDGET_MS;
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;

  return async function neonFetch(urlInput: string | URL | Request, init?: RequestInit): Promise<Response> {
    const readOnly = isReadOnlyBody(typeof init?.body === 'string' ? init.body : undefined);
    const deadline = Date.now() + budgetMs;

    for (let attempt = 1; ; attempt++) {
      try {
        const remaining = Math.max(1, deadline - Date.now());
        return await sendOnce(urlInput, init, {
          readOnly,
          idleTimeoutMs: Math.min(idleTimeoutMs, remaining),
          connectTimeoutMs: Math.min(connectTimeoutMs, remaining),
        });
      } catch (err) {
        const phase = err instanceof NeonRequestError ? err.phase : 'request';
        const delay = retryDelayMs(attempt);
        const retryable = readOnly || phase === 'connect';
        if (!retryable || attempt >= maxAttempts || Date.now() + delay >= deadline) {
          emitDbConnectionIssue({ source: 'http', kind: readOnly ? 'read' : 'write', attempts: attempt, error: err });
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };
}
