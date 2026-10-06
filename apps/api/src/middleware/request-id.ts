import { randomUUID } from 'node:crypto';
import type { Context, Next } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

/**
 * Every /v1 response carries X-Request-Id, and every JSON error body carries the same id as
 * error.request_id. The id is always server-generated: it keys request_logs/usage_records rows
 * (UNIQUE), so a client-supplied X-Request-Id must never be reused.
 */
export async function requestId(c: Context, next: Next) {
  const id = randomUUID();
  c.set('requestId', id);
  await next();
  c.res.headers.set('X-Request-Id', id);

  if (c.res.status < 400 || !c.res.headers.get('content-type')?.includes('application/json')) return;
  const body = await c.res
    .clone()
    .json()
    .catch(() => null);
  if (!body || typeof body.error !== 'object' || body.error === null) return;
  body.error.request_id = id;
  const headers = new Headers(c.res.headers);
  headers.delete('content-length');
  c.res = new Response(JSON.stringify(body), { status: c.res.status, headers });
}
