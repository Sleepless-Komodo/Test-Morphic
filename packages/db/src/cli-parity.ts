import fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { checkDatabaseParity, formatParityReportCli } from './parity.ts';
import { startAudit, verifyAuditChain } from './audit-report.ts';
import { checkDeepParity, formatDeepParityCli } from './deep-parity.ts';
import { getConnectionString, getFallbackConnectionString, sanitizeErrorForLog } from './index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

const USAGE = `Usage: pnpm db:parity [options]

Options:
  --deep          Compare row contents and balance-vs-ledger (run with web in maintenance and API stopped)
  --verify-audit  Check the audit report chain and exit
  --json          Output JSON
  --no-fail       Exit 0 even when databases differ (not allowed with --deep)
  -h, --help      Show this help`;

const rawArgs = process.argv.slice(2);

let parsed;
try {
  parsed = parseArgs({
    args: rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs,
    strict: true,
    allowPositionals: false,
    options: {
      deep: { type: 'boolean', default: false },
      'verify-audit': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      'no-fail': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (parsed.values.deep && parsed.values['no-fail']) throw new Error('--no-fail cannot be combined with --deep');
} catch (err) {
  console.error(`[db:parity] ${err instanceof Error ? err.message : String(err)}`);
  console.error(USAGE);
  process.exit(1);
}

if (parsed.values.help) {
  console.log(USAGE);
  process.exit(0);
}

const jsonMode = parsed.values.json;
const noFail = parsed.values['no-fail'];
const deep = parsed.values.deep;
const verifyAudit = parsed.values['verify-audit'];

async function runDeep(): Promise<void> {
  const primaryUrl = getConnectionString();
  const fallbackUrl = getFallbackConnectionString();
  if (!fallbackUrl) throw new Error('DATABASE_URL_FALLBACK is not configured');

  const audit = startAudit({ operation: 'deep-parity', sourceUrl: primaryUrl, destinationUrl: fallbackUrl });
  try {
    const shallow = await checkDatabaseParity({ primaryUrl, fallbackUrl });
    if (!shallow.primaryReachable || !shallow.fallbackReachable) throw new Error('a database is unreachable');
    if (!shallow.migrationsMatch) throw new Error('migrations differ between the databases');
    const report = await checkDeepParity({ primaryUrl, fallbackUrl });
    audit.finish(report.matches ? 'succeeded' : 'failed', { ...report });
    console.log(jsonMode ? JSON.stringify(report, null, 2) : `${formatDeepParityCli(report)}\n Audit report: ${audit.file}`);
    if (!report.matches) process.exitCode = 1;
  } catch (err) {
    audit.finish('failed', { error: sanitizeErrorForLog(err) });
    throw err;
  }
}

async function main() {
  if (verifyAudit) {
    const chain = verifyAuditChain();
    console.log(`[db:parity] ${chain.reports} audit report(s), ${chain.problems.length} problem(s)`);
    for (const p of chain.problems) console.log(`  ! ${p}`);
    if (chain.problems.length > 0) process.exitCode = 1;
    return;
  }
  if (deep) return runDeep();

  const report = await checkDatabaseParity();

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatParityReportCli(report));
  }

  if (!noFail && !report.isCriticalMatch) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[db:parity] Fatal error:', sanitizeErrorForLog(err));
  process.exit(1);
});
