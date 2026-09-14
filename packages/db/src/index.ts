import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema.ts';

// Force WebSocket for Neon in Node.js
neonConfig.webSocketConstructor = ws;

// We export 'any' or a union to support both drivers transparently
let instance: any = null;

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!instance) {
    const connectionString =
      process.env.DATABASE_URL ?? 'postgresql://unset:unset@localhost:5432/unset';
    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
    
    if (isVercel) {
      const pool = new Pool({ connectionString });
      instance = drizzleNeon(pool, { schema });
    } else {
      instance = drizzle(
        postgres(connectionString, {
          max: 10,
          prepare: false,
        }),
        { schema },
      );
    }
  }
  return instance;
}

// Proxy so `db.select()` etc. works while deferring env read to first use.
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_t, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export { schema };
export * from './schema.ts';
