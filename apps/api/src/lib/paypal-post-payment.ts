// ── PayPal post-payment events (refund / reversal / dispute) ──────────────────
//
// These events move a payment that is already `paid`. The capture-lifecycle path in
// routes/webhooks.ts cannot carry them: the payload identifies a capture (or refund)
// rather than the order, so the handler resolves the payment itself.
//
// Invariants (AUDIT_BACKEND §3 T3):
//  - one transaction per event: payment_events insert (dedupe) + status mutation + freeze
//  - the dedupe insert runs before any mutation, so a replay never re-alerts
//  - ops alerts fire only after the transaction commits
//  - payer PII is stripped before the payload is persisted

import { db, schema as s } from '@morphic/db';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { getCapture } from './paypal';
import { sendOpsAlert } from './alert';
import {
  accrueRefund,
  markPaidPayment,
  recordPaymentEvent,
  recordUnmatchedEvent,
  suspendUser,
  transitionPayment,
  type PaymentRow,
  type PaymentTx,
} from './payment-state';

export const POST_PAYMENT_EVENT_TYPES = [
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
  'CUSTOMER.DISPUTE.CREATED',
  'CUSTOMER.DISPUTE.RESOLVED',
] as const;

export function isPostPaymentEvent(eventType: string): boolean {
  return (POST_PAYMENT_EVENT_TYPES as readonly string[]).includes(eventType);
}

interface Alert {
  message: string;
  payload: Record<string, unknown>;
}

interface Outcome {
  duplicate: boolean;
  status: string;
  alerts: Alert[];
  reason?: string;
}

export interface PostPaymentResult {
  duplicate?: boolean;
  reason?: string;
  status?: string;
}

const PII_KEYS = new Set([
  'payer',
  'shipping',
  'buyer',
  'payment_source',
  'payer_email',
  'email_address',
  'given_name',
  'surname',
]);

/** Strip payer PII before the payload is persisted (AUDIT_BACKEND §3 T3, L1). */
export function redactPaypalPayload(value: unknown): any {
  if (Array.isArray(value)) return value.map(redactPaypalPayload);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (PII_KEYS.has(lower) || lower.startsWith('phone')) continue;
      out[key] = redactPaypalPayload(v);
    }
    return out;
  }
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PayPal capture ids are alphanumeric; anything else must not reach a URL or the DB. */
const CAPTURE_ID_RE = /^[A-Za-z0-9]+$/;

/** Keep only a string that looks like a capture id — drops nulls, non-strings and junk. */
function asCaptureId(value: unknown): string | undefined {
  return typeof value === 'string' && CAPTURE_ID_RE.test(value) ? value : undefined;
}

/** Last path segment of a HATEOAS link, minus query/hash and any trailing slash. */
function captureIdFromLink(href: unknown): string | undefined {
  if (typeof href !== 'string') return undefined;
  const path = href.split(/[?#]/)[0]!.replace(/\/+$/, '');
  return asCaptureId(path.split('/').pop());
}

/** Strict 2-decimal parse to minor units; null when the value is not a plain money string. */
export function parseMinorUnits(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const str = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) return null;
  const [whole, frac = ''] = str.split('.');
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

interface PaymentRefs {
  captureId?: string;
  orderId?: string;
  customId?: string;
}

/** Pull the identifying ids out of the payload, per the shape PayPal sends for each type. */
export function extractPaymentRefs(eventType: string, payload: any): PaymentRefs {
  const resource = payload?.resource ?? {};
  const refs: PaymentRefs = {
    orderId: resource?.supplementary_data?.related_ids?.order_id,
    customId: resource?.custom_id,
  };

  if (eventType === 'PAYMENT.CAPTURE.REVERSED') {
    refs.captureId = asCaptureId(resource?.id);
  } else if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
    // The refund resource carries its own id; the original capture is linked via rel="up".
    const up = (resource?.links ?? []).find((l: any) => l?.rel === 'up')?.href;
    refs.captureId =
      asCaptureId(resource?.supplementary_data?.related_ids?.capture_id) ??
      captureIdFromLink(up);
  } else if (eventType.startsWith('CUSTOMER.DISPUTE')) {
    refs.captureId = asCaptureId(resource?.disputed_transactions?.[0]?.seller_transaction_id);
  }

  return refs;
}

/**
 * Resolve the payment behind a post-payment event.
 * Order: custom_id (UUID) → captureId → order id → ask PayPal which order owns the capture.
 * Only rows with provider='paypal' are considered.
 */
export async function resolvePostPaymentRow(refs: PaymentRefs): Promise<PaymentRow | null> {
  const lookup = async (where: SQL): Promise<PaymentRow | null> => {
    const [row] = await db
      .select()
      .from(s.payments)
      .where(and(where, eq(s.payments.provider, 'paypal')))
      .limit(1);
    return row ?? null;
  };

  if (refs.customId && UUID_RE.test(refs.customId)) {
    const row = await lookup(eq(s.payments.id, refs.customId));
    if (row) return row;
  }
  if (refs.captureId) {
    const row = await lookup(eq(s.payments.captureId, refs.captureId));
    if (row) return row;
  }
  if (refs.orderId) {
    const row = await lookup(eq(s.payments.externalId, refs.orderId));
    if (row) return row;
  }

  // Fallback: the capture knows its order even when the webhook body omits it.
  if (refs.captureId) {
    try {
      const info = await getCapture(refs.captureId);
      if (info.customId && UUID_RE.test(info.customId)) {
        const row = await lookup(eq(s.payments.id, info.customId));
        if (row) return row;
      }
      if (info.orderId) {
        const row = await lookup(eq(s.payments.externalId, info.orderId));
        if (row) return row;
      }
    } catch (err) {
      console.warn('[webhook/paypal] capture lookup fallback failed:', err);
    }
  }

  return null;
}

async function applyRefund(tx: PaymentTx, payment: PaymentRow, payload: any): Promise<Outcome> {
  const resource = payload?.resource ?? {};
  const value = resource?.amount?.value;
  const currency = resource?.amount?.currency_code;
  const delta = parseMinorUnits(value);

  if (delta === null || delta <= 0 || currency !== payment.currency) {
    // The money cannot be accounted for — park the row for a human instead of guessing.
    const moved = await transitionPayment(payment.id, ['paid'], 'needs_review', tx);
    return {
      duplicate: false,
      status: moved?.status ?? payment.status,
      reason: 'refund_mismatch',
      alerts: [
        {
          message: `PayPal refund tidak dapat diverifikasi untuk payment ${payment.id} — review manual`,
          payload: {
            type: 'paypal_refund_needs_review',
            paymentId: payment.id,
            userId: payment.userId,
            refundValue: value ?? null,
            refundCurrency: currency ?? null,
            expectedCurrency: payment.currency,
          },
        },
      ],
    };
  }

  const accrued = await accrueRefund(payment.id, delta, ['paid', 'refunded'], tx);
  if (!accrued) {
    return {
      duplicate: false,
      status: payment.status,
      reason: 'refund_unexpected_state',
      alerts: [
        {
          message: `PayPal refund pada payment ${payment.id} berstatus ${payment.status} — tidak diakumulasi`,
          payload: {
            type: 'paypal_refund_unexpected_state',
            paymentId: payment.id,
            userId: payment.userId,
            status: payment.status,
            deltaMinorUnits: delta,
          },
        },
      ],
    };
  }

  let status = accrued.status;
  if (accrued.refundedAmountMinorUnits >= payment.amountCents && accrued.status === 'paid') {
    const flipped = await markPaidPayment(payment.id, 'refunded', tx);
    if (flipped) status = flipped.status;
  }

  return {
    duplicate: false,
    status,
    alerts: [
      {
        message: `PayPal refund pada payment ${payment.id} (${accrued.refundedAmountMinorUnits}/${payment.amountCents}) — clawback manual via admin_adjustment`,
        payload: {
          type: 'paypal_refund_clawback',
          paymentId: payment.id,
          userId: payment.userId,
          currency: payment.currency,
          refundedMinorUnits: accrued.refundedAmountMinorUnits,
          amountMinorUnits: payment.amountCents,
          status,
        },
      },
    ],
  };
}

async function applyDisputeOpened(
  tx: PaymentTx,
  payment: PaymentRow,
  eventType: string,
): Promise<Outcome> {
  const moved = await transitionPayment(payment.id, ['paid'], 'disputed', tx);
  if (!moved) {
    // A reversal/dispute on a row that is no longer `paid` is an anomaly worth a human's
    // attention, but it must not be reported as if the row moved — and the account stays
    // unfrozen. Mirrors the `refund_unexpected_state` branch in applyRefund.
    return {
      duplicate: false,
      status: payment.status,
      reason: 'dispute_unexpected_state',
      alerts: [
        {
          message: `PayPal ${eventType} pada payment ${payment.id} berstatus ${payment.status} — tidak dipindah ke disputed`,
          payload: {
            type: 'paypal_dispute_unexpected_state',
            eventType,
            paymentId: payment.id,
            userId: payment.userId,
            status: payment.status,
          },
        },
      ],
    };
  }

  const suspended = await suspendUser(payment.userId, tx);

  return {
    duplicate: false,
    status: moved.status,
    alerts: [
      {
        message: `PayPal ${eventType} pada payment ${payment.id} → ${moved.status}${suspended ? ' (akun dibekukan)' : ''}`,
        payload: {
          type: eventType === 'PAYMENT.CAPTURE.REVERSED' ? 'paypal_reversal' : 'paypal_dispute_created',
          eventType,
          paymentId: payment.id,
          userId: payment.userId,
          previousStatus: payment.status,
          status: moved.status,
          suspended,
        },
      },
    ],
  };
}

/**
 * The row was not in a state this outcome can move (e.g. already refunded). Report the
 * anomaly rather than emit an alert claiming a transition that never happened.
 */
function unexpectedDisputeState(payment: PaymentRow, code: string, intendedType: string): Outcome {
  return {
    duplicate: false,
    status: payment.status,
    reason: 'dispute_unexpected_state',
    alerts: [
      {
        message: `PayPal dispute resolved "${code}" pada payment ${payment.id} berstatus ${payment.status} — tidak diubah, review manual`,
        payload: {
          type: 'paypal_dispute_resolved_unexpected_state',
          intendedType,
          paymentId: payment.id,
          userId: payment.userId,
          outcomeCode: code,
          status: payment.status,
        },
      },
    ],
  };
}

async function applyDisputeResolved(
  tx: PaymentTx,
  payment: PaymentRow,
  payload: any,
): Promise<Outcome> {
  const resource = payload?.resource ?? {};
  const code = String(
    resource?.dispute_outcome?.outcome_code ?? resource?.dispute_outcome?.outcome ?? '',
  ).toUpperCase();

  // The seller keeps the money when the dispute is decided in their favour OR the buyer
  // withdraws the claim (`CANCELED_BY_BUYER`). Matching on a bare `BUYER` substring would
  // misread that cancel as a loss and refund the seller's funds — so the cancel is carved
  // out before the buyer branch, not after.
  if (code.includes('SELLER') || code === 'CANCELED_BY_BUYER') {
    const moved = await transitionPayment(payment.id, ['disputed'], 'paid', tx);
    if (!moved) return unexpectedDisputeState(payment, code, 'paypal_dispute_won_seller');
    return {
      duplicate: false,
      status: moved.status,
      alerts: [
        {
          message: `PayPal dispute dimenangkan seller (payment ${payment.id}) → paid. Akun ${payment.userId} masih suspended — unsuspend manual bila layak.`,
          payload: {
            type: 'paypal_dispute_won_seller',
            paymentId: payment.id,
            userId: payment.userId,
            outcomeCode: code,
            status: moved.status,
          },
        },
      ],
    };
  }

  if (code.includes('BUYER')) {
    // A lost dispute refunds in full; keep refunded_amount consistent with the terminal status.
    const moved = await transitionPayment(payment.id, ['disputed', 'paid'], 'refunded', tx, {
      refundedAmountMinorUnits: payment.amountCents,
    });
    if (!moved) return unexpectedDisputeState(payment, code, 'paypal_dispute_lost_buyer');
    return {
      duplicate: false,
      status: moved.status,
      alerts: [
        {
          message: `PayPal dispute dimenangkan buyer (payment ${payment.id}) → refunded. Clawback + unsuspend manual bila layak (user ${payment.userId}).`,
          payload: {
            type: 'paypal_dispute_lost_buyer',
            paymentId: payment.id,
            userId: payment.userId,
            outcomeCode: code,
            status: moved.status,
          },
        },
      ],
    };
  }

  return {
    duplicate: false,
    status: payment.status,
    reason: 'dispute_outcome_unknown',
    alerts: [
      {
        message: `PayPal dispute resolved dengan outcome "${code || 'tidak diketahui'}" pada payment ${payment.id} — review manual`,
        payload: {
          type: 'paypal_dispute_outcome_unknown',
          paymentId: payment.id,
          userId: payment.userId,
          outcomeCode: code,
        },
      },
    ],
  };
}

export async function handlePostPaymentEvent(input: {
  eventId: string;
  eventType: string;
  payload: any;
}): Promise<PostPaymentResult> {
  const { eventId, eventType, payload } = input;
  const redacted = redactPaypalPayload(payload);
  const refs = extractPaymentRefs(eventType, payload);
  const payment = await resolvePostPaymentRow(refs);

  if (!payment) {
    const stored = await recordUnmatchedEvent({ provider: 'paypal', eventId, payload: redacted });
    if (stored) {
      await sendOpsAlert(`PayPal ${eventType}: payment tidak ditemukan (event ${eventId})`, {
        type: 'paypal_post_payment_unmapped',
        eventType,
        eventId,
        captureId: refs.captureId ?? null,
        orderId: refs.orderId ?? null,
      });
    }
    return { duplicate: !stored, reason: 'payment_not_found' };
  }

  // Best-effort capture_id backfill; a unique collision here is expected and harmless.
  if (!payment.captureId && refs.captureId) {
    try {
      await db
        .update(s.payments)
        .set({ captureId: refs.captureId })
        .where(and(eq(s.payments.id, payment.id), isNull(s.payments.captureId)));
    } catch (err) {
      console.warn('[webhook/paypal] capture_id backfill skipped:', err);
    }
  }

  const outcome = await db.transaction(async (tx) => {
    const isNew = await recordPaymentEvent(
      { provider: 'paypal', eventId, paymentId: payment.id, payload: redacted },
      tx,
    );
    if (!isNew) return { duplicate: true, status: payment.status, alerts: [] as Alert[], reason: undefined };

    if (eventType === 'PAYMENT.CAPTURE.REFUNDED') return applyRefund(tx, payment, payload);
    if (eventType === 'PAYMENT.CAPTURE.REVERSED' || eventType === 'CUSTOMER.DISPUTE.CREATED') {
      return applyDisputeOpened(tx, payment, eventType);
    }
    return applyDisputeResolved(tx, payment, payload);
  });

  for (const alert of outcome.alerts) {
    try {
      await sendOpsAlert(alert.message, alert.payload);
    } catch (err) {
      console.error('[webhook/paypal] ops alert failed:', err);
    }
  }

  return { duplicate: outcome.duplicate, status: outcome.status, reason: outcome.reason };
}
