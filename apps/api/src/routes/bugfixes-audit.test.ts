/**
 * Regression suite for non-P0 audit bugs BUG-02, BUG-04, BUG-05, and BUG-06.
 */
import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { db, schema as s } from '@morphic/db';
import { grantCredits } from '@morphic/db/billing';
import { desc, eq, inArray } from 'drizzle-orm';
import { MAX_BODY_BYTES } from '../handlers/v1';
import { MANAGEMENT_MAX_BODY_BYTES, WEBHOOK_MAX_BODY_BYTES } from '../middleware/body-limit';

process.env.TEST_UPSTREAM_KEY = 'sk-test';
process.env.RESPONSES_API_ENABLED = 'true';
process.env.ANTHROPIC_ENABLED = 'true';

const { app } = await import('../app');
const { invalidateRouterCache } = await import('../domain/router');
const { rateLimitStore } = await import('../ratelimit');

const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });

async function serverPort(): Promise<number> {
  for (let i = 0; i < 200; i += 1) {
    const addr = server.address();
    if (addr && typeof addr === 'object') return (addr as AddressInfo).port;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('test server failed to listen');
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const created = {
  poolIds: [] as string[],
  modelIds: [] as string[],
  providerIds: [] as string[],
};

async function mkUser(credits = 1_000_000) {
  const tag = uid();
  const [user] = await db
    .insert(s.users)
    .values({ name: 'bugfix', email: `bugfix-${tag}@bugfix.test` })
    .returning();
  if (credits > 0) {
    await grantCredits({
      userId: user!.id,
      amount: credits,
      entryType: 'admin_adjustment',
      reference: `bugfix-${tag}`,
    });
  }
  const rawKey = `mp-${randomUUID().replaceAll('-', '')}`;
  const [apiKey] = await db
    .insert(s.apiKeys)
    .values({
      userId: user!.id,
      name: 'bugfix-key',
      keyHash: createHash('sha256').update(rawKey).digest('hex'),
      keyPrefix: rawKey.slice(0, 10),
    })
    .returning();
  return { user: user!, rawKey, apiKeyId: apiKey!.id };
}

async function mkProvider(name: string, baseUrl: string) {
  const [p] = await db
    .insert(s.providers)
    .values({
      name: `${name}-${uid()}`,
      baseUrl,
      credentialReference: 'env:TEST_UPSTREAM_KEY',
    })
    .returning();
  created.providerIds.push(p!.id);
  return p!;
}

async function mkModel(
  providerId: string,
  opts: {
    inputCreditsPer1m?: number;
    outputCreditsPer1m?: number;
    providerCostInputPer1m?: number | null;
    providerCostOutputPer1m?: number | null;
  } = {},
) {
  const [m] = await db
    .insert(s.models)
    .values({
      providerId,
      publicModelId: `bugfix-model-${uid()}`,
      providerModelId: 'upstream/internal-model',
      displayName: 'Bugfix Model',
      contextLength: 8192,
      inputCreditsPer1m: opts.inputCreditsPer1m ?? 1_000_000,
      outputCreditsPer1m: opts.outputCreditsPer1m ?? 1_000_000,
      providerCostInputPer1m: opts.providerCostInputPer1m ?? null,
      providerCostOutputPer1m: opts.providerCostOutputPer1m ?? null,
      capabilities: ['tools', 'reasoning'],
    })
    .returning();
  created.modelIds.push(m!.id);
  invalidateRouterCache();
  return m!;
}

afterEach(() => {
  delete process.env.POOL_ENABLED;
  delete process.env.ANTHROPIC_DEFAULT_MODEL;
  delete process.env.ALERT_WEBHOOK_URL;
  invalidateRouterCache();
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (created.poolIds.length) {
    await db.delete(s.modelProviderPool).where(inArray(s.modelProviderPool.id, created.poolIds));
  }
  if (created.modelIds.length) {
    await db.delete(s.models).where(inArray(s.models.id, created.modelIds));
  }
  if (created.providerIds.length) {
    await db.delete(s.providers).where(inArray(s.providers.id, created.providerIds));
  }
});

test('BUG-02a: POST /v1/responses enforces 10MB bodyLimit before JSON parsing or auth', async () => {
  const oversized = 'x'.repeat(MAX_BODY_BYTES + 1024);
  const res = await app.request('/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: oversized,
  });
  assert.equal(res.status, 413);
  const reqId = res.headers.get('x-request-id');
  assert.ok(reqId && /^[0-9a-f-]{36}$/.test(reqId));
  const body = (await res.json()) as { error: { code: string; request_id?: string } };
  assert.equal(body.error.code, 'payload_too_large');
  assert.equal(body.error.request_id, reqId);
});

test('BUG-02b & BUG-02c: POST /v1/responses uses a single server UUID across header + DB logs, ignores client X-Request-Id, and counts IP rate limit once over real socket', async () => {
  const prov = await mkProvider('bug02', 'http://bug02.upstream.test');
  const model = await mkModel(prov.id);
  const { user, rawKey } = await mkUser(1_000_000);
  const port = await serverPort();

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('bug02.upstream.test')) {
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-bug02',
          object: 'chat.completion',
          created: 1700000000,
          model: 'upstream/internal-model',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'pong' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return realFetch(input, init);
  }) as typeof fetch;

  const origIncrement = rateLimitStore.increment.bind(rateLimitStore);
  const ipKeysSeen: string[] = [];
  rateLimitStore.increment = async (key: string, windowSeconds: number) => {
    if (key.startsWith('rlip:')) ipKeysSeen.push(key);
    return origIncrement(key, windowSeconds);
  };

  try {
    const spoofedId = '00000000-0000-0000-0000-000000000001';
    const res = await realFetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
        'X-Request-Id': spoofedId,
      },
      body: JSON.stringify({ model: model.publicModelId, input: 'ping' }),
    });
    assert.equal(res.status, 200);
    const headerReqId = res.headers.get('x-request-id');
    assert.ok(headerReqId && /^[0-9a-f-]{36}$/.test(headerReqId));
    assert.notEqual(headerReqId, spoofedId, 'client-supplied X-Request-Id must never be reused');

    // Wait briefly for fire-and-forget logRequest insert to complete.
    for (let i = 0; i < 40; i += 1) {
      const [log] = await db
        .select()
        .from(s.requestLogs)
        .where(eq(s.requestLogs.userId, user.id))
        .orderBy(desc(s.requestLogs.createdAt))
        .limit(1);
      if (log) {
        assert.equal(log.requestId, headerReqId, 'request_logs.request_id must match X-Request-Id');
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }

    const [usage] = await db
      .select()
      .from(s.usageRecords)
      .where(eq(s.usageRecords.userId, user.id))
      .orderBy(desc(s.usageRecords.createdAt))
      .limit(1);
    assert.ok(usage);
    assert.equal(usage.requestId, headerReqId, 'usage_records.request_id must match X-Request-Id');

    // Real socket on 127.0.0.1 resolved IP (not 'unknown') and incremented rlip exactly once!
    assert.equal(ipKeysSeen.length, 1, 'ipRateLimit must run once per /v1/responses call, not twice');
    assert.match(ipKeysSeen[0]!, /^rlip:(127\.0\.0\.1|::ffff:127\.0\.0\.1):/);
  } finally {
    globalThis.fetch = realFetch;
    rateLimitStore.increment = origIncrement;
  }
});

test('BUG-04: unlimited day pass settlement does not fire false-positive alertNegativeMargin', async () => {
  const prov = await mkProvider('bug04', 'http://bug04.upstream.test');
  const passModel = await mkModel(prov.id, {
    inputCreditsPer1m: 2_000_000,
    outputCreditsPer1m: 2_000_000,
    providerCostInputPer1m: 1_000_000,
    providerCostOutputPer1m: 1_000_000,
  });
  const lossModel = await mkModel(prov.id, {
    inputCreditsPer1m: 100_000,
    outputCreditsPer1m: 100_000,
    providerCostInputPer1m: 2_000_000,
    providerCostOutputPer1m: 2_000_000,
  });
  const { user, rawKey } = await mkUser(1_000_000);

  // Grant an active unlimited pass on passModel.
  await db.insert(s.entitlements).values({
    userId: user.id,
    modelId: passModel.id,
    allowance: 500_000,
    remaining: 500_000,
    unlimited: true,
    source: 'purchase',
    expiresAt: new Date(Date.now() + 86_400_000),
  });

  process.env.ALERT_WEBHOOK_URL = 'http://alert-spy.upstream.test/hook';
  const alertPayloads: Array<Record<string, unknown>> = [];

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === 'http://alert-spy.upstream.test/hook') {
      alertPayloads.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      return new Response('ok', { status: 200 });
    }
    if (url.includes('bug04.upstream.test')) {
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-bug04',
          object: 'chat.completion',
          created: 1700000000,
          model: 'upstream/internal-model',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'ok' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return realFetch(input, init);
  }) as typeof fetch;

  try {
    const passRes = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rawKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: passModel.publicModelId, messages: [{ role: 'user', content: 'hi' }] }),
    });
    assert.equal(passRes.status, 200);
    await new Promise((r) => setTimeout(r, 40));

    const [passUsage] = await db
      .select()
      .from(s.usageRecords)
      .where(eq(s.usageRecords.modelId, passModel.id))
      .limit(1);
    assert.equal(passUsage?.creditsConsumed, 0);
    assert.equal(passUsage?.upstreamCostCredits, 200);
    assert.equal(
      alertPayloads.filter((p) => p.type === 'negative_margin' && p.model === passModel.publicModelId).length,
      0,
      'unlimited pass must NOT trigger negative_margin alert',
    );

    // Sanity check: genuine negative margin on balance-billed lossModel still alerts!
    const lossRes = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rawKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: lossModel.publicModelId, messages: [{ role: 'user', content: 'hi' }] }),
    });
    assert.equal(lossRes.status, 200);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(
      alertPayloads.filter((p) => p.type === 'negative_margin' && p.model === lossModel.publicModelId).length,
      1,
      'genuine negative margin on balance billing must still alert',
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('BUG-05: /v1/messages re-evaluates prepareBody per failover candidate and triggers onProviderAlert on upstream 401', async () => {
  process.env.POOL_ENABLED = 'true';
  process.env.ALERT_WEBHOOK_URL = 'http://alert-spy.upstream.test/hook';

  const p1 = await mkProvider('bug05-p1', 'http://bug05-p1.upstream.test');
  const p2 = await mkProvider('bug05-p2', 'http://bug05-p2.upstream.test');
  const model = await mkModel(p1.id);
  process.env.ANTHROPIC_DEFAULT_MODEL = model.publicModelId;

  const [pool1] = await db
    .insert(s.modelProviderPool)
    .values({
      modelId: model.id,
      providerId: p1.id,
      providerModelId: 'p1/model',
      priority: 1,
      weight: 100,
      isEnabled: true,
      maxOutputTokens: 64,
      supportsTools: true,
      reasoningEchoRequired: true,
    })
    .returning();
  const [pool2] = await db
    .insert(s.modelProviderPool)
    .values({
      modelId: model.id,
      providerId: p2.id,
      providerModelId: 'p2/model',
      priority: 2,
      weight: 100,
      isEnabled: true,
      maxOutputTokens: 2048,
      supportsTools: true,
      reasoningEchoRequired: false,
    })
    .returning();
  created.poolIds.push(pool1!.id, pool2!.id);
  invalidateRouterCache();

  const { rawKey } = await mkUser(1_000_000);
  const seenBodies: Array<{ host: string; body: Record<string, unknown> }> = [];
  const alertPayloads: Array<Record<string, unknown>> = [];

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === 'http://alert-spy.upstream.test/hook') {
      alertPayloads.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      return new Response('ok', { status: 200 });
    }
    if (url.includes('bug05-p1.upstream.test')) {
      seenBodies.push({ host: 'p1', body: JSON.parse(String(init?.body ?? '{}')) });
      // Return 401 so both failover AND onProviderAlert fire!
      return new Response('{"error":"bad upstream key"}', { status: 401 });
    }
    if (url.includes('bug05-p2.upstream.test')) {
      seenBodies.push({ host: 'p2', body: JSON.parse(String(init?.body ?? '{}')) });
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-bug05',
          object: 'chat.completion',
          created: 1700000000,
          model: 'p2/model',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'served-by-p2' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return realFetch(input, init);
  }) as typeof fetch;

  try {
    const res = await app.request('/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': rawKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'use a tool' }],
        tools: [{ name: 'ping', description: 'ping', input_schema: { type: 'object' } }],
        tool_choice: { type: 'any' },
      }),
    });
    assert.equal(res.status, 200);
    await new Promise((r) => setTimeout(r, 40));

    assert.equal(seenBodies.length, 2);
    // Candidate 1 had maxOutputTokens=64 and supportsRequiredToolChoice=false -> clamped to 64 & tool_choice='auto'
    assert.equal(seenBodies[0]!.host, 'p1');
    assert.equal(seenBodies[0]!.body.max_tokens, 64);
    assert.equal(seenBodies[0]!.body.tool_choice, 'auto');

    // Candidate 2 had maxOutputTokens=2048 and supportsRequiredToolChoice=true -> keeps 1000 & tool_choice='required'
    assert.equal(seenBodies[1]!.host, 'p2');
    assert.equal(seenBodies[1]!.body.max_tokens, 1000);
    assert.equal(seenBodies[1]!.body.tool_choice, 'required');

    // Candidate 1's 401 triggered alertProviderProblem on /v1/messages!
    const provAlerts = alertPayloads.filter(
      (p) => p.type === 'provider_problem' && p.providerId === p1.id && p.status === 401,
    );
    assert.equal(provAlerts.length, 1, 'onProviderAlert must fire on /v1/messages upstream 401');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('BUG-06: /webhooks/* and management routes enforce 1MB bodyLimit with 413 payload_too_large', async () => {
  const overWebhookLimit = 'w'.repeat(WEBHOOK_MAX_BODY_BYTES + 512);
  const overMgmtLimit = 'm'.repeat(MANAGEMENT_MAX_BODY_BYTES + 512);

  for (const path of ['/webhooks/paypal', '/webhooks/duitku', '/webhooks/mock']) {
    const res = await app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: overWebhookLimit,
    });
    assert.equal(res.status, 413, `${path} must reject >1MB body with 413`);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'payload_too_large');
  }

  for (const path of ['/v1/keys', '/v1/payments/create', '/v1/payments/paypal/create-order', '/v1/redeem']) {
    const res = await app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: overMgmtLimit,
    });
    assert.equal(res.status, 413, `${path} must reject >1MB body with 413 before sessionAuth`);
    const body = (await res.json()) as { error: { code: string; request_id?: string } };
    assert.equal(body.error.code, 'payload_too_large');
    assert.ok(body.error.request_id, `${path} 413 response should carry error.request_id`);
  }
});
