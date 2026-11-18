import test from 'node:test';
import assert from 'node:assert/strict';
import { PARITY_TABLES, computeParityDiffFromSnapshots, resetFailoverToPrimary, type DatabaseSyncReport, type DbSnapshot } from '@morphic/db';
import { createSyncTracker, type SyncLogger } from './db-sync-log';
import { logStartupConfig, runFallbackSyncJob, runStartupSelfCheck } from './db-failover-monitor';

const tick = () => new Promise((r) => setImmediate(r));

async function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void> | void): Promise<void> {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    await fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

function makeLog() {
  const logs = { info: [] as string[], warn: [] as string[], error: [] as string[] };
  const log: SyncLogger = {
    info: (m) => void logs.info.push(m),
    warn: (m) => void logs.warn.push(m),
    error: (m) => void logs.error.push(m),
  };
  return { logs, log };
}

function snap(overrides: Partial<DbSnapshot> = {}): DbSnapshot {
  const tables: DbSnapshot['tables'] = {};
  for (const t of PARITY_TABLES) tables[t.tableName] = { exists: true, count: 10, latestAt: '2026-11-18T05:00:00.000Z' };
  return {
    reachable: true, permissionsOk: true, migrationsCount: 23, latestMigrationHash: 'h',
    tables, userBalances: [{ userId: 'u1', email: 'a@b.c', credits: 10 }],
    paidPaymentsCount: 1, paidAmountCents: 100, activeApiKeysCount: 1, ...overrides,
  };
}

const matchReport = () => computeParityDiffFromSnapshots(snap(), snap());
const driftReport = () => computeParityDiffFromSnapshots(snap(), snap({ paidPaymentsCount: 0 }));
const fallbackDownReport = () =>
  computeParityDiffFromSnapshots(snap(), snap({ reachable: false, permissionsOk: false, tables: {}, userBalances: [], error: 'ECONNREFUSED' }));

const FALLBACK = 'postgresql://morphic_app:s3cret@127.0.0.1:5432/morphic?sslmode=disable';
const PRIMARY = 'postgresql://u:p@ep-x.neon.tech/neondb?sslmode=require';

test('startup config line is informative and never prints credentials', async () => {
  resetFailoverToPrimary();
  await withEnv({ DATABASE_URL: PRIMARY, DATABASE_URL_FALLBACK: FALLBACK, DB_SYNC_ON_WRITE: undefined, DB_FORCE_FALLBACK: undefined, DB_FAILOVER_ENABLED: undefined }, () => {
    const { logs, log } = makeLog();
    logStartupConfig(log);
    const all = [...logs.info, ...logs.warn, ...logs.error].join('\n');
    assert.match(logs.info[0]!, /^\[db-sync\] startup primary=ep-x\.neon\.tech fallback=127\.0\.0\.1:5432 activeTarget=primary failover=on syncOnWrite=on /);
    assert.ok(!all.includes('s3cret'));
    assert.equal(logs.warn.length, 0);
  });
});

test('startup warns loudly when fallback is not configured', async () => {
  await withEnv({ DATABASE_URL: PRIMARY, DATABASE_URL_FALLBACK: undefined }, () => {
    const { logs, log } = makeLog();
    logStartupConfig(log);
    assert.match(logs.info[0]!, /fallback=not-configured/);
    assert.ok(logs.warn.some((m) => m.includes('DISABLED')));
  });
});

test('startup flags identical URLs, sync-on-write off and non-loopback fallback', async () => {
  await withEnv({ DATABASE_URL: FALLBACK, DATABASE_URL_FALLBACK: FALLBACK }, () => {
    const { logs, log } = makeLog();
    logStartupConfig(log);
    assert.ok(logs.error.some((m) => m.includes('identical')));
  });
  await withEnv({ DATABASE_URL: PRIMARY, DATABASE_URL_FALLBACK: FALLBACK, DB_SYNC_ON_WRITE: 'false' }, () => {
    const { logs, log } = makeLog();
    logStartupConfig(log);
    assert.ok(logs.warn.some((m) => m.includes('DB_SYNC_ON_WRITE=false')));
  });
  await withEnv({ DATABASE_URL: PRIMARY, DATABASE_URL_FALLBACK: 'postgresql://a:b@10.0.0.5:5432/m', DB_SYNC_ON_WRITE: undefined }, () => {
    const { logs, log } = makeLog();
    logStartupConfig(log);
    assert.ok(logs.warn.some((m) => m.includes('not loopback')));
  });
});

test('self-check: healthy fallback logs info and runs the boot catch-up sync', async () => {
  await withEnv({ DATABASE_URL_FALLBACK: FALLBACK, DB_SYNC_ON_BOOT: undefined }, async () => {
    const { logs, log } = makeLog();
    let boot = 0;
    const alerts: string[] = [];
    await runStartupSelfCheck({ log, checkParity: async () => matchReport(), sendAlert: async (m) => void alerts.push(m), runBootSync: async () => void (boot += 1) });
    assert.match(logs.info[0]!, /startup check primary=ONLINE fallback=ONLINE permissions=ok migrations=match parity=EXACT/);
    assert.equal(boot, 1);
    assert.equal(alerts.length, 0);
  });
});

test('self-check: drift is a warning and still runs the boot sync', async () => {
  await withEnv({ DATABASE_URL_FALLBACK: FALLBACK, DB_SYNC_ON_BOOT: undefined }, async () => {
    const { logs, log } = makeLog();
    let boot = 0;
    await runStartupSelfCheck({ log, checkParity: async () => driftReport(), sendAlert: async () => {}, runBootSync: async () => void (boot += 1) });
    assert.ok(logs.warn.some((m) => m.includes('startup check') && m.includes('parity=DRIFT')));
    assert.ok(logs.warn.some((m) => m.includes('running catch-up sync now')));
    assert.equal(boot, 1);
  });
});

test('self-check: unusable fallback logs an error, alerts and does NOT sync', async () => {
  await withEnv({ DATABASE_URL_FALLBACK: FALLBACK, DB_SYNC_ON_BOOT: undefined }, async () => {
    const { logs, log } = makeLog();
    let boot = 0;
    const alerts: string[] = [];
    await runStartupSelfCheck({ log, checkParity: async () => fallbackDownReport(), sendAlert: async (m) => void alerts.push(m), runBootSync: async () => void (boot += 1) });
    assert.ok(logs.error.some((m) => m.includes('fallback=UNREACHABLE')));
    assert.equal(alerts.length, 1);
    assert.match(alerts[0]!, /TIDAK siap/);
    assert.equal(boot, 0);
  });
});

test('self-check: timeout/crash is an error plus alert; DB_SYNC_ON_BOOT=false skips the sync with a log', async () => {
  await withEnv({ DATABASE_URL_FALLBACK: FALLBACK, DB_SYNC_ON_BOOT: undefined }, async () => {
    const { logs, log } = makeLog();
    const alerts: string[] = [];
    await runStartupSelfCheck({ log, timeoutMs: 5, checkParity: () => new Promise(() => {}), sendAlert: async (m) => void alerts.push(m) });
    assert.ok(logs.error.some((m) => m.includes('startup check FAILED')));
    assert.equal(alerts.length, 1);
  });
  await withEnv({ DATABASE_URL_FALLBACK: FALLBACK, DB_SYNC_ON_BOOT: 'false' }, async () => {
    const { logs, log } = makeLog();
    let boot = 0;
    await runStartupSelfCheck({ log, checkParity: async () => matchReport(), sendAlert: async () => {}, runBootSync: async () => void (boot += 1) });
    assert.equal(boot, 0);
    assert.ok(logs.info.some((m) => m.includes('DB_SYNC_ON_BOOT=false')));
  });
});

function fakeSyncReport(parity: DatabaseSyncReport['parityAfterSync']): DatabaseSyncReport {
  return {
    startedAt: 'a', completedAt: 'b', dryRun: false,
    tablesSynced: [{ tableName: 'users', skipped: false, rowsFetched: 2, rowsUpserted: 2 }],
    totalRowsFetched: 2, totalRowsUpserted: 2, warnings: ['Skipped x: missing on fallback'], parityAfterSync: parity,
  };
}

function jobHarness() {
  const { logs, log } = makeLog();
  const alerts: string[] = [];
  const tracker = createSyncTracker({ log, sendAlert: async (m) => void alerts.push(m), now: () => 1, alertCooldownMs: 600_000 });
  return { logs, log, alerts, tracker };
}

test('sync job logs a one-line ok summary (even with 0 changes) and surfaces sync warnings', async () => {
  const h = jobHarness();
  await runFallbackSyncJob('periodic', { log: h.log, tracker: h.tracker, now: () => 100, run: async () => fakeSyncReport(matchReport()) });
  assert.match(h.logs.info[0]!, /^\[db-sync\] ok kind=full trigger=periodic rowsFetched=2 rowsUpserted=2 tablesTouched=1 parity=EXACT maxLagSec=0 driftedTables=0 durationMs=0$/);
  assert.ok(h.logs.warn.some((m) => m.includes('sync warning: Skipped x')));
});

test('sync job: drift is logged as warning; not-applicable is logged as skip', async () => {
  const h = jobHarness();
  await runFallbackSyncJob('periodic', { log: h.log, tracker: h.tracker, run: async () => fakeSyncReport(driftReport()) });
  assert.ok(h.logs.warn.some((m) => m.includes('ok kind=full') && m.includes('parity=DRIFT')));
  assert.ok(h.logs.warn.some((m) => m.includes('parity drift after periodic sync')));
  await withEnv({ DATABASE_URL_FALLBACK: FALLBACK }, async () => {
    await runFallbackSyncJob('boot', { log: h.log, tracker: h.tracker, run: async () => null });
  });
  assert.ok(h.logs.info.some((m) => m.includes('skip kind=full trigger=boot reason=failover-active')));
});

test('sync job failure is never silent: periodic alerts on the 3rd failure, boot alerts immediately', async () => {
  const h = jobHarness();
  const boom = async () => { throw new Error('connect ECONNREFUSED'); };
  await runFallbackSyncJob('periodic', { log: h.log, tracker: h.tracker, run: boom });
  await runFallbackSyncJob('periodic', { log: h.log, tracker: h.tracker, run: boom });
  await tick();
  assert.equal(h.logs.error.length, 2);
  assert.equal(h.alerts.length, 0);
  await runFallbackSyncJob('periodic', { log: h.log, tracker: h.tracker, run: boom });
  await tick();
  assert.equal(h.alerts.length, 1);

  const b = jobHarness();
  await runFallbackSyncJob('boot', { log: b.log, tracker: b.tracker, run: boom });
  await tick();
  assert.equal(b.alerts.length, 1);
});

test('sync job: failover abort is a warning, not a failure', async () => {
  const h = jobHarness();
  const abort = async () => { const e = new Error('aborted'); e.name = 'SyncAbortedError'; throw e; };
  await runFallbackSyncJob('periodic', { log: h.log, tracker: h.tracker, run: abort });
  assert.ok(h.logs.warn.some((m) => m.includes('abort kind=full trigger=periodic')));
  assert.equal(h.logs.error.length, 0);
  assert.equal(h.tracker.status().consecutiveFailures, 0);
});
