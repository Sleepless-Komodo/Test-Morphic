import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema.ts';

// ---------------------------------------------------------------------------
// Neon HTTP driver — best for Next.js server components & serverless.
// Uses plain HTTPS per-query (stateless) instead of WebSocket Pool
// (persistent). WebSocket connections drop between requests in serverless
// environments, causing intermittent ETIMEDOUT errors.
// ---------------------------------------------------------------------------

function getConnectionString(): string {
  return process.env.DATABASE_URL ?? 'postgresql://unset:unset@localhost:5432/unset';
}

let _instance: NeonHttpDatabase<typeof schema> | null = null;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (_instance) return _instance;

  const sql = neon(getConnectionString());
  _instance = drizzle(sql, { schema });

  return _instance;
}

// ---------------------------------------------------------------------------
// Transactions — neon-http supports transactions via batch API.
// ---------------------------------------------------------------------------
export async function withTransaction<T>(
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  return (getDb() as any).transaction(fn);
}

// Proxy so `db.select()` etc. works while deferring env read to first use.
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_t, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export { schema };
export * from './schema.ts';
