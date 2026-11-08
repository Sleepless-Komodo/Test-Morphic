import type { Context } from 'hono';

const INTERNAL_CALL = Symbol('morphic.internalCall');

export interface InternalCallContext {
  requestId?: string;
  clientIp?: string;
  ipRateLimited?: boolean;
}

/**
 * Wraps internal-only request metadata in a module-private Symbol binding for
 * in-process `app.request(path, init, env)` calls. External HTTP clients cannot
 * forge or inject Symbol keys on `c.env`.
 */
export function createInternalCallEnv(ctx: InternalCallContext): Record<PropertyKey, unknown> {
  return { [INTERNAL_CALL]: ctx };
}

export function getInternalCallContext(c: Context): InternalCallContext | undefined {
  const env = c.env as Record<PropertyKey, unknown> | undefined;
  if (!env || typeof env !== 'object') return undefined;
  return env[INTERNAL_CALL] as InternalCallContext | undefined;
}
