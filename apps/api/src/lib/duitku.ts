import { createHmac, timingSafeEqual } from 'node:crypto';

// ── Config ────────────────────────────────────────────

function getMerchantCode(): string {
  const code = process.env.DUITKU_MERCHANT_CODE;
  if (!code) throw new Error('DUITKU_MERCHANT_CODE is not set');
  return code;
}

function getApiKey(): string {
  const key = process.env.DUITKU_API_KEY;
  if (!key) throw new Error('DUITKU_API_KEY is not set');
  return key;
}

function baseUrl(): string {
  const env = process.env.DUITKU_ENV ?? 'sandbox';
  return env === 'production'
    ? 'https://passport.duitku.com/webapi'
    : 'https://sandbox.duitku.com/webapi';
}

function hmacSha256(data: string, key: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

// ── Create Transaction ────────────────────────────────

export interface CreateTransactionParams {
  merchantOrderId: string;   // unique ID from our side
  paymentAmount: number;     // integer IDR, no decimals
  productDetails: string;    // e.g. "Morphic Credits - Paket Hemat"
  email: string;             // customer email
  customerVaName: string;    // name shown on bank confirmation
  callbackUrl: string;       // webhook URL (must be public HTTPS)
  returnUrl: string;         // redirect after payment
  expiryPeriod?: number;     // minutes, default 60
  paymentMethod?: string;    // e.g. 'SP' (ShopeePay QRIS), leave blank for all
}

export interface CreateTransactionResult {
  paymentUrl: string;
  reference: string;
  statusCode: string;
  statusMessage: string;
}

/**
 * Create a Duitku transaction.
 * Signature: HMAC_SHA256(merchantCode + merchantOrderId + paymentAmount, apiKey)
 * Docs: https://docs.duitku.com/api/id/#create-invoice
 */
export async function createTransaction(
  params: CreateTransactionParams,
): Promise<CreateTransactionResult> {
  const merchantCode = getMerchantCode();
  const apiKey = getApiKey();

  const stringToSign = `${merchantCode}${params.merchantOrderId}${params.paymentAmount}`;
  const signature = hmacSha256(stringToSign, apiKey);

  const body: Record<string, unknown> = {
    merchantCode,
    paymentAmount: params.paymentAmount,
    merchantOrderId: params.merchantOrderId,
    productDetails: params.productDetails,
    email: params.email,
    customerVaName: params.customerVaName,
    callbackUrl: params.callbackUrl,
    returnUrl: params.returnUrl,
    signature,
    expiryPeriod: params.expiryPeriod ?? 60,
  };

  if (params.paymentMethod) {
    body.paymentMethod = params.paymentMethod;
  }

  const url = `${baseUrl()}/api/merchant/v2/inquiry`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Duitku createTransaction HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as {
    paymentUrl?: string;
    reference?: string;
    statusCode?: string;
    statusMessage?: string;
    Message?: string;
  };

  if (data.statusCode !== '00') {
    throw new Error(`Duitku createTransaction failed: ${data.statusMessage ?? data.Message ?? 'unknown error'}`);
  }

  return {
    paymentUrl: data.paymentUrl!,
    reference: data.reference!,
    statusCode: data.statusCode!,
    statusMessage: data.statusMessage!,
  };
}

// ── Check Transaction Status ──────────────────────────

export interface TransactionStatus {
  merchantOrderId: string;
  reference: string;
  amount: string;
  statusCode: string;   // '00' success, '01' pending, '02' cancelled
  statusMessage: string;
}

/**
 * Check Duitku transaction status.
 * Signature: HMAC_SHA256(merchantCode + merchantOrderId, apiKey)
 * Docs: https://docs.duitku.com/api/id/#check-transaction
 */
export async function checkTransactionStatus(
  merchantOrderId: string,
): Promise<TransactionStatus> {
  const merchantCode = getMerchantCode();
  const apiKey = getApiKey();

  const signature = hmacSha256(`${merchantCode}${merchantOrderId}`, apiKey);

  const params = { merchantCode, merchantOrderId, signature };

  const url = `${baseUrl()}/api/merchant/transactionStatus`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Duitku checkTransaction HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as TransactionStatus & { Message?: string };
  return data;
}

// ── Verify Inbound Callback Signature ────────────────

export interface DuitkuCallbackPayload {
  merchantCode: string;
  amount: string;
  merchantOrderId: string;
  productDetail: string;
  additionalParam?: string;
  paymentCode: string;
  resultCode: string;      // '00' success, '01' failed
  merchantUserId?: string;
  reference: string;
  publisherOrderId?: string;
  signature: string;
  spUserHash?: string;
  settlementDate?: string;
  issuerCode?: string;
  customerName?: string;
}

/**
 * Verify Duitku callback signature (inbound webhook).
 * Formula: HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)
 * Note: ORDER IS DIFFERENT from create-transaction signature.
 */
export function verifyCallbackSignature(payload: DuitkuCallbackPayload): boolean {
  const apiKey = getApiKey();
  const stringToSign = `${payload.merchantCode}${payload.amount}${payload.merchantOrderId}`;
  const expected = hmacSha256(stringToSign, apiKey);

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(payload.signature, 'hex'),
    );
  } catch {
    return false;
  }
}
