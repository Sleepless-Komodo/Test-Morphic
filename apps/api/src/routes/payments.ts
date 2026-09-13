import { Hono } from 'hono';
import { db, schema as s } from '@morphic/db';
import { eq, and } from 'drizzle-orm';
import { sessionAuth } from '../middleware/session-auth.ts';
import { createTransaction, checkTransactionStatus } from '../lib/duitku.ts';

const payments = new Hono();

payments.use('*', sessionAuth);

// ── POST /v1/payments/create ──────────────────────────
// Creates a Duitku transaction for a given packageId.
// Returns paymentUrl (redirect to Duitku hosted payment page).
payments.post('/create', async (c) => {
  const { userId } = c.get('userSession');

  let body: { packageId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { message: 'invalid json body', type: 'invalid_request_error', code: 'invalid_json' } },
      400,
    );
  }

  const { packageId } = body;
  if (!packageId) {
    return c.json(
      { error: { message: 'packageId is required', type: 'invalid_request_error', code: 'missing_package_id' } },
      400,
    );
  }

  // Fetch the package
  const [pkg] = await db
    .select()
    .from(s.packages)
    .where(and(eq(s.packages.id, packageId), eq(s.packages.status, 'active')))
    .limit(1);

  if (!pkg) {
    return c.json(
      { error: { message: 'package not found or inactive', type: 'invalid_request_error', code: 'package_not_found' } },
      404,
    );
  }

  if (!pkg.priceCents || pkg.priceCents <= 0) {
    return c.json(
      { error: { message: 'package has no price set', type: 'invalid_request_error', code: 'package_no_price' } },
      400,
    );
  }

  // Fetch user info (for email + customerVaName)
  const [user] = await db
    .select({ name: s.users.name, email: s.users.email })
    .from(s.users)
    .where(eq(s.users.id, userId))
    .limit(1);

  if (!user) {
    return c.json(
      { error: { message: 'user not found', type: 'auth_error', code: 'user_not_found' } },
      401,
    );
  }

  // Generate a unique merchantOrderId
  const merchantOrderId = `morphic-${userId.slice(0, 8)}-${Date.now()}`;
  const amountIDR = pkg.priceCents; // priceCents stores IDR (not cents) per convention

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

  // Insert pending payment row BEFORE calling Duitku (so we have the row if webhook arrives fast)
  const [payment] = await db
    .insert(s.payments)
    .values({
      userId,
      provider: 'duitku',
      externalId: merchantOrderId,
      packageId: pkg.id,
      amountCents: amountIDR,
      currency: pkg.currency ?? 'IDR',
      credits: pkg.creditAllowance,
      status: 'pending',
    })
    .returning();

  let duitkuResult;
  try {
    duitkuResult = await createTransaction({
      merchantOrderId,
      paymentAmount: amountIDR,
      productDetails: `Morphic Credits — ${pkg.name}`,
      email: user.email,
      customerVaName: user.name.slice(0, 20),
      callbackUrl: `${apiUrl}/webhooks/duitku`,
      returnUrl: `${appUrl}/dashboard/billing?ref=${payment!.id}`,
      expiryPeriod: 60,
    });
  } catch (err: any) {
    // Mark as failed and return error
    await db
      .update(s.payments)
      .set({ status: 'failed' })
      .where(eq(s.payments.id, payment!.id));
    console.error('[payments/create] Duitku error:', err?.message);
    return c.json(
      { error: { message: 'payment gateway error', type: 'server_error', code: 'gateway_error' } },
      502,
    );
  }

  // Save the Duitku reference onto the payment row
  await db
    .update(s.payments)
    .set({ externalId: merchantOrderId }) // already set, but reference is in Duitku's side
    .where(eq(s.payments.id, payment!.id));

  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();

  return c.json({
    paymentId: payment!.id,
    merchantOrderId,
    paymentUrl: duitkuResult.paymentUrl,
    reference: duitkuResult.reference,
    amountIDR,
    expiresAt,
    package: {
      id: pkg.id,
      name: pkg.name,
      creditAllowance: pkg.creditAllowance,
    },
  });
});

// ── GET /v1/payments/:id ──────────────────────────────
// Poll payment status. Returns DB status + optionally refreshes from Duitku.
payments.get('/:id', async (c) => {
  const { userId } = c.get('userSession');
  const paymentId = c.req.param('id');

  const [payment] = await db
    .select()
    .from(s.payments)
    .where(and(eq(s.payments.id, paymentId), eq(s.payments.userId, userId)))
    .limit(1);

  if (!payment) {
    return c.json(
      { error: { message: 'payment not found', type: 'invalid_request_error', code: 'payment_not_found' } },
      404,
    );
  }

  // If still pending and it's a Duitku payment, optionally check Duitku directly
  // (Webhook should update it, but this is a fallback for polling)
  if (payment.status === 'pending' && payment.provider === 'duitku') {
    try {
      const status = await checkTransactionStatus(payment.externalId);
      if (status.statusCode === '00') {
        // Webhook may have been slow; log for observability — credit grant still via webhook
        console.log(`[payments/${paymentId}] Duitku reports paid but DB still pending — webhook may be in-flight`);
      }
    } catch {
      // Non-fatal: just return DB state
    }
  }

  return c.json({
    id: payment.id,
    status: payment.status,
    provider: payment.provider,
    amountCents: payment.amountCents,
    currency: payment.currency,
    credits: payment.credits,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  });
});

export { payments };
