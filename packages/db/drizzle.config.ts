import { config } from 'dotenv';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// Node gives each resolved address 250ms to connect before trying the next. The Neon host
// (us-east-2) takes ~300ms to handshake from Indonesia, so every address timed out and
// `drizzle-kit migrate` died with a silent ETIMEDOUT.
setDefaultAutoSelectFamilyAttemptTimeout(3000);

config({ path: resolve(process.cwd(), '../../.env') });

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
