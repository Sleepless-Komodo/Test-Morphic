/**
 * Regression & conformance test suite for Phase P1 audit fixes:
 * - FIX-P1-01: Granular Admin RBAC roles & IP/CIDR allowlist
 * - FIX-P1-03: POOL_ENABLED default true + kill-switch POOL_ENABLED=false
 * - FIX-P1-04: Anthropic 401/403/429 error envelopes + Retry-After & X-RateLimit-* headers
 * - FIX-P1-06: DSAR export key-derived session block, dsar_requests tracking, & audit log
 */
import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { db, schema as s } from '@morphic/db';
import { grantCredits } from '@morphic/db/billing';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  extractTrustedAdminIp,
  hasAdminPermission,
  isAdminIpAllowed,
  isAdminRole,
} from '@morphic/shared/admin-rbac';

process.env.TEST_UPSTREAM_KEY = 'sk-test';
process.env.ANTHROPIC_ENABLED = 'true';

const { app } = await import('../app');
const { invalidateRouterCache } = await import('../domain/router');

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const created = {
  userIds: [] as string[],
  poolIds: [] as string[],
  modelIds: [] as string[],
  providerIds: [] as string[],
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.POOL_ENABLED;
  delete process.env.GATEWAY_IP_RPM;
  delete process.env.TRUST_X_REAL_IP;
  invalidateRouterCache();
});

after(async () => {
  if (created.poolIds.length) {
    await db.delete(s.modelProviderPool).where(inArray(s.modelProviderPool.id, created.poolIds));
  }
  if (created.modelIds.length) {
    await db.delete(s.models).where(inArray(s.models.id, created.modelIds));
  }
  if (created.providerIds.length) {
    await db.delete(s.providers).where(inArray(s.providers.id, created.providerIds));
  }
  if (created.userIds.length) {
    await db.delete(s.adminAuditLog).where(inArray(s.adminAuditLog.entityId, created.userIds));
    await db.delete(s.dsarRequests).where(inArray(s.dsarRequests.userId, created.userIds));
    await db.delete(s.usageRecords).where(inArray(s.usageRecords.userId, created.userIds));
    await db.delete(s.requestLogs).where(inArray(s.requestLogs.userId, created.userIds));
    await db.delete(s.reservations).where(inArray(s.reservations.userId, created.userIds));
    await db.delete(s.creditLedger).where(inArray(s.creditLedger.userId, created.userIds));
    await db.delete(s.balances).where(inArray(s.balances.userId, created.userIds));
    await db.delete(s.users).where(inArray(s.users.id, created.userIds));
  }
});

async function mkUser(opts: {
  credits?: number;
  suspended?: boolean;
  role?: 'user' | 'admin' | 'super_admin' | 'finance' | 'support' | 'security';
  authMethod?: string | null;
} = {}) {
  const tag = uid();
  const [user] = await db
    .insert(s.users)
    .values({
      name: `p1-${tag}`,
      email: `p1-${tag}@p1.test`,
      role: opts.role ?? 'user',
      suspended: opts.suspended ?? false,
    })
    .returning();
  created.userIds.push(user!.id);

  const credits = opts.credits ?? 500_000;
  if (credits > 0) {
    await grantCredits({
      userId: user!.id,
      amount: credits,
      entryType: 'admin_adjustment',
      reference: `p1-${tag}`,
    });
  }

  const rawKey = `mp-${randomUUID().replaceAll('-', '')}`;
  const [apiKey] = await db
    .insert(s.apiKeys)
    .values({
      userId: user!.id,
      name: 'p1-key',
      keyHash: createHash('sha256').update(rawKey).digest('hex'),
      keyPrefix: rawKey.slice(0, 10),
    })
    .returning();

  const sessionToken = `sess-${randomUUID()}`;
  await db.insert(s.sessions).values({
    userId: user!.id,
    token: sessionToken,
    authMethod: opts.authMethod ?? null,
    expiresAt: new Date(Date.now() + 3_600_000),
  });

  return { user: user!, rawKey, apiKeyId: apiKey!.id, sessionToken };
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

async function mkModel(providerId: string) {
  const [m] = await db
    .insert(s.models)
    .values({
      providerId,
      publicModelId: `p1-model-${uid()}`,
      providerModelId: 'legacy/model',
      displayName: 'P1 Model',
      contextLength: 32_768,
      inputCreditsPer1m: 100,
      outputCreditsPer1m: 200,
      status: 'active',
    })
    .returning();
  created.modelIds.push(m!.id);
  return m!;
}

test('FIX-P1-01: DB stores granular admin roles and RBAC + IP allowlist enforce least privilege', async () => {
  const fin = await mkUser({ credits: 0, role: 'finance' });
  const sup = await mkUser({ credits: 0, role: 'support' });
  const sec = await mkUser({ credits: 0, role: 'security' });

  assert.equal(fin.user.role, 'finance');
  assert.equal(sup.user.role, 'support');
  assert.equal(sec.user.role, 'security');

  assert.equal(isAdminRole(fin.user.role), true);
  assert.equal(hasAdminPermission(fin.user.role, 'finance:write'), true);
  assert.equal(hasAdminPermission(fin.user.role, 'users:delete'), false);
  assert.equal(hasAdminPermission(sup.user.role, 'users:write'), true);
  assert.equal(hasAdminPermission(sup.user.role, 'finance:write'), false);
  assert.equal(hasAdminPermission(sec.user.role, 'security:read'), true);
  assert.equal(hasAdminPermission(sec.user.role, 'codes:write'), false);

  const allow = '198.51.100.7, 10.10.0.0/16';
  const hdrAllowed = new Headers({ 'x-forwarded-for': '203.0.113.99, 10.10.42.5' });
  const hdrBlocked = new Headers({ 'x-forwarded-for': '10.10.42.5, 203.0.113.99' });
  assert.equal(isAdminIpAllowed(extractTrustedAdminIp(hdrAllowed, {}), allow), true);
  assert.equal(isAdminIpAllowed(extractTrustedAdminIp(hdrBlocked, {}), allow), false);
});

test('FIX-P1-03: POOL_ENABLED defaults to true (multi-key/provider pool active out of the box)', async () => {
  delete process.env.POOL_ENABLED;
  const legacyProv = await mkProvider('p1-legacy', 'http://p1-legacy.upstream.test');
  const keySlot1 = await mkProvider('p1-chutes-key1', 'http://p1-slot1.upstream.test');
  const keySlot2 = await mkProvider('p1-chutes-key2', 'http://p1-slot2.upstream.test');
  const model = await mkModel(legacyProv.id);

  const [pool1] = await db
    .insert(s.modelProviderPool)
    .values({
      modelId: model.id,
      providerId: keySlot1.id,
      providerModelId: 'pooled/slot-1',
      priority: 1,
      contextLength: 32_768,
    })
    .returning();
  const [pool2] = await db
    .insert(s.modelProviderPool)
    .values({
      modelId: model.id,
      providerId: keySlot2.id,
      providerModelId: 'pooled/slot-2',
      priority: 2,
      contextLength: 32_768,
    })
    .returning();
  created.poolIds.push(pool1!.id, pool2!.id);
  invalidateRouterCache();

  const { rawKey } = await mkUser();
  const visitedHosts: string[] = [];

  globalThis.fetch = (async (url: string | URL | Request) => {
    const host = new URL(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).hostname;
    visitedHosts.push(host);
    if (host === 'p1-slot1.upstream.test') {
      return new Response(JSON.stringify({ error: { message: 'rate limit' } }), { status: 429 });
    }
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-p1',
        object: 'chat.completion',
        created: 1700000000,
        model: 'pooled/slot-2',
        choices: [{ index: 0, message: { role: 'assistant', content: 'pooled ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${rawKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.publicModelId, messages: [{ role: 'user', content: 'hi' }] }),
  });

  assert.equal(res.status, 200);
  assert.deepEqual(visitedHosts, ['p1-slot1.upstream.test', 'p1-slot2.upstream.test']);
});

test('FIX-P1-04: /v1/messages emits Anthropic error envelopes on 401, 403, and 429 with rate-limit headers', async () => {
  // 1) 401 missing key -> Anthropic authentication_error envelope
  const r401 = await app.request('/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }),
  });
  assert.equal(r401.status, 401);
  const b401 = (await r401.json()) as { type: string; error: { type: string; message: string } };
  assert.equal(b401.type, 'error');
  assert.equal(b401.error.type, 'authentication_error');

  // 2) 403 suspended account -> Anthropic permission_error envelope
  const suspended = await mkUser({ suspended: true });
  const r403 = await app.request('/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': suspended.rawKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }),
  });
  assert.equal(r403.status, 403);
  const b403 = (await r403.json()) as { type: string; error: { type: string; message: string } };
  assert.equal(b403.type, 'error');
  assert.equal(b403.error.type, 'permission_error');

  // 3) 429 IP rate limit -> Anthropic rate_limit_error envelope + Retry-After + X-RateLimit-* headers
  process.env.GATEWAY_IP_RPM = '1';
  const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;

  await app.request('/v1/messages', {
    method: 'POST',
    headers: { 'x-forwarded-for': testIp, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const r429 = await app.request('/v1/messages', {
    method: 'POST',
    headers: { 'x-forwarded-for': testIp, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(r429.status, 429);
  assert.ok(Number(r429.headers.get('retry-after')) >= 1);
  assert.equal(r429.headers.get('x-ratelimit-limit-requests'), '1');
  assert.equal(r429.headers.get('x-ratelimit-remaining-requests'), '0');
  const b429 = (await r429.json()) as { type: string; error: { type: string } };
  assert.equal(b429.type, 'error');
  assert.equal(b429.error.type, 'rate_limit_error');
});

test('FIX-P1-04: upstream 429 propagates Retry-After on both /v1/chat/completions and /v1/messages', async () => {
  const prov = await mkProvider('p1-rl', 'http://p1-rl.upstream.test');
  const model = await mkModel(prov.id);
  invalidateRouterCache();
  const { rawKey } = await mkUser();

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: { message: 'upstream busy' } }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '17' },
    })) as typeof fetch;

  const v1Res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${rawKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.publicModelId, messages: [{ role: 'user', content: 'hi' }] }),
  });
  assert.equal(v1Res.status, 429);
  assert.equal(v1Res.headers.get('retry-after'), '17');

  const anthRes = await app.request('/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': rawKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.publicModelId, max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }),
  });
  assert.equal(anthRes.status, 429);
  assert.equal(anthRes.headers.get('retry-after'), '17');
});

test('FIX-P1-06 & FIX-P1-04: /v1/account/export blocks key-derived sessions, logs DSAR + audit trail, and emits session rate-limit headers', async () => {
  // 1) Key-derived session MUST be denied (403)
  const keyDerived = await mkUser({ authMethod: 'api_key' });
  const forbidden = await app.request('/v1/account/export', {
    headers: { Authorization: `Bearer ${keyDerived.sessionToken}` },
  });
  assert.equal(forbidden.status, 403);
  const forbiddenBody = (await forbidden.json()) as { error: { code: string } };
  assert.equal(forbiddenBody.error.code, 'key_derived_session_forbidden');

  // 2) Interactive session succeeds, emits X-RateLimit-*, records dsar_requests + admin_audit_log
  const interactive = await mkUser({ credits: 42_000 });
  const res = await app.request('/v1/account/export', {
    headers: { Authorization: `Bearer ${interactive.sessionToken}` },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-ratelimit-limit-requests'), '5');
  assert.equal(res.headers.get('x-ratelimit-remaining-requests'), '4');

  const exported = (await res.json()) as {
    export_meta: { request_id: string; row_limit_per_section: number; truncated: boolean };
    balance_credits: number;
  };
  assert.ok(exported.export_meta?.request_id);
  assert.equal(exported.export_meta.row_limit_per_section, 10_000);
  assert.equal(exported.export_meta.truncated, false);
  assert.equal(exported.balance_credits, 42_000);

  // Verify dsar_requests row via GET /v1/account/export/requests
  const listRes = await app.request('/v1/account/export/requests', {
    headers: { Authorization: `Bearer ${interactive.sessionToken}` },
  });
  assert.equal(listRes.status, 200);
  const listBody = (await listRes.json()) as {
    data: Array<{ id: string; status: string; row_count: number; completed_at: string | null }>;
  };
  assert.equal(listBody.data.length, 1);
  assert.equal(listBody.data[0]?.id, exported.export_meta.request_id);
  assert.equal(listBody.data[0]?.status, 'completed');
  assert.ok(listBody.data[0]?.completed_at);

  // Verify audit log row in admin_audit_log
  const [auditRow] = await db
    .select()
    .from(s.adminAuditLog)
    .where(
      and(
        eq(s.adminAuditLog.entityId, interactive.user.id),
        eq(s.adminAuditLog.action, 'account.dsar_export'),
      ),
    )
    .orderBy(desc(s.adminAuditLog.createdAt))
    .limit(1);
  assert.ok(auditRow, 'account.dsar_export must be recorded in admin_audit_log');
});
