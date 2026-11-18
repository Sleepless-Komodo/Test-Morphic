import fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { checkDatabaseParity, formatParityReportCli } from './parity.ts';
import { sanitizeErrorForLog } from './index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

const args = new Set(process.argv.slice(2));
const jsonMode = args.has('--json');
const noFail = args.has('--no-fail');

async function main() {
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
