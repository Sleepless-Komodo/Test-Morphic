import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDevOrTestEnv } from './runtime-env.js';

test('isDevOrTestEnv returns false when NODE_ENV is unset', () => {
  assert.equal(isDevOrTestEnv({}), false);
});

test('isDevOrTestEnv returns false for production and staging', () => {
  assert.equal(isDevOrTestEnv({ NODE_ENV: 'production' }), false);
  assert.equal(isDevOrTestEnv({ NODE_ENV: 'staging' }), false);
});

test('isDevOrTestEnv returns true only for development and test', () => {
  assert.equal(isDevOrTestEnv({ NODE_ENV: 'development' }), true);
  assert.equal(isDevOrTestEnv({ NODE_ENV: 'test' }), true);
});
