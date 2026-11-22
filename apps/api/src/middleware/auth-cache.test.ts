import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { db, schema as s } from '@morphic/db';
import { eq, inArray } from 'drizzle-orm';
import { apiKeyAuth, invalidateApiKeyAuthCache } from './auth';

const app = new Hono();
app.use('*', apiKeyAuth());
app.get('/', (c) => c.json(c.get('apiKey')));

const userIds: string[] = [];

afterEach(() => {
  delete process.env.API_KEY_AUTH_CACHE_TTL_MS;
  invalidateApiKeyAuthCache();
});

after(async () => {
  if (userIds.length) {
    await db.delete(s.apiKeys).where(inArray(s.apiKeys.userId, userIds));
    await db.delete(s.users).where(inArray(s.users.id, userIds));
  }
});

async function mkKey() {
  const tag = randomUUID().slice(0, 8);
  const [user] = await db
    .insert(s.users)
    .values({ name: `authcache-${tag}`, email: `authcache-${tag}@authcache.test` })
    .returning();
  userIds.push(user!.id);
  const rawKey = `mp-${randomUUID().replaceAll('-', '')}`;
  const [key] = await db
    .insert(s.apiKeys)
    .values({
      userId: user!.id,
      name: 'authcache-key',
      keyHash: createHash('sha256').update(rawKey).digest('hex'),
      keyPrefix: rawKey.slice(0, 10),
    })
    .returning();
  return { rawKey, keyId: key!.id, userId: user!.id };
}

const call = (rawKey: string) => app.request('/', { headers: { authorization: `Bearer ${rawKey}` } });

test('auth cache: revoked key keeps working within TTL, stops after invalidation', async () => {
  const { rawKey, keyId, userId } = await mkKey();
  const first = await call(rawKey);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { keyId, userId });

  // Written by another process (apps/web): this process only sees it after the TTL.
  await db.update(s.apiKeys).set({ status: 'revoked' }).where(eq(s.apiKeys.id, keyId));
  assert.equal((await call(rawKey)).status, 200);

  invalidateApiKeyAuthCache(keyId);
  assert.equal((await call(rawKey)).status, 401);
});

test('auth cache: TTL 0 disables caching, suspend applies on the next request', async () => {
  process.env.API_KEY_AUTH_CACHE_TTL_MS = '0';
  const { rawKey, userId } = await mkKey();
  assert.equal((await call(rawKey)).status, 200);

  await db.update(s.users).set({ suspended: true }).where(eq(s.users.id, userId));
  assert.equal((await call(rawKey)).status, 403);
});

test('auth cache: lastUsedAt is written once per debounce window', async () => {
  const { rawKey, keyId } = await mkKey();
  assert.equal((await call(rawKey)).status, 200);
  await new Promise((r) => setTimeout(r, 200));
  const [firstTouch] = await db.select({ at: s.apiKeys.lastUsedAt }).from(s.apiKeys).where(eq(s.apiKeys.id, keyId));
  assert.ok(firstTouch?.at, 'first request sets lastUsedAt');

  assert.equal((await call(rawKey)).status, 200);
  await new Promise((r) => setTimeout(r, 200));
  const [secondTouch] = await db.select({ at: s.apiKeys.lastUsedAt }).from(s.apiKeys).where(eq(s.apiKeys.id, keyId));
  assert.equal(secondTouch?.at?.getTime(), firstTouch.at.getTime(), 'second request within 60s does not write');
});
