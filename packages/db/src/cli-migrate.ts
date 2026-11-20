import dns from 'node:dns';
import fs from 'node:fs';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getConnectionString, getFallbackConnectionString, sanitizeErrorForLog } from './index.ts';
import { safeHostLabel } from './parity.ts';

try {
  dns.setDefaultResultOrder('ipv4first');
  setDefaultAutoSelectFamilyAttemptTimeout(3000);
} catch {
  // Ignore in environments without node:dns / node:net
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

const USAGE = `Usage: pnpm db:migrate [options]

Options:
  --fallback     Apply migrations to DATABASE_URL_FALLBACK instead of DATABASE_URL
  -h, --help     Show this help (via pnpm: pnpm db:migrate -- --help)`;

const rawArgs = process.argv.slice(2);
const normalizedArgs = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;

let parsed;
try {
  parsed = parseArgs({
    args: normalizedArgs,
    strict: true,
    allowPositionals: false,
    options: {
      fallback: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
} catch (err) {
  console.error(`[db:migrate] ${err instanceof Error ? err.message : String(err)}`);
  console.error(USAGE);
  process.exit(1);
}

if (parsed.values.help) {
  console.log(USAGE);
  process.exit(0);
}

const useFallback = parsed.values.fallback;

function formatMigrationError(err: unknown): void {
  console.error(`[db:migrate] FAILED: ${sanitizeErrorForLog(err, 800)}`);
  if (!err || typeof err !== 'object') return;

  const rec = err as Record<string, unknown>;
  const cause = (rec.cause && typeof rec.cause === 'object' ? rec.cause : rec) as Record<string, unknown>;

  if (typeof rec.query === 'string') {
    console.error(`[db:migrate] Query:\n${rec.query.trim()}`);
  }
  for (const field of ['code', 'severity', 'detail', 'hint', 'schema', 'table', 'constraint'] as const) {
    if (typeof cause[field] === 'string' && cause[field]) {
      console.error(`[db:migrate] ${field}: ${cause[field]}`);
    }
  }
  if (cause.code === '42501') {
    console.error(
      '[db:migrate] Hint: role lacks DDL/owner privileges. Run migration as the database owner (e.g. postgres), then GRANT table/sequence privileges to the app role.',
    );
  }
}

async function main(): Promise<void> {
  const targetUrl = useFallback ? getFallbackConnectionString() : getConnectionString();
  if (!targetUrl) {
    console.error(
      useFallback
        ? '[db:migrate] ERROR: DATABASE_URL_FALLBACK is not configured.'
        : '[db:migrate] ERROR: DATABASE_URL is not configured.',
    );
    process.exit(1);
  }

  const migrationsFolder = resolve(__dirname, '../drizzle');
  console.log(
    `[db:migrate] Applying migrations to ${safeHostLabel(targetUrl)} (${useFallback ? 'fallback' : 'primary'})...`,
  );

  const client = postgres(targetUrl, { max: 1, connect_timeout: 15 });
  try {
    await migrate(drizzle(client), { migrationsFolder });
    console.log('[db:migrate] Migrations applied successfully!');
  } catch (err) {
    formatMigrationError(err);
    process.exitCode = 1;
  } finally {
    await client.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((err) => {
  formatMigrationError(err);
  process.exit(1);
});
