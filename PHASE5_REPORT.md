# Payment Audit — Phase 5 Pre-Go-Live Hardening Report (Updated)

This report provides the full evidence, code traces, test demonstrations, and operational analyses for Phase 5 Pre-Go-Live Hardening, incorporating the user audit review directives.

---

## 1. Executive Status & Audit Overview

Phase 5 code hardening tasks (P5-1 through P5-7b) are fully implemented, verified, and strictly isolated within approved allowlists.

### Status of Remaining Work
- **P5-8 (Operator Pre-Flight Verification):** This task requires live operator credentials and dashboard interaction (Neon production DB inspection, PayPal Developer Dashboard webhook subscriptions, PayPal account USD receiving preferences, sandbox dispute simulation, and live Telegram notification delivery). It cannot be simulated solely by code and must be executed by the operator following [OPERATOR_RUNBOOK.md](file:///home/rose/projects/morphic/OPERATOR_RUNBOOK.md).
- **P5-9 (Request-ID UUID Format):** Conditional task. Left untouched as the PayPal Sandbox did not reject the `capture:<uuid>` idempotency format.
- **Out-of-Scope Items:**
  - `gateway.test.ts` rate limit timing sensitivity against slow network DBs.
  - Receipt PDF route `/v1/payments/:id/receipt` filtering `status = 'paid'` (returns 404 for refunded/disputed, while web UI displays them; does not pose a financial risk).

---

## 2. Resolutions to Review Directives

### 1. Package Pricing & Currency Safeguards
**Concern:** If an active package has `price_cents` null/<=0 or an unsupported currency, it could be sold for $1.00 (`Math.max(100, ...)`) with full credit allowance.

#### A. Database Query Verification
The requested query was executed directly against the active database:
```sql
SELECT id, name, price_cents, currency, status, credit_allowance, model_id
FROM packages
WHERE status = 'active'
  AND (price_cents IS NULL OR price_cents <= 0 OR currency NOT IN ('IDR','USD'));
```
**Result:** `rowCount: 0` (`rows: []`). There are **zero** active packages in the database with null/<=0 price or non-IDR/USD currency.

#### B. Step 1–3 Route Inspection & Hardening
In both [payments.post('/create')](file:///home/rose/projects/morphic/apps/api/src/routes/payments.ts#L94-L115) (Duitku) and [payments.post('/paypal/create-order')](file:///home/rose/projects/morphic/apps/api/src/routes/payments.ts#L370-L395):
1. **Package Existence & Status:**
   ```typescript
   const [pkg] = await db
     .select()
     .from(s.packages)
     .where(and(eq(s.packages.id, packageId), eq(s.packages.status, 'active')))
     .limit(1);
   if (!pkg) return c.json({ error: { message: 'package not found or inactive', code: 'package_not_found' } }, 404);
   ```
2. **Price Validation:**
   ```typescript
   if (!pkg.priceCents || pkg.priceCents <= 0) {
     return c.json({ error: { message: 'package has no price set', code: 'package_no_price' } }, 400);
   }
   ```
   *Any package with null, 0, or negative price is rejected with HTTP 400 before conversion.*
3. **Currency Safeguard (Added):**
   ```typescript
   if (pkg.currency !== 'IDR' && pkg.currency !== 'USD') {
     return c.json({ error: { message: 'unsupported package currency', code: 'invalid_currency' } }, 400);
   }
   ```
   *Any currency other than IDR or USD is immediately rejected with HTTP 400 `invalid_currency`, preventing accidental IDR fallback treatment.*

---

### 2. Capture ID Persistence in Reconcile
**Concern:** Background reconciliation salvages payments but must store `captureId` so late webhook disputes can be matched.

#### Findings & Fix:
- Line 87 of [apps/api/src/lib/paypal-reconcile.ts](file:///home/rose/projects/morphic/apps/api/src/lib/paypal-reconcile.ts#L87) already executed `if (order.captureId) await saveCaptureId(payment.id, order.captureId);` right after `getOrder`.
- To provide double assurance, an explicit call was added directly inside `case 'paid':` right before `fulfilPayment`:
  ```typescript
  case 'paid': {
    if (!capturedOrderMatches(order, payment)) {
      await flagPaymentNeedsReview(...);
      return 'needs_review';
    }
    if (order.captureId) await saveCaptureId(payment.id, order.captureId);
    return (await fulfilPayment(payment.id)).success ? 'paid' : null;
  }
  ```
- **Automated Verification:** Added assertion in [apps/api/src/routes/paypal-reconcile.test.ts:411](file:///home/rose/projects/morphic/apps/api/src/routes/paypal-reconcile.test.ts#L411):
  ```typescript
  const after = await refetchPayment(payment.id);
  assert.equal(after?.status, 'paid');
  assert.ok(after?.captureId, 'captureId must be persisted by reconcile before fulfillment');
  ```
- **Out of Scope List:** Item 2 was removed from [OUT_OF_SCOPE_FINDINGS.md](file:///home/rose/projects/morphic/apps/api/OUT_OF_SCOPE_FINDINGS.md).

---

### 3. Telegram HTML Alert Hardening & 400 Fallback Retry
**Concern:** Preserving tags in dynamic messages can cause Telegram 400 parse errors on unmatched brackets or inject malicious links.

#### Implementation in [apps/api/src/lib/alert.ts](file:///home/rose/projects/morphic/apps/api/src/lib/alert.ts):
1. **Full Escaping by Default:** `sendTelegramAlert` defaults to 100% escaping with `escapeTelegramHtml(message)` (no HTML whitelist). Dynamic payment IDs, emails, error messages, and amounts are completely escaped.
2. **Opt-in for Internal Templates:** Only curated, internally formatted strings (e.g. `checkProviderHealth`) pass `{ isHtmlFormatted: true }` to retain tags (`<b>`, `<code>`, etc.).
3. **Automatic Plain-Text Fallback Retry on HTTP 400:**
   ```typescript
   if (res.status === 400) {
     const errBody = (await res.json().catch(() => ({}))) as { description?: string };
     console.warn(`[alert] Telegram returned 400 (${errBody?.description}). Retrying as plain text without parse_mode...`);

     const retryRes = await fetch(url, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ chat_id: chatId, text: message }), // Omit parse_mode
     });
     ...
     return;
   }
   ```
4. **Test Suite:** 6/6 tests passing in [apps/api/src/lib/alert.test.ts](file:///home/rose/projects/morphic/apps/api/src/lib/alert.test.ts), including verification of the fallback retry without `parse_mode`.

---

## 3. Test Database Isolation & Safety Proof (P5-1)

### A. Active Database Host
- Host in `.env`: `ep-jolly-paper-aekoqy1c-pooler.c-2.us-east-2.aws.neon.tech`.
- Default test allowlist: `['localhost', '127.0.0.1', '::1']`.
- Remote hosts are **NEVER** allowed unless explicitly supplied via `TEST_DB_HOST_ALLOWLIST` in `.env.test`.

### B. Negative Run Demonstration
To prove that `test-guard.ts` executes synchronously before test files or DB connections are loaded, we ran `pnpm test` with an unauthorized production-like host:
```bash
DATABASE_URL=postgresql://user:pass@ep-forbidden-production.neon.tech/neondb ALLOW_TEST_DB_WRITE=1 pnpm --filter @morphic/api test
```

#### Exact Output & Exit Status:
```text
> @morphic/api@0.0.1 test /home/rose/projects/morphic/apps/api
> tsx --import ./src/lib/test-guard.ts --test --env-file=../../.env.test src/**/*.test.ts

❌ FATAL TEST GUARD FAILURE:
[test-guard] Refusing to run tests: DATABASE_URL host (ep-forbidden-production.neon.tech) is not in allowlist: [localhost, 127.0.0.1, ::1]

✖ src/lib/alert.test.ts (2243ms)
...
✖ src/routes/payments.test.ts (2236ms)
...
ℹ tests 11
ℹ pass 0
ℹ fail 11
ℹ duration_ms 2303

/home/rose/projects/morphic/apps/api:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @morphic/api@0.0.1 test: `tsx --import ./src/lib/test-guard.ts --test --env-file=../../.env.test src/**/*.test.ts`
Exit status 1
```
**Conclusion:** All 11 worker processes were immediately terminated with exit code 1 during pre-import evaluation (`--import ./src/lib/test-guard.ts`). Zero tests, zero queries, and zero schema migrations reached the database.

---

## 4. `adjustUserCredits` Input & UI Validation Analysis

The clawback runbook relies on reducing credits via admin adjustment:
1. **Server Action Validation:**
   In [apps/web/src/lib/admin-actions.ts:46-59](file:///home/rose/projects/morphic/apps/web/src/lib/admin-actions.ts#L46-L59):
   ```typescript
   export async function adjustUserCredits(formData: FormData) {
     const admin = await requireAdmin();
     const id = String(formData.get('id'));
     const amount = Number(formData.get('amount'));
     if (!id || !Number.isFinite(amount) || amount === 0) return;
     await grantCredits({
       userId: id,
       amount,
       entryType: 'admin_adjustment',
       reference: `admin:${admin.id}`,
     });
     ...
   }
   ```
   *Analysis:* There is **no Zod schema** enforcing `amount > 0`. `Number.isFinite(-50000)` evaluates to `true` and `-50000 !== 0`, allowing negative numbers through without errors.
2. **Frontend UI Input:**
   In [apps/web/src/app/admin/users/users-table.tsx:160-167](file:///home/rose/projects/morphic/apps/web/src/app/admin/users/users-table.tsx#L160-L167):
   ```tsx
   <input
     id={`adjust-${u.id}`}
     name="amount"
     type="number"
     className="..."
     placeholder={t.admin.users.adjustPlaceholder}
   />
   ```
   *Analysis:* There is **no `min="1"` or `min="0"` attribute** on the `<input>`. An admin can type `-50000` and submit the form directly.
3. **Database Layer:**
   In [packages/db/src/billing.ts:68](file:///home/rose/projects/morphic/packages/db/src/billing.ts#L68):
   `const newBal = (bal?.credits ?? 0) + input.amount;` updates `balances.credits` directly. `balances.credits` in Postgres is `bigint` without a non-negative check constraint. Negative balances are fully supported.

---

## 5. Fixture-Derived Leftover Test Data Cleanup Queries

> [!CAUTION]
> Do NOT use `WHERE external_id LIKE 'temp:%'`.
> In Morphic's live PayPal checkout flow, every pending transaction starts as `temp:${idempotencyKey}` while contacting PayPal. Deleting `temp:%` can destroy active customer payments.

### Recommended Fixture-Derived Queries:
```sql
-- 1. Inspect payments created by automated test runners:
SELECT p.id, p.user_id, u.email, p.provider, p.external_id, p.amount_cents, p.currency, p.status, p.created_at
FROM payments p
JOIN users u ON p.user_id = u.id
WHERE u.email LIKE '%@test.local'
   OR u.email LIKE '%@test.dev'
   OR u.email LIKE 'tester-%'
   OR u.email LIKE 'test-user-%'
   OR u.email LIKE 'sec-user-%'
ORDER BY p.created_at DESC;

-- 2. Inspect mock packages created by tests:
SELECT id, name, price_cents, currency, status, credit_allowance
FROM packages
WHERE name LIKE 'T7 Package %'
   OR name LIKE 'USD Package %'
   OR name LIKE 'IDR Package %'
   OR name LIKE 'pkg-%'
ORDER BY created_at DESC;

-- 3. Safely archive test packages:
UPDATE packages
SET status = 'archived'
WHERE (name LIKE 'T7 Package %' OR name LIKE 'USD Package %' OR name LIKE 'IDR Package %')
  AND status = 'active';
```

---

## 6. VPS Deployment Nginx Configuration Snippet

From [DEPLOYMENT_VPS.md](file:///home/rose/projects/morphic/DEPLOYMENT_VPS.md#L21-L47):

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;          # Forward to internal Morphic API port
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;

    # Overwrite X-Forwarded-For with the true remote connection IP ($remote_addr).
    # Do NOT use $proxy_add_x_forwarded_for as external clients can inject forged IPs.
    proxy_set_header X-Forwarded-For $remote_addr;

    # Notify API that request arrived via HTTPS
    proxy_set_header X-Forwarded-Proto $scheme;

    # Clear CF-Connecting-IP header from external clients.
    # Prevents header spoofing attacks when Cloudflare CDN is not in use.
    proxy_set_header CF-Connecting-IP "";

    # Standard timeouts
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_connect_timeout 15s;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
}
```

### Production Loopback Warning Verification
In [apps/api/src/lib/ip.ts:38-41](file:///home/rose/projects/morphic/apps/api/src/lib/ip.ts#L38-L41):
```typescript
if (process.env.NODE_ENV === 'production' && isLoopbackIp(resolved) && !warnedLoopback) {
  warnedLoopback = true;
  console.warn('[ip] client IP resolved to loopback behind a reverse proxy; check nginx X-Forwarded-For');
}
```
`warnedLoopback` is a module-scoped boolean initialized to `false`. If the resolved IP is loopback in production, it warns exactly once per process.

---

## 7. Frontend UI Testing Notes

1. **PayPal Capture Modal States:**
   - **202 `processing`:** The modal switches to a spinner verifying state, disables the PayPal smart buttons, and initiates status polling every 3s.
   - **422 `instrument_declined`:** Displays a localized notice encouraging the user to try another card/funding instrument. The checkout modal remains open and re-enables the button.
   - **409 `conflict`:** A non-destructive refresh check occurs to reconcile payment status without getting stuck in an infinite retry loop.
   - **`needs_review`:** Displays a support card with the payment UUID and a one-click copy button, advising the user that payment verification is underway.
2. **Billing View & Badges:**
   - In `apps/web/src/app/dashboard/billing/billing-view.tsx`, transactions with `needs_review`, `disputed`, and `refunded` display designated status badges and formatted dates/credits.
3. **Receipt Page Access:**
   - In `apps/web/src/app/receipt/[id]/page.tsx`, viewing receipts for refunded or disputed transactions is permitted (with amber/red badges), while retaining the strict `userId` ownership check.

---

## 8. Git Diff Stat per Commit

All changes made during Phase 5 are strictly within allowed task boundaries:

```text
=== COMMIT: 3e6de89 ===
P5-1: isolate test database with strict .env.test and test-guard
 .env.test.example                          |  31 ++++++
 .gitignore                                 |   2 +
 apps/api/package.json                      |   2 +-
 apps/api/src/lib/test-guard.test.ts        | 111 +++++++++++++++++++++
 apps/api/src/lib/test-guard.ts             |  61 +++++++++++
 5 files changed, 206 insertions(+), 1 deletion(-)

=== COMMIT: 1bdde90 ===
P5-2: persist captureId in verify route before fulfilling payment
 apps/api/src/routes/payments.ts                     |  2 +
 apps/api/src/routes/paypal-capture-hardening.test.ts | 40 +++++++++++++++++++
 2 files changed, 42 insertions(+)

=== COMMIT: d6b53ed ===
P5-3: enforce server-derived USD currency and stored amount in PayPal create-order
 apps/api/src/routes/payments.ts                 |  9 +++++--
 apps/api/src/routes/paypal-create-order.test.ts | 47 +++++++++++++++++++++++++
 2 files changed, 52 insertions(+), 4 deletions(-)

=== COMMIT: 8e0bd0e ===
P5-4: add regression test ensuring suspended accounts cannot authenticate via API keys
 apps/api/src/routes/security.test.ts | 46 +++++++++++++++++++++++++++++++++++
 1 file changed, 46 insertions(+)

=== COMMIT: 9b0750b ===
P5-5: gate CF-Connecting-IP, avoid pooling webhook limiter on loopback, and add VPS deployment guide
 DEPLOYMENT_VPS.md           | 66 +++++++++++++++++++++++++++++++++++++++
 apps/api/src/app.ts         |  6 +++-
 apps/api/src/lib/ip.test.ts | 61 ++++++++++++++++++++++++++++++++++++
 apps/api/src/lib/ip.ts      | 36 ++++++++++++++++-----
 4 files changed, 158 insertions(+), 11 deletions(-)

=== COMMIT: 38e0fd7 ===
P5-6: update frontend handling for new payment statuses and capture responses
 apps/web/src/app/dashboard/billing/billing-view.tsx    |  77 ++++++--
 apps/web/src/app/dashboard/billing/checkout-modal.tsx  | 109 +++++++++++++--------
 apps/web/src/app/receipt/[id]/page.tsx                 |  29 ++++--
 apps/web/src/components/PayPalButton.tsx               | 212 ++++++++++++++++++++++++----------------
 apps/web/src/lib/i18n/locales/en.ts                    |   3 +
 apps/web/src/lib/i18n/locales/id.ts                    |   3 +
 6 files changed, 327 insertions(+), 106 deletions(-)

=== COMMIT: f13e19e ===
P5-7: add operator runbook and telegram alert test script
 OPERATOR_RUNBOOK.md           | 141 ++++++++++++++++++++++++++++++++++++++++++
 scripts/test-telegram-alert.ts |  42 +++++++++++++
 2 files changed, 183 insertions(+)

=== COMMIT: 55eb0f0 ===
P5-7b: escape dynamic content in telegram HTML alert messages
 apps/api/src/lib/alert.test.ts | 165 +++++++++++++++++++++++++++++++++++++++
 apps/api/src/lib/alert.ts      |  44 ++++++++-
 2 files changed, 205 insertions(+), 4 deletions(-)
```
