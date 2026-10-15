/**
 * Phase 2 acceptance tests (AUDIT_BACKEND §11 — T3 + T8): PayPal post-payment events.
 *
 * Drives the real /webhooks/paypal route against the real DB. Only PayPal's
 * signature-verification and capture-lookup endpoints are mocked — the DB driver and
 * Redis reach the real network, mirroring payments.test.ts. Ops alerts are captured
 * by pointing ALERT_WEBHOOK_URL at a fake host the fetch mock intercepts.
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app';
import { db, schema as s } from '@morphic/db';
import { and, eq } from 'drizzle-orm';
import {
  extractPaymentRefs,
  isPostPaymentEvent,
  parseMinorUnits,
  redactPaypalPayload,
} from '../lib/paypal-post-payment';

const ENV_KEYS = [
  'PAYPAL_WEBHOOK_ID',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'ALERT_WEBHOOK_URL',
] as const;

function runId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Real PayPal capture ids are alphanumeric; keep fixtures realistic so extraction keeps them. */
function capId(prefix: string): string {
  return `${prefix}${runId().replace(/[^A-Za-z0-9]/g, '')}`;
}

/**
 * Mock PayPal verification + capture lookup, and capture outgoing ops alerts.
 * Passes every other request through to the real network so the DB driver keeps working.
 */
async function withMocks(fn: (alerts: any[]) => Promise<void>): Promise<void> {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.PAYPAL_WEBHOOK_ID = 'WH-PHASE2';
  process.env.PAYPAL_CLIENT_ID = 'phase2-client';
  process.env.PAYPAL_CLIENT_SECRET = 'phase2-secret';
  process.env.ALERT_WEBHOOK_URL = 'https://alert.test/hook';

  const alerts: any[] = [];
  const originalFetch = globalThis.fetch;
  const fetchMock = mock.method(globalThis, 'fetch', async (url: any, init: any) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.startsWith('https://alert.test/')) {
      try {
        alerts.push(JSON.parse(String(init?.body ?? '{}')));
      } catch {
        alerts.push({ raw: String(init?.body) });
      }
      return new Response('{}', { status: 200 });
    }
    if (u.includes('paypal.com')) {
      if (u.includes('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), {
          status: 200,
        });
      }
      if (u.includes('verify-webhook-signature')) {
        return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), { status: 200 });
      }
      // Capture lookup fallback must never reach the real network.
      if (u.includes('/v2/payments/captures/')) {
        return new Response('{}', { status: 404 });
      }
    }
    return originalFetch(url, init);
  });

  try {
    await fn(alerts);
  } finally {
    fetchMock.mock.restore();
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k] as string;
    }
  }
}

async function postPaypal(payload: unknown): Promise<Response> {
  return app.request('/webhooks/paypal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-ID',
      'paypal-transmission-id': `phase2-${runId()}`,
      'paypal-transmission-sig': 'phase2-sig',
      'paypal-transmission-time': new Date().toISOString(),
    },
    body: JSON.stringify(payload),
  });
}

async function mkPayment(opts: {
  status: 'paid' | 'disputed' | 'refunded';
  amountCents: number;
  currency?: string;
  captureId: string;
}) {
  const id = runId();
  const [user] = await db
    .insert(s.users)
    .values({ name: 'pp-user', email: `pp-${id}@sec.test` })
    .returning();
  const [payment] = await db
    .insert(s.payments)
    .values({
      userId: user.id,
      provider: 'paypal',
      externalId: `PAYPAL-ORD-${id}`,
      amountCents: opts.amountCents,
      currency: opts.currency ?? 'USD',
      credits: 100,
      status: opts.status,
      paidAt: new Date(),
      captureId: opts.captureId,
    })
    .returning();
  return { user, payment };
}

async function refetchPayment(id: string) {
  const [row] = await db.select().from(s.payments).where(eq(s.payments.id, id));
  return row;
}

async function refetchUser(id: string) {
  const [row] = await db.select().from(s.users).where(eq(s.users.id, id));
  return row;
}

function alertTypes(alerts: any[]): string[] {
  return alerts.map((a) => a.type);
}

function refundPayload(captureId: string, value: string, currency = 'USD') {
  return {
    id: `WH-REFUND-${runId()}`,
    event_type: 'PAYMENT.CAPTURE.REFUNDED',
    resource: {
      id: `REFUND-${runId()}`,
      amount: { value, currency_code: currency },
      supplementary_data: { related_ids: { capture_id: captureId } },
    },
  };
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

test('T3: parseMinorUnits accepts 2-decimal money strings, rejects anything else', () => {
  assert.equal(parseMinorUnits('10.00'), 1000);
  assert.equal(parseMinorUnits('10.5'), 1050);
  assert.equal(parseMinorUnits('0.01'), 1);
  assert.equal(parseMinorUnits(10), 1000);
  assert.equal(parseMinorUnits('10.555'), null);
  assert.equal(parseMinorUnits('1e3'), null);
  assert.equal(parseMinorUnits('-5.00'), null);
  assert.equal(parseMinorUnits('abc'), null);
  assert.equal(parseMinorUnits(null), null);
});

test('T3: redactPaypalPayload strips payer PII and phone keys, keeps ids', () => {
  const out = redactPaypalPayload({
    id: 'EVT-1',
    resource: {
      id: 'CAP-1',
      payer: { email_address: 'a@b.c', phone: { phone_number: '123' } },
      payment_source: { paypal: {} },
      shipping: { name: 'X' },
      payer_email: 'a@b.c',
      phone_number: '123',
    },
  });
  assert.equal(out.id, 'EVT-1');
  assert.equal(out.resource.id, 'CAP-1');
  assert.equal(out.resource.payer, undefined);
  assert.equal(out.resource.payment_source, undefined);
  assert.equal(out.resource.shipping, undefined);
  assert.equal(out.resource.payer_email, undefined);
  assert.equal(out.resource.phone_number, undefined);
});

test('T3: extractPaymentRefs reads the capture id per event shape', () => {
  assert.equal(
    extractPaymentRefs('PAYMENT.CAPTURE.REVERSED', { resource: { id: 'CAP9' } }).captureId,
    'CAP9',
  );
  assert.equal(
    extractPaymentRefs('PAYMENT.CAPTURE.REFUNDED', {
      resource: { supplementary_data: { related_ids: { capture_id: 'CAP8' } } },
    }).captureId,
    'CAP8',
  );
  assert.equal(
    extractPaymentRefs('PAYMENT.CAPTURE.REFUNDED', {
      resource: { links: [{ rel: 'up', href: 'https://api.paypal.com/v2/payments/captures/CAP7' }] },
    }).captureId,
    'CAP7',
  );
  assert.equal(
    extractPaymentRefs('CUSTOMER.DISPUTE.CREATED', {
      resource: { disputed_transactions: [{ seller_transaction_id: 'CAP6' }] },
    }).captureId,
    'CAP6',
  );
});

test('T3: isPostPaymentEvent matches exactly the four post-payment types', () => {
  assert.equal(isPostPaymentEvent('PAYMENT.CAPTURE.REFUNDED'), true);
  assert.equal(isPostPaymentEvent('PAYMENT.CAPTURE.REVERSED'), true);
  assert.equal(isPostPaymentEvent('CUSTOMER.DISPUTE.CREATED'), true);
  assert.equal(isPostPaymentEvent('CUSTOMER.DISPUTE.RESOLVED'), true);
  assert.equal(isPostPaymentEvent('PAYMENT.CAPTURE.COMPLETED'), false);
  assert.equal(isPostPaymentEvent('CHECKOUT.ORDER.APPROVED'), false);
});

// ── Exit gate: refunds ───────────────────────────────────────────────────────

test('T3: full refund → refunded, clawback alert, account NOT frozen', async () => {
  const cap = capId('CAPFULL');
  const { user, payment } = await mkPayment({ status: 'paid', amountCents: 1000, captureId: cap });

  await withMocks(async (alerts) => {
    const res = await postPaypal(refundPayload(cap, '10.00'));
    assert.equal(res.status, 200);

    const after = await refetchPayment(payment.id);
    assert.equal(after?.status, 'refunded');
    assert.equal(after?.refundedAmountMinorUnits, 1000);

    const account = await refetchUser(user.id);
    assert.equal(account?.suspended, false, 'a plain refund must not freeze the account');

    assert.deepEqual(alertTypes(alerts), ['paypal_refund_clawback']);
  });
});

test('T3: partial refund keeps paid, accrues amount, alerts for manual clawback', async () => {
  const cap = capId('CAPPART');
  const { user, payment } = await mkPayment({ status: 'paid', amountCents: 1000, captureId: cap });

  await withMocks(async (alerts) => {
    const res = await postPaypal(refundPayload(cap, '4.00'));
    assert.equal(res.status, 200);

    const after = await refetchPayment(payment.id);
    assert.equal(after?.status, 'paid');
    assert.equal(after?.refundedAmountMinorUnits, 400);

    const account = await refetchUser(user.id);
    assert.equal(account?.suspended, false);

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'paypal_refund_clawback');
    assert.equal(alerts[0].status, 'paid');
  });
});

// ── T8: unaccountable refund parks the row AND alerts ────────────────────────

test('T8: refund with mismatched currency → needs_review + alert', async () => {
  const cap = capId('CAPCUR');
  const { payment } = await mkPayment({ status: 'paid', amountCents: 1000, captureId: cap });

  await withMocks(async (alerts) => {
    const res = await postPaypal(refundPayload(cap, '10.00', 'EUR'));
    assert.equal(res.status, 200);

    const after = await refetchPayment(payment.id);
    assert.equal(after?.status, 'needs_review');
    assert.equal(after?.refundedAmountMinorUnits, 0);

    assert.equal(alerts.length, 1, 'every needs_review write must raise an ops alert');
    assert.equal(alerts[0].type, 'paypal_refund_needs_review');
  });
});

// ── Exit gate: reversal + disputes ───────────────────────────────────────────

test('T3: capture reversed → disputed, account suspended, alert', async () => {
  const cap = capId('CAPREV');
  const { user, payment } = await mkPayment({ status: 'paid', amountCents: 1000, captureId: cap });

  await withMocks(async (alerts) => {
    const res = await postPaypal({
      id: `WH-REV-${runId()}`,
      event_type: 'PAYMENT.CAPTURE.REVERSED',
      resource: { id: cap },
    });
    assert.equal(res.status, 200);

    const after = await refetchPayment(payment.id);
    assert.equal(after?.status, 'disputed');

    const account = await refetchUser(user.id);
    assert.equal(account?.suspended, true);

    assert.deepEqual(alertTypes(alerts), ['paypal_reversal']);
  });
});

test('T3: dispute opened → disputed, account suspended, alert', async () => {
  const cap = capId('CAPDIS');
  const { user, payment } = await mkPayment({ status: 'paid', amountCents: 1000, captureId: cap });

  await withMocks(async (alerts) => {
    const res = await postPaypal({
      id: `WH-DIS-${runId()}`,
      event_type: 'CUSTOMER.DISPUTE.CREATED',
      resource: { disputed_transactions: [{ seller_transaction_id: cap }] },
    });
    assert.equal(res.status, 200);

    const after = await refetchPayment(payment.id);
    assert.equal(after?.status, 'disputed');

    const account = await refetchUser(user.id);
    assert.equal(account?.suspended, true);

    assert.deepEqual(alertTypes(alerts), ['paypal_dispute_created']);
  });
});

test('T3: dispute won by seller → back to paid, alert asks for manual unsuspend', async () => {
  const cap = capId('CAPWON');
  const { payment } = await mkPayment({ status: 'disputed', amountCents: 1000, captureId: cap });

  await withMocks(async (alerts) => {
    const res = await postPaypal({
      id: `WH-WON-${runId()}`,
      event_type: 'CUSTOMER.DISPUTE.RESOLVED',
      resource: {
        disputed_transactions: [{ seller_transaction_id: cap }],
        dispute_outcome: { outcome_code: 'RESOLVED_SELLER_FAVOUR' },
      },
    });
    assert.equal(res.status, 200);

    const after = await refetchPayment(payment.id);
    assert.equal(after?.status, 'paid');

    assert.deepEqual(alertTypes(alerts), ['paypal_dispute_won_seller']);
  });
});

test('T3: dispute won by buyer → refunded in full, alert', async () => {
  const cap = capId('CAPLOST');
  const { payment } = await mkPayment({ status: 'disputed', amountCents: 1000, captureId: cap });

  await withMocks(async (alerts) => {
    const res = await postPaypal({
      id: `WH-LOST-${runId()}`,
      event_type: 'CUSTOMER.DISPUTE.RESOLVED',
      resource: {
        disputed_transactions: [{ seller_transaction_id: cap }],
        dispute_outcome: { outcome_code: 'RESOLVED_BUYER_FAVOUR' },
      },
    });
    assert.equal(res.status, 200);

    const after = await refetchPayment(payment.id);
    assert.equal(after?.status, 'refunded');
    assert.equal(after?.refundedAmountMinorUnits, 1000);

    assert.deepEqual(alertTypes(alerts), ['paypal_dispute_lost_buyer']);
  });
});

// ── Exit gate: idempotency ───────────────────────────────────────────────────

test('T3: replaying the same refund event is a no-op — no double accrue, no re-alert', async () => {
  const cap = capId('CAPDUP');
  const { payment } = await mkPayment({ status: 'paid', amountCents: 1000, captureId: cap });
  const payload = refundPayload(cap, '10.00');

  await withMocks(async (alerts) => {
    const first = await postPaypal(payload);
    assert.equal(first.status, 200);
    assert.equal(alerts.length, 1);

    const replay = await postPaypal(payload);
    assert.equal(replay.status, 200);
    const replayBody = await replay.json();
    assert.equal(replayBody.duplicate, true);

    const after = await refetchPayment(payment.id);
    assert.equal(after?.refundedAmountMinorUnits, 1000, 'replay must not accrue twice');
    assert.equal(after?.status, 'refunded');
    assert.equal(alerts.length, 1, 'replay must not re-alert');
  });
});

// ── Exit gate: unmapped event ────────────────────────────────────────────────

test('T3: unmapped event stores payment_id NULL, redacts PII, and returns 200', async () => {
  const eventId = `WH-ORPHAN-${runId()}`;
  const orphanCap = capId('CAPORPHAN');

  await withMocks(async (alerts) => {
    const res = await postPaypal({
      id: eventId,
      event_type: 'PAYMENT.CAPTURE.REFUNDED',
      resource: {
        id: `REFUND-ORPHAN-${runId()}`,
        amount: { value: '10.00', currency_code: 'USD' },
        supplementary_data: { related_ids: { capture_id: orphanCap } },
        payer: { email_address: 'victim@example.com' },
      },
    });
    assert.equal(res.status, 200, 'an unmappable event must still be acknowledged');
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.reason, 'payment_not_found');

    const [stored] = await db
      .select()
      .from(s.paymentEvents)
      .where(and(eq(s.paymentEvents.provider, 'paypal'), eq(s.paymentEvents.eventId, eventId)))
      .limit(1);
    assert.ok(stored, 'the unmapped event must be persisted for audit');
    assert.equal(stored.paymentId, null);
    assert.equal((stored.payload as any)?.resource?.payer, undefined, 'PII must be stripped');

    assert.deepEqual(alertTypes(alerts), ['paypal_post_payment_unmapped']);
  });
});

// ── Regression: review findings #1 and #2 ────────────────────────────────────

test('T3: CANCELED_BY_BUYER is a seller win, not a refund', async () => {
  const cap = capId('CAPCANCEL');
  const { payment } = await mkPayment({ status: 'disputed', amountCents: 1000, captureId: cap });

  await withMocks(async (alerts) => {
    const res = await postPaypal({
      id: `WH-CANCEL-${runId()}`,
      event_type: 'CUSTOMER.DISPUTE.RESOLVED',
      resource: {
        disputed_transactions: [{ seller_transaction_id: cap }],
        dispute_outcome: { outcome_code: 'CANCELED_BY_BUYER' },
      },
    });
    assert.equal(res.status, 200);

    const after = await refetchPayment(payment.id);
    assert.equal(after?.status, 'paid', 'a withdrawn claim must not refund the seller');
    assert.equal(after?.refundedAmountMinorUnits, 0, 'no funds may be accrued on a cancel');

    assert.deepEqual(alertTypes(alerts), ['paypal_dispute_won_seller']);
  });
});

test('T3: dispute outcome on a row that never moved is reported, not faked', async () => {
  const cap = capId('CAPSTALE');
  const { payment } = await mkPayment({ status: 'refunded', amountCents: 1000, captureId: cap });

  await withMocks(async (alerts) => {
    const res = await postPaypal({
      id: `WH-STALE-${runId()}`,
      event_type: 'CUSTOMER.DISPUTE.RESOLVED',
      resource: {
        disputed_transactions: [{ seller_transaction_id: cap }],
        dispute_outcome: { outcome_code: 'RESOLVED_SELLER_FAVOUR' },
      },
    });
    assert.equal(res.status, 200);

    const after = await refetchPayment(payment.id);
    assert.equal(after?.status, 'refunded', 'the row must not move from a non-disputed state');

    assert.deepEqual(alertTypes(alerts), ['paypal_dispute_resolved_unexpected_state']);
  });
});

// ── Regression: capture-id parsing rejects junk before it reaches a URL/DB ───

test('T3: malformed capture ids in links and dispute refs are dropped', () => {
  assert.equal(
    extractPaymentRefs('PAYMENT.CAPTURE.REFUNDED', {
      resource: { links: [{ rel: 'up', href: 'https://api.paypal.com/v2/payments/captures/ABC123/?x=1' }] },
    }).captureId,
    'ABC123',
    'query string and trailing slash must be stripped, keeping the id',
  );
  assert.equal(
    extractPaymentRefs('PAYMENT.CAPTURE.REVERSED', { resource: { id: 'BAD/../ID' } }).captureId,
    undefined,
    'non-alphanumeric ids must not survive extraction',
  );
  assert.equal(
    extractPaymentRefs('CUSTOMER.DISPUTE.CREATED', {
      resource: { disputed_transactions: [{ seller_transaction_id: 'has space' }] },
    }).captureId,
    undefined,
  );
});
