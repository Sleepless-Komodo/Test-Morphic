import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memo, invalidate } from './memo.ts';

test('concurrent callers share one call; result reused within ttl', async () => {
  let calls = 0;
  const fn = async () => ++calls;
  const [a, b] = await Promise.all([memo('k1', 1000, fn), memo('k1', 1000, fn)]);
  assert.equal(a, 1); assert.equal(b, 1);
  assert.equal(await memo('k1', 1000, fn), 1);
  assert.equal(calls, 1);
});

test('expires after ttl', async () => {
  let calls = 0;
  await memo('k2', 5, async () => ++calls);
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(await memo('k2', 5, async () => ++calls), 2);
});

test('failures are not cached', async () => {
  await assert.rejects(memo('k3', 1000, async () => { throw new Error('db down'); }));
  await new Promise((r) => setImmediate(r));
  assert.equal(await memo('k3', 1000, async () => 'ok'), 'ok');
});

test('invalidate by prefix', async () => {
  let calls = 0;
  await memo('alerts:x', 1000, async () => ++calls);
  invalidate('alerts:');
  assert.equal(await memo('alerts:x', 1000, async () => ++calls), 2);
});
