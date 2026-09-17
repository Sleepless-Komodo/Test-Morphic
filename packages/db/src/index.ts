import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

function getConnectionString(): string {
  return process.env.DATABASE_URL ?? 'postgresql://unset:unset@localhost:5432/unset';
}

// ---------------------------------------------------------------------------
// Single postgres.js TCP connection — works for both local dev and any
// self-hosted / managed Postgres (Railway, Supabase, etc.).
// ---------------------------------------------------------------------------
let _instance: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (_instance) return _instance;

  _instance = drizzle(
    postgres(getConnectionString(), {
      max: 10,
      prepare: false,
      connect_timeout: 15,
      idle_timeout: 30,
    }),
    { schema },
  );

  return _instance;
}

// ---------------------------------------------------------------------------
// Transactions — use the regular postgres.js driver which handles them natively.
// ---------------------------------------------------------------------------
export async function withTransaction<T>(
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  return (getDb() as any).transaction(fn);
}

// Proxy so `db.select()` etc. works while deferring env read to first use.
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_t, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export { schema };
export * from './schema.ts';
