import { Hono } from 'hono';
import { db, schema as s } from '@morphic/db';
import { eq, and } from 'drizzle-orm';
import { sessionAuth } from '../middleware/session-auth';
import { createTransaction, checkTransactionStatus } from '../lib/duitku';

const payments = new Hono();

payments.use('*', sessionAuth);

const FALLBACK_PACKAGES: Array<{
  id: string;
  name: string;
  priceCents: number;
  creditAllowance: number;
  durationHours?: number;
}> = [
  {
    id: 'pkg-v4-1day',
    name: 'Pass Harian DeepSeek V4',
    priceCents: 2500,
    creditAllowance: 15000,
    durationHours: 24,
  },
  {
    id: 'pkg-qwen-1day',
    name: 'Pass Harian Qwen Max',
    priceCents: 3500,
    creditAllowance: 22000,
    durationHours: 24,
  },
  {
    id: 'pkg-r1-1day',
    name: 'Pass Harian DeepSeek R1',
    priceCents: 4500,
    creditAllowance: 28000,
    durationHours: 24,
  },
  {
    id: 'pkg-all-1day',
    name: 'All-Access Pass (24 Jam)',
    priceCents: 7500,
    creditAllowance: 45000,
    durationHours: 24,
  },
  {
    id: 'pkg-micro-5k',
    name: 'Mikro Saldo 30K',
    priceCents: 5000,
    creditAllowance: 30000,
    durationHours: 24 * 30,
  },
  {
    id: 'pkg-week-9k',
    name: 'Pass Mingguan Coding',
    priceCents: 9000,
    creditAllowance: 70000,
    durationHours: 24 * 7,
  },
  {
    id: 'starter',
    name: 'Starter 10K',
    priceCents: 10000,
    creditAllowance: 10000,
    durationHours: 24 * 30,
  },
  {
    id: 'pro',
    name: 'Pro 25K',
    priceCents: 25000,
    creditAllowance: 25000,
    durationHours: 24 * 30,
  },
  {
    id: 'power',
    name: 'Power 50K',
    priceCents: 50000,
    creditAllowance: 50000,
    durationHours: 24 * 30,
  },
];

// ── POST /v1/payments/create ──────────────────────────
// Creates a Duitku transaction for a given packageId.
// Returns paymentUrl (redirect to Duitku hosted payment page).
payments.post('/create', async (c) => {
  const { userId } = c.get('userSession');

  let body: { packageId?: string; paymentMethod?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { message: 'invalid json body', type: 'invalid_request_error', code: 'invalid_json' } },
      400,
    );
  }

  const { packageId, paymentMethod } = body;
  if (!packageId) {
    return c.json(
      { error: { message: 'packageId is required', type: 'invalid_request_error', code: 'missing_package_id' } },
      400,
    );
  }

  // Resolve package: check DB if valid UUID, otherwise check fallback packages
  let pkg: {
    id: string | null;
    name: string;
    priceCents: number | null;
    creditAllowance: number;
    currency?: string;
  } | null = null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(packageId);

  if (isUuid) {
    const [dbPkg] = await db
      .select()
      .from(s.packages)
      .where(and(eq(s.packages.id, packageId), eq(s.packages.status, 'active')))
      .limit(1);
    if (dbPkg) {
      pkg = dbPkg;
    }
  }

  if (!pkg) {
    const fallback = FALLBACK_PACKAGES.find((p) => p.id === packageId);
    if (fallback) {
      pkg = {
        id: null,
        name: fallback.name,
        priceCents: fallback.priceCents,
        creditAllowance: fallback.creditAllowance,
        currency: 'IDR',
      };
    }
  }

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
  const amountIDR = pkg.priceCents; // priceCents stores IDR

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

  // Insert pending payment row BEFORE calling Duitku (so we have the row if webhook arrives fast)
  let payment: any;
  try {
    const [inserted] = await db
      .insert(s.payments)
      .values({
        userId,
        provider: 'duitku',
        externalId: merchantOrderId,
        packageId: pkg.id ? pkg.id : null,
        amountCents: amountIDR,
        currency: pkg.currency ?? 'IDR',
        credits: pkg.creditAllowance,
        status: 'pending',
      })
      .returning();
    payment = inserted;
  } catch (dbErr: any) {
    console.error('[payments/create] DB insert error:', dbErr);
    return c.json(
      { error: { message: 'failed to initialize payment record', type: 'server_error', code: 'db_error' } },
      500,
    );
  }

  let duitkuResult;
  try {
    const customerVaName = ((user.name || user.email.split('@')[0] || 'Customer') as string).slice(0, 20);
    duitkuResult = await createTransaction({
      merchantOrderId,
      paymentAmount: amountIDR,
      paymentMethod: paymentMethod ?? 'SP',
      productDetails: `Morphic Credits — ${pkg.name}`,
      email: user.email,
      customerVaName,
      callbackUrl: `${apiUrl}/webhooks/duitku`,
      returnUrl: `${appUrl}/dashboard/billing?ref=${payment.id}`,
      expiryPeriod: 60,
    });
  } catch (err: any) {
    // Mark as failed and return error
    if (payment?.id) {
      await db
        .update(s.payments)
        .set({ status: 'failed' })
        .where(eq(s.payments.id, payment.id));
    }
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
    qrString: duitkuResult.qrString,
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
  // (Webhook should update it, but this is a fallback for polling & manual check)
  if (payment.status === 'pending' && payment.provider === 'duitku') {
    try {
      const status = await checkTransactionStatus(payment.externalId);
      if (status.statusCode === '00') {
        const { grantCredits, grantEntitlement } = await import('@morphic/db/billing');
        await db
          .update(s.payments)
          .set({ status: 'paid', paidAt: new Date() })
          .where(and(eq(s.payments.id, payment.id), eq(s.payments.status, 'pending')));

        if (payment.packageId) {
          const [pkg] = await db
            .select()
            .from(s.packages)
            .where(eq(s.packages.id, payment.packageId))
            .limit(1);

          if (pkg?.modelId) {
            await grantEntitlement({
              userId,
              allowance: payment.credits ?? pkg.creditAllowance,
              modelId: pkg.modelId,
              durationHours: pkg.durationHours,
              source: 'purchase',
              packageId: pkg.id,
            });
          } else {
            await grantCredits({
              userId,
              amount: payment.credits,
              entryType: 'purchase',
              reference: `duitku:${payment.externalId}`,
            });
          }
        } else {
          await grantCredits({
            userId,
            amount: payment.credits,
            entryType: 'purchase',
            reference: `duitku:${payment.externalId}`,
          });
        }
        payment.status = 'paid';
        payment.paidAt = new Date();
      } else if (status.statusCode === '02' || status.statusCode === '01') {
        await db
          .update(s.payments)
          .set({ status: 'failed' })
          .where(and(eq(s.payments.id, payment.id), eq(s.payments.status, 'pending')));
        payment.status = 'failed';
      }
    } catch (err: any) {
      console.warn(`[payments/${paymentId}] Duitku check error:`, err?.message);
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
