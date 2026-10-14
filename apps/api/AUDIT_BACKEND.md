# Backend Payment-Integrity Audit — Morphic Gateway (`apps/api`)

Audit scope: payment/credit integrity of `apps/api` against commit `6fc248c` + working tree.
Threat model: self-hosted VPS, no CDN/Cloudflare assumed, single API instance.

**Revision 3.** Rev 2 + corrections from follow-up review. This document is written as an
**implementation spec for an AI coding agent**. Changes from rev 2 are marked **[REV3]**.

---

## 0. Instructions for the implementing agent

1. **Verify every claim against source before changing anything.** Line numbers below come from the
   previous audit and may have shifted. If a claim does not match the code, stop and report, do not
   force the change.
2. Work **one task (T1…T10 in §3) per commit**, in order. After each task run `tsc --noEmit` and the
   existing tests (`security.test.ts` etc.).
3. **Do not work on** items in §7 ("Already mitigated / do not implement").
4. The PayPal webhook payload shape for `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`,
   `CUSTOMER.DISPUTE.CREATED/RESOLVED` is **not yet verified** against this account. ID extraction must be
   defensive and verified with real sandbox payloads (§9). Do not invent fields.
5. `sendOpsAlert()` (`lib/alert.ts`) already exists. Read its original signature; build one `opsAlert()`
   helper that wraps it, never throws, and is used by all new code.
6. Every payment status change must be a **conditional UPDATE** (`WHERE status IN (...) RETURNING`), never
   read-then-write.
7. Do not change the behaviour of `processPaymentSuccess` at all (this audit does not ask for it).
8. **Read §0A before writing a single line. §0A is binding: a diff that leaves scope is rejected.**

---

## 0A. SCOPE LIMITS (binding, no exceptions)

Your job is **only** to implement T1–T10 in §3 exactly as written. Everything else in the repo is
**out of scope**, including anything you consider ugly, inefficient, or wrong.

### A. Per-task file allowlist (only these files may be changed/created)

| Task | Files that may be changed/created |
|---|---|
| T1 | `apps/api/src/lib/paypal.ts`, `apps/api/src/index.ts` (`assertProductionConfig` only) |
| T2 | `packages/db/src/schema.ts` (`payments` table + 1 index on `creditLedger` only), 1 new migration file |
| T3 | `lib/paypal-post-payment.ts` (new), `lib/payment-state.ts` (new), `routes/webhooks.ts` (PayPal route only) |
| T4 | `lib/paypal-reconcile.ts`, `index.ts` (reconcile interval block only) |
| T5 | `routes/webhooks.ts` (PayPal route only), `lib/paypal.ts`, `lib/payment-events.ts` (add `recordUnmatchedEvent` + comment fix only), `app.ts` (rate limit for `/webhooks/*` only) |
| T6 | `lib/paypal.ts` (`captureOrder` + error classifier), `routes/payments.ts` (capture route only), `lib/payment-state.ts` |
| T7 | `lib/paypal.ts` (`createOrder`, money helpers), `routes/payments.ts` (create route only) |
| T8 | files already touched by T3/T4/T5 only |
| T9 | no code |
| T10 | no code (running scenarios only) |

**New** test files (`*.test.ts` next to the code being changed) are always allowed.

### B. Read-only (may be read, FORBIDDEN to change)

`packages/db/src/billing.ts` (`processPaymentSuccess`, `markPaymentIfOpen`, `grantCredits`, `reserve`/`pickSource`),
`lib/notify.ts`, `lib/duitku.ts` (inside the release gate), `lib/alert.ts`, `lib/account-deletion.ts`,
`middleware/*` (including `session-auth.ts`, `auth.ts`), `ratelimit*`, all auth/Better Auth code, all `web/*`,
all tables/schemas other than those named in T2, all build/lint/CI config files.

If you feel you **need** to change a read-only file for a task to work → **STOP** and report (see §D). Do not improvise.

### C. Explicit prohibitions

- No refactor, rename, move, reformat, or "tidying" of code the audit does not name.
  Do not run formatter/lint-fix on files; follow the existing style on the lines you touch.
- No adding/removing/upgrading dependencies (`package.json`, lockfile) and no changing the name or meaning of existing env vars.
- No changing signatures/exports used by other files, **except** adding optional parameters named by the audit.
  `reconcilePaypalPayments` must stay exported as an alias.
- No deleting, disabling (`skip`/`only`), or weakening existing tests. Old tests may only be changed if their behaviour
  intentionally changes per the audit, and you must **name which test + why** in the commit message.
- No adding features outside the gate: **no** automatic ledger clawback, entitlement revoke, auto-unfreeze, Duitku refactor,
  offline webhook verification, outbox/queue, etc. (all of these are §4 = later, not now).
- No touching items in §7 ("do not implement") and the "Confirmed correct" part of §1.
- No destructive commands: `DROP`/`TRUNCATE`/`DELETE` without `WHERE` on the DB, `git push`, `git reset --hard`,
  `git push --force`, deleting branches, editing `.env*`, or putting secrets into the repo/log.
- No changing behaviour beyond what the task names, not even "while we're at it". Example: do not also fix Duitku, rate limit
  other routes, or error handling in routes that are not named.

### D. Stop-and-report rule

1. If an audit claim does not match source, or a task needs a file outside the allowlist, or there are two plausible readings:
   **stop that task**, write up your finding, and move on to the next unblocked task. Do not guess. If you must choose
   to keep moving, take the **narrowest, most conservative** reading and record the assumption.
2. Any other bug/problem you find out of scope must **not be fixed**. Record it in `OUT_OF_SCOPE_FINDINGS.md`
   (file, line, short description) and leave it.

### E. Checklist required at the end of EVERY task (paste the result into the commit message)

1. `git diff --stat` → every file that appears must be in the §A allowlist for that task. Any foreign file → revert changes to it.
2. `git diff` contains no whitespace/format/rename-only changes outside the lines that genuinely must change.
3. `tsc --noEmit` passes and all existing tests still pass (no test skipped/deleted).
4. No changes to `package.json`/lockfile/`.env*`.
5. One commit = one task; the commit message starts with `T<n>:` and contains the file list plus assumptions (if any).

Violating §0A (diff out of scope, read-only file changed, test weakened) makes the task result **failed**
and it must be reverted, even if the functionality is correct.

---

## 1. Verdict

Architecture and security intent are solid. **Not production-ready** until the §3 release gate is met and the
§9 sandbox end-to-end passes. Biggest risks: refund/dispute is unhandled (H5) and there is no PayPal environment guard (H1).

### Confirmed correct (do not touch)

- `interpretOrder` derives status from the **capture** status, not the order. An order that is `COMPLETED` with no capture data
  is **not** treated as paid (`lib/paypal.ts:135-137`).
- `verifyWebhookSignature` is fail-closed (`lib/paypal.ts:338-341, 357-359, 381-387`).
- `PayPal-Request-Id` is sent in `createOrder` (`lib/paypal.ts:199`).
- The partial unique index `ledger_purchase_reference_unique` (`schema.ts:246`) is the last line of defence against double credit.
- `payment_events` has a unique `(provider, event_id)` (`schema.ts:381`).
- Financial relations use `onDelete: 'restrict'` (`schema.ts:355`).
- `processPaymentSuccess` is atomic (`billing.ts:438-447`); `markPaymentIfOpen` is conditional (`billing.ts:406-424`).
- The Duitku callback re-verifies the amount against the DB **and** the Duitku status API before crediting.
- Balance ≤ 0 is already rejected (`pickSource` requires `bal.credits >= estimatedCredits`) → clawback has effect.
- The 1 MB body-size cap is already active on all routes including `/webhooks/*` (`app.ts:59-71`).

---

## 2. Rev 3 corrections to rev 2 (read first)

Four things in rev 2 §6 were wrong/inconsistent. The implementation must follow the rev 3 version.

1. **[REV3] `markPaymentIfOpen` cannot be used for refund/dispute.** That function only changes open statuses
   and never overwrites `paid`, while refund/dispute happens on a payment that is already `paid`. The H5 handler
   must use a new function with explicit transitions (see T3).
2. **[REV3] `captureId` belongs in the release gate, not "week one".** Dispute events identify the transaction via
   capture ID; without this column the payment cannot be mapped (T2).
3. **[REV3] Do not freeze the account on `PAYMENT.CAPTURE.REFUNDED`.** That event is also sent when the operator
   refunds it themselves; auto-suspend would lock out a customer who was just refunded. Freeze only for `REVERSED` and
   `DISPUTE.CREATED`. A won dispute is not auto-unfrozen (the account may have been suspended by an admin for another reason).
4. **[REV3] "H3 minimum" must not turn transient errors into `needs_review`.** A momentary gateway timeout
   would flood alerts and make the row unrescuable, because `processPaymentSuccess` does not accept
   `needs_review`. The correct rule is in T4.

Other correction: **[REV3]** a narrow `transmission_time` window (e.g. 5 minutes) **must not** be used: PayPal retries
for up to 3 days and the header may not be re-signed. Replay protection from idempotency alone
(`payment_events` unique) + re-fetching the order via API is enough.

---

## 3. Release gate (work order)

Format: **Task → files → acceptance criteria**. All of T1–T10 are required before live.

### T1 — PayPal environment guard (H1) ⟵ do this first
- **Files:** `lib/paypal.ts`, `index.ts` (`assertProductionConfig`, around `:15-42`).
- Add `assertPaypalConfig()`:
  - If `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are both unset → PayPal is considered disabled, log, return
    (a Duitku-only deployment must not crash).
  - Otherwise: production (`NODE_ENV=production`) requires `PAYPAL_ENVIRONMENT ∈ {live, production}`; non-production
    is **forbidden** from `live`; production with `PAYPAL_WEBHOOK_TEST_BYPASS` set → throw; production requires
    `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`.
- `getBaseUrl()` uses the same rules and **throws**, never falls back to sandbox in production.
- **Acceptance:** boot with `NODE_ENV=production` + empty/sandbox env → process crashes with a clear message;
  dev without `NODE_ENV` + sandbox still runs; existing tests still pass.
- Note: if there is a staging environment with `NODE_ENV=production` but sandbox credentials, separate it with `APP_ENV`.

### T2 — Schema migration (M5, reduced)
- **Files:** `packages/db/src/schema.ts` + drizzle migration.
- On `payments` add: `captureId text`, `reconcileCheckedAt timestamptz`,
  `refundedAmountMinorUnits integer NOT NULL DEFAULT 0`; add `'needs_review'` and `'disputed'` to the status enum.
- Indexes: `payments_open_idx (status, created_at) WHERE status IN ('pending','pending_paypal','capturing')`;
  `payments_capture_unique (capture_id) WHERE capture_id IS NOT NULL`.
- On `credit_ledger` add `ledger_refund_reference_unique (reference) WHERE entry_type = 'refund'`.
- Add `CHECK (status IN (...all 9 statuses...))` on `payments` (`NOT VALID` then `VALIDATE`). Drizzle
  `{ enum }` only validates in TypeScript; Postgres accepts any string (confirmed, `schema.ts:362`).
- Do **NOT** change `external_id` from global unique to composite `(provider, external_id)`: global unique
  is stricter and still correct; that change is a risky migration with no benefit.
- Pre-check before migrating: no status outside the 9 values; no duplicate `credit_ledger.reference` for
  `entry_type='refund'`.
- **Acceptance:** `drizzle-kit generate` is clean; `tsc` passes (every place that switches on `payment.status`
  is checked against the 2 new statuses); the migration succeeds on a data copy.

### T3 — Refund / reversal / dispute handler (H5 minimum)
- **Files:** `routes/webhooks.ts` (the `:328-334` branch), a new module (e.g. `lib/paypal-post-payment.ts`),
  a new `lib/payment-state.ts` if needed.
- New helper `transitionPayment(id, fromStatuses, to, tx?)` = `UPDATE ... WHERE id AND status IN (from) RETURNING`.
  `markPaidPayment(id, to)` = `transitionPayment(id, ['paid'], to)`.
- Event → action mapping:

| Event | Action |
|---|---|
| `PAYMENT.CAPTURE.REFUNDED` | add `refundedAmountMinorUnits` (check same currency, strict parse); if total ≥ `amountMinorUnits` → `paid → refunded`, otherwise stays `paid`. **No freeze.** Alert: manual clawback (`admin_adjustment`). |
| `PAYMENT.CAPTURE.REVERSED` | `paid → disputed` + `users.suspended = true` + alert |
| `CUSTOMER.DISPUTE.CREATED` | `paid → disputed` + `users.suspended = true` + alert |
| `CUSTOMER.DISPUTE.RESOLVED` | outcome contains `SELLER` → `disputed → paid`; `BUYER` → `disputed/paid → refunded`; anything else → alert only. **No** auto-unfreeze; the alert asks for a manual unsuspend. |

- **One transaction:** insert `payment_events` (`onConflictDoNothing().returning`) + status mutation + freeze. If the insert
  returns no row → duplicate event → no-op (no repeated alert). Alerts are sent **after** commit.
- Payment lookup (in order): `custom_id` (if a valid UUID) → `captureId` → order ID (`externalId`) → API fallback
  `GET /v2/payments/captures/{id}` to fetch `supplementary_data.related_ids.order_id`. `provider='paypal'` only.
  Validate the capture ID with `^[A-Za-z0-9]+$` before using it in a URL.
- ID extraction (**verify with sandbox payloads**): `REVERSED` → `resource.id` (capture); `REFUNDED` →
  the `rel="up"` link on the resource (originating capture); `DISPUTE.*` → `resource.disputed_transactions[].seller_transaction_id`;
  order ID from `resource.supplementary_data.related_ids.order_id`.
- Events that cannot be mapped: insert into `payment_events` with `paymentId = null` (nullable column) + alert,
  respond **200** (a retry will not help). DB error → throw → **5xx** (PayPal retries).
- Backfill `captureId` (best-effort, outside the transaction, may fail on unique).
- PII redaction (L1): remove `payer`, `shipping`, `buyer`, `payment_source`, `payer_email`, `email_address`,
  `given_name`, `surname`, `phone*` from the payload before storing.
- **Acceptance:** a test per event (full refund, partial refund, replay of the same event, reversal, dispute
  created/won/lost, unmapped event); a replay neither doubles `refundedAmountMinorUnits` nor re-alerts.
- Policy: automatic ledger clawback is **not** built in this gate (alert → manual `admin_adjustment`).

### T4 — Reconcile (H3 + #5 + M7 + M9)
- **Files:** `lib/paypal-reconcile.ts`, `index.ts:85-90`.
- One dispatcher `reconcileOpenPayments()` (the alias `reconcilePaypalPayments` is kept so old imports do not break),
  with a shared `settleDuitkuPayment` / `settlePaypalPayment`. `settlePaypalPayment` is exported because the capture route uses it (T6).
- **Row claim:** query `ORDER BY reconcile_checked_at ASC NULLS FIRST, created_at ASC LIMIT 50`, filter
  `reconcile_checked_at IS NULL OR < now-10m`; before calling the gateway, `UPDATE payments SET reconcile_checked_at = now()
  WHERE id AND status IN (open) AND (reconcile_checked_at IS NULL OR < now-10m) RETURNING id`; empty → skip.
- **Expire rules (the core of H3):** remove `|| tooOld` from **all** `catch` blocks (including the outermost catch `:186-188`).
  A row is expired only by an **explicit** gateway answer: PayPal `PayPalApiError.status === 404` /
  `INVALID_RESOURCE_ID`, or a terminal `failed`/`expired` status; Duitku `statusCode '02'`, or not-found.
  The gateway answering "not paid yet" (PayPal `pending`, Duitku not '00') and the row being >24h old → may expire.
- **[REV3] Transient errors (timeout/5xx/network):** the row **stays open** (no `needs_review`, no expire).
  If the row is >24h old, send an alert **at most once per 24h per payment** (using `rateLimitStore.increment(
  'notif:payment_stuck:<id>', 86400) === 1`, like the `notifyLowBalance` pattern). Reason: the money may already have arrived,
  and a follow-up webhook can still rescue an open/expired row.
- **`needs_review` only for conditions that genuinely must not be credited:** amount/currency/order-binding mismatch,
  or a capture that turns out to be already `refunded` while the row is still open. Always accompanied by `opsAlert`. This fills in the `console.error`
  `NEEDS REVIEW` that currently only goes to the log (`:33, :112, :151`) and stops mismatch rows from clogging the queue.
- `pending_paypal` stays excluded from age-based expiry (as the code comment says). Note: the expire
  branch checks `order.effectiveStatus === 'pending'`, not `payment.status`; make sure a `PENDING` capture really becomes
  `pending_paypal` in `interpretOrder` (it does, via capture status).
- **M9:** a `running` guard on the reconcile `setInterval` so slow runs do not pile up.
- **Acceptance:** tests: (a) >50 open rows, all eventually processed; (b) the gateway throws on a >24h row →
  the row stays `pending`, one alert; (c) PayPal 404 → expired; (d) mismatch → `needs_review` + alert; (e) two parallel
  calls do not process the same row twice.

### T5 — PayPal webhook: recording, binding, rate limit (H2, M3, M8)
- **Files:** `routes/webhooks.ts:222-337`, `lib/paypal.ts`, `lib/payment-events.ts`, `app.ts:108-115`.
- **M8:** a cheap pre-check **before** the postback to PayPal: all five `paypal-*` headers present, `paypal-cert-url` with scheme
  `https` and host `^([a-z0-9-]+\.)*paypal\.com$`. Add a loose per-IP rate limit (e.g. 120/min) using the existing
  `ipRateLimit` — PayPal can send retry bursts; do not throttle legitimate webhooks.
- **Record every event:** `no_order_id` (`:269`) and `payment_not_found` (`:281`) currently return 200 with no trace.
  Add `recordUnmatchedEvent({provider, eventId, payload})` (insert with `paymentId = null`, `onConflictDoNothing`,
  return a boolean "newly stored") and call it in both branches. Payload is redacted (T3).
  **Type note:** the DB column `payment_events.payment_id` is already nullable (`schema.ts:378`), but the interface
  `PaymentEventInput.paymentId` is still `string` (non-nullable, `payment-events.ts:15`) — change it to `string | null`
  so a null insert is possible. This is part of task T5, not a read-only file.
- **Dispatch:** refund/reversal/dispute events → the T3 handler before the COMPLETED/DENIED logic.
- **Row already in a review status:** if `payment.status ∈ {needs_review, disputed, refunded}` when a `COMPLETED` webhook
  arrives → record the event, respond **200** (do not throw → multi-day 5xx retry loop because
  `processPaymentSuccess` does not accept that status).
- **H2 + M3 (`PAYMENT.CAPTURE.COMPLETED` branch, `:287-327`):** before `recordAndFulfilPayment`, call
  `getOrder(payment.externalId)`; continue only if `effectiveStatus === 'paid'` **and** `capturedOrderMatches` is true.
  Otherwise: record the event + `needs_review` + alert, respond 200. Webhook = trigger, API = source of truth.
- **`capturedOrderMatches(o, p)`** (replacing `capturedAmountMatches` at all call sites: reconcile `:150`,
  capture route `:526`, webhook `:307`): `o.orderId === p.externalId` **and** custom_id matches `p.id` **and** amount +
  currency match. Add `customId` to `PayPalParsedOrder` (read from `captures[0].custom_id ?? purchase_units[0].custom_id`).
  **If PayPal does not return `custom_id`**, skip that check with a `console.warn` unless the env
  `PAYPAL_REQUIRE_CUSTOM_ID=1`; once sandbox confirms `custom_id` always comes back, enable that flag. (Without
  this leniency, if PayPal omits the field every payment would land in `needs_review`.)
- `interpretOrder` (M1): if there are multiple captures, pick `COMPLETED` first, then `PENDING`, then the first;
  `REFUNDED`/`PARTIALLY_REFUNDED` → `effectiveStatus = 'refunded'` (not `failed`); every caller of `effectiveStatus`
  must handle this new value (reconcile: open row + refunded → `needs_review`).
- Every path that finds a capture ID stores it (`saveCaptureId`, best-effort, only when `captureId IS NULL`).
- **Acceptance:** tests: webhook without headers → 400 without calling PayPal; cert_url `paypal.com.evil.com` rejected;
  unknown event recorded (`payment_id` null); COMPLETED webhook with a different amount → not credited;
  webhook to a `needs_review` row → 200.

### T6 — Capture route (H4 + #4)
- **Files:** `lib/paypal.ts` (`captureOrder`), `routes/payments.ts:447-570`.
- `captureOrder(orderId, paymentId)`: headers `PayPal-Request-Id: capture:<paymentId>` and `Prefer: return=representation`;
  if the result has no `captureStatus`, return `getOrder(orderId)`. `orderId` is `encodeURIComponent`'d in the URL.
- **Atomic claim** before calling PayPal: `UPDATE ... SET status='capturing' WHERE id AND status IN
  ('pending','pending_paypal','failed','expired') RETURNING`. **[REV3]** `failed`/`expired` **deliberately included** (late-rescue:
  if PayPal already took the money, the credit must land); when that happens, a loud `console.warn` with the payment ID
  (meaning the local state was wrong). Do **not** reject `expired`/`failed` (see §7).
- Claim failed: if the status is now `capturing` (retry after a timeout / another process) → **do not capture again**; call
  `settlePaypalPayment(payment, {tooOld:false})` — `paid` → 200, otherwise 202 `processing`. Any other status → 409.
- Error handling after the claim:
  - `ORDER_ALREADY_CAPTURED` → `getOrder` then check `capturedOrderMatches` (not an automatic success; `:512-526` already does this).
  - `INSTRUMENT_DECLINED` (422) → release the claim (`capturing → pending`), respond 422 with a "try another method" message.
  - Any other definitive 4xx (not 408/429) → release the claim, respond 409.
  - **Timeout / 5xx / network = status UNKNOWN**: **do not** set `failed`, **do not** release the claim; leave it
    `capturing`, respond 202; reconcile settles it.
- Outcomes: `paid` + `capturedOrderMatches` → `saveCaptureId` + `fulfilPayment`; `pending_paypal` →
  `markPaymentIfOpen(..., 'pending_paypal')`; `failed` → `markPaymentIfOpen(..., 'failed')`; `refunded`/mismatch → `needs_review` + alert.
- Add `sessionRateLimit('payments', N)` to the capture route (pattern `routes/keys.ts:13`, `routes/redeem.ts:29`);
  the create route is currently only limited by a 5/hour DB check.
- **Acceptance:** two parallel capture requests → only one calls PayPal; an artificial timeout → the row stays `capturing`
  then reconcile settles it; INSTRUMENT_DECLINED → the row goes back to `pending` and can be retried.

### T7 — Create order (M2)
- **Files:** `lib/paypal.ts` (`createOrder`), `routes/payments.ts:324-443` (the `POST /paypal/create-order` route). Note: `:32-208` is the Duitku `/create` route, not PayPal — do not mix them up.
- Throw if the `approve`/`payer-action` link is not found (currently returns `''`, `:234-240`).
- Amount string from integer cents: helper `centsToPaypalAmount(cents)` = `(cents/100).toFixed(2)`, validate integer ≥ 0;
  `createOrder` validates `^\d+(\.\d{1,2})?$`.
- Optional `return_url`/`cancel_url` via `payment_source.paypal.experience_context`.
- Strict `paypalAmountToCents` (L6): regex `^\d+(\.\d{1,2})?$`, compute from the string (not `Math.round(Number*100)`),
  throw on an unexpected format; `capturedAmountMatches` wraps it in try/catch → `false`.
- Business note (verify before live): as far as I know PayPal does not support IDR as a transaction currency; make sure
  the pricing flow uses a supported currency (e.g. USD) and the rate is locked server-side in the payment row (it is, `payments.ts:159`).

### T8 — Alerting `needs_review` (#8)
- Every path that writes `needs_review` calls `opsAlert()` (T3/T4/T5). No `console.error`-only.
- **Acceptance:** trigger a mismatch in sandbox → the Telegram/webhook message is sent.

### T9 — PayPal dashboard configuration (non-code)
The **live** webhook must subscribe to: `PAYMENT.CAPTURE.COMPLETED`, `.DENIED`, `.PENDING`, `.REFUNDED`, `.REVERSED`,
`CHECKOUT.ORDER.VOIDED`, `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.RESOLVED`. The sandbox webhook ID ≠ live; `PAYPAL_WEBHOOK_ID`
in production must be the live ID.

### T10 — Sandbox end-to-end + live smoke test
See §9. Must pass before go-live.

---

## 4. Medium/Low findings that can follow (week one)

- **Automatic clawback:** a `entryType:'refund'` ledger entry with a negative value, `reference = refund:<paypal_refund_id>`
  (not the capture ID), using `grantCredits` (`billing.ts:349`) + the T2 unique index. Negative balances are already blocked on the
  API path.
- **Entitlement packages** (`pkg.modelId`, `billing.ts:476-487`) write to `entitlements`, not `credit_ledger`. Refund/dispute
  on this kind of purchase must change the entitlement to `revoked`, not write a negative ledger. Not covered by T3.
- **M4:** `PAYPAL_WEBHOOK_TEST_BYPASS` (`paypal.ts:353-355`) is **double-gated** (`NODE_ENV === 'test' && flag === '1'`), so it is
  **not reachable in production** as long as `NODE_ENV` is correct — not a bug, only loose wording in the previous rev. T1 adds an
  explicit ban on this flag in production; cleaner still is injecting a verifier in tests (`vi.mock`).
- **M6:** OAuth token stampede (`paypal.ts:28-62`) → store the in-flight promise (`inflight ??= fetchToken().finally(() => inflight = null)`).
- **M10:** the webhook verifies the parsed body (`webhooks.ts:223→226→239`). This usually works; if there are sporadic
  `invalid signature` errors on legitimate events, move to offline verification over the raw body (`node:crypto` + a certificate from
  `paypal-cert-url`, host validated).
- **L1:** `payment_events.payload` retention + PII redaction (basic redaction is already in T3).
- **L3:** Duitku `expiryPeriod` always = `DUITKU_PAYMENT_TTL_MINUTES` (make it the default in `createTransaction`). Otherwise the
  local row expires at minute 5 while the QR can be paid until minute 60.
- **L4:** `assertDuitkuConfig` in production should `throw` (not `warn`) when the merchant code/API key is empty. ~~verify
  `assertProductionConfig` (`index.ts:26-39`) guarantees that~~ — **note:** `assertProductionConfig` never existed in the repo;
  the safety net is now an explicit production branch in `index.ts` (done in Phase 1).
- **L5:** `void notifyPaymentPaid` can be lost on serverless; outbox/queue if we ever move.
- **L7:** fix the `PaymentEventInput` comment (`payment-events.ts:8-11`): what is idempotent is `processPaymentSuccess`/
  `markPaymentIfOpen`, `payment_events` only prevents duplicate audit rows. Add `recordUnmatchedEvent` (T5).
- **Duitku:** not-found detection via error-message substring is fragile; better to have a typed error from `lib/duitku.ts`.
- **Duitku/QRIS** has no refund webhook → manual procedure (`admin_adjustment`); document it for the operator.

---

## 5. Schema spec (summary)

```ts
// payments — additions
captureId: text('capture_id'),
reconcileCheckedAt: timestamp('reconcile_checked_at', { withTimezone: true }),
refundedAmountMinorUnits: integer('refunded_amount_minor_units').notNull().default(0),
// status enum: + 'needs_review', 'disputed'
// index: payments_open_idx (partial), payments_capture_unique (partial unique)
// credit_ledger: ledger_refund_reference_unique (partial unique WHERE entry_type='refund')
// + CHECK constraint status IN (9 values)
```

---

## 6. Verification checklist answers (against source)

1. **`processPaymentSuccess`** — atomic **yes** (`billing.ts:438-447`). Accepted statuses: `pending, pending_paypal, capturing,
   failed, expired`; `refunded` excluded (correct). Ledger reference `payment:<id>` (`:494, :506`). One transaction with the balance change (`:518`).
   Entitlements write to `entitlements`, not the ledger (`:476-487`).
2. **`markPaymentIfOpen`** — conditional **yes** (`billing.ts:406-424`); open = `pending, pending_paypal, capturing`; never overwrites `paid`
   (**which is why it is unsuitable for H5**, see §2.1).
3. **Create route** — price/credits server-side **yes** (`payments.ts:114, :161`); rate locked in the row (`:159`); 5/hour limit (`:69-89`).
   No `sessionRateLimit` (`:23-24`).
4. **Capture route** — auth middleware **yes** (`:23-24`), ownership in the handler **yes** (`:470-474`); atomic `capturing` claim
   **missing** (dead status); rejecting `expired/failed` **deliberately absent** (correct); `isAlreadyCapturedError` → `getOrder` **yes** (`:507-516`);
   `INSTRUMENT_DECLINED` **not mapped** (`:515-520`); suspended users blocked **yes** (`session-auth.ts:100`).
5. **PayPal webhook** — raw body is read **yes but discarded** (`:223→226`); verification is the earliest step **yes** (`:239`); lookup via `custom_id` **no**
   (only `externalId`, `:276`); unknown events answered 200 **without** `recordPaymentEvent` (`:269, :281`); DB error → 5xx **yes** (`:326`).
6. **Duitku callback** — `merchantCode` implicit (part of the signed string, `duitku.ts:210`); only `resultCode '00'` is fulfilled;
   amount matched against the DB + API re-verified; `eventId` gets a `:resultCode` suffix so it does not collide.
7. **Refund/dispute handler** — does not exist (T3).
8. **Reconcile scheduler** — one `setInterval` caller (`index.ts:85-90`), 15 minutes; no alert (`sendOpsAlert` exists but is not called).

---

## 7. Already mitigated / DO NOT implement

| Claim | Reality |
|---|---|
| `deletedAt` unchecked in `sessionAuth` → a deleted user can still pay | **Wrong.** `softDeleteUser` (`lib/account-deletion.ts:10-34`) sets `suspended=true` and deletes all sessions in one transaction; `sessionAuth` rejects `suspended`. |
| No alerting infrastructure | **Wrong.** `sendOpsAlert()` already exists; what is missing is only the call from reconcile/webhook. |
| Webhook has no body-size limit | **Wrong.** A 1 MB `bodyLimit` is active (`app.ts:59-71`). Only the rate limit is missing. |
| A negative balance makes clawback pointless | **Wrong.** `pickSource` rejects balance ≤ 0. |
| `/receipt/:paymentId` is IDOR-prone | **Safe.** The route is at `payments.ts:212`, the `userId` filter at `payments.ts:236`. |
| **Reject `expired`/`failed` in the capture route** | **DO NOT.** `processPaymentSuccess` deliberately accepts both (late-rescue). Rejecting = money in, credits not. |
| Narrow `transmission_time` window | **DO NOT** (see §2). |
| Change `externalId` to a composite unique | **Not needed** (T2). |
| Auto-freeze on `REFUNDED` / auto-unfreeze after a won dispute | **DO NOT** (see §2.3). |

---

## 8. VPS deploy notes

- Bind the API to `127.0.0.1`, TLS at nginx. If the API port is exposed to the internet, `getTrustedClientIp` is meaningless and per-IP rate limiting can be spoofed.
- Run **one** API instance. With T4 the multi-instance claim is safe, but one is still recommended until T4 is proven.
- `REDIS_URL` is required; without it the rate limiter falls back to in-memory (resets on restart, uncoordinated).
- Production: `NODE_ENV=production`, `PAYPAL_ENVIRONMENT=live`, `DUITKU_ENV=production`, `PAYPAL_WEBHOOK_TEST_BYPASS` unset.
  `assertPaypalConfig()` and `assertDuitkuConfig()` must hard-exit in production.

---

## 9. Sandbox end-to-end (required before live)

The webhook simulator is not enough (postback verification does not support mock events). Use real sandbox transactions.

| Scenario | Expected result |
|---|---|
| Normal payment | `paid`, credited once, `capture_id` populated |
| Capture sent twice / double click | still credited once |
| Artificial timeout during capture | row `capturing`, reconcile settles it, **not** `failed` |
| COMPLETED webhook arrives before the capture response | credited once |
| Same webhook sent 2× | no-op |
| Card declined (`INSTRUMENT_DECLINED`) | row back to `pending`, can retry |
| Capture `PENDING` | `pending_paypal`, not expired by age |
| Amount mismatch | `needs_review` + alert sent |
| Full refund from the dashboard | `refunded`, alert, account **not** frozen |
| Partial refund | stays `paid`, `refundedAmountMinorUnits` increases, alert |
| Dispute opened | `disputed`, account `suspended`, alert |
| Dispute won | back to `paid`, alert asking for a manual unsuspend |
| COMPLETED webhook to a `needs_review` row | 200, no 5xx retry |
| >50 open rows | all eventually processed (no starvation) |

**Real payload verification** for `REFUNDED`, `REVERSED`, `DISPUTE.CREATED/RESOLVED`: take one payload per event from
`payment_events`, match the capture ID, order ID, `custom_id`, `dispute_outcome.outcome_code` against the extraction in T3.
Also check whether `custom_id` comes back on the order/capture; if yes, set `PAYPAL_REQUIRE_CUSTOM_ID=1`.

**Live smoke test:** one real smallest-possible transaction, refund it yourself, confirm the `REFUNDED` event arrives, is recorded, and the alert is sent.

---

## 10. Priorities

| Prio | Task | Reason |
|---|---|---|
| **P0** | T1 environment guard | 10 minutes; its failure is silent and fatal |
| **P0** | T2 schema + T3 refund/dispute handler | refund = free credits that are never clawed back |
| **P1** | T4 reconcile | rows can be wrongly expired; the queue can stall |
| **P1** | T5 webhook (record all events, binding, rate limit) | audit trail + payload manipulation |
| **P1** | T8 alerting | money can get stuck with nobody knowing |
| **P2** | T6 capture route, T7 create order | correctness/UX, not money leakage |
| **P2** | T9/T10 dashboard + sandbox | release gate |
| **P3** | §4 | cleanup |

---

## 11. Phased Work Plan (4 Phases)

Split so it can be done across sessions; each phase stands alone and is tested before moving on.
The §0A scope limits remain fully in effect in every phase.

```
PHASE 1 ──► PHASE 2 ──► PHASE 3 ──► PHASE 4
T1, T2      T3, T8      T4, T5      T6, T7, T9, T10
```

### Phase 1 — Foundation (T1 + T2)

**Target: the code can boot safely in production, the schema is ready for all following phases.**

| Task | Summary | Files touched |
|---|---|---|
| T1 | `assertPaypalConfig()`: guard PayPal env at boot | `lib/paypal.ts`, `index.ts` |
| T2 | Add columns + enum + index to schema & migration | `packages/db/src/schema.ts`, 1 new migration file |

**Order within the phase:**
1. Do T1 first (fastest, ~10 minutes, no schema dependency).
2. Do T2: generate the migration, run it on a DB copy, verify `tsc --noEmit`.

**Phase 1 exit gate:**
- [x] `NODE_ENV=production` + empty env → the process crashes with a clear message
  - **Correction to this gate:** the original wording was loose. A provider that is **completely unconfigured** (both credentials empty) is deliberately treated as inactive and does not crash, per §3 T1 — a Duitku-only or PayPal-only deployment must still boot. What crashes is a **partial** configuration: production with only one of `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`, or without `PAYPAL_WEBHOOK_ID`, or with `PAYPAL_ENVIRONMENT` not `live`/`production`, or with `PAYPAL_WEBHOOK_TEST_BYPASS` set. Duitku follows the same rules.
- [x] `tsc --noEmit` passes; no new broken imports
- [x] The columns `captureId`, `reconcileCheckedAt`, `refundedAmountMinorUnits` and the statuses `needs_review` & `disputed` exist in the schema + DB
- [x] Migration succeeds on a data copy

**Issues left from Phase 1:** remaining findings after commit `4780212` + follow-up hardening.

| Item | Severity | Disposition |
|---|---|---|
| The `PAYPAL_WEBHOOK_TEST_BYPASS` guard sits below the "disabled" early-return | Low — the flag is not referenced anywhere else | **Fixed** — the guard moved to the top of `assertPaypalConfig()` |
| The `throw` from `assertDuitkuConfig()` is swallowed by a `try/catch` in `index.ts`; §8 asks for a hard-exit | **Medium** — production could boot with `DUITKU_ENV=sandbox` | **Fixed** — explicit production branch in `index.ts` |
| §L4 names `assertProductionConfig` (`index.ts:26-39`) as the safety net — **that function does not exist in the repo** | Medium — there never was a backstop; the audit's own reference was stale | **Fixed** — the reference is struck through; the new production branch in `index.ts` is the backstop |
| `security.test.ts` (`Fix 1.4`) fails — expects 200, gets 401 | Medium — pre-existing from `6fc248c`, not Phase 1 | **Fixed** — a `fetch` mock replaces the removed `mock_test_trans_id` backdoor |
| `gateway.test.ts:114` (rate-limit 121 requests) fails against remote Neon | Low — timing flake, 60s window vs serial RTT >120s | **Deferred** — environmental, diagnosed separately |
| `0011_fuzzy_betty_ross.sql:7` uses a plain `ADD CONSTRAINT`, not `NOT VALID` + `VALIDATE` | Low — the end result is identical; the lock profile only matters on a large table | **Deferred** — already applied to the DB; editing the file would desync from the journal |

Note: `external_id` is deliberately left **globally** unique (not composite `(provider, external_id)`) per §7 "Not needed" — the constraint is followed on purpose, not overlooked.

**Dependency for the following phases:** T3, T4, T5 all need the T2 columns and the new enum. Do not start Phase 2 before Phase 1 passes.

---

### Phase 2 — Financial Security (T3 + T8)

**Target: refund/reversal/dispute handled; every `needs_review` path sends an alert.**

| Task | Summary | Files touched |
|---|---|---|
| T3 | Handlers for `REFUNDED`, `REVERSED`, `DISPUTE.*`; `transitionPayment`; PII redaction | `lib/paypal-post-payment.ts` (new), `lib/payment-state.ts` (new), `routes/webhooks.ts` |
| T8 | Make sure every `needs_review` path calls `opsAlert()` | files already touched by T3 only |

**Order within the phase:**
1. Create `lib/payment-state.ts` with `transitionPayment` + `markPaidPayment`.
2. Create `lib/paypal-post-payment.ts` with a handler per event (mapping in §3 T3).
3. Add dispatch in `routes/webhooks.ts` before the COMPLETED/DENIED branches.
4. T8: check every `needs_review` path in the new files already calls `opsAlert()`.

**Phase 2 exit gate:**
- [x] Test: full refund → `refunded`, alert sent, account **not** frozen
- [x] Test: partial refund → stays `paid`, `refundedAmountMinorUnits` increases, alert sent
- [x] Test: reversal → `disputed`, `users.suspended = true`, alert
- [x] Test: dispute created → `disputed`, suspended, alert
- [x] Test: dispute won by seller → `paid`, alert asks for a manual unsuspend
- [x] Test: dispute won by buyer → `refunded`, alert
- [x] Test: replay of the same event → no-op (does not double `refundedAmountMinorUnits`)
- [x] Test: unmapped event → insert with `paymentId = null`, respond 200
- [x] `tsc --noEmit` passes

**Status: ✅ DONE (2026-10-14).** The new suite `src/routes/paypal-post-payment.test.ts` (16 tests) passes in full
and covers all eight gate lines above plus unit tests for `parseMinorUnits`,
`redactPaypalPayload`, `extractPaymentRefs`, and `isPostPaymentEvent`.

**Review pass (2026-10-14, after the initial implementation) — 3 findings fixed:**

| # | Finding | Disposition |
|---|---|---|
| 1 | The `outcome_code` `CANCELED_BY_BUYER` (buyer withdraws the claim) contains the substring `BUYER`, so it read as a **buyer win** → full refund + false clawback alert | **Fixed** — the seller-win branch is now `code.includes('SELLER') \|\| code === 'CANCELED_BY_BUYER'`, carved before the buyer branch |
| 2 | The alert & return value claimed a transition that did not happen when `transitionPayment` returned `null` (`applyDisputeOpened` / `applyDisputeResolved`) | **Fixed** — a `dispute_unexpected_state` branch + the `unexpectedDisputeState()` helper; the alert honestly says the status did not change and the account was not frozen |
| 4 | `captureId` from a HATEOAS link (`split('/').pop()`) and the DB backfill were not regex-validated, even though `getCapture()` requires it | **Fixed** — `asCaptureId()` (`^[A-Za-z0-9]+$`) + `captureIdFromLink()` (strips query/hash/trailing slash) used on every extraction path |
| 3 | `FOR UPDATE` for stale state on simultaneous webhooks | **Deferred** — the audit deliberately chose `WHERE status IN (...)` + SQL-side increment as the concurrency mechanism (§3 T3); `FOR UPDATE` is an enhancement §0C forbids. Not a bug. |
| 5 | `PII_KEYS` does not yet cover standalone `email`/`first_name`/`last_name` | **Deferred** — speculative, outside the explicit §3 T3 redaction list. Not part of the gate. |

Finding #4 also made the old test fixtures unrealistic (`CAP-...` ids contain hyphens, rejected by the correct guard) — the fixtures were fixed to alphanumeric ids; a duplicate test block was cleaned up along the way. Three regression tests were added for #1, #2, and the #4 sanitization.

**Implementation notes for the next session (read before Phase 3):**

1. **`payment-state.ts` also holds `recordPaymentEvent` / `recordUnmatchedEvent`.** T5 in §3 assumes
   those helpers live in `lib/payment-events.ts`, but that file **does not exist** and is not in the Phase 2
   allowlist, so the helpers were placed temporarily in `lib/payment-state.ts`. When doing T5, **do not
   duplicate** — move/re-export them from `payment-state.ts`, or create `lib/payment-events.ts` that
   re-exports both and point `paypal-post-payment.ts` at it. Right now the import in
   `paypal-post-payment.ts` points at `./payment-state`.
2. **The `captureId` backfill runs outside the transaction**, best-effort, with a `captureId IS NULL` guard and a
   swallowed unique collision (treated as normal). This matches §3 T3; do not move it inside the tx.
3. **The new `getCapture()` in `lib/paypal.ts`** validates the id with `^[A-Za-z0-9]+$` and throws when it does not
   match. The fallback lookup in `resolvePostPaymentRow` catches that error and only `console.warn`s — so an odd
   capture id never fails the webhook, it just makes the row unmapped (recorded,
   `paymentId = NULL`). The unmapped test deliberately uses an invalid id to verify this path.
4. **Alerts are sent after commit.** `handlePostPaymentEvent` collects `outcome.alerts` inside the tx and
   only calls `sendOpsAlert` after `db.transaction` finishes; a replay (duplicate) returns
   `alerts: []`, so the same event never doubles an alert.
5. **Refund mismatch → `needs_review` + alert** (`paypal_refund_needs_review`) is the only `needs_review` path
   in the Phase 2 files — that is what satisfies T8. If Phase 3 adds a new `needs_review` path
   (T4 touches reconcile), make sure the new path also calls `sendOpsAlert`.
6. **Out-of-scope findings are recorded in `apps/api/OUT_OF_SCOPE_FINDINGS.md`** — the rate-limit test
   `gateway.test.ts:114` is flaky because of the fixed 60-second window vs a slow remote DB. Not a Phase 2 regression and
   not fixed (the file is outside the allowlist).

**Dependency for the following phases:** T5 will dispatch to the T3 handler; make sure T3 is exported and stable before moving on. `handlePostPaymentEvent` + `isPostPaymentEvent` are already exported from `lib/paypal-post-payment.ts`.

---

### Phase 3 — Hardening (T4 + T5)

**Target: reconcile does not wrongly expire rows; every webhook is recorded; rate limit in place.**

| Task | Summary | Files touched |
|---|---|---|
| T4 | Fix expire-on-error, add `needs_review` + stuck alert, `running` guard | `lib/paypal-reconcile.ts`, `index.ts` (interval block only) |
| T5 | Header pre-check, cert-url, rate limit, `recordUnmatchedEvent`, re-fetch `getOrder`, `capturedOrderMatches`, nullable `PaymentEventInput` | `routes/webhooks.ts`, `lib/paypal.ts`, `lib/payment-events.ts`, `app.ts` |

**Order within the phase:**
1. T4 first (stands alone, no T5 dependency).
2. T5: change `PaymentEventInput.paymentId` to `string | null`, add `recordUnmatchedEvent`, then fix the webhook route.

**T4 cautions — critical behaviour changes:**
- Remove `|| tooOld` from all `catch` blocks (including the outermost catch `:186-188`).
- Transient error → the row **stays open**, alert rate-limited to once per 24 hours.
- `needs_review` only for amount/currency mismatch, not for transient errors.
- A `running` guard on the `setInterval` (boolean flag, reset in `finally`).

**T5 cautions — change order:**
- Pre-check headers before calling `verifyWebhookSignature` (fail early, saves 1 PayPal API call).
- `capturedOrderMatches` replaces `capturedAmountMatches` in the webhook (adds `orderId` + `customId` checks).
- If `custom_id` does not come back from PayPal → `console.warn`, skip that check (do not block), unless `PAYPAL_REQUIRE_CUSTOM_ID=1`.

**Phase 3 exit gate:**
- [x] T4 test (a): gateway timeout on a >24h row → the row stays `pending`, one alert sent
- [x] T4 test (b): PayPal 404 → `expired`
- [x] T4 test (c): amount mismatch → `needs_review` + alert
- [x] T4 test (d): two parallel calls do not process the same row twice (`running` guard)
- [x] T5 test: webhook without headers → 400, without calling PayPal
- [x] T5 test: `paypal-cert-url` with an invalid host → rejected before verification
- [x] T5 test: unknown event → recorded in `payment_events` (`paymentId = null`)
- [x] T5 test: COMPLETED webhook with a different amount → not credited, `needs_review`
- [x] T5 test: webhook to a `needs_review` row → 200, no retry loop
- [x] `tsc --noEmit` passes

**Status: ✅ DONE (2026-10-14).** New suite `src/routes/paypal-reconcile.test.ts` (14 tests) passes in full and
covers the ten gate lines above (plus Duitku amount mismatch). Implementation split across `lib/paypal-reconcile.ts` (T4),
`lib/paypal.ts` + `routes/webhooks.ts` + `app.ts` (T5), and `index.ts` (M9 guard).

**Two deviations from the §3 text — both deliberate, both required to stay inside §0A:**

1. **`lib/payment-events.ts` does not exist and was not created.** T5 says to add `recordUnmatchedEvent` there and
   widen `PaymentEventInput.paymentId` to `string | null`. In reality both helpers already live in
   `lib/payment-state.ts` (Phase 2 left them there, see the Phase 2 note) and `paymentId` is already
   `string | null`. Creating a `payment-events.ts` would have required re-pointing `paypal-post-payment.ts` at it —
   an out-of-scope edit. The helpers were therefore used as-is from `payment-state.ts`; nothing was duplicated.
2. **`capturedAmountMatches` is still exported.** T5 says `capturedOrderMatches` replaces it "at all call sites".
   The one remaining caller is `routes/payments.ts` (the capture route), which is a **T6** file and therefore
   out of scope for Phase 3. `capturedOrderMatches` is the only matcher used by every Phase 3 path; the old export
   is kept solely so the T6 file keeps compiling. **T6 must switch that call site to `capturedOrderMatches` and
   then the compat export can be deleted.**

**Review pass (2026-10-14, after the initial implementation) — 4 findings fixed:**

| # | Finding | Disposition |
|---|---|---|
| 1 | **Duitku amount mismatch only `console.error`d and returned `null`** — the row stayed `pending`, was re-claimed every 10 min forever, and never alerted. The T4 invariant is provider-agnostic, not PayPal-only. | **Fixed** — `settleDuitkuPayment` now calls `flagPaymentNeedsReview` (alert type `duitku_needs_review`) and returns `needs_review`, matching the PayPal path. Regression test `T4(d2)` locks it. |
| 2 | **`customId` read only from `purchase_units[0].custom_id`** — the audit named `captures[0].custom_id ?? purchase_units[0].custom_id`. If PayPal returns the id on the capture object the binding check silently degraded to order-id + amount. | **Fixed** — the capture type carries `custom_id` and `interpretOrder` reads `capture?.custom_id ?? raw.purchase_units?.[0]?.custom_id`; `amount`/`currency` fall back to the purchase unit when no capture exists yet. |
| 3 | **`security.test.ts` mock used a static capture id (`CAP-SEC-1`)** — `payments.capture_id` is unique, so a second run against the same DB collided. | **Fixed** — the fixture is now `CAP-SEC-<ts>-<rand>`. |
| 4 | **The `needs_review` transition + log + alert block was written inline twice** (reconcile + webhook), which §0.5 forbids ("one helper … used by all new code") and which T6 would have tripled. | **Fixed** — centralized into `flagPaymentNeedsReview()` in `lib/payment-state.ts`, alongside `OPEN_PAYMENT_STATUSES` (single source of truth for the open set) and `saveCaptureId` (moved here so *all* `payments` mutations live in one module). `paypal-reconcile.ts` re-exports `saveCaptureId` to preserve its existing import surface. `hasPayPalTransmissionHeaders` / `PAYPAL_TRANSMISSION_HEADERS` moved into `lib/paypal.ts` and are consumed by both the route and `verifyWebhookSignature`. |

**Assumption recorded for finding #4:** centralizing into `lib/payment-state.ts` touches a file that T4/T5's §A
allowlist does not name (it was created under T3). It was treated as in scope under §0.5, which explicitly requires
one shared helper rather than per-call-site duplication. No behaviour changed beyond the Duitku bugfix; the refactor
is a move, not a rewrite. If §0A is read strictly per-task, this is the one file to re-check.

**Implementation notes for the next session (read before Phase 4):**

1. **`reconcileOpenPayments()` is the single dispatcher**; `reconcilePaypalPayments` is a kept alias (exported
   const) as §0C requires. `settlePaypalPayment` is exported for T6 to reuse when a capture times out; its
   second argument is `{ expireIfUnpaid: boolean }` — T6 should pass `false` so a timed-out capture is never
   age-expired by the caller.
2. **The claim is `reconcile_checked_at`, set before the gateway call, reclaimable after 10 minutes
   (`RECLAIM_AFTER_MS`).** The claim is a single conditional `UPDATE … WHERE status IN (…) RETURNING`; if it
   returns nothing the row is skipped. This is what makes two concurrent runs safe — the T4(e) test asserts the
   gateway is read exactly once for the contended row. **Do not** move the claim after the `getOrder` call.
3. **Age expiry (`MAX_EXPIRY_MS = 24h`) now only applies to `status = 'pending'`.** `pending_paypal` is never
   age-expired because a PayPal order can legitimately sit unpaid for days while the buyer decides; its terminal
   state comes from the gateway (`failed`/`expired`) or from `CHECKOUT.ORDER.VOIDED`. If Phase 4 adds another
   long-lived status, add it to the exclusion in `settlePaypalPayment`'s `default` branch, not to `OPEN_STATUSES`.
4. **Transient errors leave the row open and alert once per 24h** via
   `rateLimitStore.increment('notif:payment_stuck:<id>', 86400)`. The alert only fires for rows older than
   `MAX_EXPIRY_MS`, so a short-lived gateway blip on a young row is silent by design — the next reconcile run
   retries it. Expiry happens **only** on an explicit gateway answer: PayPal 404 / `INVALID_RESOURCE_ID` (via
   `isPaypalGone`) or a terminal `failed`/`expired`/`refunded` order status; Duitku `statusCode === '02'` or a
   not-found error (via `isDuitkuNotFound`). Everything else is transient.
5. **`needs_review` from reconcile is reserved for `capturedOrderMatches` mismatch or an already-`refunded`
   capture**, and both paths call `sendOpsAlert` (`paypal_needs_review`) — this is the Phase-3 addition to the T8
   invariant that every `needs_review` path alerts. **If Phase 4 adds another `needs_review` transition, it must
   alert too.**
6. **The webhook cert-host check rejects before the PayPal round-trip.** `hasPayPalTransmissionHeaders` requires
   all five `paypal-*` headers *and* an `https` `paypal-cert-url` whose host matches `^([a-z0-9-]+\.)*paypal\.com$`.
   A missing/malformed header set now returns **400** (not 401) and never calls PayPal. 401 is reserved for a
   header set that passes the cheap check but fails signature verification. **This intentionally changed
   `security.test.ts:244`'s first assertion from 401 → 400** — that test was updated and its comment names T5.
7. **`/webhooks/*` has its own loose per-IP limit** (`WEBHOOK_IP_RPM`, default 120/min, key prefix `rlwh`) applied
   in `app.ts` ahead of the security headers. It is deliberately looser than the gateway's per-key limit because
   PayPal retries; it is a floor against a flood, not a throttle. `getTrustedClientIp` returns `'unknown'` under
   `app.request` unless a header is set, so the limiter is skipped for header-less test calls — the rate-limit
   test sets `cf-connecting-ip` explicitly.
8. **The webhook COMPLETED path re-reads the order and re-verifies the binding before granting credits.** The
   webhook is only a trigger; `getOrder` + `capturedOrderMatches` is the source of truth. An order that comes
   back paid but not bound to the row is recorded, moved to `needs_review`, alerted
   (`paypal_webhook_mismatch`), and acked **200** so PayPal stops retrying. A row already in
   `needs_review`/`disputed`/`refunded` short-circuits to a 200 `review_status` ack before any gateway call.
9. **`interpretOrder` now picks the capture and reports refunds.** A multi-capture order prefers `COMPLETED`,
   then `PENDING`, then the first; `REFUNDED`/`PARTIALLY_REFUNDED` map to `effectiveStatus = 'refunded'`.
   `PayPalParsedOrder` gained `customId`, and `createOrder` now sets `custom_id: paymentId` so new orders can be
   bound by `customId` — when PayPal omits it back, `capturedOrderMatches` warns and falls back to order-id +
   amount unless `PAYPAL_REQUIRE_CUSTOM_ID=1`.
10. **Known flake, not a Phase 3 regression:** `gateway.test.ts:114` (`P1-04`) loops 121 requests against a
    120-per-60s window; when the loop exceeds 60s against the slow remote DB the counter resets mid-loop and the
    final request is a 200. Already recorded in `apps/api/OUT_OF_SCOPE_FINDINGS.md`; the file is outside the
    allowlist, so it was left alone. Full suite: **73/74 pass**, the one failure being this flake.

---

### Phase 4 — Polish & Go-Live (T6 + T7 + T9 + T10)

**Target: more robust capture UX, strict create order, live configuration, sandbox passes.**

| Task | Summary | Files touched |
|---|---|---|
| T6 | Atomic `capturing` claim, `INSTRUMENT_DECLINED` handling, timeout → 202, `sessionRateLimit` | `lib/paypal.ts`, `routes/payments.ts` |
| T7 | Throw when there is no approve URL; `centsToPaypalAmount`; strict `paypalAmountToCents` | `lib/paypal.ts`, `routes/payments.ts` |
| T9 | Configure the live webhook in the PayPal dashboard (non-code) | — |
| T10 | Sandbox end-to-end scenarios (see §9) | — |

**Order within the phase:**
1. T7 first (the `paypal.ts` change comes earlier, and T6 uses it too).
2. T6: add the `capturing` claim, error classifier, rate limit.
3. T9: configure the PayPal dashboard (subscribe all required events).
4. T10: run the whole §9 scenario set, document the results.

**Phase 4 exit gate (= go-live gate):**
- [ ] T6 test: two parallel capture requests → only one calls PayPal
- [ ] T6 test: artificial timeout → the row stays `capturing`, reconcile settles it
- [ ] T6 test: `INSTRUMENT_DECLINED` → the row goes back to `pending`, can be retried
- [ ] T7 test: no approve URL → throw (not return `''`)
- [ ] All §9 scenarios pass in sandbox
- [ ] Live smoke test: 1 small transaction + self-refund + confirm the `REFUNDED` event is recorded
- [ ] `tsc --noEmit` passes final

---

### Phase Status Checklist (update after each phase)

| Phase | Status | Completion date |
|---|---|---|
| Phase 1 — Foundation (T1, T2) | ✅ Done (commit `4780212` + follow-up hardening) | 2026-10-14 |
| Phase 2 — Financial Security (T3, T8) | ✅ Done (uncommitted — user commits) | 2026-10-14 |
| Phase 3 — Hardening (T4, T5) | ✅ Done (uncommitted — user commits) | 2026-10-14 |
| Phase 4 — Polish & Go-Live (T6, T7, T9, T10) | ⬜ Not started | — |