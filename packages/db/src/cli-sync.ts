import fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { formatParityReportCli } from './parity.ts';
import { PRUNE_TABLES, syncPrimaryToFallback } from './sync.ts';
import { sanitizeErrorForLog } from './index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

const USAGE = `Usage: pnpm db:sync-fallback [options]

Options:
  --dry-run            Count rows (and list prune candidates) without writing
  --skip-logs          Skip request_logs table
  --force-full         Ignore append watermarks and scan all rows
  --prune-deleted      Delete local rows of ${PRUNE_TABLES.join(', ')} that no longer exist on the primary
  --allow-empty-prune  Allow a prune when the primary table is empty
  --allow-behind       Copy even when the primary looks older than local (overwrites newer local data)
  --json               Output JSON report
  -h, --help           Show this help (via pnpm: pnpm db:sync-fallback -- --help)`;

const rawArgs = process.argv.slice(2);

let parsed;
try {
  parsed = parseArgs({
    args: rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs,
    strict: true,
    allowPositionals: false,
    options: {
      'dry-run': { type: 'boolean', default: false },
      'skip-logs': { type: 'boolean', default: false },
      'force-full': { type: 'boolean', default: false },
      'prune-deleted': { type: 'boolean', default: false },
      'allow-empty-prune': { type: 'boolean', default: false },
      'allow-behind': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
} catch (err) {
  console.error(`[db:sync-fallback] ${err instanceof Error ? err.message : String(err)}`);
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
const pruneDeleted = parsed.values['prune-deleted'];
const allowEmptyPrune = parsed.values['allow-empty-prune'];
const allowBehind = parsed.values['allow-behind'];
const jsonMode = parsed.values.json;

// Not pruned automatically: their foreign keys would cascade.
const CATALOG_TABLES = new Set(['packages', 'models', 'providers', 'model_provider_pool', 'announcements']);

async function main() {
  if (!jsonMode) {
    console.log(
      `[db:sync-fallback] Starting sync (dryRun=${dryRun}, skipLogs=${skipLogs}, forceFull=${forceFull}, pruneDeleted=${pruneDeleted})...`,
    );
  }

  const report = await syncPrimaryToFallback({
    dryRun,
    skipLogs,
    forceFull,
    pruneDeleted,
    allowEmptyPrune,
    allowBehind,
  });

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('');
    console.log('Sync Summary:');
    for (const t of report.tablesSynced) {
      if (t.skipped) {
        console.log(`  - ${t.tableName.padEnd(24)} SKIPPED (${t.skipReason})`);
      } else {
        console.log(
          `  - ${t.tableName.padEnd(24)} fetched=${String(t.rowsFetched).padStart(6)}  upserted=${String(t.rowsUpserted).padStart(6)}`,
        );
      }
    }
    console.log(`  Total fetched=${report.totalRowsFetched}, upserted=${report.totalRowsUpserted}`);
    if (report.pruned) {
      console.log('');
      console.log(dryRun ? 'Prune candidates (dry run, nothing deleted):' : 'Prune Summary:');
      for (const p of report.pruned) {
        const note = p.skippedReason ? `  SKIPPED (${p.skippedReason})` : '';
        console.log(`  - ${p.tableName.padEnd(24)} candidates=${p.candidates}  deleted=${p.deleted}${note}`);
        for (const id of p.ids) console.log(`      ${id}`);
      }
      for (const t of report.parityAfterSync.tables) {
        if (CATALOG_TABLES.has(t.tableName) && t.deltaRows < 0) {
          console.log(`  ! ${t.tableName}: ${-t.deltaRows} extra local row(s), not pruned; check by hand before switching databases`);
        }
      }
    }
    if (report.warnings.length > 0) {
      console.log('');
      console.log('Sync Warnings:');
      for (const w of report.warnings) {
        console.log(`  ! ${w}`);
      }
    }
    console.log('');
    console.log(formatParityReportCli(report.parityAfterSync));
  }

  if (!dryRun && !report.parityAfterSync.isCriticalMatch) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[db:sync-fallback] Fatal error:', sanitizeErrorForLog(err));
  process.exit(1);
});
