import test from 'node:test';
import assert from 'node:assert/strict';
import { syncTargetedToFallback } from '@morphic/db';
import { createSyncTracker, type SyncLogger } from './db-sync-log';
import { createTargetedSyncQueue, runExclusiveSync, type TargetedSyncQueueDeps, type TargetedSyncInput } from './db-sync-queue';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const tick = () => new Promise((r) => setImmediate(r));

function harness(overrides: Partial<TargetedSyncQueueDeps> = {}) {
  const logs = { info: [] as string[], warn: [] as string[], error: [] as string[] };
  const alerts: string[] = [];
  let t = 1_000_000;
  const log: SyncLogger = {
    info: (m) => void logs.info.push(m),
    warn: (m) => void logs.warn.push(m),
    error: (m) => void logs.error.push(m),
  };
  const tracker = createSyncTracker({ log, sendAlert: async (m) => void alerts.push(m), now: () => t, alertCooldownMs: 600_000 });
  const calls = { targeted: [] as TargetedSyncInput[], full: 0 };
  const deps: TargetedSyncQueueDeps = {
    checkEnabled: () => ({ enabled: true }),
    runTargeted: async (input) => {
      calls.targeted.push(input);
      return {
        userId: UUID_B,
        totalRowsUpserted: 3,
        tables: [
          { tableName: 'balances', rowsUpserted: 1 },
          { tableName: 'credit_ledger', rowsUpserted: 2 },
        ],
      };
    },
    runFull: async () => {
      calls.full += 1;
      return { rowsUpserted: 9, parity: 'CRITICAL' };
    },
    tracker,
    log,
    debounceMs: 1,
    retryDelaysMs: [1],
    now: () => t,
    sleep: async () => {},
    ...overrides,
  };
  return { deps, calls, logs, alerts, tracker, advance: (ms: number) => void (t += ms) };
}

test('success logs an informative line (ids, rows, tables)', async () => {
  const h = harness();
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ paymentId: UUID_A });
  await q.flush();
  const line = h.logs.info.find((m) => m.includes('ok kind=targeted'))!;
  assert.ok(line);
  assert.match(line, new RegExp(`trigger=payment paymentId=${UUID_A}`));
  assert.match(line, /rows=3 tables=balances:1,credit_ledger:2 attempt=1/);
});

test('dedupes identical inputs scheduled within the debounce window', async () => {
  const h = harness();
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ paymentId: UUID_A, userId: UUID_B });
  q.schedule({ paymentId: UUID_A, userId: UUID_B });
  await q.flush();
  assert.equal(h.calls.targeted.length, 1);
});

test('invalid input is logged as a warning, never silently dropped', async () => {
  const h = harness();
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ redeemCodeId: UUID_A });
  await q.flush();
  assert.equal(h.calls.targeted.length, 0);
  assert.ok(h.logs.warn.some((m) => m.includes('reason=invalid-input')));
});

test('disabled sync logs the reason once per 10 minutes, then again after the window', async () => {
  const h = harness({ checkEnabled: () => ({ enabled: false, reason: 'disabled-by-config' }) });
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ userId: UUID_A });
  q.schedule({ userId: UUID_B });
  await q.flush();
  assert.equal(h.calls.targeted.length, 0);
  assert.equal(h.logs.info.filter((m) => m.includes('reason=disabled-by-config')).length, 1);
  h.advance(600_001);
  q.schedule({ userId: UUID_A });
  assert.equal(h.logs.info.filter((m) => m.includes('reason=disabled-by-config')).length, 2);
});

test('failover-active skip is logged with its reason', async () => {
  const h = harness({ checkEnabled: () => ({ enabled: false, reason: 'failover-active' }) });
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ paymentId: UUID_A });
  assert.ok(h.logs.info.some((m) => m.includes('reason=failover-active')));
});

test('retry: failing attempt is logged as FAIL attempt, then success without alert', async () => {
  let n = 0;
  const h = harness({
    runTargeted: async () => {
      n += 1;
      if (n === 1) throw new Error('transient');
      return { totalRowsUpserted: 1, tables: [] };
    },
  });
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ paymentId: UUID_A });
  await q.flush();
  assert.ok(h.logs.error.some((m) => m.includes('FAIL attempt kind=targeted attempt=1/2')));
  assert.ok(h.logs.info.some((m) => m.includes('ok kind=targeted') && m.includes('attempt=2')));
  assert.equal(h.calls.full, 0);
  assert.equal(h.alerts.length, 0);
});

test('escalates to a full sync and logs ESCALATE + ok kind=full trigger=escalation', async () => {
  const h = harness({ runTargeted: async () => { throw new Error('fk violation'); } });
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ paymentId: UUID_A });
  await q.flush();
  assert.ok(h.logs.warn.some((m) => m.includes('ESCALATE kind=targeted->full')));
  assert.ok(h.logs.info.some((m) => m.includes('ok kind=full trigger=escalation')));
  assert.equal(h.calls.full, 1);
  assert.equal(h.alerts.length, 0);
});

test('give-up is loud: FAIL + GIVE-UP logs, one Telegram alert, failure counted', async () => {
  const h = harness({
    runTargeted: async () => { throw new Error('boom'); },
    runFull: async () => { throw new Error('boom full'); },
  });
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ paymentId: UUID_A });
  await q.flush();
  await tick();
  assert.ok(h.logs.error.some((m) => m.includes('FAIL kind=targeted+full')));
  assert.ok(h.logs.error.some((m) => m.includes('GIVE-UP') && m.includes(UUID_A)));
  assert.equal(h.alerts.length, 1);
  assert.equal(h.tracker.status().consecutiveFailures, 1);
});

test('later give-ups within cooldown are logged but not alerted; then recovery notifies', async () => {
  let failing = true;
  const h = harness({
    runTargeted: async () => {
      if (failing) throw new Error('boom');
      return { totalRowsUpserted: 1, tables: [] };
    },
    runFull: async () => {
      if (failing) throw new Error('boom full');
      return {};
    },
  });
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ paymentId: UUID_A });
  await q.flush();
  q.schedule({ paymentId: UUID_B });
  await q.flush();
  await tick();
  assert.equal(h.alerts.length, 1);
  assert.equal(h.logs.error.filter((m) => m.includes('GIVE-UP')).length, 2);

  failing = false;
  q.schedule({ paymentId: UUID_A, userId: UUID_B });
  await q.flush();
  await tick();
  assert.ok(h.logs.warn.some((m) => m.includes('RECOVERED after 2 consecutive failure(s)')));
  assert.match(h.alerts[h.alerts.length - 1]!, /pulih/);
});

test('failover mid-flight aborts with a warning: no full sync, no failure counted, no alert', async () => {
  let enabled = true;
  const h = harness({
    checkEnabled: () => (enabled ? { enabled: true } : { enabled: false, reason: 'failover-active' }),
    runTargeted: async () => {
      enabled = false;
      throw new Error('aborted');
    },
  });
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ paymentId: UUID_A });
  await q.flush();
  await tick();
  assert.ok(h.logs.warn.some((m) => m.includes('abort kind=targeted')));
  assert.equal(h.calls.full, 0);
  assert.equal(h.alerts.length, 0);
  assert.equal(h.tracker.status().consecutiveFailures, 0);
});

test('SQL params in errors never reach logs or alerts', async () => {
  const secretErr = () => new Error('Failed query: insert into "accounts" (...)\nparams: tok_secret_123,sess_abc');
  const h = harness({
    runTargeted: async () => { throw secretErr(); },
    runFull: async () => { throw secretErr(); },
  });
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ paymentId: UUID_A });
  await q.flush();
  await tick();
  const everything = [...h.logs.info, ...h.logs.warn, ...h.logs.error, ...h.alerts].join('\n');
  assert.ok(!everything.includes('tok_secret_123'));
  assert.ok(!everything.includes('sess_abc'));
});

test('different inputs run strictly one at a time through runExclusiveSync', async () => {
  let running = 0;
  let maxRunning = 0;
  const h = harness({
    runTargeted: (input) =>
      runExclusiveSync(async () => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 5));
        running -= 1;
        void input;
        return { totalRowsUpserted: 0, tables: [] };
      }),
  });
  const q = createTargetedSyncQueue(h.deps);
  q.schedule({ userId: UUID_A });
  q.schedule({ userId: UUID_B });
  await q.flush();
  assert.equal(maxRunning, 1);
});

test('runExclusiveSync keeps working after a rejected task', async () => {
  await assert.rejects(runExclusiveSync(async () => { throw new Error('x'); }));
  assert.equal(await runExclusiveSync(async () => 42), 42);
});

test('syncTargetedToFallback validates input before touching any database', async () => {
  const urls = { primaryUrl: 'postgresql://a:b@127.0.0.1:1/p', fallbackUrl: 'postgresql://a:b@127.0.0.1:2/f' };
  await assert.rejects(syncTargetedToFallback({ userId: 'not-a-uuid' }, urls), /invalid userId/);
  await assert.rejects(syncTargetedToFallback({ paymentId: UUID_A, redeemCodeId: 'zzz' }, urls), /invalid redeemCodeId/);
  await assert.rejects(syncTargetedToFallback({ redeemCodeId: UUID_A }, urls), /needs userId or paymentId/);
  await assert.rejects(
    syncTargetedToFallback({ userId: UUID_A }, { primaryUrl: urls.primaryUrl, fallbackUrl: urls.primaryUrl }),
    /identical/,
  );
});
