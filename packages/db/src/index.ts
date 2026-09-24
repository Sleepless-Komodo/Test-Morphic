import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './schema.ts';

if (typeof globalThis !== 'undefined') {
  neonConfig.webSocketConstructor = neonConfig.webSocketConstructor || ws;
}

// ---------------------------------------------------------------------------
// Neon HTTP driver — stateless queries (select/insert/update/delete)
// Neon Pool driver — interactive transactions (db.transaction / withTransaction)
// ---------------------------------------------------------------------------

function getConnectionString(): string {
  return process.env.DATABASE_URL ?? 'postgresql://unset:unset@localhost:5432/unset';
}

/**
 * Resilient fetch wrapper for Neon HTTP queries.
 * Automatically retries transient network drops (e.g. `TypeError: fetch failed`, socket timeouts,
 * connection resets) up to 3 times with backoff before throwing.
 */
async function resilientFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err: any) {
      lastError = err;
      const msg = err?.message ?? '';
      const code = err?.cause?.code ?? '';
      const isTransient =
        msg.includes('fetch failed') ||
        msg.includes('connecting to database') ||
        err?.name === 'TypeError' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        code === 'UND_ERR_SOCKET';

      if (isTransient && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 100));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

neonConfig.fetchFunction = resilientFetch;

let _instance: NeonHttpDatabase<typeof schema> | null = null;
let _poolDb: NeonDatabase<typeof schema> | null = null;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (_instance) return _instance;

  const sql = neon(getConnectionString());
  _instance = drizzle(sql, { schema });

  return _instance;
}

function getPoolDb(): NeonDatabase<typeof schema> {
  if (_poolDb) return _poolDb;

  const pool = new Pool({
    connectionString: getConnectionString(),
    max: 5, // Free tier friendly pool limit
    idleTimeoutMillis: 10_000, // Close idle sockets after 10s
    connectionTimeoutMillis: 10_000, // Timeout connection attempts after 10s
  });

  // Attach error handler to prevent unhandled EventEmitter error crashes when Neon auto-suspends or resets idle sockets
  pool.on('error', (err: any) => {
    console.error('[db] Neon pool error (handled):', err?.message ?? err);
  });

  _poolDb = drizzleServerless(pool, { schema });

  return _poolDb;
}

// ---------------------------------------------------------------------------
// Interactive Transactions — Routed to Neon WebSocket Pool
// ---------------------------------------------------------------------------
export async function withTransaction<T>(
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  return getPoolDb().transaction(fn);
}

// Proxy so `db.select()` etc. uses neon-http, while `db.transaction()` routes to Neon Pool!
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_t, prop) {
    if (prop === 'transaction') {
      return (fn: (tx: any) => Promise<any>) => getPoolDb().transaction(fn);
    }
    return Reflect.get(getDb(), prop);
  },
});

export { schema };
export * from './schema.ts';
