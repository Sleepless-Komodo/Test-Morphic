import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimatePromptTokens, estimatePromptTokensForReservation } from './credits.ts';

test('estimatePromptTokensForReservation returns 0 for empty string', () => {
  assert.equal(estimatePromptTokensForReservation(''), 0);
});

test('estimatePromptTokensForReservation reserves ceil(bytes/3) on ASCII while keeping estimatePromptTokens unchanged', () => {
  const s = 'a'.repeat(300);
  assert.equal(estimatePromptTokensForReservation(s), 100);
  assert.equal(estimatePromptTokens(s), 75);
});

test('estimatePromptTokensForReservation covers 3-byte CJK characters (~1 token/char vs 0.25)', () => {
  const cjk = '你'.repeat(100); // 300 UTF-8 bytes
  assert.equal(estimatePromptTokensForReservation(cjk), 100);
  assert.equal(estimatePromptTokens(cjk), 25);
});

test('estimatePromptTokensForReservation is >= estimatePromptTokens for ASCII strings', () => {
  for (const len of [0, 1, 3, 4, 17, 128]) {
    const s = 'x'.repeat(len);
    assert.ok(
      estimatePromptTokensForReservation(s) >= estimatePromptTokens(s),
      `expected reservation estimate >= display estimate for length ${len}`,
    );
  }
});
