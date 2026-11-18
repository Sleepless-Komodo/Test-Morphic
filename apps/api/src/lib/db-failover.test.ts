import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeParityDiffFromSnapshots,
  formatParitySummaryAlert,
  getDbFailoverState,
  isNeonFailoverError,
  onDbFailover,
  PARITY_TABLES,
  resetFailoverToPrimary,
  triggerManualFailover,
  type DbFailoverEvent,
  type DbSnapshot,
} from '@morphic/db';
import { InsufficientCreditsError } from '@morphic/db/billing';
import { handleFailoverEvent, resetFailoverMonitorForTests } from './db-failover-monitor';

function makeBaseSnapshot(overrides: Partial<DbSnapshot> = {}): DbSnapshot {
  const tables: DbSnapshot['tables'] = {};
  for (const t of PARITY_TABLES) {
    tables[t.tableName] = {
      exists: true,
      count: 10,
      latestAt: '2026-11-18T05:00:00.000Z',
    };
  }
  return {
    reachable: true,
    permissionsOk: true,
    migrationsCount: 23,
    latestMigrationHash: '0022_abuse_cases',
    tables,
    userBalances: [
      { userId: 'u-1', email: 'alice@example.com', credits: 1000 },
      { userId: 'u-2', email: 'bob@example.com', credits: 2500 },
    ],
    paidPaymentsCount: 28,
    paidAmountCents: 1_500_000,
    activeApiKeysCount: 10,
    ...overrides,
  };
}

test('isNeonFailoverError detects Neon quota/limit, PG connection/pool, HTTP, and network failures', () => {
  assert.equal(isNeonFailoverError(new Error('Your project has exceeded the compute time quota')), true);
  assert.equal(isNeonFailoverError(new Error('exceeded the data transfer quota')), true);
  assert.equal(isNeonFailoverError(new Error('project_size_limit reached')), true);
  assert.equal(isNeonFailoverError(new Error('endpoint is disabled due to usage limit')), true);

  assert.equal(isNeonFailoverError(Object.assign(new Error('too many connections'), { code: '53300' })), true);
  assert.equal(isNeonFailoverError(Object.assign(new Error('admin shutdown'), { code: '57P01' })), true);
  assert.equal(isNeonFailoverError(Object.assign(new Error('connection failure'), { code: '08006' })), true);

  assert.equal(isNeonFailoverError(Object.assign(new Error('Payment Required'), { status: 402 })), true);
  assert.equal(isNeonFailoverError(Object.assign(new Error('Service Unavailable'), { statusCode: 503 })), true);

  assert.equal(isNeonFailoverError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })), true);
  assert.equal(isNeonFailoverError({ message: 'wrapper', cause: { code: 'ETIMEDOUT' } }), true);
  assert.equal(isNeonFailoverError({ message: 'NeonDbError', sourceError: { status: 429 } }), true);
});

test('isNeonFailoverError rejects application-level SQL and domain errors', () => {
  assert.equal(isNeonFailoverError(new InsufficientCreditsError('insufficient credits')), false);
  assert.equal(isNeonFailoverError(Object.assign(new Error('duplicate key value'), { code: '23505' })), false);
  assert.equal(isNeonFailoverError(Object.assign(new Error('fk violation'), { code: '23503' })), false);
  assert.equal(isNeonFailoverError(Object.assign(new Error('invalid input syntax'), { code: '22P02' })), false);
  assert.equal(isNeonFailoverError(Object.assign(new Error('relation does not exist'), { code: '42P01' })), false);
  assert.equal(isNeonFailoverError(Object.assign(new Error('deadlock detected'), { code: '40P01' })), false);
  assert.equal(isNeonFailoverError(null), false);
});

test('Sticky failover state machine transitions once, stays sticky, and respects config guards', async () => {
  const origFallback = process.env.DATABASE_URL_FALLBACK;
  const origEnabled = process.env.DB_FAILOVER_ENABLED;
  const origForce = process.env.DB_FORCE_FALLBACK;

  try {
    resetFailoverToPrimary();
    delete process.env.DB_FORCE_FALLBACK;

    // Without DATABASE_URL_FALLBACK, failover must not activate
    delete process.env.DATABASE_URL_FALLBACK;
    process.env.DB_FAILOVER_ENABLED = 'true';
    assert.equal(triggerManualFailover('missing_fallback'), false);
    assert.equal(getDbFailoverState().activeTarget, 'primary');

    // With DB_FAILOVER_ENABLED=false, failover must not activate
    process.env.DATABASE_URL_FALLBACK = 'postgresql://morphic_app:pass@127.0.0.1:5432/morphic?sslmode=disable';
    process.env.DB_FAILOVER_ENABLED = 'false';
    assert.equal(triggerManualFailover('disabled_failover'), false);
    assert.equal(getDbFailoverState().activeTarget, 'primary');

    // Enabled + configured -> switches once and stays sticky
    process.env.DB_FAILOVER_ENABLED = 'true';
    const events: DbFailoverEvent[] = [];
    const unsubscribe = onDbFailover((ev) => {
      events.push(ev);
    });

    try {
      const first = triggerManualFailover('neon_quota_exceeded', new Error('compute time quota'));
      const second = triggerManualFailover('duplicate_trigger', new Error('another error'));
      await new Promise((r) => setTimeout(r, 10));

      assert.equal(first, true);
      assert.equal(second, false);
      assert.equal(events.length, 1);
      assert.equal(events[0]?.activeTarget, 'fallback');
      assert.equal(events[0]?.reason, 'neon_quota_exceeded');

      const state = getDbFailoverState();
      assert.equal(state.activeTarget, 'fallback');
      assert.equal(state.fallbackConfigured, true);
      assert.equal(state.failoverEnabled, true);
      assert.equal(state.failoverReason, 'neon_quota_exceeded');
    } finally {
      unsubscribe();
    }
  } finally {
    resetFailoverToPrimary();
    if (origFallback !== undefined) process.env.DATABASE_URL_FALLBACK = origFallback;
    else delete process.env.DATABASE_URL_FALLBACK;
    if (origEnabled !== undefined) process.env.DB_FAILOVER_ENABLED = origEnabled;
    else delete process.env.DB_FAILOVER_ENABLED;
    if (origForce !== undefined) process.env.DB_FORCE_FALLBACK = origForce;
    else delete process.env.DB_FORCE_FALLBACK;
  }
});

test('computeParityDiffFromSnapshots reports 100% match when Primary and Fallback align', () => {
  const primary = makeBaseSnapshot();
  const fallback = makeBaseSnapshot();

  const report = computeParityDiffFromSnapshots(primary, fallback, {
    primaryHost: 'ep-primary.neon.tech',
    fallbackHost: '127.0.0.1:5432',
  });

  assert.equal(report.isCriticalMatch, true);
  assert.equal(report.isExactMatch, true);
  assert.equal(report.migrationsMatch, true);
  assert.equal(report.maxLagSeconds, 0);
  assert.equal(report.driftedTables.length, 0);
  assert.equal(report.financialDiff.balanceDeltaCredits, 0);
  assert.equal(report.financialDiff.mismatchedUserBalances.length, 0);
  assert.match(formatParitySummaryAlert(report), /100% EXACT MATCH/);
});

test('computeParityDiffFromSnapshots detects 1-day data lag and user balance mismatch', () => {
  const primary = makeBaseSnapshot();
  const fallback = makeBaseSnapshot();

  // Simulate 1-day old dump on fallback (86400 seconds behind)
  fallback.tables.users = { exists: true, count: 17, latestAt: '2026-11-17T05:00:00.000Z' };
  primary.tables.users = { exists: true, count: 19, latestAt: '2026-11-18T05:00:00.000Z' };

  fallback.tables.credit_ledger = { exists: true, count: 2032, latestAt: '2026-11-17T05:00:00.000Z' };
  primary.tables.credit_ledger = { exists: true, count: 2050, latestAt: '2026-11-18T05:00:00.000Z' };

  fallback.paidPaymentsCount = 28;
  primary.paidPaymentsCount = 30;
  fallback.paidAmountCents = 1_500_000;
  primary.paidAmountCents = 1_750_000;

  fallback.userBalances = [
    { userId: 'u-1', email: 'alice@example.com', credits: 900 },
    { userId: 'u-2', email: 'bob@example.com', credits: 2500 },
  ];

  const report = computeParityDiffFromSnapshots(primary, fallback);

  assert.equal(report.isCriticalMatch, false);
  assert.equal(report.isExactMatch, false);
  assert.equal(report.maxLagSeconds, 86_400);
  assert.equal(report.financialDiff.balanceDeltaCredits, 100);
  assert.equal(report.financialDiff.mismatchedUserBalances.length, 1);
  assert.equal(report.financialDiff.mismatchedUserBalances[0]?.email, 'alice@example.com');
  assert.equal(report.financialDiff.mismatchedUserBalances[0]?.deltaCredits, 100);
  assert.match(formatParitySummaryAlert(report), /DRIFT DETECTED/);
});

test('computeParityDiffFromSnapshots keeps isCriticalMatch true when only operational logs differ', () => {
  const primary = makeBaseSnapshot();
  const fallback = makeBaseSnapshot();

  primary.tables.request_logs = { exists: true, count: 500, latestAt: '2026-11-18T05:05:00.000Z' };
  fallback.tables.request_logs = { exists: true, count: 480, latestAt: '2026-11-18T05:00:00.000Z' };

  const report = computeParityDiffFromSnapshots(primary, fallback);

  assert.equal(report.isCriticalMatch, true);
  assert.equal(report.isExactMatch, false);
  assert.equal(report.driftedTables.map((t) => t.tableName).join(','), 'request_logs');
  assert.match(formatParitySummaryAlert(report), /CRITICAL MATCH/);
});

test('handleFailoverEvent dispatches ops alert with parity summary', async () => {
  resetFailoverMonitorForTests();
  const alerts: Array<{ message: string; payload: Record<string, unknown> }> = [];
  const primary = makeBaseSnapshot();
  const fallback = makeBaseSnapshot();
  fallback.tables.payments = { exists: true, count: 28, latestAt: '2026-11-17T05:00:00.000Z' };
  primary.tables.payments = { exists: true, count: 29, latestAt: '2026-11-18T05:00:00.000Z' };

  await handleFailoverEvent(
    {
      previousTarget: 'primary',
      activeTarget: 'fallback',
      reason: 'neon_runtime_error',
      triggeredAt: '2026-11-18T05:10:00.000Z',
      errorMessage: 'compute time quota exceeded',
    },
    {
      checkParity: async () => computeParityDiffFromSnapshots(primary, fallback),
      sendAlert: async (message, payload) => {
        alerts.push({ message, payload });
      },
    },
  );

  assert.equal(alerts.length, 1);
  assert.match(alerts[0]!.message, /\[DB FAILOVER\]/);
  assert.match(alerts[0]!.message, /DRIFT DETECTED/);
  assert.equal(alerts[0]!.payload.type, 'db_failover');
  resetFailoverMonitorForTests();
});
