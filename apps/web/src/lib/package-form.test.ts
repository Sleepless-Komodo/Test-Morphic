import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePackageForm } from './package-form.ts';

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const ok = { name: ' DeepSeek V4 - 1 Day ', creditAllowance: '100000', durationHours: '24', priceCents: '25000', modelId: 'm1', description: '' };

test('valid form is trimmed and typed', () => {
  const r = parsePackageForm(form(ok));
  assert.ok('values' in r);
  assert.deepEqual(r.values, { name: 'DeepSeek V4 - 1 Day', description: null, creditAllowance: 100000, modelId: 'm1', durationHours: 24, priceCents: 25000, status: 'active' });
});

test('empty optional fields become null; status inactive kept', () => {
  const r = parsePackageForm(form({ ...ok, durationHours: '', priceCents: '', modelId: '', status: 'inactive' }));
  assert.ok('values' in r);
  assert.equal(r.values!.durationHours, null);
  assert.equal(r.values!.priceCents, null);
  assert.equal(r.values!.modelId, null);
  assert.equal(r.values!.status, 'inactive');
});

test('rejects bad input', () => {
  for (const bad of [
    { name: '  ' },
    { creditAllowance: '0' },
    { creditAllowance: '-5' },
    { creditAllowance: '1.5' },
    { creditAllowance: 'abc' },
    { durationHours: '0' },
    { durationHours: '2.5' },
    { priceCents: '-1' },
    { name: 'x'.repeat(101) },
  ]) {
    assert.ok('error' in parsePackageForm(form({ ...ok, ...bad })), JSON.stringify(bad));
  }
});

test('unknown status falls back to active', () => {
  const r = parsePackageForm(form({ ...ok, status: 'deleted' }));
  assert.ok('values' in r && r.values!.status === 'active');
});
