# Payment Audit — Phase 5 Pre-Go-Live Hardening Report

This report summarizes the execution, code verification, test results, and operational checklists for Phase 5 Addendum (Revision 2) of the Morphic payment integrity audit.

---

## 1. Task Execution & Commits Summary

| Task | Commit | Key Files Modified | Test Results & Assumptions |
|---|---|---|---|
| **P5-1** | `3e6de89` | `apps/api/package.json`<br>`apps/api/src/lib/test-guard.ts`<br>`apps/api/src/lib/test-guard.test.ts`<br>`.env.test.example`<br>`.gitignore` | **6/6 tests PASS.** Test runner strictly enforces `--env-file=../../.env.test` and `--import ./src/lib/test-guard.ts`. Aborts with exit code 1 if production, if `ALLOW_TEST_DB_WRITE !== '1'`, or if host not in allowlist. |
| **P5-2** | `1bdde90` | `apps/api/src/routes/payments.ts`<br>`apps/api/src/routes/paypal-capture-hardening.test.ts` | **3/3 tests PASS.** In `GET /paypal/verify/:paymentId`, added `if (order.captureId) await saveCaptureId(paymentId, order.captureId);` immediately before `fulfilPayment`. |
| **P5-3** | `d6b53ed` | `apps/api/src/routes/payments.ts`<br>`apps/api/src/routes/paypal-create-order.test.ts` | **4/4 tests PASS.** Hardcoded `paymentCurrency = 'USD' as const` and derived `amountStr` directly from `payment.amountCents`. Discarded all client body currency/amount inputs. Validated 16,000 IDR/USD rate, $1.00 clamp, and rounding. |
| **P5-4** | `8e0bd0e` | `apps/api/src/routes/security.test.ts` | **1/1 test PASS.** Verified that an account with `suspended = true` and an `active` API key is blocked with HTTP 403 `account_suspended` on inference endpoints (`/v1/models`, `/v1/chat/completions`), and that unsuspending immediately restores access. |
| **P5-5** | `9b0750b` | `apps/api/src/lib/ip.ts`<br>`apps/api/src/app.ts`<br>`DEPLOYMENT_VPS.md`<br>`apps/api/src/lib/ip.test.ts` | **4/4 tests PASS.** Gated `cf-connecting-ip` behind `TRUST_CF_CONNECTING_IP === '1'` (default 0). Webhook rate limiter skips requests if IP is `unknown` or loopback (`127.0.0.1`, `::1`) to prevent shared bucket exhaustion. Created `DEPLOYMENT_VPS.md`. |
| **P5-6** | `38e0fd7` | `apps/web/src/components/PayPalButton.tsx`<br>`apps/web/src/app/dashboard/billing/checkout-modal.tsx`<br>`apps/web/src/app/dashboard/billing/billing-view.tsx`<br>`apps/web/src/app/receipt/[id]/page.tsx`<br>`apps/web/src/lib/i18n/locales/en.ts`<br>`apps/web/src/lib/i18n/locales/id.ts` | **`tsc --noEmit` PASS (0 errors).** Handles 202 `processing`, 422 `instrument_declined`, 409 conflict, and `needs_review` support display with max polling duration (~6 min). Added localized badges for `needs_review`, `disputed`, `refunded`. Receipt page allows `paid`, `refunded`, `disputed` with preserved `userId` filter. |
| **P5-7** | `f13e19e` | `OPERATOR_RUNBOOK.md`<br>`scripts/test-telegram-alert.ts` | Created comprehensive runbook for scenarios A to H with verified SQL templates and proportional clawback formulas. Created diagnostic alert test script. |
| **P5-7b**| `55eb0f0` | `apps/api/src/lib/alert.ts`<br>`apps/api/src/lib/alert.test.ts` | **5/5 tests PASS.** Implemented `escapeTelegramHtml` and `sanitizeTelegramHtml` strictly escaping `&` -> `&amp;`, `<` -> `&lt;`, `>` -> `&gt;` while preserving intentional HTML tags (`<b>`, `<code>`, `<i>`, `<a>`). Logged non-2xx status and description. |
| **P5-9** | *N/A* | None | **CONDITIONAL — NOT triggered.** PayPal sandbox has not reported rejection of the `capture:<uuid>` `PayPal-Request-Id` format. Left unchanged. |

---

## 2. Stopped / Blocked Tasks

No tasks were blocked or stopped. Task P5-9 was conditional and was not executed because the prerequisite failure condition (sandbox rejection of request ID format) did not occur.

---

## 3. Detailed Answers to Audit Questions

### P5-1: Test Database Isolation & Safety
- **Does the test DB host equal the application DB host?**
  Yes. In developer environments with `.env`, both point to the Neon database host.
- **How was load order proven?**
  `apps/api/package.json` specifies:
  ```json
  "test": "tsx --import ./src/lib/test-guard.ts --test --env-file=../../.env.test src/**/*.test.ts"
  ```
  The Node.js `--import` flag loads and executes `./src/lib/test-guard.ts` before any test file is imported. `test-guard.ts` synchronously validates `DATABASE_URL` against `TEST_DB_HOST_ALLOWLIST` (or loopback hosts `localhost`, `127.0.0.1`, `::1`) and verifies `ALLOW_TEST_DB_WRITE === '1'`, immediately terminating the process (`process.exit(1)`) if safeguards fail. This was verified with 6/6 unit tests in `test-guard.test.ts`.
- **Leftover-Test-Data Inspection Queries (for Operator):**
  ```sql
  -- Inspect mock/test payments created during previous test runs:
  SELECT id, user_id, provider, external_id, amount_cents, currency, status, created_at 
  FROM payments 
  WHERE external_id LIKE 'test-%' OR external_id LIKE 'mock-%' OR external_id LIKE 'temp:%'
  ORDER BY created_at DESC;

  -- Inspect mock/test users:
  SELECT id, email, role, suspended, created_at 
  FROM users 
  WHERE email LIKE '%@test.local' OR email LIKE '%@example.com' OR name LIKE 'Test%'
  ORDER BY created_at DESC;
  ```

### P5-2: PayPal Capture ID Persistence Paths
- `POST /v1/payments/paypal/capture` (`apps/api/src/routes/payments.ts:607`): **YES**, calls `saveCaptureId(paymentId, paypalOrder.captureId)` before `fulfilPayment`.
- `GET /v1/payments/paypal/verify/:paymentId` (`apps/api/src/routes/payments.ts:695`): **YES**, updated in P5-2 to call `saveCaptureId(paymentId, order.captureId)` before `fulfilPayment`.
- Background Reconcile `settlePaypalPayment` (`apps/api/src/lib/paypal-reconcile.ts:101`): **NO**, calls `fulfilPayment(payment.id)` without persisting `captureId`. Recorded in `OUT_OF_SCOPE_FINDINGS.md`.
- Webhook `PAYMENT.CAPTURE.COMPLETED` (`apps/api/src/routes/webhooks.ts:365`): Captures are stored, and `paypal-post-payment.ts:445` backfills `capture_id` if missing.

### P5-3: USD Conversion & Guard Confirmation
- **Conversion Constants:**
  - Rate constant: `IDR_PER_USD = 16_000` (`packages/shared/src/credits.ts:8`).
  - $1.00 clamp: `Math.max(100, Math.round((priceIdr / IDR_PER_USD) * 100))` (`packages/shared/src/credits.ts:25`).
  - Rounding: Standard mathematical rounding to nearest integer USD cent.
- **Where rate/amount is locked:** On the `payments` record (`amountCents = usdAmountCents`, `currency = 'USD'`) in `apps/api/src/routes/payments.ts:407`.
- **Where the guard lives:** `apps/api/src/routes/payments.ts:394, 414` derives `paymentCurrency = 'USD' as const` and `amountStr = paypal.centsToPaypalAmount(payment.amountCents)`, ignoring any client request body values.
- **Does UI show USD before approval?**
  Yes. `apps/web/src/app/dashboard/billing/checkout-modal.tsx:177, 478, 549` displays `$ {usdPrice} USD` on the package selector and directly above the PayPal button.

### P5-5: Client IP Behind Reverse Proxy (VPS)
- **Headers Read & Order:** `cf-connecting-ip` (only when `TRUST_CF_CONNECTING_IP === '1'`), then `x-forwarded-for` (last hop extracted), falling back to `'unknown'`.
- **Unconditional `cf-connecting-ip` trust?** No. Disabled by default unless explicitly opted in.
- **Limiter behavior on loopback/unknown:** In `apps/api/src/app.ts:38`, requests with loopback IPs (`127.0.0.1`, `::1`) or `'unknown'` bypass the webhook rate limiter, preventing legitimate retry bursts from PayPal from sharing and exhausting a single bucket when behind an Nginx proxy.

### P5-6: Frontend Response Handling & Polling Constants
- **Exact Response Shapes:**
  - 202 `processing`: switches modal to verifying state, disables PayPal button, and starts polling without triggering an error.
  - 422 `instrument_declined`: displays a friendly card decline message and keeps the checkout modal open for card retry.
  - 409 conflict: triggers a single status verification refresh without retry looping.
  - `needs_review`: renders an alert card displaying the payment ID with a copy button and support instructions.
- **Polling Constants:**
  - `POLL_INTERVAL_MS = 3000` (3s base interval).
  - `MAX_POLL_ATTEMPTS = 60` with adaptive backoff: attempts 1–19 at 3s (60s), 20–39 at 6s (120s), 40–60 at 10s (200s). Total duration: 380s (~6.3 minutes).

### P5-7 & P5-7b: Runbook, Credits, and Alerting Findings
- **Which statuses `processPaymentSuccess` accepts:**
  Strictly `['pending', 'pending_paypal', 'capturing', 'failed', 'expired']` (`packages/db/src/billing.ts:444`). Any payment with status `needs_review`, `disputed`, or `refunded` returns `{ success: false, credits: 0 }`.
- **Does admin credit-adjust allow negative balance?**
  Yes. In `packages/db/src/schema.ts:210`, `balances.credits` has no non-negative constraint (`CHECK (credits >= 0)`). `writeBalanceLedger` (`packages/db/src/billing.ts:68`) performs atomic addition `sql`${s.balances.credits} + ${entry.amount}``, which safely drives balances negative during clawbacks.
- **`lib/alert.ts` Findings:**
  - Telegram Parse Mode: `'HTML'`.
  - Message construction: Template literals in health monitor; dynamic strings in ops alerts.
  - Non-2xx reply: Now logs `[alert] Telegram notification failed (${res.status}): ${description}` without logging bot tokens.
  - Generic Webhook: Unaffected; receives the raw, unescaped payload.
  - Mocked-transport tests: 5/5 unit tests PASS (`apps/api/src/lib/alert.test.ts`), verifying strict escape order (`&` -> `&amp;`, `<` -> `&lt;`, `>` -> `&gt;`) and retention of valid HTML tags (`<b>`, `<code>`, `<i>`, `<a>`).

---

## 4. Additions to `OUT_OF_SCOPE_FINDINGS.md`

1. **`settlePaypalPayment` in reconcile does not persist `captureId`** (`apps/api/src/lib/paypal-reconcile.ts:101`).
2. **API PDF receipt route filters strictly on `status = 'paid'`** (`apps/api/src/routes/payments.ts:238`).

---

## 5. Key Code Excerpts

### A. Verify Route (`apps/api/src/routes/payments.ts:693-704`)
```typescript
if (!paypal.capturedOrderMatches(order, payment)) {
  await flagPaymentNeedsReview(payment, {
    reason: 'amount/currency/order-binding mismatch on verify',
    orderId: order.orderId,
    customId: order.customId,
    amount: order.amount,
    currency: order.currency,
  });
  return c.json({ status: 'pending', message: 'Payment is being verified.' });
}

if (order.captureId) await saveCaptureId(paymentId, order.captureId);

// Rescue path: processPaymentSuccess can rescue open, failed, or expired payment rows to 'paid'
const res = await fulfilPayment(paymentId);
if (res.success) {
  payment.status = 'paid';
  payment.paidAt = new Date();
  return c.json({ status: 'paid', recovered: true, credits: payment.credits });
}
```

### B. `getTrustedClientIp` (`apps/api/src/lib/ip.ts:22-44`)
```typescript
export function getTrustedClientIp(c: Context): string {
  // 1. Cloudflare header — only trusted when explicitly opted in
  if (process.env.TRUST_CF_CONNECTING_IP === '1') {
    const cf = c.req.header('cf-connecting-ip');
    if (cf) return cf.trim();
  }

  // 2. X-Forwarded-For: trust only the rightmost entry appended by our reverse proxy
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  return 'unknown';
}
```

### C. PayPal USD Guard (`apps/api/src/routes/payments.ts:392-424`)
```typescript
// Step 4: Determine USD cents amount (IDR packages converted at IDR_PER_USD)
const usdAmountCents = packagePriceUsdCents(pkg.priceCents, pkg.currency);
const paymentCurrency = 'USD' as const;

// Step 5: Generate idempotency key & insert new pending payment row
const idempotencyKey = randomUUID();

const [payment] = await db
  .insert(s.payments)
  .values({
    userId,
    provider: 'paypal',
    externalId: `temp:${idempotencyKey}`,
    packageId: pkg.id,
    amountCents: usdAmountCents,
    currency: paymentCurrency,
    credits: pkg.creditAllowance ?? 0,
    status: 'pending',
  })
  .returning();

// Step 6: Call PayPal createOrder API using the exact integer cents stored on the row
const amountStr = paypal.centsToPaypalAmount(payment.amountCents);

let paypalResult;
try {
  paypalResult = await paypal.createOrder({
    amount: amountStr,
    currency: paymentCurrency,
    paymentId: payment.id,
    idempotencyKey,
  });
...
```
