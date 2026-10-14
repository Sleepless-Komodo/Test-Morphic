# Morphic Payment Operator Runbook (Post-Payment & Exception Handling)

This runbook guides operators on managing payment exceptions, refunds, chargebacks, and discrepancies across Morphic's payment gateways (PayPal & Duitku).

---

## 1. System Alert Handling Matrix

| # | Alert / Situation | System State (Automatic) | Operator Action Required |
|---|---|---|---|
| **A** | **Refund**<br>`PAYMENT.CAPTURE.REFUNDED` | - If full refund: `payments.status = 'refunded'`<br>- If partial refund: `payments.status` stays `'paid'`, `payments.refunded_amount_minor_units` incremented.<br>- Account is **NOT** frozen automatically. | **Claw back credits manually** via the Admin Credit Adjustment tool with a **negative** amount.<br>Compute proportional credits: <br>$$\text{Clawback Credits} = \text{round}\left(\frac{\text{payments.credits} \times \text{refunded\_amount\_minor\_units}}{\text{payments.amount\_cents}}\right)$$<br>**Balance behavior:** The adjustment path **can drive balances negative** (verified in `packages/db/src/billing.ts:68`; no non-negative constraint on `balances.credits`).<br>**Entitlements:** If the package granted dedicated model entitlements (`entitlements` table), credit adjustments do **not** revoke entitlements. Revoke manually via Admin UI (`/admin/entitlements`) or SQL. |
| **B** | **Reversal / Dispute Opened**<br>`PAYMENT.CAPTURE.REVERSED`<br>`CUSTOMER.DISPUTE.CREATED` | - `payments.status = 'disputed'`<br>- `users.suspended = true`<br>- User API keys and dashboard access are immediately blocked with HTTP 403 `account_suspended`. | **Do NOT unsuspend the user.**<br>Log into PayPal Resolution Center, review dispute reason, and submit evidence (audit logs from `usage_records` and `request_logs`). |
| **C** | **Dispute Won (Seller Favor)**<br>`CUSTOMER.DISPUTE.RESOLVED` (Seller or `CANCELED_BY_BUYER`) | - `payments.status = 'paid'`<br>- Account remains **`suspended = true`** (no auto-unfreeze). | Review transaction history in Admin Dashboard (`/admin/users`).<br>If the account is in good standing and dispute is settled, unsuspend the user manually via `/admin/users` (toggle suspension button). |
| **D** | **Dispute Lost (Buyer Favor)**<br>`CUSTOMER.DISPUTE.RESOLVED` (Buyer favor) | - `payments.status = 'refunded'`<br>- `payments.refunded_amount_minor_units = payments.amount_cents`<br>- Account remains **`suspended = true`**. | 1. Claw back all credits originally granted using the formula in **A**.<br>2. Evaluate fraud risk before deciding whether to unsuspend or keep permanently suspended. |
| **E** | **Payment Needs Review**<br>`needs_review` | - `payments.status = 'needs_review'`<br>- **NO credits are granted.**<br>- Subsqeuent late `COMPLETED` webhooks return HTTP 200 without double crediting.<br>- Occurs on: currency mismatch, order binding mismatch, or capture already refunded while row is open. | **Investigate in PayPal Dashboard:**<br>1. Check if the funds actually settled in the PayPal account.<br>2. **If valid (benign mismatch):** Grant credits manually via Admin (`/admin/users`) and execute SQL Template E1 to update payment to `'paid'`.<br>3. **If fraudulent / invalid:** Execute SQL Template E2 to transition payment to `'failed'`.<br>*Note:* `processPaymentSuccess` deliberately **rejects** `needs_review` (only accepts `pending`, `pending_paypal`, `capturing`, `failed`, `expired`). Rows in `needs_review` will **never** be auto-credited. |
| **F** | **Open Payment >24h & Gateway Unreachable** | - Payment remains in its current open state (`pending`, `pending_paypal`, `capturing`).<br>- Not marked `expired`.<br>- Alert sent at most once per 24 hours per payment. | Check PayPal/Duitku status manually.<br>If the gateway is down, await recovery. Once reachable, the reconcile job or incoming webhook will automatically credit the payment. |
| **G** | **Unmatched Refund / Dispute Event** | - Event recorded in `payment_events` with `payment_id = NULL`.<br>- User account and balances are **not touched**. | 1. Find the PayPal capture ID or order ID from the alert payload in PayPal Dashboard.<br>2. Match with user payment manually.<br>3. If legitimate, perform credit adjustment and update account status manually. |
| **H** | **Dispute Resolved with Unrecognized Outcome** | - Payment remains `disputed`.<br>- Account remains `suspended = true`.<br>- Alert dispatched for human review. | Check outcome details in PayPal Resolution Center. Resolve manually via Admin Dashboard. |

---

## 2. Read-Only SQL: Payments Needing Attention

Run this query daily or upon alert notification to inspect payments requiring operational intervention:

```sql
-- Payments Needing Operator Attention
SELECT 
  p.id AS payment_id,
  p.user_id,
  u.email AS user_email,
  p.provider,
  p.status,
  p.currency,
  p.amount_cents,
  p.credits,
  p.capture_id,
  p.external_id,
  p.created_at,
  p.reconcile_checked_at,
  p.refunded_amount_minor_units
FROM payments p
INNER JOIN users u ON u.id = p.user_id
WHERE 
  p.status IN ('needs_review', 'disputed')
  OR (
    p.status IN ('pending', 'pending_paypal', 'capturing')
    AND p.created_at < NOW() - INTERVAL '24 hours'
  )
ORDER BY p.created_at DESC;
```

---

## 3. SQL Action Templates for `needs_review`

### Template E1: Approve Legitimate Payment in `needs_review`
Use this template **only** after confirming in PayPal Dashboard that the funds actually arrived and the mismatch was benign.

```sql
BEGIN;

-- 1. Verify current status and lock row
SELECT id, user_id, credits, amount_cents, status 
FROM payments 
WHERE id = '<PAYMENT_UUID>' AND status = 'needs_review'
FOR UPDATE;

-- 2. Mark payment as paid
UPDATE payments 
SET 
  status = 'paid', 
  paid_at = NOW(),
  reconcile_checked_at = NOW()
WHERE id = '<PAYMENT_UUID>' AND status = 'needs_review';

-- 3. Append credit ledger entry
INSERT INTO credit_ledger (
  user_id, 
  entry_type, 
  amount, 
  source_type, 
  reference, 
  created_at
) VALUES (
  '<USER_UUID>', 
  'admin_adjustment', 
  <CREDITS_AMOUNT>, 
  'balance', 
  'needs_review_approved:<PAYMENT_UUID>', 
  NOW()
);

-- 4. Increment cached credit balance
INSERT INTO balances (user_id, credits, updated_at)
VALUES ('<USER_UUID>', <CREDITS_AMOUNT>, NOW())
ON CONFLICT (user_id) DO UPDATE 
SET 
  credits = balances.credits + EXCLUDED.credits,
  updated_at = NOW();

COMMIT;
```

### Template E2: Reject / Fail Invalid Payment in `needs_review`
Use this template if the transaction was fraudulent, invalid, or money was not received.

```sql
BEGIN;

UPDATE payments 
SET 
  status = 'failed',
  reconcile_checked_at = NOW()
WHERE id = '<PAYMENT_UUID>' AND status = 'needs_review';

COMMIT;
```

---

## 4. Duitku / QRIS Refund Procedure (Manual)

Duitku **does not** provide an automated refund webhook for QRIS or Virtual Account payments.

1. **Verify Customer Request:** Match customer invoice ID (`morphic-...`) in Duitku Merchant Portal.
2. **Execute Refund:** Perform bank transfer / refund directly from company bank account or via Duitku Disbursement portal if configured.
3. **Claw Back Credits:**
   - Go to Admin Dashboard: `/admin/users`
   - Search for user email
   - Enter negative credit amount in the **Adjust Credits** form:
     $$\text{Deduction} = -(\text{payment.credits})$$
   - Submit form. Verify user's updated balance in `/admin/users`.
4. **Update DB Record:**
   ```sql
   UPDATE payments 
   SET 
     status = 'refunded', 
     refunded_amount_minor_units = amount_cents 
   WHERE id = '<PAYMENT_UUID>' AND status = 'paid';
   ```
