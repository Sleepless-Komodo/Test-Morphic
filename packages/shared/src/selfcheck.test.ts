import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateApiKey, hashApiKey, displayPrefix, KEY_PREFIX } from './keys.ts';
import {
  estimateReservation,
  actualUsageCredits,
  reserveOutputCap,
  tokensToCredits,
} from './credits.ts';

test('api key generation and hashing', () => {
  const k = generateApiKey();
  assert.ok(k.raw.startsWith(KEY_PREFIX));
  assert.equal(k.hash, hashApiKey(k.raw));
  assert.equal(k.prefix, displayPrefix(k.raw));
  assert.notEqual(hashApiKey(k.raw), hashApiKey('mp-other'));
});

test('reserve output cap clamps to hard cap and context', () => {
  const base = {
    promptTokens: 100,
    modelContextLength: 32768,
    hardReserveCap: 16384,
    pricing: { inputCreditsPer1m: 100, outputCreditsPer1m: 200 },
  };
  assert.equal(reserveOutputCap({ ...base, requestedMaxTokens: 999_999 }), 16384);
  assert.equal(reserveOutputCap({ ...base, requestedMaxTokens: null }), 16384);
  assert.equal(reserveOutputCap({ ...base, requestedMaxTokens: 500 }), 500);
  assert.equal(
    reserveOutputCap({ ...base, modelContextLength: 1000, requestedMaxTokens: null }),
    1000,
  );
});

test('reservation estimate is ceiling, actual usage <= estimate', () => {
  const input = {
    promptTokens: 1000,
    requestedMaxTokens: 2000,
    modelContextLength: 32768,
    hardReserveCap: 16384,
    pricing: { inputCreditsPer1m: 100, outputCreditsPer1m: 200 },
  };
  const est = estimateReservation(input);
  assert.equal(est, tokensToCredits(1000, 100) + tokensToCredits(2000, 200));
  const actual = actualUsageCredits(1000, 500, input.pricing);
  assert.ok(actual <= est);
});

test('credits round up, never negative', () => {
  assert.equal(tokensToCredits(1, 100), 1);
  assert.equal(tokensToCredits(0, 100), 0);
});
