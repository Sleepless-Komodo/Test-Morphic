/**
 * Phase 4 acceptance tests (AUDIT_BACKEND §11 — T6 + T7): capture-route hardening and
 * strict order creation.
 *
 * Drives the real routes against the real DB. Only PayPal's OAuth, capture and order-lookup
 * endpoints are mocked; every other request (including the DB driver) passes through, mirroring
 * payments.test.ts. Ops alerts are captured by pointing ALERT_WEBHOOK_URL at a fake host.
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app';
import { db, schema as s } from '@morphic/db';
import { getBalance } from '@morphic/db/billing';
import { eq } from 'drizzle-orm';
import { centsToPaypalAmount, paypalAmountToCents, PAYPAL_AMOUNT_RE } from '../lib/paypal';

const ENV_KEYS = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'ALERT_WEBHOOK_URL'] as const;

function runId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A PayPal order body whose capture is COMPLETED for `amount`, bound to `paymentId`. */
function paidOrder(orderId: string, paymentId: string, value: string, currency = 'USD') {
  return {
    id: orderId,
    status: 'COMPLETED',
    purchase_units: [
      {
        custom_id: paymentId,
        amount: { currency_code: currency, value },
        payments: {
          captures: [
            {
              id: `CAP-${runId().replace(/[^A-Za-z0-9]/g, '')}`,
              status: 'COMPLETED',
              custom_id: paymentId,
              amount: { currency_code: currency, value },
            },
          ],
        },
      },
    ],
  };
}

/**
 * Install a PayPal fetch mock. `onCapture` decides what the capture endpoint returns; the order
 * lookup returns `getOrderBody`. Counts are exposed so a test can prove PayPal was called once.
 */
async function withPaypal(
  opts: {
    onCapture: (orderId: string) => Response | Promise<Response>;
    getOrderBody?: (orderId: string) => unknown;
  },
  fn: (counts: { capture: number; getOrder: number }, alerts: any[]) => Promise<void>,
): Promise<void> {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.PAYPAL_CLIENT_ID = 'phase4-client';
  process.env.PAYPAL_CLIENT_SECRET = 'phase4-secret';
  process.env.ALERT_WEBHOOK_URL = 'https://alert.test/hook';

  const counts = { capture: 0, getOrder: 0 };
  const alerts: any[] = [];
  const originalFetch = globalThis.fetch;
  const f = mock.method(globalThis, 'fetch', async (url: any, init: any) => {
    const u = typeof url === 'string' ? url : url.toString();

    if (u.startsWith('https://alert.test/')) {
      try {
        alerts.push(JSON.parse(String(init?.body ?? '{}')));
      } catch {
        alerts.push({ raw: String(init?.body) });
      }
      return new Response('{}', { status: 200 });
    }

    if (u.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), {
        status: 200,
      });
    }

    const captureMatch = u.match(/\/v2\/checkout\/orders\/([^/?]+)\/capture$/);
    if (captureMatch) {
      counts.capture++;
      return opts.onCapture(decodeURIComponent(captureMatch[1]));
    }

    const orderMatch = u.match(/\/v2\/checkout\/orders\/([^/?]+)$/);
    if (orderMatch) {
      counts.getOrder++;
      const body = opts.getOrderBody?.(decodeURIComponent(orderMatch[1])) ?? {};
      return new Response(JSON.stringify(body), { status: 200 });
    }

    return originalFetch(url, init);
  });

  try {
    await fn(counts, alerts);
  } finally {
    f.mock.restore();
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k] as string;
    }
  }
}

type PaymentStatus =
  | 'pending'
  | 'pending_paypal'
  | 'capturing'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'needs_review'
  | 'disputed';

async function mkPaypal(opts: { status?: PaymentStatus; amountCents?: number } = {}) {
  const id = runId();
  const [user] = await db
    .insert(s.users)
    .values({ name: 'Capture User', email: `capture-${id}@test.dev` })
    .returning();
  const token = `test_capture_session_${id}`;
  await db.insert(s.sessions).values({
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 3600_000),
  });
  const [payment] = await db
    .insert(s.payments)
    .values({
      userId: user.id,
      provider: 'paypal',
      externalId: `PAYPAL-ORDER-${id}`,
      amountCents: opts.amountCents ?? 5000,
      currency: 'USD',
      credits: 10000,
      status: opts.status ?? 'pending',
    })
    .returning();
  return { user, payment, token };
}

async function capture(token: string, orderId: string, paymentId: string) {
  return app.request('/v1/payments/paypal/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId, paymentId }),
  });
}

async function verify(token: string, paymentId: string) {
  return app.request(`/v1/payments/paypal/verify/${paymentId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function refetch(id: string) {
  const [row] = await db.select().from(s.payments).where(eq(s.payments.id, id));
  return row;
}

// ── T7: strict amount helpers ────────────────────────────────────────────────

test('T7: paypalAmountToCents computes from digits and rejects bad formats', () => {
  assert.equal(paypalAmountToCents('10.00'), 1000);
  assert.equal(paypalAmountToCents('8.70'), 870); // 8.7 * 100 = 869.999… in float
  assert.equal(paypalAmountToCents('0.01'), 1);
  assert.equal(paypalAmountToCents('50'), 5000);
  for (const bad of ['10.555', '1e3', '-5.00', 'abc', '', '1.2.3', '+3.00']) {
    assert.throws(() => paypalAmountToCents(bad), /Unexpected PayPal amount format/);
  }
});

test('T7: centsToPaypalAmount formats whole cents and rejects non-integers', () => {
  assert.equal(centsToPaypalAmount(1000), '10.00');
  assert.equal(centsToPaypalAmount(870), '8.70');
  assert.equal(centsToPaypalAmount(1), '0.01');
  assert.equal(centsToPaypalAmount(0), '0.00');
  for (const bad of [10.5, -1]) {
    assert.throws(() => centsToPaypalAmount(bad), /Invalid PayPal amount in cents/);
  }
  assert.equal(PAYPAL_AMOUNT_RE.test(centsToPaypalAmount(5000)), true);
});

test('T7: create-order throws when PayPal returns no approve link', { timeout: 30000 }, async () => {
  const { user, token } = await mkPaypal();

  const [pkg] = await db
    .insert(s.packages)
    .values({
      name: `T7 Package ${runId()}`,
      priceCents: 500,
      currency: 'USD',
      creditAllowance: 10000,
      status: 'active',
    })
    .returning();

  const originalFetch = globalThis.fetch;
  const f = mock.method(globalThis, 'fetch', async (url: any, init: any) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.includes('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
    }
    if (u.includes('/v2/checkout/orders')) {
      // A well-formed order with no approve/payer-action link: the buyer has nowhere to go.
      return new Response(JSON.stringify({ id: `ORDER-${runId()}`, links: [] }), { status: 200 });
    }
    return originalFetch(url, init);
  });

  let status: number;
  try {
    const res = await app.request('/v1/payments/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ packageId: pkg.id }),
    });
    status = res.status;
  } finally {
    f.mock.restore();
  }

  // The route must fail the request rather than return a checkout with an empty approve URL.
  assert.notEqual(status, 200);
  // Scope to the row the create route inserted (mkPaypal also made one for this user).
  const rows = await db.select().from(s.payments).where(eq(s.payments.packageId, pkg.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, 'failed');
});

// ── T6: capture hardening ────────────────────────────────────────────────────

test('T6: a paid capture grants credits exactly once', { timeout: 30000 }, async () => {
  const { user, payment, token } = await mkPaypal();

  await withPaypal(
    { onCapture: () => new Response(JSON.stringify(paidOrder(payment.externalId!, payment.id, '50.00')), { status: 200 }) },
    async () => {
      const res = await capture(token, payment.externalId!, payment.id);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    },
  );

  assert.equal((await refetch(payment.id))?.status, 'paid');
  assert.equal(await getBalance(user.id), payment.credits);
});

test('T6: two concurrent captures call PayPal once; the loser settles via lookup', { timeout: 30000 }, async () => {
  const { user, payment, token } = await mkPaypal();

  await withPaypal(
    {
      onCapture: () =>
        new Response(JSON.stringify(paidOrder(payment.externalId!, payment.id, '50.00')), { status: 200 }),
      getOrderBody: () => paidOrder(payment.externalId!, payment.id, '50.00'),
    },
    async (counts) => {
      const [a, b] = await Promise.all([
        capture(token, payment.externalId!, payment.id),
        capture(token, payment.externalId!, payment.id),
      ]);
      // Exactly one request actually captured; the other must have observed the claim.
      assert.equal(counts.capture, 1);
      assert.ok([200, 202].includes(a.status));
      assert.ok([200, 202].includes(b.status));
    },
  );

  assert.equal((await refetch(payment.id))?.status, 'paid');
  // The single successful capture must credit once — never twice.
  assert.equal(await getBalance(user.id), payment.credits);
});

test('T6: an indeterminate capture error leaves the row capturing for reconcile', { timeout: 30000 }, async () => {
  const { payment, token } = await mkPaypal();

  await withPaypal(
    { onCapture: () => new Response('{"name":"INTERNAL_SERVER_ERROR"}', { status: 500 }) },
    async () => {
      const res = await capture(token, payment.externalId!, payment.id);
      assert.equal(res.status, 202);
      const data = await res.json();
      assert.equal(data.status, 'processing');
    },
  );

  // Unknown outcome: never marked failed, never released — reconcile settles it later.
  assert.equal((await refetch(payment.id))?.status, 'capturing');
});

test('T6: INSTRUMENT_DECLINED releases the claim so the buyer can retry', { timeout: 30000 }, async () => {
  const { payment, token } = await mkPaypal();

  await withPaypal(
    {
      onCapture: () =>
        new Response(
          JSON.stringify({
            name: 'UNPROCESSABLE_ENTITY',
            details: [{ issue: 'INSTRUMENT_DECLINED', description: 'declined' }],
          }),
          { status: 422 },
        ),
    },
    async () => {
      const res = await capture(token, payment.externalId!, payment.id);
      assert.equal(res.status, 422);
      const data = await res.json();
      assert.equal(data.error.code, 'instrument_declined');
    },
  );

  assert.equal((await refetch(payment.id))?.status, 'pending');
});

test('T6: ORDER_ALREADY_CAPTURED falls back to order lookup and credits', { timeout: 30000 }, async () => {
  const { user, payment, token } = await mkPaypal();

  await withPaypal(
    {
      onCapture: () =>
        new Response(
          JSON.stringify({
            name: 'UNPROCESSABLE_ENTITY',
            details: [{ issue: 'ORDER_ALREADY_CAPTURED', description: 'already captured' }],
          }),
          { status: 422 },
        ),
      getOrderBody: () => paidOrder(payment.externalId!, payment.id, '50.00'),
    },
    async () => {
      const res = await capture(token, payment.externalId!, payment.id);
      assert.equal(res.status, 200);
    },
  );

  assert.equal((await refetch(payment.id))?.status, 'paid');
  assert.equal(await getBalance(user.id), payment.credits);
});

test('T6: a capture whose order binding mismatches is flagged for review and not credited', { timeout: 30000 }, async () => {
  const { user, payment, token } = await mkPaypal();

  await withPaypal(
    {
      onCapture: () => {
        // Right amount, but the custom_id names a different payment: not ours to credit.
        const order = paidOrder(payment.externalId!, payment.id, '50.00') as any;
        order.purchase_units[0].custom_id = 'someone-elses-payment';
        order.purchase_units[0].payments.captures[0].custom_id = 'someone-elses-payment';
        return new Response(JSON.stringify(order), { status: 200 });
      },
    },
    async (_counts, alerts) => {
      const res = await capture(token, payment.externalId!, payment.id);
      assert.equal(res.status, 202);
      // Every needs_review transition must raise an ops alert (Phase 3 handoff note 5).
      assert.ok(alerts.length >= 1);
    },
  );

  assert.equal((await refetch(payment.id))?.status, 'needs_review');
  assert.equal(await getBalance(user.id), 0);
});

test('P5-2: verify route recovers a paid payment, grants credits once, and persists capture_id', { timeout: 30000 }, async () => {
  const { user, payment, token } = await mkPaypal({ status: 'pending' });
  const captureId = `CAP-VERIFY-${Date.now()}`;

  await withPaypal(
    {
      onCapture: () => new Response('{}', { status: 200 }),
      getOrderBody: () => {
        const order = paidOrder(payment.externalId!, payment.id, '50.00') as any;
        order.purchase_units[0].payments.captures[0].id = captureId;
        return order;
      },
    },
    async () => {
      const res = await verify(token, payment.id);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.status, 'paid');
      assert.equal(body.recovered, true);
    },
  );

  const updated = await refetch(payment.id);
  assert.equal(updated?.status, 'paid');
  assert.equal(updated?.captureId, captureId, 'captureId must be persisted by the verify route');
  assert.equal(await getBalance(user.id), payment.credits);

  // Calling verify again when already paid must be idempotent and not grant double credits
  const res2 = await verify(token, payment.id);
  assert.equal(res2.status, 200);
  assert.equal(await getBalance(user.id), payment.credits);
});