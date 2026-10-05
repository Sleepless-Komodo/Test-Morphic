/**
 * Security regression tests (audit findings H3, H4, H7, M2, plus IDOR / mass-assignment).
 * Runs against the real DB via app.request, following the payments.test.ts pattern.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app';
import { db, schema as s } from '@morphic/db';
import { eq, sql } from 'drizzle-orm';

async function mkUser(tag: string) {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db
    .insert(s.users)
    .values({ name: tag, email: `${tag}-${runId}@sec.test` })
    .returning();
  const token = `sec_${tag}_${runId}`;
  await db.insert(s.sessions).values({
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 3600_000),
  });
  return { user, token };
}

async function mkKeyDerivedSession(userId: string) {
  const token = `sec_kd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(s.sessions).values({
    userId,
    token,
    expiresAt: new Date(Date.now() + 3600_000),
    authMethod: 'api_key',
  });
  return token;
}

// ── M2: session cookie must match by exact name ──────────────────────────────
test('M2: planted cookie name does not authenticate', async () => {
  const { token } = await mkUser('m2victim');
  const evil = await app.request('/v1/account/balance', {
    headers: { Cookie: `x_session_token=${token}` },
  });
  assert.equal(evil.status, 401);

  const ok = await app.request('/v1/account/balance', {
    headers: { Cookie: `better-auth.session_token=${token}` },
  });
  assert.equal(ok.status, 200);
});

// ── no-auth / forged tokens ──────────────────────────────────────────────────
test('unauthenticated management routes return 401', async () => {
  for (const path of ['/v1/keys', '/v1/account/balance', '/v1/account/usage']) {
    const res = await app.request(path);
    assert.equal(res.status, 401, `${path} should be 401`);
  }
});

test('forged session token returns 401', async () => {
  const res = await app.request('/v1/account/balance', {
    headers: { Authorization: 'Bearer not-a-real-token' },
  });
  assert.equal(res.status, 401);
});

// ── IDOR: cross-user key deletion ────────────────────────────────────────────
test('IDOR: attacker cannot delete another user key', async () => {
  const victim = await mkUser('idorvictim');
  const attacker = await mkUser('idorattacker');
  const [key] = await db
    .insert(s.apiKeys)
    .values({ userId: victim.user.id, name: 'k', keyHash: `h${Date.now()}`, keyPrefix: 'mp-xxxxxx', status: 'active' })
    .returning();

  const res = await app.request(`/v1/keys/${key.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${attacker.token}` },
  });
  assert.equal(res.status, 404);

  const [still] = await db.select({ status: s.apiKeys.status }).from(s.apiKeys).where(eq(s.apiKeys.id, key.id));
  assert.equal(still.status, 'active');
});

// ── H4: concurrent redemptions cannot exceed max_redemptions ─────────────────
test('H4: max_redemptions is not exceeded under concurrency', async () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const [code] = await db
    .insert(s.redeemCodes)
    .values({ code: `SECRACE-${runId}`, name: 'sec', rewardType: 'credits', creditAmount: 1000, maxRedemptions: 1, active: true })
    .returning();

  const users = await Promise.all(Array.from({ length: 12 }, (_, i) => mkUser(`race${i}${runId}`)));
  const results = await Promise.all(
    users.map((u, i) =>
      app.request('/v1/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${u.token}`,
          'x-forwarded-for': `198.51.100.${i + 1}`,
        },
        body: JSON.stringify({ code: `SECRACE-${runId}` }),
      }),
    ),
  );
  const oks = results.filter((r) => r.status === 200).length;
  assert.equal(oks, 1, 'exactly one redemption should succeed');

  const [row] = await db.select({ c: s.redeemCodes.redeemedCount }).from(s.redeemCodes).where(eq(s.redeemCodes.id, code.id));
  assert.equal(row.c, 1);
});

// ── H4/correctness: double-spend by same user returns 409, grants once ───────
test('double redemption by same user returns 409', async () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  await db.insert(s.redeemCodes).values({ code: `SECDBL-${runId}`, name: 'sec', rewardType: 'credits', creditAmount: 500, active: true });
  const u = await mkUser(`dbl${runId}`);
  const ipHdr = { 'x-forwarded-for': '198.51.100.200' };
  const first = await app.request('/v1/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u.token}`, ...ipHdr },
    body: JSON.stringify({ code: `SECDBL-${runId}` }),
  });
  assert.equal(first.status, 200);
  const second = await app.request('/v1/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u.token}`, ...ipHdr },
    body: JSON.stringify({ code: `SECDBL-${runId}` }),
  });
  assert.equal(second.status, 409);
});

// ── H7: key-derived sessions are read-only ───────────────────────────────────
test('H7: key-derived session can read but cannot mint keys, redeem, or pay', async () => {
  const { user } = await mkUser('h7');
  const kdToken = await mkKeyDerivedSession(user.id);
  const auth = { Authorization: `Bearer ${kdToken}` };

  assert.equal((await app.request('/v1/account/balance', { headers: auth })).status, 200);

  assert.equal(
    (await app.request('/v1/keys', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{"name":"x"}' })).status,
    403,
  );
  assert.equal(
    (await app.request('/v1/redeem', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{"code":"X"}' })).status,
    403,
  );
  assert.equal(
    (await app.request('/v1/payments/create', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{"packageId":"x"}' })).status,
    403,
  );
});

// ── H3: redeem attempts are rate limited ─────────────────────────────────────
test('H3: redeem endpoint throttles rapid attempts', async () => {
  const { token } = await mkUser('h3');
  const statuses: number[] = [];
  for (let i = 0; i < 25; i++) {
    const r = await app.request('/v1/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ code: `NOPE-${i}` }),
    });
    statuses.push(r.status);
  }
  assert.ok(statuses.includes(429), 'expected at least one 429 after the limit');
});

// ── mass assignment on payment create ────────────────────────────────────────
test('mass assignment: extra fields on payment create are ignored', async () => {
  const attacker = await mkUser('massassign');
  const [pkg] = await db
    .insert(s.packages)
    .values({ name: `MA ${Date.now()}`, priceCents: 500000, currency: 'IDR', creditAllowance: 100000, status: 'active' })
    .returning();

  await app.request('/v1/payments/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${attacker.token}` },
    body: JSON.stringify({ packageId: pkg.id, credits: 999999999, status: 'paid', amountCents: 1, userId: '00000000-0000-0000-0000-000000000000' }),
  });
  // Either the gateway call succeeds (pending) or errors, but the row must reflect package values, not attacker input.
  const [row] = await db
    .select({ credits: s.payments.credits, amountCents: s.payments.amountCents, status: s.payments.status, userId: s.payments.userId })
    .from(s.payments)
    .where(eq(s.payments.userId, attacker.user.id))
    .orderBy(sql`created_at desc`)
    .limit(1);
  if (row) {
    assert.equal(row.credits, 100000);
    assert.equal(row.amountCents, 500000);
    assert.notEqual(row.status, 'paid');
    assert.equal(row.userId, attacker.user.id);
  }
});

// ── FIX-BE-P0-01: Hash-only API keys test ─────────────────────────────────────
test('FIX-BE-P0-01: GET /v1/keys never exposes plaintext key or encrypted_key', async () => {
  const user = await mkUser('hashonlykey');
  const createRes = await app.request('/v1/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
    body: JSON.stringify({ name: 'Security Test Key' }),
  });
  assert.equal(createRes.status, 201);
  const createdBody = await createRes.json();
  assert.ok(createdBody.key, 'POST response must contain raw key');
  assert.ok(createdBody.key.startsWith('mp-'), 'raw key must start with mp-');

  const listRes = await app.request('/v1/keys', {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.ok(Array.isArray(listBody.data), 'GET /v1/keys returns array data');
  assert.ok(listBody.data.length > 0, 'GET /v1/keys contains created key');
  
  const fetchedKeyItem = listBody.data.find((k: any) => k.id === createdBody.id);
  assert.ok(fetchedKeyItem, 'created key present in list');
  assert.equal(fetchedKeyItem.key, undefined, 'GET /v1/keys must NOT include key property');
  assert.equal(fetchedKeyItem.encryptedKey, undefined, 'GET /v1/keys must NOT include encryptedKey property');
  assert.ok(fetchedKeyItem.prefix, 'GET /v1/keys includes prefix');
});

// ── FIX-BE-P0-04: /webhooks/mock production guard ─────────────────────────────
test('FIX-BE-P0-04: POST /webhooks/mock returns 404 when NODE_ENV=production', async () => {
  const origEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const res = await app.request('/webhooks/mock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: 'test', payment_id: 'test', status: 'paid' }),
    });
    assert.equal(res.status, 404, 'mock webhook should be 404 in production');
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});

// ── FIX-BE-P0-03 / Fix 1.4: PayPal webhook S2S endpoint ──────────────────────
test('Fix 1.4: PayPal webhook rejects missing signature and processes valid event idempotently', async () => {
  // 1. Missing signature headers returns 401
  const badRes = await app.request('/webhooks/paypal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'WH-TEST-001', event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
  });
  assert.equal(badRes.status, 401, 'missing PayPal signature headers should return 401');

  // 2. Valid test signature header processes event
  const user = await mkUser('paypalwebhook');
  const orderId = `PAYPAL-ORD-${Date.now()}`;
  const [payment] = await db
    .insert(s.payments)
    .values({
      userId: user.user.id,
      provider: 'paypal',
      externalId: orderId,
      amountCents: 1000,
      credits: 500,
      currency: 'USD',
      status: 'pending',
    })
    .returning();

  const payload = {
    id: `WH-EVT-${Date.now()}`,
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: {
      id: orderId,
      status: 'COMPLETED',
    },
  };

  const headers = {
    'Content-Type': 'application/json',
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-ID',
    'paypal-transmission-id': 'mock_test_trans_id',
    'paypal-transmission-sig': 'mock_sig',
    'paypal-transmission-time': new Date().toISOString(),
  };

  const okRes = await app.request('/webhooks/paypal', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  assert.equal(okRes.status, 200);
  const okBody = await okRes.json();
  assert.equal(okBody.ok, true);

  // Check credits granted
  const [updatedPayment] = await db.select().from(s.payments).where(eq(s.payments.id, payment.id));
  assert.equal(updatedPayment.status, 'paid');

  // 3. Duplicate event returns 200 with duplicate: true
  const dupRes = await app.request('/webhooks/paypal', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  assert.equal(dupRes.status, 200);
  const dupBody = await dupRes.json();
  assert.equal(dupBody.duplicate, true);
});

// ── Key rotation ─────────────────────────────────────────────────────────────
test('key rotation mints a replacement and puts the old key on a grace period', async () => {
  const { token } = await mkUser('rot');
  const other = await mkUser('rotother');
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const created = await (await app.request('/v1/keys', { method: 'POST', headers: auth, body: '{"name":"prod"}' })).json();

  const bad = await app.request(`/v1/keys/${created.id}/rotate`, { method: 'POST', headers: auth, body: '{"gracePeriodSeconds":5}' });
  assert.equal(bad.status, 400);

  const foreign = await app.request(`/v1/keys/${created.id}/rotate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${other.token}`, 'Content-Type': 'application/json' },
    body: '{"gracePeriodSeconds":3600}',
  });
  assert.equal(foreign.status, 404);

  const res = await app.request(`/v1/keys/${created.id}/rotate`, { method: 'POST', headers: auth, body: '{"gracePeriodSeconds":3600}' });
  assert.equal(res.status, 201);
  const rotated = await res.json();
  assert.ok(rotated.key.startsWith('mp-') && rotated.key !== created.key);
  assert.equal(rotated.name, 'prod');
  assert.equal(rotated.expires_at, null);
  const graceMs = new Date(rotated.rotated_from.expires_at).getTime() - Date.now();
  assert.ok(graceMs > 3500_000 && graceMs <= 3600_000);

  // Both keys authenticate during the grace period.
  for (const k of [created.key, rotated.key]) {
    const r = await app.request('/v1/models', { headers: { Authorization: `Bearer ${k}` } });
    assert.notEqual(r.status, 401);
  }

  // Once the grace period is over the old key is rejected.
  await db.update(s.apiKeys).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(s.apiKeys.id, created.id));
  const expired = await app.request('/v1/models', { headers: { Authorization: `Bearer ${created.key}` } });
  assert.equal(expired.status, 401);
  const again = await app.request(`/v1/keys/${created.id}/rotate`, { method: 'POST', headers: auth, body: '{}' });
  assert.equal(again.status, 409);
});
