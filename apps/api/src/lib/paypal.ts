// ── PayPal REST API Client ─────────────────────────────

function getClientId(): string {
  const id = process.env.PAYPAL_CLIENT_ID;
  if (!id) throw new Error('PAYPAL_CLIENT_ID is not set');
  return id;
}

function getClientSecret(): string {
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!secret) throw new Error('PAYPAL_CLIENT_SECRET is not set');
  return secret;
}

/**
 * Resolve the PayPal environment with production guardrails.
 * Production must run live; non-production must not. Never falls back to sandbox in production.
 */
function resolvePaypalEnvironment(): 'live' | 'sandbox' {
  const env = process.env.PAYPAL_ENVIRONMENT ?? 'sandbox';
  const isProduction = process.env.NODE_ENV === 'production';
  const isLive = env === 'live' || env === 'production';

  if (isProduction && !isLive) {
    throw new Error(
      `PAYPAL_ENVIRONMENT must be "live" or "production" when NODE_ENV=production (got "${env}")`,
    );
  }
  if (!isProduction && isLive) {
    throw new Error(`PAYPAL_ENVIRONMENT="${env}" is not allowed outside production`);
  }
  return isLive ? 'live' : 'sandbox';
}

/**
 * Validate PayPal config at startup. Unconfigured PayPal (Duitku-only deployment) is disabled,
 * not fatal. Throws on production misconfiguration so the process crashes instead of silently
 * running against sandbox.
 */
export function assertPaypalConfig(): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Checked before the disabled carve-out: a leaked test flag is a config error whether or not
  // PayPal is otherwise configured, so it must not be reachable past an early return.
  if (isProduction && process.env.PAYPAL_WEBHOOK_TEST_BYPASS) {
    throw new Error('PAYPAL_WEBHOOK_TEST_BYPASS must not be set in production');
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId && !clientSecret) {
    console.log('[paypal] disabled (PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are unset)');
    return;
  }

  if (isProduction) {
    if (!clientId) throw new Error('PAYPAL_CLIENT_ID is required in production');
    if (!clientSecret) throw new Error('PAYPAL_CLIENT_SECRET is required in production');
    if (!process.env.PAYPAL_WEBHOOK_ID) throw new Error('PAYPAL_WEBHOOK_ID is required in production');
  }

  resolvePaypalEnvironment();
}

function getBaseUrl(): string {
  return resolvePaypalEnvironment() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

// ── OAuth Token Cache ─────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  // Buffer 60s before actual expiry
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PayPal OAuth HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// ── Interfaces ────────────────────────────────────────

export interface PayPalOrderResult {
  orderId: string;
  approveUrl: string;
}

export interface PayPalParsedOrder {
  orderId: string;
  orderStatus: string;      // CREATED, SAVED, APPROVED, VOIDED, COMPLETED, PAYER_ACTION_REQUIRED
  captureStatus?: string;   // COMPLETED, PENDING, DECLINED, FAILED, REFUNDED, PARTIALLY_REFUNDED
  captureId?: string;
  amount?: string;
  currency?: string;
  customId?: string;        // purchase_units[0].custom_id — the payment id we set at order creation
  effectiveStatus: 'paid' | 'pending_paypal' | 'failed' | 'expired' | 'pending' | 'refunded';
}

export class PayPalApiError extends Error {
  public status: number;
  public details?: Array<{ issue: string; description: string }>;

  constructor(message: string, status: number, details?: Array<{ issue: string; description: string }>) {
    super(message);
    this.name = 'PayPalApiError';
    this.status = status;
    this.details = details;
  }
}

// ── Status Interpreter ───────────────────────────────

export const PAYPAL_CERT_HOST_RE = /^([a-z0-9-]+\.)*paypal\.com$/i;

export const PAYPAL_TRANSMISSION_HEADERS = [
  'paypal-auth-algo',
  'paypal-cert-url',
  'paypal-transmission-id',
  'paypal-transmission-sig',
  'paypal-transmission-time',
] as const;

export type PayPalTransmissionHeader = (typeof PAYPAL_TRANSMISSION_HEADERS)[number];

/**
 * Cheap pre-check before calling PayPal's verification endpoint.
 *
 * Requirements:
 *  - All five paypal-* headers must be present and non-empty.
 *  - paypal-cert-url must be an https URL whose host is under paypal.com (M8 / T5).
 *    Without this check, an attacker could supply their own certificate URL and
 *    cause the verification endpoint to sign against their key.
 */
export function hasPayPalTransmissionHeaders(headers: Record<string, string | undefined>): boolean {
  for (const key of PAYPAL_TRANSMISSION_HEADERS) {
    if (!headers[key]) return false;
  }

  let certUrl: URL;
  try {
    certUrl = new URL(headers['paypal-cert-url']!);
  } catch {
    return false;
  }
  return certUrl.protocol === 'https:' && PAYPAL_CERT_HOST_RE.test(certUrl.hostname);
}

/**
 * Interpret raw PayPal Order / Capture API responses.
 * Evaluates the underlying capture rather than the top-level order status, because a
 * COMPLETED order with a PENDING capture has not actually paid us yet.
 *
 * An order can carry several captures (a retry after a declined first attempt). Reading
 * only `captures[0]` would report a failed first try as the outcome of a later successful
 * one, so the captures are ranked: COMPLETED, then PENDING, then the first.
 */
export function interpretOrder(raw: {
  id?: string;
  status: string;
  purchase_units?: Array<{
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
        custom_id?: string;
      }>;
    };
  }>;
}): PayPalParsedOrder {
  const orderId = raw.id ?? '';
  const orderStatus = raw.status ?? '';

  const captures = raw.purchase_units?.flatMap((u) => u.payments?.captures ?? []) ?? [];
  const capture =
    captures.find((c) => c.status === 'COMPLETED') ??
    captures.find((c) => c.status === 'PENDING') ??
    captures[0];

  const customId = capture?.custom_id ?? raw.purchase_units?.[0]?.custom_id;
  const captureStatus = capture?.status;
  const captureId = capture?.id;
  const amount = capture?.amount?.value ?? raw.purchase_units?.[0]?.amount?.value;
  const currency = capture?.amount?.currency_code ?? raw.purchase_units?.[0]?.amount?.currency_code;

  let effectiveStatus: PayPalParsedOrder['effectiveStatus'] = 'pending';

  if (captureStatus) {
    if (captureStatus === 'COMPLETED') {
      effectiveStatus = 'paid';
    } else if (captureStatus === 'PENDING') {
      effectiveStatus = 'pending_paypal';
    } else if (captureStatus === 'REFUNDED' || captureStatus === 'PARTIALLY_REFUNDED') {
      // Money came in and has since gone back out — never credit an open row for it.
      effectiveStatus = 'refunded';
    } else if (['DECLINED', 'FAILED'].includes(captureStatus)) {
      effectiveStatus = 'failed';
    }
  } else if (orderStatus === 'COMPLETED') {
    // Without capture details, do NOT consider paid
    effectiveStatus = 'pending';
  } else if (orderStatus === 'VOIDED') {
    effectiveStatus = 'expired';
  } else if (orderStatus === 'PENDING') {
    effectiveStatus = 'pending_paypal';
  } else {
    // CREATED, SAVED, APPROVED, PAYER_ACTION_REQUIRED
    effectiveStatus = 'pending';
  }

  return {
    orderId,
    orderStatus,
    captureStatus,
    captureId,
    amount,
    currency,
    customId,
    effectiveStatus,
  };
}

/**
 * Verify a gateway order actually belongs to the payment row we hold before crediting it.
 *
 * Amount and currency alone are not enough: two users can create orders for the same nominal
 * value, so a webhook naming someone else's order would otherwise be credited to us. The order
 * id must be the one we stored, and the `custom_id` we set at creation must be this payment's id.
 */
export function capturedOrderMatches(
  o: PayPalParsedOrder,
  expected: { id: string; externalId: string | null; amountCents: number; currency: string },
): boolean {
  if (!o.orderId || o.orderId !== expected.externalId) return false;
  if (o.customId) {
    if (o.customId !== expected.id) return false;
  } else if (process.env.PAYPAL_REQUIRE_CUSTOM_ID === '1') {
    return false;
  } else {
    // PayPal has been seen to omit custom_id on some orders. Until sandbox confirms it always
    // comes back, degrade to order-id + amount binding instead of flagging every payment.
    console.warn(`[paypal] order ${o.orderId} returned no custom_id; binding check is order id + amount`);
  }
  return capturedAmountMatches(o, expected);
}

export const PAYPAL_AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

/**
 * Parse a PayPal amount string into integer cents, computing from the digits rather than
 * `Math.round(Number(x) * 100)` — a float multiply can land a cent low (8.7 * 100 = 869.999…),
 * which would silently under-credit. Throws on any format PayPal should never send, so a
 * surprise value is surfaced instead of guessed at.
 */
export function paypalAmountToCents(amount: string): number {
  if (!PAYPAL_AMOUNT_RE.test(amount)) {
    throw new Error(`Unexpected PayPal amount format: ${JSON.stringify(amount)}`);
  }
  const [whole, frac = ''] = amount.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  return Number(whole) * 100 + Number(fracPadded);
}

/** Format integer cents as a PayPal amount string. PayPal accepts only whole cents. */
export function centsToPaypalAmount(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`Invalid PayPal amount in cents: ${cents}`);
  }
  return (cents / 100).toFixed(2);
}

function capturedAmountMatches(
  o: PayPalParsedOrder,
  expected: { amountCents: number; currency: string },
): boolean {
  if (!o.amount || !o.currency) return false;
  let cents: number;
  try {
    cents = paypalAmountToCents(o.amount);
  } catch {
    return false;
  }
  return cents === expected.amountCents && o.currency === expected.currency;
}

// ── API Functions ─────────────────────────────────────

/**
 * Create a PayPal checkout order.
 * Uses `PayPal-Request-Id` for PayPal side idempotency.
 */
export async function createOrder(params: {
  amount: string;
  currency: string;
  paymentId: string;
  idempotencyKey: string;
  returnUrl?: string;
  cancelUrl?: string;
}): Promise<PayPalOrderResult> {
  if (!PAYPAL_AMOUNT_RE.test(params.amount)) {
    throw new Error(`Unexpected PayPal amount format: ${JSON.stringify(params.amount)}`);
  }

  const token = await getAccessToken();

  const res = await fetch(`${getBaseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': params.idempotencyKey,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: params.paymentId,
          amount: {
            currency_code: params.currency,
            value: params.amount,
          },
        },
      ],
      ...(params.returnUrl || params.cancelUrl
        ? {
            payment_source: {
              paypal: {
                experience_context: {
                  ...(params.returnUrl ? { return_url: params.returnUrl } : {}),
                  ...(params.cancelUrl ? { cancel_url: params.cancelUrl } : {}),
                },
              },
            },
          }
        : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as {
      name?: string;
      message?: string;
      details?: Array<{ issue: string; description: string }>;
    };
    throw new PayPalApiError(
      errorData.message ?? `PayPal createOrder HTTP ${res.status}`,
      res.status,
      errorData.details,
    );
  }

  const data = (await res.json()) as {
    id: string;
    links?: Array<{ href: string; rel: string }>;
  };

  const approveLink = data.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
  if (!approveLink) {
    // Without an approval URL the buyer has nowhere to go; returning '' would surface as a
    // broken checkout instead of a gateway error. Fail loudly so the row is marked failed.
    throw new Error(`PayPal order ${data.id} returned no approve/payer-action link`);
  }

  return {
    orderId: data.id,
    approveUrl: approveLink,
  };
}

/**
 * Capture payment for an approved order.
 * Returns parsed order status details including underlying capture status.
 *
 * `paymentId` is sent as the `PayPal-Request-Id` idempotency key so a retried request (e.g. after
 * a client timeout) is not charged twice. `Prefer: return=representation` asks PayPal to include
 * the capture in the response; if it still comes back without one, the order is re-read.
 */
export async function captureOrder(orderId: string, paymentId?: string): Promise<PayPalParsedOrder> {
  const token = await getAccessToken();

  const res = await fetch(`${getBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(paymentId ? { 'PayPal-Request-Id': `capture:${paymentId}` } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as {
      name?: string;
      message?: string;
      details?: Array<{ issue: string; description: string }>;
    };
    throw new PayPalApiError(
      errorData.message ?? `PayPal captureOrder HTTP ${res.status}`,
      res.status,
      errorData.details,
    );
  }

  const data = await res.json();
  const parsed = interpretOrder({ id: orderId, ...data });

  // No capture details in the response: read the order to learn the real outcome rather than
  // guessing from the top-level order status alone.
  if (!parsed.captureStatus) {
    return getOrder(orderId);
  }

  return parsed;
}

/**
 * Retrieve order details for verification or reconciliation.
 * Returns parsed order status details including underlying capture status.
 */
export async function getOrder(orderId: string): Promise<PayPalParsedOrder> {
  const token = await getAccessToken();

  const res = await fetch(`${getBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as {
      name?: string;
      message?: string;
      details?: Array<{ issue: string; description: string }>;
    };
    throw new PayPalApiError(
      errorData.message ?? `PayPal getOrder HTTP ${res.status}`,
      res.status,
      errorData.details,
    );
  }

  const data = await res.json();
  return interpretOrder({ id: orderId, ...data });
}

export interface PayPalCaptureInfo {
  captureId: string;
  orderId?: string;
  customId?: string;
  status?: string;
}

/**
 * Retrieve a capture by ID. Used to resolve the order behind a refund / reversal / dispute
 * webhook when the payload itself does not carry the order ID.
 * The capture ID is validated before it is interpolated into the URL path.
 */
export async function getCapture(captureId: string): Promise<PayPalCaptureInfo> {
  if (!/^[A-Za-z0-9]+$/.test(captureId)) {
    throw new Error(`Invalid PayPal capture id: ${captureId}`);
  }

  const token = await getAccessToken();

  const res = await fetch(`${getBaseUrl()}/v2/payments/captures/${captureId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as {
      name?: string;
      message?: string;
      details?: Array<{ issue: string; description: string }>;
    };
    throw new PayPalApiError(
      errorData.message ?? `PayPal getCapture HTTP ${res.status}`,
      res.status,
      errorData.details,
    );
  }

  const data = (await res.json()) as {
    id?: string;
    status?: string;
    custom_id?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
  };

  return {
    captureId: data.id ?? captureId,
    orderId: data.supplementary_data?.related_ids?.order_id,
    customId: data.custom_id,
    status: data.status,
  };
}

/**
 * Detect if an error from PayPal capture API indicates that the order was already captured.
 */
export function isAlreadyCapturedError(err: unknown): boolean {
  if (err instanceof PayPalApiError) {
    if (err.status === 422) {
      if (err.details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED')) {
        return true;
      }
      if (err.message.includes('ORDER_ALREADY_CAPTURED')) {
        return true;
      }
    }
  }
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    if ((err as { message: string }).message.includes('ORDER_ALREADY_CAPTURED')) {
      return true;
    }
  }
  return false;
}

/**
 * Detect a definitive client error: PayPal rejected the request itself (4xx) and retrying the
 * same call will not help. 408 (timeout) and 429 (rate limit) are excluded — those are
 * transient and the outcome of the capture is still unknown.
 */
export function isDefinitiveClientError(err: unknown): boolean {
  return err instanceof PayPalApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429;
}

/**
 * Detect `INSTRUMENT_DECLINED` (422): the buyer's funding source was rejected. The buyer can
 * retry with another method, so the caller releases its claim instead of failing the payment.
 */
export function isInstrumentDeclinedError(err: unknown): boolean {
  if (!(err instanceof PayPalApiError)) return false;
  if (err.status !== 422) return false;
  if (err.details?.some((d) => d.issue === 'INSTRUMENT_DECLINED')) return true;
  return err.message.includes('INSTRUMENT_DECLINED');
}

/**
 * Verify PayPal webhook signature via PayPal POST /v1/notifications/verify-webhook-signature API endpoint.
 */
export async function verifyWebhookSignature(params: {
  headers: Record<string, string | undefined>;
  body: any;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error('[paypal] PAYPAL_WEBHOOK_ID is not set — rejecting webhook');
    return false;
  }

  for (const key of PAYPAL_TRANSMISSION_HEADERS) {
    if (!params.headers[key]) return false;
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(`${getBaseUrl()}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: params.headers['paypal-auth-algo'],
        cert_url: params.headers['paypal-cert-url'],
        transmission_id: params.headers['paypal-transmission-id'],
        transmission_sig: params.headers['paypal-transmission-sig'],
        transmission_time: params.headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: params.body,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return false;
    const data = (await res.json()) as { verification_status?: string };
    return data.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('[paypal] Webhook signature verification error:', err);
    return false;
  }
}
