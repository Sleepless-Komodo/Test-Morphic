import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { db, schema as s } from '@morphic/db';
import { inArray } from 'drizzle-orm';
import { apiKeyAuth, gatewayGuards } from './auth';

// Each stream waits on a gate, so a test decides when it is still "in flight".
const gates: Array<() => void> = [];

const app = new Hono();
app.use('*', apiKeyAuth(), gatewayGuards({ rpm: 1000, concurrency: 2 }));
app.get('/stream', (c) =>
  streamSSE(c, async (stream) => {
    await new Promise<void>((resolve) => gates.push(resolve));
    await stream.writeSSE({ data: 'done' });
  }),
);
app.get('/json', (c) => c.json({ ok: true }));

const userIds: string[] = [];

afterEach(() => {
  delete process.env.GATEWAY_GLOBAL_CONCURRENCY;
  while (gates.length) gates.shift()!();
});

after(async () => {
  if (userIds.length) {
    await db.delete(s.apiKeys).where(inArray(s.apiKeys.userId, userIds));
    await db.delete(s.users).where(inArray(s.users.id, userIds));
  }
});

async function mkKey(): Promise<string> {
  const tag = randomUUID().slice(0, 8);
  const [user] = await db
    .insert(s.users)
    .values({ name: `cc-${tag}`, email: `cc-${tag}@concurrency.test` })
    .returning();
  userIds.push(user!.id);
  const rawKey = `mp-${randomUUID().replaceAll('-', '')}`;
  await db.insert(s.apiKeys).values({
    userId: user!.id,
    name: 'cc-key',
    keyHash: createHash('sha256').update(rawKey).digest('hex'),
    keyPrefix: rawKey.slice(0, 10),
  });
  return rawKey;
}

const call = (rawKey: string, path = '/stream') =>
  app.request(path, { headers: { authorization: `Bearer ${rawKey}` } });

async function waitForGates(n: number) {
  for (let i = 0; i < 50 && gates.length < n; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(gates.length, n);
}

test('per-key slot stays held for the whole stream, freed when it finishes', async () => {
  const key = await mkKey();
  const a = await call(key);
  const b = await call(key);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);

  // Both streams are still open: before the fix the slots were already free here.
  const third = await call(key);
  assert.equal(third.status, 429);
  assert.equal((await third.json()).error.code, 'concurrency_limit_exceeded');

  await waitForGates(2);
  gates.shift()!();
  assert.match(await a.text(), /done/);
  assert.equal((await call(key)).status, 200);
});

test('per-key slot is freed when the client cancels the stream', async () => {
  const key = await mkKey();
  const a = await call(key);
  await call(key);
  assert.equal((await call(key)).status, 429);

  await a.body!.cancel();
  assert.equal((await call(key)).status, 200);
});

test('non-stream responses release the slot immediately', async () => {
  const key = await mkKey();
  for (let i = 0; i < 5; i++) assert.equal((await call(key, '/json')).status, 200);
});

test('global cap: 503 server_overloaded across keys, freed when a stream ends', async () => {
  process.env.GATEWAY_GLOBAL_CONCURRENCY = '1';
  const keyA = await mkKey();
  const keyB = await mkKey();

  const a = await call(keyA);
  assert.equal(a.status, 200);

  const blocked = await call(keyB);
  assert.equal(blocked.status, 503);
  assert.equal(blocked.headers.get('retry-after'), '1');
  assert.equal((await blocked.json()).error.code, 'server_overloaded');

  await waitForGates(1);
  gates.shift()!();
  await a.text();
  const b = await call(keyB);
  assert.equal(b.status, 200);
});
