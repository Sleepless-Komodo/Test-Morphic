import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog, type LiveModel, type SnapshotModel } from './model-catalog.ts';

const snap = (slug: string, aliases: string[] = []): SnapshotModel => ({
  slug, name: slug, maker: 'DeepSeek', makerLogo: '/logos/catalog/deepseek.svg', description: 'from snapshot', aliases,
  input: ['text', 'image'], output: ['text'], contextLength: 1000, maxOutput: 10, inputUsd: [1, 2], outputUsd: [3, 3],
  reasoning: false, published: null, providers: [{ name: 'DeepSeek', logo: '/logos/catalog/deepseek.svg' }],
});
const live = (publicModelId: string, description: string | null = null): LiveModel => ({
  publicModelId, providerModelId: 'x', displayName: `DB ${publicModelId}`, description, contextLength: 64, capabilities: [],
  inputCreditsPer1m: 100, outputCreditsPer1m: 200, maker: 'DeepSeek',
  tokens7d: 5, hourly: [{ total: 2, errors: 1 }],
});

test('buildCatalog lists database models only, enriched by exact snapshot matches', () => {
  const out = buildCatalog([snap('deepseek/deepseek-v4-pro'), snap('deepseek/deepseek-v4-flash', ['ds-flash'])], [live('ds-flash'), live('deepseek-v4', 'from db')]);
  const byId = Object.fromEntries(out.map((m) => [m.id, m]));
  // snapshot-only models never show up
  assert.deepEqual(out.map((m) => m.id), ['ds-flash', 'deepseek-v4']);
  // alias hit: our id, name and credits; snapshot fills description, modalities, max output and logo
  assert.equal(byId['ds-flash'].name, 'DB ds-flash');
  assert.deepEqual(byId['ds-flash'].price, { input: 100, output: 200 });
  assert.equal(byId['ds-flash'].description, 'from snapshot');
  assert.deepEqual(byId['ds-flash'].input, ['text', 'image']);
  assert.equal(byId['ds-flash'].maxOutput, 10);
  assert.equal(byId['ds-flash'].makerLogo, '/logos/catalog/deepseek.svg');
  assert.ok(!('providers' in byId['ds-flash']), 'catalog must not carry upstream providers');
  // deepseek-v4 must not swallow deepseek-v4-pro; it keeps its own DB description and text-only defaults
  assert.equal(byId['deepseek-v4'].description, 'from db');
  assert.deepEqual(byId['deepseek-v4'].input, ['text']);
  assert.equal(byId['deepseek-v4'].maxOutput, null);
});
