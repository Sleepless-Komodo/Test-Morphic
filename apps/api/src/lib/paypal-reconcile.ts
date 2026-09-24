import { db, schema as s } from '@morphic/db';
import { and, inArray, lt } from 'drizzle-orm';
import { markPaymentIfOpen, processPaymentSuccess } from '@morphic/db/billing';
import { getOrder, capturedAmountMatches } from './paypal';
import { checkTransactionStatus } from './duitku';

// Configuration thresholds for stale reconciliation
const STALE_THRESHOLD_MS = 15 * 60_000; // 15 minutes cutoff for stale rows
const MAX_EXPIRY_MS = 24 * 60 * 60_000; // 24 hours maximum lifetime for open payments
const MAX_PER_RUN = 50; // Maximum payments to reconcile per run to prevent query timeouts

/**
 * Periodically reconciles open payments (PayPal & Duitku).
 * Gateway-first reconciliation logic:
 * - Step 1: Query open payment rows (>15m old) ordered by oldest first (createdAt ASC).
 * - Step 2: Query Duitku / PayPal payment gateway APIs first.
 * - Step 3: On success status, verify nominal amounts (and currency for PayPal).
 * - Step 4: Handle terminal success, failures, and 24h age expiry (tooOld).
 * - Step 5: Preserve 'pending_paypal' (review states) from 24h age expiration.
 */
export async function reconcilePaypalPayments(): Promise<number> {
  const now = Date.now();
  const cutoff15m = new Date(now - STALE_THRESHOLD_MS);
  const cutoff24h = new Date(now - MAX_EXPIRY_MS);

  // Select open payments created more than 15 minutes ago, ordered by oldest first
  const stale = await db
    .select()
    .from(s.payments)
    .where(
      and(
        inArray(s.payments.status, ['pending', 'pending_paypal', 'capturing']),
        lt(s.payments.createdAt, cutoff15m),
      ),
    )
    .orderBy(s.payments.createdAt)
    .limit(MAX_PER_RUN);

  let reconciled = 0;

  for (const payment of stale) {
    try {
      const tooOld = payment.createdAt < cutoff24h;

      if (payment.provider === 'duitku') {
        // Query Duitku transactionStatus API first
        const status = await checkTransactionStatus(payment.externalId);

        if (status.statusCode === '00') {
          // Verify nominal amount matches stored amountCents
          if (Number(status.amount) !== payment.amountCents) {
            console.error(`[payment-reconcile] NEEDS REVIEW: Duitku ${payment.id} got=${status.amount} expected=${payment.amountCents}`);
            continue;
          }
          if ((await processPaymentSuccess(payment.id)).success) {
            reconciled++;
            console.log(`[payment-reconcile] Duitku payment ${payment.id} reconciled → paid`);
          }
        } else if (status.statusCode === '02' || tooOld) {
          await markPaymentIfOpen(payment.id, 'expired');
          console.log(`[payment-reconcile] Duitku payment ${payment.id} marked expired (statusCode=${status.statusCode}, tooOld=${tooOld})`);
        }
      } else if (payment.provider === 'paypal') {
        // Handle temporary PayPal order attempts (>15m old without real Order ID)
        if (!payment.externalId || payment.externalId.startsWith('temp:')) {
          await markPaymentIfOpen(payment.id, 'failed');
          console.log(`[payment-reconcile] stale temporary PayPal payment ${payment.id} marked failed`);
          continue;
        }

        // Query PayPal REST API getOrder() first
        const order = await getOrder(payment.externalId);

        if (order.effectiveStatus === 'paid') {
          // Verify both amount and currency using helper
          if (!capturedAmountMatches(order, payment)) {
            console.error(`[payment-reconcile] NEEDS REVIEW: PayPal ${payment.id} got=${order.amount} ${order.currency} expected=${payment.amountCents} ${payment.currency}`);
            continue;
          }
          if ((await processPaymentSuccess(payment.id)).success) {
            reconciled++;
            console.log(`[payment-reconcile] PayPal payment ${payment.id} reconciled → paid`);
          }
        } else if (order.effectiveStatus === 'failed' || order.effectiveStatus === 'expired') {
          await markPaymentIfOpen(payment.id, order.effectiveStatus);
          console.log(`[payment-reconcile] PayPal payment ${payment.id} marked ${order.effectiveStatus}`);
        } else if (order.effectiveStatus === 'pending' && tooOld) {
          // Only expire standard pending orders if >24h old; pending_paypal (under review) is preserved
          await markPaymentIfOpen(payment.id, 'expired');
          console.log(`[payment-reconcile] PayPal payment ${payment.id} >24h old marked expired`);
        }
      }
    } catch (err) {
      console.error(`[payment-reconcile] error processing payment ${payment.id}:`, err);
    }
  }

  return reconciled;
}


