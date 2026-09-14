import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { neon, Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import ws from 'ws';
import * as schema from './schema.ts';

// Required for Pool (WebSocket-based) connections in Node.js
neonConfig.webSocketConstructor = ws;

function getConnectionString(): string {
  return process.env.DATABASE_URL ?? 'postgresql://unset:unset@localhost:5432/unset';
}

const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

// ---------------------------------------------------------------------------
// For Vercel: use Neon HTTP driver for simple queries (stateless, no hang).
// For local: use postgres.js TCP connection.
// ---------------------------------------------------------------------------
let _httpInstance: any = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (_httpInstance) return _httpInstance;

  const connectionString = getConnectionString();

  if (isVercel) {
    // Neon HTTP driver — stateless, one-shot, perfect for serverless.
    // No WebSocket connection to go stale after container freeze/thaw.
    const sql = neon(connectionString);
    _httpInstance = drizzleHttp(sql, { schema });
  } else {
    _httpInstance = drizzlePostgres(
      postgres(connectionString, {
        max: 10,
        prepare: false,
      }),
      { schema },
    );
  }

  return _httpInstance;
}

// ---------------------------------------------------------------------------
// For transactions in Vercel: create a fresh Pool per-call, close after done.
// This avoids stale WebSocket connections from frozen containers.
// ---------------------------------------------------------------------------
export async function withTransaction<T>(
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  if (!isVercel) {
    // Local: use the regular postgres.js driver which handles transactions natively
    return (getDb() as any).transaction(fn);
  }

  // Vercel: fresh Pool per transaction — NEVER reuse across requests
  const pool = new Pool({ connectionString: getConnectionString() });
  const txDb = drizzleNeon(pool, { schema });
  try {
    return await txDb.transaction(fn);
  } finally {
    // Always close the pool to release the WebSocket connection
    await pool.end().catch(() => {});
  }
}

// Proxy so `db.select()` etc. works while deferring env read to first use.
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_t, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export { schema };
export * from './schema.ts';
