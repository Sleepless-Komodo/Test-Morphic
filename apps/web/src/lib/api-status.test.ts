import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_API_STATUS, isApiDown, nextApiStatus, parseHealthBody, type ApiCheck } from './api-status.ts';

const fail: ApiCheck = { ok: false, reason: 'unreachable' };
const run = (...checks: ApiCheck[]) => checks.reduce((s, c, i) => nextApiStatus(s, c, (i + 1) * 1000), INITIAL_API_STATUS);

test('one failure stays quiet, two in a row alert, one success clears', () => {
  assert.equal(isApiDown(run(fail)), false);
  assert.equal(isApiDown(run(fail, fail)), true);
  assert.equal(isApiDown(run(fail, { ok: true }, fail)), false);
  assert.deepEqual(run(fail, fail, { ok: true }), { failures: 0, downSince: null, lastOkAt: 3000, lastCheckAt: 3000, reason: null });
});

test('downSince is the first failure, lastOkAt survives the outage, reason is the latest', () => {
  assert.deepEqual(run({ ok: true }, fail, fail, { ok: false, reason: 'error' }), {
    failures: 3,
    downSince: 2000,
    lastOkAt: 1000,
    lastCheckAt: 4000,
    reason: 'error',
  });
});

test('a check that could not run changes nothing', () => {
  assert.equal(isApiDown(run(fail, null)), false);
  assert.equal(isApiDown(run(fail, null, fail)), true);
  assert.equal(isApiDown(run(fail, fail, null)), true);
});

test('only a health body counts as an answer', () => {
  assert.deepEqual(parseHealthBody({ ok: true, status: 'operational' }), { ok: true });
  assert.deepEqual(parseHealthBody({ ok: false, reason: 'unreachable' }), { ok: false, reason: 'unreachable' });
  assert.deepEqual(parseHealthBody({ ok: false }), { ok: false, reason: 'error' });
  for (const other of [null, 'x', {}, { ok: 'yes' }, []]) assert.equal(parseHealthBody(other), null);
});

test('failures on both sides of a long gap are not one outage', () => {
  const first = nextApiStatus(INITIAL_API_STATUS, fail, 0);
  const afterGap = nextApiStatus(first, fail, 2 * 60 * 60_000);
  assert.equal(isApiDown(afterGap), false);
  assert.equal(nextApiStatus(afterGap, fail, 2 * 60 * 60_000 + 30_000).downSince, 2 * 60 * 60_000);
});
