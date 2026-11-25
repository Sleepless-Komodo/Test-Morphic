/**
 * A -> local -> B with three real databases. Wipes morphic_a_test, morphic_local_test and
 * morphic_b_test on the test host; skipped when they do not exist or are not migrated.
 */
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import {
  checkDeepParity,
  createDbHandle,
  extractExecuteRows,
  schema as s,
  startAudit,
  syncFallbackToPrimary,
  syncPrimaryToFallback,
  syncTargetedToFallback,
  verifyAuditChain,
  type DbHandle,
} from '@morphic/db';
import { createSyncTracker, type SyncLogger } from './db-sync-log';
import { runFallbackSyncJob } from './db-failover-monitor';
import { createTargetedSyncQueue } from './db-sync-queue';

const urlFor = (name: string): string => {
  const u = new URL(process.env.DATABASE_URL!);
  u.pathname = `/${name}`;
  return u.toString();
};
const A = urlFor('morphic_a_test');
const LOCAL = urlFor('morphic_local_test');
const B = urlFor('morphic_b_test');

const auditTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'morphic-audit-'));
const savedAuditDir = process.env.DB_AUDIT_DIR;
let a: DbHandle, local: DbHandle, b: DbHandle;

async function available(url: string): Promise<boolean> {
  const h = createDbHandle(url, { max: 1 });
  try {
    await h.db.execute(sql`select 1 from public.users limit 1`);
    return true;
  } catch {
    return false;
  } finally {
    await h.close();
  }
}
const ready = (await Promise.all([A, LOCAL, B].map(available))).every(Boolean);
const opts = { skip: ready ? false : 'morphic_{a,local,b}_test not available' };

async function wipe(h: DbHandle): Promise<void> {
  const [row] = extractExecuteRows<{ db: string }>(await h.db.execute(sql`select current_database() as db`));
  assert.match(row!.db, /^morphic_(a|local|b)_test$/);
  const tables = extractExecuteRows<{ t: string }>(
    await h.db.execute(sql`select tablename as t from pg_tables where schemaname = 'public'`),
  );
  await h.db.execute(sql.raw(`TRUNCATE ${tables.map((x) => `"public"."${x.t}"`).join(', ')} CASCADE`));
}

interface Seeded {
  userId: string;
  keyId: string;
  oldKeyId: string;
  sessionId: string;
  paymentId: string;
}

async function seed(h: DbHandle): Promise<Seeded> {
  const d = h.db as any;
  const userId = randomUUID();
  const [keyId, oldKeyId, sessionId, paymentId] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  await d.insert(s.users).values({ id: userId, name: 'Budi', email: `${userId}@test.local` });
  await d.insert(s.balances).values({ userId, credits: 10_000_000 });
  await d.insert(s.apiKeys).values([
    { id: keyId, userId, name: 'current', keyHash: randomUUID(), keyPrefix: 'mp-a' },
    { id: oldKeyId, userId, name: 'old', keyHash: randomUUID(), keyPrefix: 'mp-b' },
  ]);
  await d.insert(s.sessions).values({ id: sessionId, userId, token: randomUUID(), expiresAt: new Date(Date.now() + 3_600_000) });
  await d.insert(s.payments).values({
    id: paymentId,
    userId,
    provider: 'paypal',
    externalId: randomUUID(),
    amountCents: 2000,
    credits: 10_000_000,
    status: 'paid',
    paidAt: new Date(),
  });
  await d.insert(s.creditLedger).values({ userId, entryType: 'purchase', amount: 10_000_000, reference: `payment:${paymentId}` });
  await d.insert(s.usageRecords).values({ userId, apiKeyId: oldKeyId, requestId: randomUUID(), status: 'success' });
  return { userId, keyId, oldKeyId, sessionId, paymentId };
}

const toLocal = (extra: object = {}) => syncPrimaryToFallback({ primaryUrl: A, fallbackUrl: LOCAL, ...extra });
const ids = async (h: DbHandle, table: any): Promise<string[]> =>
  ((await (h.db as any).select({ id: table.id }).from(table)) as Array<{ id: string }>).map((x) => x.id);
const isBehind = (err: unknown) => err instanceof Error && err.name === 'PrimaryBehindError';

before(() => {
  process.env.DB_AUDIT_DIR = auditTmp;
  a = createDbHandle(A, { max: 2 });
  local = createDbHandle(LOCAL, { max: 2 });
  b = createDbHandle(B, { max: 2 });
});
after(async () => {
  await Promise.all([a, local, b].map((h) => h.close()));
  fs.rmSync(auditTmp, { recursive: true, force: true });
  if (savedAuditDir === undefined) delete process.env.DB_AUDIT_DIR;
  else process.env.DB_AUDIT_DIR = savedAuditDir;
});
beforeEach(async () => {
  if (!ready) return;
  fs.rmSync(auditTmp, { recursive: true, force: true });
  await Promise.all([wipe(a), wipe(local), wipe(b)]);
});

test('an empty or older primary is blocked and local stays untouched', opts, async () => {
  const x = await seed(a);
  await toLocal();
  const asPrimary = (extra: object = {}) => syncPrimaryToFallback({ primaryUrl: B, fallbackUrl: LOCAL, ...extra });

  await assert.rejects(asPrimary({ pruneDeleted: true, allowEmptyPrune: true }), isBehind);

  await (b.db as any).insert(s.users).values({ id: x.userId, name: 'Budi', email: `${x.userId}@test.local` });
  await (b.db as any).insert(s.balances).values({ userId: x.userId, credits: 1 });
  await assert.rejects(asPrimary(), isBehind);
  await assert.rejects(syncTargetedToFallback({ userId: x.userId }, { primaryUrl: B, fallbackUrl: LOCAL }), isBehind);

  const [bal] = await (local.db as any).select().from(s.balances);
  assert.equal(bal.credits, 10_000_000);
  assert.equal((await ids(local, s.apiKeys)).length, 2);

  const dry = await asPrimary({ dryRun: true });
  assert.ok(dry.warnings.some((w) => w.includes('would be refused')));
  await asPrimary({ allowBehind: true });
  const [forced] = await (local.db as any).select().from(s.balances);
  assert.equal(forced.credits, 1);
});

test('refunds, repeated syncs and stray local payments do not block', opts, async () => {
  const x = await seed(a);
  await toLocal();
  await (a.db as any).update(s.payments).set({ status: 'refunded' }).where(eq(s.payments.id, x.paymentId));
  await (local.db as any).insert(s.payments).values({
    userId: x.userId, provider: 'duitku', externalId: randomUUID(), amountCents: 2000, credits: 1, status: 'expired',
  });
  await toLocal();
  await toLocal();
  const [p] = await (local.db as any).select().from(s.payments).where(eq(s.payments.id, x.paymentId));
  assert.equal(p.status, 'refunded');
});

test('prune: dry run writes nothing, live run removes only access rows and keeps history', opts, async () => {
  const x = await seed(a);
  await toLocal();
  await (a.db as any).delete(s.apiKeys).where(eq(s.apiKeys.id, x.oldKeyId));
  await (local.db as any).insert(s.payments).values({
    userId: x.userId, provider: 'duitku', externalId: randomUUID(), amountCents: 2000, credits: 1, status: 'expired',
  });

  const dry = await toLocal({ dryRun: true, pruneDeleted: true });
  assert.deepEqual(dry.pruned!.find((p) => p.tableName === 'api_keys')!.ids, [x.oldKeyId]);
  assert.equal((await ids(local, s.apiKeys)).length, 2);
  assert.equal(fs.existsSync(auditTmp), false);

  const live = await toLocal({ pruneDeleted: true });
  assert.equal(live.pruned!.find((p) => p.tableName === 'api_keys')!.deleted, 1);
  assert.deepEqual(await ids(local, s.apiKeys), [x.keyId]);
  assert.equal((await ids(local, s.payments)).length, 2);
  assert.equal((await ids(local, s.usageRecords)).length, 1);
});

test('prune: an empty primary table is skipped unless allowed', opts, async () => {
  const x = await seed(a);
  await toLocal();
  await (a.db as any).delete(s.sessions).where(eq(s.sessions.id, x.sessionId));
  const skipped = await toLocal({ pruneDeleted: true });
  assert.equal(skipped.pruned!.find((p) => p.tableName === 'sessions')!.skippedReason, 'primary_table_empty');
  assert.equal((await ids(local, s.sessions)).length, 1);
  await toLocal({ pruneDeleted: true, allowEmptyPrune: true });
  assert.equal((await ids(local, s.sessions)).length, 0);
});

test('prune stops before deleting when the audit report cannot be written', opts, async () => {
  const x = await seed(a);
  await toLocal();
  await (a.db as any).delete(s.apiKeys).where(eq(s.apiKeys.id, x.oldKeyId));
  fs.writeFileSync(auditTmp, 'not a directory');
  await assert.rejects(toLocal({ pruneDeleted: true }));
  assert.equal((await ids(local, s.apiKeys)).length, 2);
});

test('A -> local -> B reproduces balances, ledger and keys; deleted keys stay gone', opts, async () => {
  const x = await seed(a);
  await toLocal();
  await (a.db as any).delete(s.apiKeys).where(eq(s.apiKeys.id, x.oldKeyId));
  await toLocal({ pruneDeleted: true });
  const first = await checkDeepParity({ primaryUrl: A, fallbackUrl: LOCAL });
  assert.equal(first.matches, true, JSON.stringify(first.tables.filter((t) => !t.matches)));

  await syncFallbackToPrimary({ primaryUrl: B, fallbackUrl: LOCAL, forceFull: true });
  const moved = await checkDeepParity({ primaryUrl: B, fallbackUrl: LOCAL });
  assert.equal(moved.matches, true);
  assert.equal(moved.ledgerPrimary.usersWithMismatch, 0);
  assert.deepEqual(await ids(b, s.apiKeys), [x.keyId]);
  // The normal direction works again with B as the primary.
  await syncPrimaryToFallback({ primaryUrl: B, fallbackUrl: LOCAL });
});

test('deep parity sees changed contents with equal counts, ignores microseconds, leaks nothing', opts, async () => {
  const x = await seed(a);
  await (a.db as any).execute(sql`update public.payments set created_at = '2026-11-24 01:02:03.123456+00'`);
  await toLocal();
  assert.equal((await checkDeepParity({ primaryUrl: A, fallbackUrl: LOCAL })).matches, true);

  await (local.db as any).update(s.payments).set({ credits: 5 }).where(eq(s.payments.id, x.paymentId));
  await (local.db as any).update(s.balances).set({ credits: 9 }).where(eq(s.balances.userId, x.userId));
  const report = await checkDeepParity({ primaryUrl: A, fallbackUrl: LOCAL });
  assert.equal(report.matches, false);
  assert.deepEqual(report.tables.filter((t) => !t.matches).map((t) => t.tableName).sort(), ['balances', 'payments']);
  assert.deepEqual(report.ledgerDifferences, [x.userId]);
  assert.ok(!/@test\.local|mp-a/.test(JSON.stringify(report)));
});

test('audit reports are private, chained and tamper-evident', opts, async () => {
  const target = { sourceUrl: 'postgresql://u:pw@h:1/a?x=1', destinationUrl: 'postgresql://u:pw@h:1/b' };
  const one = startAudit({ operation: 'one', ...target });
  one.finish('succeeded', { n: 1 });
  await new Promise((r) => setTimeout(r, 5));
  const two = startAudit({ operation: 'two', ...target });
  two.finish('failed', { error: 'x' });
  assert.equal(fs.statSync(one.file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(auditTmp).mode & 0o777, 0o700);
  assert.ok(!fs.readFileSync(one.file, 'utf8').includes('pw'));
  assert.deepEqual(verifyAuditChain(), { reports: 2, problems: [] });
  fs.appendFileSync(one.file, ' ');
  assert.equal(verifyAuditChain().problems.length, 1);
  fs.rmSync(one.file);
  assert.equal(verifyAuditChain().problems.length, 1);
});

test('blocked sync: one alert, no retry, no escalation, alert again only after recovery', async () => {
  const alerts: string[] = [];
  const lines: string[] = [];
  const push = (m: string) => void lines.push(m);
  const log: SyncLogger = { info: push, warn: push, error: push };
  const tracker = createSyncTracker({ log, sendAlert: async (m) => void alerts.push(m), now: () => 0, alertCooldownMs: 1 });
  const behind = Object.assign(new Error('primary is behind'), { name: 'PrimaryBehindError' });
  let targeted = 0;
  let full = 0;
  const q = createTargetedSyncQueue({
    checkEnabled: () => ({ enabled: true }),
    runTargeted: async () => { targeted += 1; throw behind; },
    runFull: async () => { full += 1; return undefined; },
    tracker, log, debounceMs: 1, retryDelaysMs: [1, 1], now: () => 0, sleep: async () => {},
  });
  q.schedule({ userId: randomUUID() });
  await q.flush();
  await runFallbackSyncJob('periodic', { run: async () => { throw behind; }, log, tracker });
  await new Promise((r) => setImmediate(r));
  assert.equal(targeted, 1);
  assert.equal(full, 0);
  assert.equal(alerts.length, 1);
  assert.equal(lines.filter((l) => l.includes('BLOCKED reason=primary-behind')).length, 2);
  tracker.ok('kind=full', {});
  await runFallbackSyncJob('periodic', { run: async () => { throw behind; }, log, tracker });
  await new Promise((r) => setImmediate(r));
  assert.equal(alerts.length, 2);
});
