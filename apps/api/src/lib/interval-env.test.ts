import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbSyncIntervalMs, intervalFromEnv } from './interval-env';

const env = (value?: string) => ({ X: value, DB_SYNC_INTERVAL_MS: value }) as unknown as NodeJS.ProcessEnv;

test('valid and unset intervals are used without a warning', () => {
  const warnings: string[] = [];
  const read = (v?: string) => intervalFromEnv('X', 300_000, env(v), (m) => void warnings.push(m));
  assert.equal(read(undefined), 300_000);
  assert.equal(read('60000'), 60_000);
  assert.equal(read('2147483647'), 2_147_483_647);
  assert.deepEqual(warnings, []);
});

test('values Node would turn into a 1 ms timer fall back to the default with a warning', () => {
  for (const bad of ['abc', '', '0', '-5', '0.5', '999', '2147483648', 'Infinity']) {
    const warnings: string[] = [];
    assert.equal(intervalFromEnv('X', 300_000, env(bad), (m) => void warnings.push(m)), 300_000, bad);
    assert.equal(warnings.length, 1, bad);
  }
});

test('DB sync: 0, negative and empty stay off; other invalid values use the default', () => {
  const read = (v?: string) => dbSyncIntervalMs(env(v), () => {});
  for (const off of ['0', '-1', '']) assert.equal(read(off), 0, off);
  for (const bad of ['abc', '2147483648', '500']) assert.equal(read(bad), 600_000, bad);
  assert.equal(read(undefined), 600_000);
  assert.equal(read('120000'), 120_000);
});
