import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface AuditReport {
  version: 1;
  operation: string;
  status: 'started' | 'succeeded' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  gitVersion: string;
  flags: Record<string, boolean>;
  source: string;
  destination: string;
  previousReport: string | null;
  previousSha256: string | null;
  details: Record<string, unknown>;
}

export interface AuditHandle {
  file: string;
  finish: (status: 'succeeded' | 'failed', details: Record<string, unknown>) => void;
}

export function auditDir(): string {
  return process.env.DB_AUDIT_DIR?.trim() || path.join(os.homedir(), '.morphic-audit');
}

/** `host:port/database`, never credentials or query parameters. */
export function auditTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return '(invalid-url)';
  }
}

function gitVersion(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

function listReports(dir: string): string[] {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
}

/**
 * Writes the "started" report before any data changes; throws when it cannot, so the caller stops.
 * `details` must never contain credentials, tokens, hashes of secrets, emails or payloads.
 */
export function startAudit(input: {
  operation: string;
  flags?: Record<string, boolean>;
  sourceUrl: string;
  destinationUrl: string;
  details?: Record<string, unknown>;
}): AuditHandle {
  const dir = auditDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);

  const previous = listReports(dir).at(-1) ?? null;
  const startedAt = new Date().toISOString();
  const report: AuditReport = {
    version: 1,
    operation: input.operation,
    status: 'started',
    startedAt,
    finishedAt: null,
    gitVersion: gitVersion(),
    flags: input.flags ?? {},
    source: auditTarget(input.sourceUrl),
    destination: auditTarget(input.destinationUrl),
    previousReport: previous,
    previousSha256: previous ? sha256(fs.readFileSync(path.join(dir, previous))) : null,
    details: input.details ?? {},
  };
  const name = `${startedAt.replace(/[:.]/g, '-')}-${input.operation}-${randomBytes(3).toString('hex')}.json`;
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });

  return {
    file,
    finish(status, details) {
      const done: AuditReport = {
        ...report,
        status,
        finishedAt: new Date().toISOString(),
        details: { ...report.details, ...details },
      };
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, `${JSON.stringify(done, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(tmp, file);
    },
  };
}

/**
 * Checks every report against the hash its successor recorded. Detects edits and deletions, not a
 * full rewrite of the chain by someone who controls the directory. The newest report has no successor.
 */
export function verifyAuditChain(): { reports: number; problems: string[] } {
  const dir = auditDir();
  if (!fs.existsSync(dir)) return { reports: 0, problems: [] };
  const problems: string[] = [];
  const names = listReports(dir);
  names.forEach((name, i) => {
    let report: AuditReport;
    try {
      report = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as AuditReport;
    } catch {
      problems.push(`${name}: unreadable`);
      return;
    }
    if (report.status === 'started') problems.push(`${name}: never finished`);
    const expected = names[i - 1] ?? null;
    if (report.previousReport !== expected) {
      problems.push(`${name}: previous report is ${report.previousReport ?? 'none'}, found ${expected ?? 'none'}`);
    } else if (expected && report.previousSha256 !== sha256(fs.readFileSync(path.join(dir, expected)))) {
      problems.push(`${expected}: content changed after ${name} was written`);
    }
  });
  return { reports: names.length, problems };
}
