# Out-of-scope findings

Bugs found while working the audit that fall **outside** the task allowlist (§0A) and were
therefore **not** fixed (§0D.2). Recorded here so a later session can pick them up.

## 1. `gateway.test.ts` per-key rate-limit test is timing-dependent (flaky against a slow DB)

- **File:** `apps/api/src/routes/gateway.test.ts:114` — `P1-04: per-key 429 carries Retry-After and zero remaining`
- **Supporting source:** `apps/api/src/ratelimit.ts:93-105` (`RATE_WINDOW_SECONDS = 60`, fixed window via
  `Math.floor(now / windowMs)` bucket key)
- **Symptom:** the test fires 121 sequential requests in a `for` loop and asserts the 121st returns 429.
  Against the remote Neon DB each request takes >1 s, so the loop spans ~140 s — crossing several
  60-second windows. The bucket key changes mid-loop, the counter resets, and the 121st request still
  reads `200`, so the assertion fails with `200 !== 429`.
- **Why it is not in scope:** touched files (`gateway.test.ts`, `ratelimit.ts`) are outside the phase-2
  allowlist and unmodified vs `HEAD`. The failure is environmental (DB latency), not a regression from
  phase 2 — it reproduces in isolation with no phase-2 code involved.
- **Possible directions for whoever owns this (do not act without an explicit task):**
  - Make the test drive the limiter deterministically (call `checkRateLimit` directly with a fixed clock,
    or inject a clock / pre-seed the counter) instead of relying on wall-clock elapsed time.
  - Or point the limiter at the in-memory store + fake timers for this test.
  - Or raise the fixed-window behaviour to a sliding window, if that is the intended product behaviour
    (that is a design decision, not a test fix).