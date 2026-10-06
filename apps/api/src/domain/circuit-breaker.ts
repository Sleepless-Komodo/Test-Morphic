import { db, schema as s } from '@morphic/db';
import { eq } from 'drizzle-orm';
import { redis } from '../lib/redis';

const FAILURE_THRESHOLD = Number(process.env.CB_FAILURE_THRESHOLD ?? 5);
const FAILURE_WINDOW_MS = Number(process.env.CB_FAILURE_WINDOW_MS ?? 60_000);
const OPEN_DURATION_MS = Number(process.env.CB_OPEN_DURATION_MS ?? 120_000);
// Live state lives in Redis (or process memory without REDIS_URL) and expires on its own.
const STATE_TTL_MS = 5 * 60_000;

export type CBState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerState {
  state: CBState;
  failures: number;
  openUntil: string | null;
  lastFailure: string | null;
}

const DEFAULT_STATE: CircuitBreakerState = {
  state: 'closed',
  failures: 0,
  openUntil: null,
  lastFailure: null,
};

type Hash = Record<string, string>;

/** Minimal hash store: Redis when configured, otherwise a per-process Map with the same TTL semantics. */
const memory = new Map<string, { h: Hash; expiresAt: number }>();
const store = {
  async get(key: string): Promise<Hash> {
    if (redis) return redis.hgetall(key);
    const e = memory.get(key);
    if (!e || e.expiresAt <= Date.now()) {
      memory.delete(key);
      return {};
    }
    return e.h;
  },
  /** Atomically bump the failure counter; a fresh counter starts a new failure window. */
  async incrFailures(key: string): Promise<number> {
    if (redis) {
      const n = await redis.hincrby(key, 'failures', 1);
      if (n === 1) await redis.pexpire(key, FAILURE_WINDOW_MS);
      return n;
    }
    const h = await this.get(key);
    const n = Number(h.failures ?? 0) + 1;
    const prev = memory.get(key);
    memory.set(key, { h: { ...h, failures: String(n) }, expiresAt: n === 1 || !prev ? Date.now() + FAILURE_WINDOW_MS : prev.expiresAt });
    return n;
  },
  async set(key: string, fields: Hash, ttlMs: number): Promise<void> {
    if (redis) {
      await redis.multi().hset(key, fields).pexpire(key, ttlMs).exec();
      return;
    }
    memory.set(key, { h: { ...(await this.get(key)), ...fields }, expiresAt: Date.now() + ttlMs });
  },
  async del(key: string): Promise<void> {
    if (redis) await redis.del(key);
    else memory.delete(key);
  },
};

const keyFor = (providerId: string) => `cb:provider:${providerId}`;

function toState(h: Hash): CircuitBreakerState {
  if (!h.state && !h.failures) return DEFAULT_STATE;
  return {
    state: (h.state as CBState) || 'closed',
    failures: Number(h.failures ?? 0),
    openUntil: h.openUntil || null,
    lastFailure: h.lastFailure || null,
  };
}

/**
 * Mirror a state TRANSITION to providers.circuit_breaker_state so the dashboards can show it.
 * Only transitions write to Postgres; per-request failure/success counting never does.
 */
async function persistTransition(providerId: string, state: CircuitBreakerState): Promise<void> {
  try {
    await db.update(s.providers).set({ circuitBreakerState: state }).where(eq(s.providers.id, providerId));
  } catch (e) {
    console.error(`[circuit-breaker] failed to persist state for provider ${providerId}:`, e);
  }
}

export async function getCircuitState(providerId: string): Promise<CircuitBreakerState> {
  try {
    return toState(await store.get(keyFor(providerId)));
  } catch (e) {
    console.error(`[circuit-breaker] failed to fetch state for provider ${providerId}:`, e);
    return DEFAULT_STATE;
  }
}

/**
 * Returns true if circuit is OPEN (meaning requests should be blocked or routed to fallback).
 * Automatically transitions OPEN -> HALF-OPEN if openUntil duration has elapsed.
 */
export async function isCircuitOpen(providerId: string): Promise<boolean> {
  const state = await getCircuitState(providerId);
  if (state.state !== 'open') return false;
  if (state.openUntil && new Date(state.openUntil) <= new Date()) {
    // Transition to half-open to allow a trial request
    try {
      await store.set(keyFor(providerId), { state: 'half-open' }, STATE_TTL_MS);
    } catch (e) {
      console.error(`[circuit-breaker] failed to update state for provider ${providerId}:`, e);
    }
    await persistTransition(providerId, { ...state, state: 'half-open' });
    return false;
  }
  return true;
}

/**
 * Record a failure for a provider.
 * If failures within window reach threshold (or the half-open trial fails), circuit opens.
 */
export async function recordFailure(providerId: string): Promise<void> {
  const key = keyFor(providerId);
  try {
    const prev = await getCircuitState(providerId);
    const failures = await store.incrFailures(key);
    const now = new Date();
    if (prev.state !== 'open' && (failures >= FAILURE_THRESHOLD || prev.state === 'half-open')) {
      const opened: CircuitBreakerState = {
        state: 'open',
        failures,
        openUntil: new Date(now.getTime() + OPEN_DURATION_MS).toISOString(),
        lastFailure: now.toISOString(),
      };
      await store.set(key, { state: 'open', openUntil: opened.openUntil!, lastFailure: opened.lastFailure! }, OPEN_DURATION_MS + STATE_TTL_MS);
      await persistTransition(providerId, opened);
    } else {
      await store.set(key, { lastFailure: now.toISOString() }, prev.state === 'open' ? OPEN_DURATION_MS + STATE_TTL_MS : FAILURE_WINDOW_MS);
    }
  } catch (e) {
    console.error(`[circuit-breaker] failed to record failure for provider ${providerId}:`, e);
  }
}

/**
 * Record a success for a provider.
 * Resets state to CLOSED and clears failure counts.
 */
export async function recordSuccess(providerId: string): Promise<void> {
  try {
    const state = await getCircuitState(providerId);
    if (state.state === 'closed' && state.failures === 0) return;
    await store.del(keyFor(providerId));
    if (state.state !== 'closed') await persistTransition(providerId, DEFAULT_STATE);
  } catch (e) {
    console.error(`[circuit-breaker] failed to record success for provider ${providerId}:`, e);
  }
}
