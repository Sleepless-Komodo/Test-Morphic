import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModelForm } from './model-form.ts';

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};

const VALID_PROVIDER_ID = '11111111-2222-3333-4444-555555555555';

const ok: Record<string, string> = {
  providerId: ` ${VALID_PROVIDER_ID} `,
  publicModelId: ' deepseek-v4 ',
  providerModelId: ' deepseek-chat ',
  displayName: ' DeepSeek V4 ',
  description: ' Fast model ',
  contextLength: '65536',
  capabilities: ' coding, reasoning, , coding , chat ',
  inputCreditsPer1m: '100',
  outputCreditsPer1m: '300',
};

test('parseModelForm: trims strings, defaults status to active, deduplicates capabilities', () => {
  const r = parseModelForm(form(ok));
  assert.ok('values' in r);
  assert.deepEqual(r.values, {
    providerId: VALID_PROVIDER_ID,
    publicModelId: 'deepseek-v4',
    providerModelId: 'deepseek-chat',
    displayName: 'DeepSeek V4',
    description: 'Fast model',
    contextLength: 65536,
    capabilities: ['coding', 'reasoning', 'chat'],
    inputCreditsPer1m: 100,
    outputCreditsPer1m: 300,
    status: 'active',
  });
});

test('parseModelForm: blank description becomes null and upstream costs parse when present', () => {
  const r = parseModelForm(
    form({
      ...ok,
      description: '   ',
      status: 'deprecated',
      providerCostInputPer1m: '',
      providerCostOutputPer1m: '0',
    }),
  );
  assert.ok('values' in r);
  assert.equal(r.values.description, null);
  assert.equal(r.values.status, 'deprecated');
  assert.equal(r.values.providerCostInputPer1m, null);
  assert.equal(r.values.providerCostOutputPer1m, 0);
});

test('parseModelForm: rejects invalid providerId, empty strings, decimals, out-of-range context, and invalid status', () => {
  const badCases: Record<string, string>[] = [
    { providerId: '' },
    { providerId: 'not-a-uuid' },
    { publicModelId: '   ' },
    { publicModelId: 'x'.repeat(201) },
    { providerModelId: '' },
    { displayName: '   ' },
    { description: 'x'.repeat(1001) },
    { contextLength: '' },
    { contextLength: '512' },
    { contextLength: '65536.5' },
    { contextLength: '2147483648' },
    { contextLength: 'abc' },
    { inputCreditsPer1m: '0' },
    { inputCreditsPer1m: '10.5' },
    { outputCreditsPer1m: '-1' },
    { outputCreditsPer1m: 'abc' },
    { status: 'deleted' },
    { providerCostInputPer1m: '-5' },
    { providerCostInputPer1m: '12.3' },
    { providerCostOutputPer1m: 'nope' },
  ];
  for (const bad of badCases) {
    const res = parseModelForm(form({ ...ok, ...bad }));
    assert.ok('error' in res, `expected error for ${JSON.stringify(bad)}`);
  }
});

test('parseModelForm: returns Indonesian error messages when en=false', () => {
  const res = parseModelForm(form({ ...ok, providerId: 'bad' }), false);
  assert.ok('error' in res);
  assert.match(res.error, /\(kode: invalid_provider\)$/);
});
