import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rupiahPerCredit, findPrice, costIdr, margin } from './margin.ts';

const r2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

test('rupiah per credit', () => {
  assert.equal(rupiahPerCredit(100_000, 50_000), 2);
  assert.equal(rupiahPerCredit(0, 0), null);
});

test('price lookup by provider model id', () => {
  const cat = [
    { id: 'deepseek/deepseek-v4.1-flash', inputPerM: 0.3, cacheReadPerM: 0.006, outputPerM: 1.2, context: null, maxOutput: null },
  ];
  assert.equal(findPrice(cat, 'deepseek/deepseek-v4.1-flash')?.inputPerM, 0.3);
  assert.equal(findPrice(cat, 'DeepSeek/DeepSeek-V4.1-Flash')?.outputPerM, 1.2);
  assert.equal(findPrice(cat, 'other'), null);
  assert.equal(findPrice(undefined, 'x'), null);
});

test('cost in rupiah', () => {
  // 1M in @ $0.3 + 0.5M out @ $1.2 = $0.9 = Rp 14,400
  assert.equal(r2(costIdr(1_000_000, 500_000, { inputPerM: 0.3, outputPerM: 1.2 }, 16_000)), 14_400);
  assert.equal(costIdr(10, 10, null, 16_000), null);
  // Unpublished output price only matters if there were output tokens
  assert.equal(costIdr(1_000_000, 10, { inputPerM: 0.3, outputPerM: null }, 16_000), null);
  assert.equal(r2(costIdr(1_000_000, 0, { inputPerM: 0.3, outputPerM: null }, 16_000)), 4_800);
});

test('margin', () => {
  const a = margin(20_000, 14_400);
  assert.equal(a.margin, 5_600);
  assert.equal(r2(a.pct), 28);
  const b = margin(10_000, 12_000);
  assert.equal(b.margin, -2_000);
  assert.equal(r2(b.pct), -20);
  assert.deepEqual(margin(10_000, null), { margin: null, pct: null });
});
