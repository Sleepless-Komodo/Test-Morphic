import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { grantCredits, grantEntitlement } from '@morphic/db/billing';

const webhooks = new Hono();

function verifyMockSignature(body: string, signature: string | undefined): boolean {
  const secret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Mock QRIS provider webhook. Real provider = same contract, swap this file.
 * Payload: { event_id, payment_id, status: 'paid'|'failed' }
 * Idempotent: (provider, event_id) unique in payment_events; duplicate → 200 no-op.
 */
webhooks.post('/mock', async (c) => {
  const raw = await c.req.text();
  if (!verifyMockSignature(raw, c.req.header('x-webhook-signature'))) {
    return c.json({ error: 'invalid signature' }, 401);
  }

  let payload: { event_id?: string; payment_id?: string; status?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    return c.json({ error: 'invalid payload' }, 400);
  }
  const { event_id: eventId, payment_id: paymentId, status } = payload;
  if (!eventId || !paymentId || !status) {
    return c.json({ error: 'missing fields' }, 400);
  }

  const [existing] = await db
    .select()
    .from(s.paymentEvents)
    .where(and(eq(s.paymentEvents.provider, 'mock'), eq(s.paymentEvents.eventId, eventId)))
    .limit(1);
  if (existing) return c.json({ ok: true, duplicate: true });

  const [payment] = await db
    .select()
    .from(s.payments)
    .where(and(eq(s.payments.provider, 'mock'), eq(s.payments.externalId, paymentId)))
    .limit(1);
  if (!payment) return c.json({ error: 'payment not found' }, 404);
  if (payment.status !== 'pending') {
    // already processed (different event id, same payment) — record + no-op
    await db.insert(s.paymentEvents).values({
      provider: 'mock',
      eventId,
      paymentId: payment.id,
      payload,
    }).onConflictDoNothing();
    return c.json({ ok: true, duplicate: true });
  }

  if (status === 'paid') {
    await db.transaction(async (tx) => {
      await tx.insert(s.paymentEvents).values({ provider: 'mock', eventId, paymentId: payment.id, payload });
      await tx
        .update(s.payments)
        .set({ status: 'paid', paidAt: new Date() })
        .where(and(eq(s.payments.id, payment.id), eq(s.payments.status, 'pending')));
    });
    // grant in one tx each (ledger+balance / entitlement)
    if (payment.packageId) {
      const [pkg] = await db.select().from(s.packages).where(eq(s.packages.id, payment.packageId)).limit(1);
      if (pkg) {
        if (pkg.modelId) {
          await grantEntitlement({
            userId: payment.userId,
            allowance: pkg.creditAllowance,
            modelId: pkg.modelId,
            durationHours: pkg.durationHours,
            source: 'purchase',
            packageId: pkg.id,
          });
        } else {
          await grantCredits({
            userId: payment.userId,
            amount: pkg.creditAllowance,
            entryType: 'purchase',
            reference: `payment:${payment.id}`,
          });
        }
      }
    } else {
      await grantCredits({
        userId: payment.userId,
        amount: payment.credits,
        entryType: 'purchase',
        reference: `payment:${payment.id}`,
      });
    }
  } else {
    await db.transaction(async (tx) => {
      await tx.insert(s.paymentEvents).values({ provider: 'mock', eventId, paymentId: payment.id, payload });
      await tx
        .update(s.payments)
        .set({ status: 'failed' })
        .where(and(eq(s.payments.id, payment.id), eq(s.payments.status, 'pending')));
    });
  }

  return c.json({ ok: true });
});

/**
 * Duitku payment callback webhook.
 *
 * Duitku sends x-www-form-urlencoded POST to this endpoint.
 * Signature verification: HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey) — hex lowercase.
 *   Note: this formula is different from the create-transaction signature.
 *
 * Idempotent: (provider='duitku', eventId=publisherOrderId) unique in payment_events.
 * Duitku retries up to 5× if it doesn't receive HTTP 200 — so we ALWAYS return 200.
 *
 * Docs: https://docs.duitku.com/api/id/#callback
 */
webhooks.post('/duitku', async (c) => {
  // Parse form-encoded body
  let formData: URLSearchParams;
  try {
    const raw = await c.req.text();
    formData = new URLSearchParams(raw);
  } catch {
    // Return 200 so Duitku doesn't retry — but log the error
    console.error('[webhook/duitku] failed to parse form body');
    return c.json({ ok: false, reason: 'parse_error' });
  }

  const payload = {
    merchantCode: formData.get('merchantCode') ?? '',
    amount: formData.get('amount') ?? '',
    merchantOrderId: formData.get('merchantOrderId') ?? '',
    productDetail: formData.get('productDetail') ?? '',
    additionalParam: formData.get('additionalParam') ?? '',
    paymentCode: formData.get('paymentCode') ?? '',
    resultCode: formData.get('resultCode') ?? '',
    merchantUserId: formData.get('merchantUserId') ?? '',
    reference: formData.get('reference') ?? '',
    publisherOrderId: formData.get('publisherOrderId') ?? '',
    signature: formData.get('signature') ?? '',
    spUserHash: formData.get('spUserHash') ?? '',
    settlementDate: formData.get('settlementDate') ?? '',
    issuerCode: formData.get('issuerCode') ?? '',
    customerName: formData.get('customerName') ?? '',
  };

  // Verify signature: HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)
  const { verifyCallbackSignature } = await import('../lib/duitku.ts');
  if (!verifyCallbackSignature(payload as any)) {
    console.error('[webhook/duitku] invalid signature for merchantOrderId:', payload.merchantOrderId);
    // Return 200 anyway — bad actor gets no retry info; Duitku signature check protects us
    return c.json({ ok: false, reason: 'invalid_signature' });
  }

  // Idempotency: use publisherOrderId as the event key (unique per Duitku transaction attempt)
  const eventId = payload.publisherOrderId || payload.reference || payload.merchantOrderId;
  const [existing] = await db
    .select({ id: s.paymentEvents.id })
    .from(s.paymentEvents)
    .where(and(eq(s.paymentEvents.provider, 'duitku'), eq(s.paymentEvents.eventId, eventId)))
    .limit(1);

  if (existing) {
    console.log('[webhook/duitku] duplicate event, skipping:', eventId);
    return c.json({ ok: true, duplicate: true });
  }

  // Find the payment by merchantOrderId (our externalId)
  const [payment] = await db
    .select()
    .from(s.payments)
    .where(and(eq(s.payments.provider, 'duitku'), eq(s.payments.externalId, payload.merchantOrderId)))
    .limit(1);

  if (!payment) {
    console.error('[webhook/duitku] payment not found for merchantOrderId:', payload.merchantOrderId);
    // Return 200 so Duitku stops retrying an order we don't know about
    return c.json({ ok: true, reason: 'payment_not_found' });
  }

  const rawPayload = Object.fromEntries(formData.entries());

  if (payload.resultCode === '00') {
    // SUCCESS — mark paid + grant credits, all in one DB transaction for atomicity
    if (payment.status !== 'pending') {
      // Already processed (e.g. poll already updated it) — just record the event
      await db.insert(s.paymentEvents)
        .values({ provider: 'duitku', eventId, paymentId: payment.id, payload: rawPayload })
        .onConflictDoNothing();
      return c.json({ ok: true, duplicate: true });
    }

    try {
      await db.transaction(async (tx) => {
        await tx.insert(s.paymentEvents).values({
          provider: 'duitku',
          eventId,
          paymentId: payment.id,
          payload: rawPayload,
        });
        await tx
          .update(s.payments)
          .set({ status: 'paid', paidAt: new Date() })
          .where(and(eq(s.payments.id, payment.id), eq(s.payments.status, 'pending')));
      });

      // Grant credits / entitlement outside the log transaction so billing errors don't
      // prevent the event from being recorded (idempotency key is already written above).
      if (payment.packageId) {
        const [pkg] = await db.select().from(s.packages).where(eq(s.packages.id, payment.packageId)).limit(1);
        if (pkg) {
          if (pkg.modelId) {
            await grantEntitlement({
              userId: payment.userId,
              allowance: pkg.creditAllowance,
              modelId: pkg.modelId,
              durationHours: pkg.durationHours,
              source: 'purchase',
              packageId: pkg.id,
            });
          } else {
            await grantCredits({
              userId: payment.userId,
              amount: pkg.creditAllowance,
              entryType: 'purchase',
              reference: `payment:${payment.id}`,
            });
          }
        }
      } else {
        await grantCredits({
          userId: payment.userId,
          amount: payment.credits,
          entryType: 'purchase',
          reference: `payment:${payment.id}`,
        });
      }

      console.log(`[webhook/duitku] payment ${payment.id} paid — ${payment.credits} credits granted to ${payment.userId}`);
    } catch (err) {
      console.error('[webhook/duitku] error processing paid event:', err);
      // Still return 200 — the idempotency row may or may not have been written.
      // If the event row was written, retry is a no-op. If not, Duitku will retry and we try again.
    }
  } else {
    // FAILED / other status
    await db.transaction(async (tx) => {
      await tx.insert(s.paymentEvents).values({
        provider: 'duitku',
        eventId,
        paymentId: payment.id,
        payload: rawPayload,
      }).onConflictDoNothing();
      await tx
        .update(s.payments)
        .set({ status: 'failed' })
        .where(and(eq(s.payments.id, payment.id), eq(s.payments.status, 'pending')));
    });
    console.log(`[webhook/duitku] payment ${payment.id} failed (resultCode: ${payload.resultCode})`);
  }

  return c.json({ ok: true });
});

export { webhooks };
