import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rejectMultiplierParams,
  requestedOutputCap,
  unifyOutputCap,
  stripMultiplierParams,
} from './request-guards.js';

test('rejectMultiplierParams accepts empty body', () => {
  assert.deepEqual(rejectMultiplierParams({}), { ok: true });
});

test('rejectMultiplierParams accepts n: 1 and n: null', () => {
  assert.deepEqual(rejectMultiplierParams({ n: 1 }), { ok: true });
  assert.deepEqual(rejectMultiplierParams({ n: null }), { ok: true });
});

test('rejectMultiplierParams rejects n > 1', () => {
  const res = rejectMultiplierParams({ n: 8 });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, 'unsupported_parameter');
  }
});

test('rejectMultiplierParams rejects best_of > 1', () => {
  const res = rejectMultiplierParams({ best_of: 2 });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, 'unsupported_parameter');
  }
});

test('requestedOutputCap resolves min positive cap across max_tokens and max_completion_tokens', () => {
  assert.equal(requestedOutputCap({}), null);
  assert.equal(requestedOutputCap({ max_tokens: 16 }), 16);
  assert.equal(requestedOutputCap({ max_completion_tokens: 50 }), 50);
  assert.equal(requestedOutputCap({ max_tokens: 16, max_completion_tokens: 100000 }), 16);
});

test('requestedOutputCap ignores non-positive numbers', () => {
  assert.equal(requestedOutputCap({ max_tokens: -5 }), null);
});

test('unifyOutputCap clamps mismatched max_tokens and max_completion_tokens to smaller value', () => {
  const out = unifyOutputCap({ max_tokens: 16, max_completion_tokens: 100000, model: 'm' });
  assert.equal(out.max_tokens, 16);
  assert.equal(out.max_completion_tokens, 16);
  assert.equal(out.model, 'm');
});

test('unifyOutputCap returns the exact same object reference when unchanged', () => {
  const input = { max_tokens: 16 };
  const out = unifyOutputCap(input);
  assert.equal(out, input);
});

test('stripMultiplierParams deletes n and best_of while keeping other keys', () => {
  const payload: Record<string, unknown> = { model: 'x', n: 1, best_of: 3, temperature: 0.5 };
  stripMultiplierParams(payload);
  assert.equal('n' in payload, false);
  assert.equal('best_of' in payload, false);
  assert.equal(payload.model, 'x');
  assert.equal(payload.temperature, 0.5);
});
