import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPricingMatrix, fmtBalance, fmtMultiplier, fmtPrice, packageFeatures, packageHeadline, priceParts, type BillingPackage } from './billing-format.ts';

test('fmtMultiplier keeps sub-0.1x prices visible instead of rounding them to 0x', () => {
  assert.equal(fmtMultiplier(100, true), '0.0001x');
  assert.equal(fmtMultiplier(1_300_000, true), '1.3x');
  assert.equal(fmtMultiplier(15_600_000, true), '16x');
  assert.equal(fmtMultiplier(5_200_000), '5,2x');
  assert.equal(fmtMultiplier(0, true), '0x');
});

test('fmtBalance shows credits as the money they were bought with', () => {
  assert.equal(fmtBalance(40_000_000, false), 'Rp20.000');
  assert.equal(fmtBalance(1_999, false), 'Rp0');
  assert.equal(fmtBalance(36_200_000, true), '$1.00');
});

const limits = { maxKeys: 5, rpmPerKey: 120, concurrentPerKey: 5 };
const pkg = (over: Partial<BillingPackage>): BillingPackage => ({
  id: 'p', name: 'p', kind: 'balance', creditAllowance: 20_000_000, durationHours: null, priceCents: 10_000, currency: 'IDR', ...over,
});
const balance = pkg({ id: 'bal', kind: 'balance', creditAllowance: 20_000_000, priceCents: 10_000 });
const tokens = pkg({ id: 'tok', kind: 'tokens', creditAllowance: 10_000_000, durationHours: 720, priceCents: 4_000 });
const pass = pkg({ id: 'pass', kind: 'unlimited', creditAllowance: 50_000_000, durationHours: 24, priceCents: 25_000, modelDisplayName: 'DeepSeek V4' });

test('packageHeadline: money for balance, tokens for a pack, a duration for a pass', () => {
  assert.deepEqual(packageHeadline(balance, false), { amount: 'Rp10.000', unit: 'saldo' });
  assert.deepEqual(packageHeadline(tokens, true), { amount: '10M', unit: 'tokens' });
  assert.deepEqual(packageHeadline(pass, true), { amount: '1 day', unit: 'up to 50M tokens a day' });
});

test('packageFeatures: ends with the real per-account limits, never invented ones', () => {
  for (const p of [balance, tokens, pass]) {
    const features = packageFeatures(p, true, limits);
    assert.deepEqual(features.slice(-2), ['5 API keys per account', '120 requests/min, 5 at once, per key']);
  }
  assert.ok(packageFeatures(pass, false, limits).includes('Khusus DeepSeek V4'));
  assert.ok(packageFeatures(tokens, true, limits).includes('Valid 30 days'));
  assert.ok(packageFeatures(balance, true, limits).includes('Never expires'));
});

test('priceParts: a number that formats back to the displayed price in both currencies', () => {
  const tokenPack = pkg({ priceCents: 4_000 });
  const idr = priceParts(tokenPack, false);
  assert.equal(idr.value, 4_000);
  assert.equal(idr.format(idr.value), 'Rp4.000');
  assert.equal(idr.format(1_234.6), 'Rp1.235'); // mid-animation values round, never show fractions
  const usd = priceParts(tokenPack, true);
  assert.equal(usd.format(usd.value), fmtPrice(tokenPack, true));
  assert.match(usd.format(usd.value), /^[$]\d+[.]\d{2}$/);
});

test('buildPricingMatrix: one column per kind on sale, cheapest package of each', () => {
  const dearToken = pkg({ id: 'tok2', kind: 'tokens', creditAllowance: 100_000_000, durationHours: 720, priceCents: 30_000 });
  const m = buildPricingMatrix([dearToken, pass, tokens, balance], false, limits);
  assert.deepEqual(m.columns.map((c) => [c.kind, c.packageId]), [['balance', 'bal'], ['tokens', 'tok'], ['unlimited', 'pass']]);
  for (const group of m.groups) for (const row of group.rows) assert.equal(row.cells.length, m.columns.length, row.name);
});

test('buildPricingMatrix: omits kinds that are not for sale and states the shared limits once per column', () => {
  const m = buildPricingMatrix([tokens], true, limits);
  assert.deepEqual(m.columns.map((c) => c.kind), ['tokens']);
  const shared = m.groups[1]!.rows;
  assert.deepEqual(shared.find((r) => r.name === 'API keys per account')!.cells, ['5']);
  assert.deepEqual(shared.find((r) => r.name === 'Rate limit per key')!.cells, ['120 RPM']);
  assert.deepEqual(m.groups[0]!.rows.find((r) => r.name === 'Valid for')!.cells, ['30 days']);
});
