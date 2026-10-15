import { db, schema as s } from '@morphic/db';
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { markPaymentIfOpen } from '@morphic/db/billing';
import { fulfilPayment } from './notify';
import {
  OPEN_PAYMENT_STATUSES,
  saveCaptureId,
  flagPaymentNeedsReview,
  type PaymentRow,
} from './payment-state';
import { getOrder, capturedOrderMatches, PayPalApiError } from './paypal';
import { checkTransactionStatus } from './duitku';
import { rateLimitStore } from '../ratelimit';
import { sendOpsAlert } from './alert';

export { saveCaptureId };

// Configuration thresholds for stale reconciliation
const STALE_THRESHOLD_MS = 15 * 60_000; // 15 minutes cutoff for stale rows
const RECLAIM_AFTER_MS = 10 * 60_000; // a claimed row is only re-claimed after this long
const MAX_EXPIRY_MS = 24 * 60 * 60_000; // 24 hours maximum lifetime for open payments
const MAX_PER_RUN = 50; // Maximum payments to reconcile per run to prevent query timeouts
const STUCK_ALERT_TTL_SECONDS = 24 * 60 * 60; // at most one stuck alert per payment per day

// A Duitku QR is only payable for this long; open rows past it are cancelled so they never sit in
// "pending" and one user cannot keep piling up live invoices on the gateway.
export const DUITKU_PAYMENT_TTL_MINUTES = 5;
// Small grace past the gateway expiry so a payment completed in the last seconds is not cancelled first.
export const DUITKU_EXPIRE_AFTER_MS = DUITKU_PAYMENT_TTL_MINUTES * 60_000 + 30_000;

const OPEN_STATUSES = OPEN_PAYMENT_STATUSES;

/** Result of one gateway settle attempt. `null` means "nothing changed". */
export type SettleOutcome =
  | 'paid'
  | 'expired'
  | 'failed'
  | 'pending_paypal'
  | 'needs_review'
  | null;

/**
 * Asks Duitku for the real status of an open payment. Grants credits on '00' (amount verified),
 * marks it expired on '02' or when `expireIfUnpaid` is set. Returns the new status, or null if unchanged.
 */
export async function settleDuitkuPayment(
  payment: PaymentRow,
  { expireIfUnpaid }: { expireIfUnpaid: boolean },
): Promise<SettleOutcome> {
  const status = await checkTransactionStatus(payment.externalId);
  if (status.statusCode === '00') {
    if (Number(status.amount) !== payment.amountCents) {
      await flagPaymentNeedsReview(payment, {
        reason: 'amount mismatch',
        amount: status.amount,
        currency: 'IDR',
      });
      return 'needs_review';
    }
    return (await fulfilPayment(payment.id)).success ? 'paid' : null;
  }
  if (status.statusCode === '02' || expireIfUnpaid) {
    return (await markPaymentIfOpen(payment.id, 'expired')) ? 'expired' : null;
  }
  return null;
}

/**
 * Asks PayPal for the real status of an open payment and settles it.
 *
 * A row is only ever expired here on an explicit gateway answer: the order no longer exists
 * (404 / INVALID_RESOURCE_ID — handled by the caller), or PayPal reports the order/its capture as
 * terminal `failed`/`expired`/`VOIDED`. A transient gateway error must leave the row untouched:
 * the money may already have arrived and a follow-up webhook can still rescue it.
 */
export async function settlePaypalPayment(
  payment: PaymentRow,
  { expireIfUnpaid }: { expireIfUnpaid: boolean },
): Promise<SettleOutcome> {
  // Temporary rows created before PayPal returned a real order id can never be paid.
  if (!payment.externalId || payment.externalId.startsWith('temp:')) {
    return (await markPaymentIfOpen(payment.id, 'failed')) ? 'failed' : null;
  }

  const order = await getOrder(payment.externalId);

  if (order.captureId) await saveCaptureId(payment.id, order.captureId);

  switch (order.effectiveStatus) {
    case 'paid': {
      if (!capturedOrderMatches(order, payment)) {
        await flagPaymentNeedsReview(payment, {
          reason: 'amount/currency/order-binding mismatch',
          orderId: order.orderId,
          customId: order.customId,
          amount: order.amount,
          currency: order.currency,
        });
        return 'needs_review';
      }
      if (order.captureId) await saveCaptureId(payment.id, order.captureId);
      return (await fulfilPayment(payment.id)).success ? 'paid' : null;
    }
    case 'refunded': {
      // The capture behind an open row was already refunded: never credit it.
      await flagPaymentNeedsReview(payment, {
        reason: 'capture already refunded',
        orderId: order.orderId,
        customId: order.customId,
        amount: order.amount,
        currency: order.currency,
      });
      return 'needs_review';
    }
    case 'failed':
    case 'expired': {
      return (await markPaymentIfOpen(payment.id, order.effectiveStatus)) ? order.effectiveStatus : null;
    }
    case 'pending_paypal': {
      // Under review by PayPal — never age-expire it, the gateway has not given up yet.
      return null;
    }
    default: {
      // Plain `pending`: the gateway simply has not seen a payment yet. Past 24h the caller
      // asks us to give up, which is a legitimate explicit-ish answer for an unpaid order.
      if (expireIfUnpaid) {
        return (await markPaymentIfOpen(payment.id, 'expired')) ? 'expired' : null;
      }
      return null;
    }
  }
}

/** Cancels (or settles, if actually paid) every Duitku payment still pending past its TTL. */
export async function sweepStaleDuitkuPayments(): Promise<number> {
  const stale = await db
    .select()
    .from(s.payments)
    .where(
      and(
        eq(s.payments.provider, 'duitku'),
        eq(s.payments.status, 'pending'),
        lt(s.payments.createdAt, new Date(Date.now() - DUITKU_EXPIRE_AFTER_MS)),
      ),
    )
    .orderBy(s.payments.createdAt)
    .limit(MAX_PER_RUN);

  let changed = 0;
  for (const payment of stale) {
    try {
      if (await settleDuitkuPayment(payment, { expireIfUnpaid: true })) changed++;
    } catch (err) {
      // Gateway unreachable: leave it open and retry next sweep rather than cancel a possibly-paid row.
      console.error(`[duitku-sweep] error processing payment ${payment.id}:`, err);
    }
  }
  return changed;
}

/** Duitku answers "no such transaction" with a 404-ish error rather than a status code. */
function isDuitkuNotFound(err: any): boolean {
  return (
    err?.message?.includes('HTTP 404') ||
    err?.message?.includes('Transaction not found') ||
    err?.message?.includes('not found')
  );
}

/** PayPal says the order/capture is gone. This is a real answer, not a transient failure. */
function isPaypalGone(err: unknown): boolean {
  if (!(err instanceof PayPalApiError)) return false;
  if (err.status === 404) return true;
  return (err.details ?? []).some((d) => d.issue === 'INVALID_RESOURCE_ID');
}

/**
 * A transient gateway failure (timeout / 5xx / network) on an old row means we cannot tell whether
 * the money arrived. Keep the row open and page ops at most once a day per payment.
 */
async function alertStuckPayment(payment: PaymentRow, err: unknown): Promise<void> {
  console.error(`[payment-reconcile] transient error for payment ${payment.id}:`, err);
  if (payment.createdAt >= new Date(Date.now() - MAX_EXPIRY_MS)) return;
  try {
    if ((await rateLimitStore.increment(`notif:payment_stuck:${payment.id}`, STUCK_ALERT_TTL_SECONDS)) !== 1) return;
    await sendOpsAlert(`Payment ${payment.id} has been open for over 24h and the gateway is unreachable`, {
      type: 'payment_stuck',
      paymentId: payment.id,
      provider: payment.provider,
      status: payment.status,
      externalId: payment.externalId,
      error: err instanceof Error ? err.message : String(err),
    });
  } catch (e) {
    console.error('[payment-reconcile] stuck alert failed:', e);
  }
}

/**
 * Claim a row for this run. Returns true when the UPDATE won, false when another instance (or a
 * concurrent run) already claimed it. Claiming is what makes parallel runs safe: the gateway call
 * only ever happens for a row this process just took.
 */
async function claimPayment(paymentId: string, reclaimBefore: Date): Promise<boolean> {
  const [claimed] = await db
    .update(s.payments)
    .set({ reconcileCheckedAt: new Date() })
    .where(
      and(
        eq(s.payments.id, paymentId),
        inArray(s.payments.status, OPEN_STATUSES),
        or(isNull(s.payments.reconcileCheckedAt), lt(s.payments.reconcileCheckedAt, reclaimBefore)),
      ),
    )
    .returning({ id: s.payments.id });

  return Boolean(claimed);
}

/**
 * Periodically reconciles open payments (PayPal & Duitku).
 * Gateway-first reconciliation logic:
 * - Step 1: Query open rows older than 15m not checked in the last 10m, oldest check first.
 * - Step 2: Claim each row (`reconcile_checked_at`) before touching the gateway.
 * - Step 3: Ask the gateway, then verify order binding, nominal amount and currency.
 * - Step 4: Settle terminal outcomes; leave transient failures open and alert once a day.
 * - Step 5: `pending_paypal` (under review) is never age-expired.
 */
export async function reconcileOpenPayments(): Promise<number> {
  const now = Date.now();
  const cutoff15m = new Date(now - STALE_THRESHOLD_MS);
  const cutoff24h = new Date(now - MAX_EXPIRY_MS);
  const reclaimBefore = new Date(now - RECLAIM_AFTER_MS);

  const stale = await db
    .select()
    .from(s.payments)
    .where(
      and(
        inArray(s.payments.status, OPEN_STATUSES),
        lt(s.payments.createdAt, cutoff15m),
        or(isNull(s.payments.reconcileCheckedAt), lt(s.payments.reconcileCheckedAt, reclaimBefore)),
      ),
    )
    .orderBy(sql`${s.payments.reconcileCheckedAt} asc nulls first`, s.payments.createdAt)
    .limit(MAX_PER_RUN);

  let reconciled = 0;

  for (const payment of stale) {
    if (!(await claimPayment(payment.id, reclaimBefore))) continue;

    // Past 24h an order the gateway still reports as unpaid may be given up on. Never applied to
    // `pending_paypal` — that is an explicit "still being reviewed" answer.
    const expireIfUnpaid = payment.status === 'pending' && payment.createdAt < cutoff24h;

    try {
      const outcome =
        payment.provider === 'duitku'
          ? await settleDuitkuPayment(payment, { expireIfUnpaid })
          : payment.provider === 'paypal'
            ? await settlePaypalPayment(payment, { expireIfUnpaid })
            : null;

      if (outcome === 'paid') {
        reconciled++;
        console.log(`[payment-reconcile] ${payment.provider} payment ${payment.id} reconciled → paid`);
      } else if (outcome) {
        console.log(`[payment-reconcile] ${payment.provider} payment ${payment.id} → ${outcome}`);
      }
    } catch (err) {
      // Explicit "gone" answers are terminal; everything else is transient and must not expire the row.
      if (payment.provider === 'duitku' && isDuitkuNotFound(err)) {
        await markPaymentIfOpen(payment.id, 'expired').catch(() => {});
        console.log(`[payment-reconcile] Duitku payment ${payment.id} marked expired (gateway 404)`);
        continue;
      }
      if (payment.provider === 'paypal' && isPaypalGone(err)) {
        await markPaymentIfOpen(payment.id, 'expired').catch(() => {});
        console.log(`[payment-reconcile] PayPal payment ${payment.id} marked expired (gateway 404)`);
        continue;
      }
      await alertStuckPayment(payment, err);
    }
  }

  return reconciled;
}

/** Kept so existing imports (index.ts) keep working. */
export const reconcilePaypalPayments = reconcileOpenPayments;
