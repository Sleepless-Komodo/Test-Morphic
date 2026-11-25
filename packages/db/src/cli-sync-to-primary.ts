import fs from 'node:fs';
import readline from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { checkDatabaseParity, formatParityReportCli, safeHostLabel } from './parity.ts';
import { startAudit } from './audit-report.ts';
import { SYNC_PLAN, syncFallbackToPrimary } from './sync.ts';
import { getConnectionString, getFallbackConnectionString, sanitizeErrorForLog } from './index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

const USAGE = `Usage: pnpm db:sync-to-primary [options]

Options:
  --dry-run      Count rows without writing to Neon primary
  --skip-logs    Skip request_logs table
  --force-full   Ignore append watermarks and scan all rows
  --allow-extra  Write even when the destination has rows the local database lacks
  --json         Output JSON report (requires --yes for live writes)
  --yes          Skip interactive confirmation prompt
  -h, --help     Show this help (via pnpm: pnpm db:sync-to-primary -- --help)`;

const rawArgs = process.argv.slice(2);
const normalizedArgs = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;

let parsed;
try {
  parsed = parseArgs({
    args: normalizedArgs,
    strict: true,
    allowPositionals: false,
    options: {
      'dry-run': { type: 'boolean', default: false },
      'skip-logs': { type: 'boolean', default: false },
      'force-full': { type: 'boolean', default: false },
      'allow-extra': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
} catch (err) {
  console.error(`[db:sync-to-primary] ${err instanceof Error ? err.message : String(err)}`);
  console.error(USAGE);
  process.exit(1);
}

if (parsed.values.help) {
  console.log(USAGE);
  process.exit(0);
}

const dryRun = parsed.values['dry-run'];
const skipLogs = parsed.values['skip-logs'];
const forceFull = parsed.values['force-full'];
const allowExtra = parsed.values['allow-extra'];
const jsonMode = parsed.values.json;
const skipConfirm = parsed.values.yes;

const UPSERT_TABLES = new Set(SYNC_PLAN.filter((t) => t.mode === 'upsert').map((t) => t.tableName));
const APPEND_TABLES = new Set(SYNC_PLAN.filter((t) => t.mode === 'append_watermark').map((t) => t.tableName));

function askConfirmation(question: string, expected: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((done) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      rl.close();
      done(ok);
    };
    rl.on('close', () => finish(false));
    rl.question(question, (answer) => finish(answer.trim() === expected));
  });
}

async function main(): Promise<void> {
  // 1) Static preconditions BEFORE touching any DB
  const primaryUrl = getConnectionString();
  const fallbackUrl = getFallbackConnectionString();

  if (!fallbackUrl) {
    console.error('[db:sync-to-primary] ERROR: DATABASE_URL_FALLBACK is not configured.');
    process.exit(1);
  }
  if (primaryUrl === fallbackUrl) {
    console.error(
      '[db:sync-to-primary] ERROR: DATABASE_URL and DATABASE_URL_FALLBACK are identical; refusing to sync onto self.',
    );
    process.exit(1);
  }
  if (!dryRun && !skipConfirm && (jsonMode || !process.stdin.isTTY)) {
    console.error(
      '[db:sync-to-primary] ERROR: Live sync in non-interactive/--json mode requires --yes (or use --dry-run).',
    );
    process.exit(1);
  }

  const primaryHost = safeHostLabel(primaryUrl);
  const fallbackHost = safeHostLabel(fallbackUrl);

  if (!jsonMode) {
    console.log('');
    console.log('=============================================================');
    console.log(' Morphic Sync: Local Fallback -> Neon Primary');
    console.log('=============================================================');
    console.log(` Source (read):       ${fallbackHost} (fallback)`);
    console.log(` Destination (write): ${primaryHost} (primary/Neon)`);
    console.log(` Mode:                ${dryRun ? 'DRY RUN (no writes)' : 'LIVE (will write to primary!)'}`);
    console.log(` Skip Logs:           ${skipLogs}`);
    console.log(` Force Full:          ${forceFull}`);
    console.log('');
    console.log('[1/3] Running pre-sync parity check...');
    console.log('');
  }

  // 2) Reachability, permissions, migrations checks
  const preParity = await checkDatabaseParity({ primaryUrl, fallbackUrl });

  if (!jsonMode) {
    console.log(formatParityReportCli(preParity));
    console.log('');
  }

  if (!preParity.primaryReachable) {
    console.error('[db:sync-to-primary] ERROR: Primary (Neon) is unreachable. Cannot sync.');
    process.exit(1);
  }
  if (!preParity.fallbackReachable) {
    console.error('[db:sync-to-primary] ERROR: Fallback (Local PG) is unreachable. Cannot sync.');
    process.exit(1);
  }
  if (!preParity.fallbackPermissionsOk) {
    console.error('[db:sync-to-primary] ERROR: Fallback role lacks required permissions.');
    process.exit(1);
  }
  if (!preParity.migrationsMatch) {
    console.error(
      `[db:sync-to-primary] ERROR: Migration mismatch (primary=${preParity.primaryMigrationsCount}, fallback=${preParity.fallbackMigrationsCount}). Run migrations on both databases first.`,
    );
    process.exit(1);
  }

  if (preParity.isExactMatch && !forceFull) {
    if (jsonMode) {
      console.log(JSON.stringify({ status: 'already_matched', preParity }, null, 2));
    } else {
      console.log(
        '[db:sync-to-primary] Row counts & balances already match (EXACT MATCH). Nothing to sync (pass --force-full to upsert all rows anyway).',
      );
    }
    return;
  }

  // A destination with rows local lacks was seeded or holds older data; a copy would mix the two.
  const extraOnDestination = preParity.tables.filter((t) => t.deltaRows > 0 && t.tableName !== 'job_leases');
  if (extraOnDestination.length > 0 && !allowExtra) {
    const list = extraOnDestination.map((t) => `${t.tableName} (+${t.deltaRows})`).join(', ');
    const message = `Destination has rows the local database lacks: ${list}. Use an empty, migrated destination, or pass --allow-extra.`;
    if (!dryRun) {
      console.error(`[db:sync-to-primary] ERROR: ${message}`);
      process.exit(1);
    }
    console.error(`[db:sync-to-primary] WARNING: ${message} A live run would be refused.`);
  }

  // 3) Interactive confirmation for live writes
  if (!dryRun && !skipConfirm) {
    const extraFallbackUpserts = preParity.tables.filter(
      (t) => t.deltaRows < 0 && UPSERT_TABLES.has(t.tableName),
    );
    if (extraFallbackUpserts.length > 0) {
      console.log('⚠️  Reverse upsert notice (fallback has more rows than primary):');
      for (const t of extraFallbackUpserts) {
        console.log(
          `   - ${t.tableName}: primary=${t.primaryCount}, fallback=${t.fallbackCount} (+${Math.abs(t.deltaRows)} extra local row(s))`,
        );
      }
      console.log('   Upserting pushes those extra local rows to Neon (or fails if a non-PK UNIQUE key collides).');
      console.log('');
    }

    console.log('⚠️  WARNING: This will WRITE data from your local fallback database to Neon production.');
    console.log('   - Upsert tables: local rows will OVERWRITE primary rows on matching PK.');
    console.log('   - Append tables: new local rows will be INSERTED (existing rows untouched).');
    console.log('   - No rows will be DELETED from Neon.');
    console.log('');
    const confirmed = await askConfirmation(`Type the destination host (${primaryHost}) to proceed: `, primaryHost);
    if (!confirmed) {
      console.log('[db:sync-to-primary] Aborted by user.');
      return;
    }
    console.log('');
  }

  // 4) Run sync
  if (!jsonMode) {
    console.log(`[2/3] ${dryRun ? 'Dry-run' : 'Syncing'} fallback -> primary...`);
    console.log('');
  }

  const audit = dryRun
    ? null
    : startAudit({
        operation: 'sync-to-primary',
        flags: { skipLogs, forceFull, allowExtra },
        sourceUrl: fallbackUrl,
        destinationUrl: primaryUrl,
      });
  let report;
  try {
    report = await syncFallbackToPrimary({ dryRun, skipLogs, forceFull });
    audit?.finish(report.parityAfterSync.isCriticalMatch ? 'succeeded' : 'failed', {
      tables: Object.fromEntries(report.tablesSynced.map((t) => [t.tableName, t.rowsUpserted])),
      criticalMatch: report.parityAfterSync.isCriticalMatch,
      driftedTables: report.parityAfterSync.driftedTables.map((t) => t.tableName),
    });
  } catch (err) {
    audit?.finish('failed', { error: sanitizeErrorForLog(err) });
    throw err;
  }

  if (jsonMode) {
    console.log(JSON.stringify({ preParity, syncReport: report }, null, 2));
    if (!dryRun && !report.parityAfterSync.isCriticalMatch) {
      process.exitCode = 1;
    }
    return;
  }

  console.log('Sync Summary (Fallback -> Primary):');
  for (const t of report.tablesSynced) {
    if (t.skipped) {
      console.log(`  - ${t.tableName.padEnd(24)} SKIPPED (${t.skipReason})`);
      continue;
    }
    console.log(
      `  - ${t.tableName.padEnd(24)} fetched=${String(t.rowsFetched).padStart(6)}  upserted=${String(t.rowsUpserted).padStart(6)}`,
    );
  }
  console.log(`  Total fetched=${report.totalRowsFetched}, upserted=${report.totalRowsUpserted}`);

  if (report.warnings.length > 0) {
    console.log('');
    console.log('Sync Warnings:');
    for (const w of report.warnings) {
      console.log(`  ! ${w}`);
    }
  }

  console.log('');
  console.log('[3/3] Post-sync parity check:');
  console.log('');
  console.log(formatParityReportCli(report.parityAfterSync));

  if (!dryRun && !forceFull) {
    const appendStillDrifted = report.parityAfterSync.driftedTables.some((t) =>
      APPEND_TABLES.has(t.tableName),
    );
    if (appendStillDrifted) {
      console.log('');
      console.log(
        'ℹ️  Hint: Append table(s) still show drift (older gaps before Neon max timestamp). Re-run with --force-full to backfill.',
      );
    }
  }

  if (!dryRun && !report.parityAfterSync.isCriticalMatch) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[db:sync-to-primary] Fatal error:', sanitizeErrorForLog(err));
  process.exit(1);
});
