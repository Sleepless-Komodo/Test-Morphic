import fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { formatParityReportCli } from './parity.ts';
import { syncPrimaryToFallback } from './sync.ts';
import { sanitizeErrorForLog } from './index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const skipLogs = args.has('--skip-logs');
const forceFull = args.has('--force-full');
const jsonMode = args.has('--json');

async function main() {
  if (!jsonMode) {
    console.log(
      `[db:sync-fallback] Starting sync (dryRun=${dryRun}, skipLogs=${skipLogs}, forceFull=${forceFull})...`,
    );
  }

  const report = await syncPrimaryToFallback({
    dryRun,
    skipLogs,
    forceFull,
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
