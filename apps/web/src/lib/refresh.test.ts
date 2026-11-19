import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REFRESH_IDLE_STOP_MS, shouldAutoRefresh } from './refresh.ts';

const now = 10 * 60 * 60_000;
const interval = 60_000;

test('idle stop is 30 minutes', () => {
  assert.equal(REFRESH_IDLE_STOP_MS, 30 * 60_000);
});

test('refreshes when stale and the user was recently active', () => {
  assert.equal(shouldAutoRefresh({ nowMs: now, lastRefreshMs: now - interval, lastInputMs: now - 1_000, intervalMs: interval }), true);
});

test('does not refresh before the interval passes', () => {
  assert.equal(shouldAutoRefresh({ nowMs: now, lastRefreshMs: now - interval + 1, lastInputMs: now, intervalMs: interval }), false);
});

test('stops refreshing an unattended tab so it cannot keep the admin step-up alive', () => {
  assert.equal(
    shouldAutoRefresh({ nowMs: now, lastRefreshMs: now - interval, lastInputMs: now - REFRESH_IDLE_STOP_MS, intervalMs: interval }),
    false,
  );
  assert.equal(
    shouldAutoRefresh({ nowMs: now, lastRefreshMs: now - interval, lastInputMs: now - REFRESH_IDLE_STOP_MS + 1, intervalMs: interval }),
    true,
  );
});
