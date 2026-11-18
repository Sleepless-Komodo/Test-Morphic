import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeErrorForLog } from '@morphic/db';
import { createSyncTracker, kv, parityVerdict, type SyncLogger } from './db-sync-log';

function setup(alertCooldownMs = 600_000) {
  const logs = { info: [] as string[], warn: [] as string[], error: [] as string[] };
  const alerts: string[] = [];
  let t = 5_000_000;
  const log: SyncLogger = {
    info: (m) => void logs.info.push(m),
    warn: (m) => void logs.warn.push(m),
    error: (m) => void logs.error.push(m),
  };
  const tracker = createSyncTracker({
    log,
    sendAlert: async (m) => void alerts.push(m),
    now: () => t,
    alertCooldownMs,
  });
  return { logs, alerts, tracker, advance: (ms: number) => void (t += ms) };
}
const tick = () => new Promise((r) => setImmediate(r));

test('kv formats fields, maps null to - and drops undefined', () => {
  assert.equal(kv({ a: 1, b: null, c: undefined, d: 'x' }), 'a=1 b=- d=x');
});

test('parityVerdict maps report flags', () => {
  assert.equal(parityVerdict({ isExactMatch: true, isCriticalMatch: true }), 'EXACT');
  assert.equal(parityVerdict({ isExactMatch: false, isCriticalMatch: true }), 'CRITICAL');
  assert.equal(parityVerdict({ isExactMatch: false, isCriticalMatch: false }), 'DRIFT');
});

test('sanitizeErrorForLog never leaks SQL params, prefers driver message, masks URLs and caps length', () => {
  const driver = Object.assign(new Error('duplicate key value violates unique constraint "users_email_unique"'), {
    code: '23505',
  });
  const wrapped = new Error('Failed query: insert into "accounts" (...)\nparams: tok_secret_123,sess_abc', { cause: driver });
  const out = sanitizeErrorForLog(wrapped);
  assert.match(out, /^\[23505\] duplicate key value/);
  assert.ok(!out.includes('tok_secret_123'));

  const onlyWrapper = new Error('Failed query: insert into "sessions"\nparams: tok_secret_999');
  assert.equal(sanitizeErrorForLog(onlyWrapper), 'query failed');

  assert.ok(!sanitizeErrorForLog(new Error('cannot connect to postgresql://u:pw@host:5432/db')).includes('pw'));
  assert.ok(sanitizeErrorForLog(new Error('x'.repeat(1000))).length <= 302);
});

test('ok logs and fail logs are never silent; error text is sanitized', () => {
  const { logs, tracker } = setup();
  tracker.ok('kind=targeted', { paymentId: 'p1', rows: 3 });
  assert.match(logs.info[0]!, /^\[db-sync\] ok kind=targeted paymentId=p1 rows=3$/);

  tracker.fail('kind=full', { trigger: 'periodic' }, new Error('Failed query: x\nparams: tok_secret_1'), { alertAfter: 1 });
  assert.match(logs.error[0]!, /FAIL kind=full trigger=periodic consecutiveFailures=1 error="query failed"/);
  assert.ok(!logs.error.join('\n').includes('tok_secret_1'));
});

test('alertAfter threshold: periodic alerts only on the 3rd consecutive failure', async () => {
  const { alerts, tracker } = setup();
  tracker.fail('kind=full', {}, new Error('boom'), { alertAfter: 3 });
  tracker.fail('kind=full', {}, new Error('boom'), { alertAfter: 3 });
  await tick();
  assert.equal(alerts.length, 0);
  tracker.fail('kind=full', {}, new Error('boom'), { alertAfter: 3 });
  await tick();
  assert.equal(alerts.length, 1);
  assert.match(alerts[0]!, /gagal \(3 beruntun\)/);
});

test('cooldown suppresses alerts but still logs; next alert reports suppressed count', async () => {
  const { logs, alerts, tracker, advance } = setup();
  tracker.fail('kind=targeted+full', {}, new Error('a'), { alertAfter: 1 });
  tracker.fail('kind=targeted+full', {}, new Error('b'), { alertAfter: 1 });
  await tick();
  assert.equal(alerts.length, 1);
  assert.equal(logs.error.length, 2);
  assert.ok(logs.warn.some((m) => m.includes('alert suppressed by cooldown (suppressed=1)')));
  advance(600_001);
  tracker.fail('kind=targeted+full', {}, new Error('c'), { alertAfter: 1 });
  await tick();
  assert.equal(alerts.length, 2);
  assert.match(alerts[1]!, /\+1 kegagalan/);
});

test('recovery logs RECOVERED, resets counters and sends a recovery alert only after a failure alert', async () => {
  const { logs, alerts, tracker } = setup();
  tracker.fail('kind=full', {}, new Error('x'), { alertAfter: 1 });
  await tick();
  assert.equal(tracker.status().consecutiveFailures, 1);
  tracker.ok('kind=full', {});
  await tick();
  assert.equal(tracker.status().consecutiveFailures, 0);
  assert.ok(logs.warn.some((m) => m.includes('RECOVERED after 1 consecutive failure(s)')));
  assert.match(alerts[alerts.length - 1]!, /pulih/);

  // No failure alert was sent (below threshold) => no recovery alert either.
  const s2 = setup();
  s2.tracker.fail('kind=full', {}, new Error('x'), { alertAfter: 3 });
  s2.tracker.ok('kind=full', {});
  await tick();
  assert.equal(s2.alerts.length, 0);
});

test('status exposes ISO timestamps and counters', () => {
  const { tracker } = setup();
  assert.deepEqual(tracker.status(), { lastOkAt: null, lastFailAt: null, consecutiveFailures: 0, suppressedAlerts: 0 });
  tracker.ok('kind=full', {});
  assert.match(tracker.status().lastOkAt!, /^\d{4}-\d{2}-\d{2}T/);
});
