# Implementation Plan Rev 2.2 (Final, Agent-Executable)

Supersedes Rev 1, Rev 2 and Rev 2.1 completely. Where an older revision disagrees with this one, **this one wins**. Nothing from older revisions is normative unless repeated here.

Accompanying files (hand these to the agent together with this plan): `sse-sanitize.ts`, `sse-sanitize.test.ts`, `v1-integration.md` (Phase 0 starting point, already tested in isolation). If they are not available, implement from **Appendix A**.

---

## 0. Rules for the implementing agent (read before touching anything)

### 0.1 Operating rules
1. **Scope is an allowlist.** Each phase lists the files you may modify. Any file not listed is **read-only** for that phase. If you believe another file must change, **stop and ask**; do not edit it.
2. **Never invent symbols.** Only use function/variable/table/column names that (a) appear in §3 "Ground truth", (b) are introduced by this plan, or (c) you verified by reading the repo. If a name is not in (a)-(c), grep for it. If it does not exist, stop and report.
3. **Names from older plan revisions are obsolete** and must not be used: see Appendix C.
4. **One phase = one branch = separate PRs/commits as listed.** Do not combine phases. Do not start a phase until the previous one is merged and `typecheck` + tests are green.
5. **Pre-flight first.** Before writing code for a phase, complete every `[PREFLIGHT]` item that phase references and paste the findings table into the PR description. If a finding contradicts this plan, **stop and report** instead of adapting silently.
6. **No drive-by changes.** No reformatting, renaming, moving files, dependency upgrades, lint-only edits, or "while I'm here" fixes. Bugs you notice outside scope go into the PR description under "Observed, not fixed".
7. **No new dependencies** (runtime or dev). Use the repo's existing test runner and libraries.
8. **Existing migrations are immutable.** Only add new migrations via the repo's drizzle workflow; review the generated SQL; additive changes only (no DROP, no type changes on existing columns).
9. **Never run migrations, seeds, or any write SQL against a production database.** Use a local/dev database only. Seed scripts are *delivered as files for a human to run*, never executed by you against shared environments.
10. **Secrets:** never log, serialize or return credentials, API keys, or the routing snapshot's credential data. Never commit `.env` files.
11. **Public API shape is frozen** except where this plan lists an explicit change (error codes/status listed in Appendix B, new `Retry-After` header, removal of `status` field in the upstream error envelope, `partial` internal status).
12. **Every behavior change needs a test that fails before and passes after** (listed per phase). Run the full suite and typecheck before each commit.
13. **Report format** at the end of each phase: what changed (files), tests added, PREFLIGHT table, deviations, "Observed, not fixed".

### 0.2 Global denylist (never modify in ANY phase unless a phase explicitly lists the file)
- `apps/api/src/middleware/auth.ts` (API key auth, `gatewayGuards`, `ipRateLimit`) and any other auth/guard logic
- `packages/shared/**` (including `chatCompletionRequestSchema`, credits, provider-crypto, models). If PREFLIGHT P4 shows `stream_options` is stripped by the schema, **stop and ask**; do not edit it yourself.
- Payment code (Duitku, PayPal), `lib/notify.ts`, email/Telegram senders (except the single new function in 1F)
- All frontend apps and dashboard pages (they are read-only consumers; compatibility is a requirement, not something you edit)
- `catalog.ts` and anything under `/v1/catalog`
- `apps/api/src/routes/**` other than `v1.ts`
- Existing drizzle migration files; `package.json` / lockfiles; CI config
- `DEPLOYMENT_VPS.md`, `docker-compose.yml`, Nginx files: only in Phase 2C

### 0.3 Glossary (do not confuse these)
- `publicModelId`: the string the user sends as `model` (e.g. `deepseek-v4.1-flash`). Also called `body.model` in `v1.ts`.
- `modelId`: the uuid primary key of `models` (`models.id`); `ResolvedRoute.modelId`.
- `providerId`: uuid of `providers`.
- `providerModelId`: the model string a *specific provider* expects. In the DB today: `models.providerModelId`. After Phase 1: `model_provider_pool.provider_model_id` per entry.
- **Pool**: the set of `model_provider_pool` rows for a `modelId`.
- **Candidate**: one usable (pool entry or legacy provider) for a model, in attempt order.
- **Route plan**: per-request object that yields candidates one by one (§6.1D).
- **Circuit key**: `(providerId, providerModelId)`.

---

## 1. Goals

1. Close the provider-identity leak and the billing leaks that exist **today** (Phases 0 and 0.5).
2. Multiple providers per model with priority order, weighted spread inside equal priority, bounded failover, no user-visible provider details (Phase 1).
3. Minimal Neon round-trips on the hot path; resilient to Neon/Redis slowness (Phase 1).
4. Safe to run a second API node behind Nginx (Phase 2).

Non-goals: admin UI for pools, cost-based routing, mid-stream failover, changing auth/credits/pricing models.

---

## 2. Locked decisions (veto only by editing this section)

| ID | Decision |
|---|---|
| D1 | Phase order: **0 → 0.5 → 1A..1G → 2A..2C**. Each independently shippable. |
| D2 | Legacy `models.fallback_provider_id` path is used **only when a model has zero enabled pool entries**. Pool exhausted ⇒ error, never legacy. |
| D3 | Unknown or `inactive` model ⇒ 404 `model_not_found` (unchanged). Known model with no usable candidate ⇒ **503** (`provider_not_configured` if no candidate survives filtering, `provider_unavailable` + `Retry-After` if all circuits are open). |
| D4 | Max attempts per request = `MAX_POOL_ATTEMPTS` (default 3), sequential. |
| D5 | Failure classification is **Appendix B**, single source of truth in code (`normalizeUpstreamError`). 401/402/403/404-from-provider now fail over and count toward the circuit; they also raise a rate-limited alert. |
| D6 | Circuit breaker key is per `(providerId, providerModelId)`. Semantics stay "consecutive failures" (success clears the counter); this is documented, not changed. |
| D7 | Half-open admits **exactly one** trial request. |
| D8 | Billing: client abort after the upstream returned 200 on a stream ⇒ status `partial`, charged for prompt + tokens delivered so far. Upstream break mid-stream with ≥1 delivered content token ⇒ `partial` (charge) by default; env `PARTIAL_BILLING_UPSTREAM_BREAK=refund` flips it. Zero delivered tokens + upstream failure ⇒ `error` (full refund). Abort **before** upstream headers ⇒ `error` (full refund, unchanged). |
| D9 | Parity invariant: every enabled pool entry must serve the model at **≥ `models.context_length`** and support **all** `models.capabilities`. Enforced at seed/admin time, not per request. |
| D10 | `UNIQUE(model_id, provider_id)` stays (known limitation: no two keys/accounts of one provider per model). |
| D11 | Background jobs use a **time-based lease table**, not static primary flags and not advisory locks. |
| D12 | Redis outage = **fail-open** for rate limit, concurrency and circuit state. |
| D13 | Default `UPSTREAM_TOTAL_TIMEOUT_MS` in code stays at the **current 55 000 ms** (read from `UPSTREAM_TIMEOUT_MS` if the new variable is unset). Home-server deployments raise it via env. No hidden behavior change from code defaults. |
| D14 | `connection: close` removal ships as its own commit. |

---

## 3. Ground truth about the current code (do not re-derive, do not contradict without evidence)

### 3.1 `apps/api/src/routes/v1.ts` (read in full by the plan author)
- Flow of `POST /chat/completions`: parse body with `chatCompletionRequestSchema.safeParse` → `resolveModelWithFallback(body.model)` (null ⇒ 404 `model_not_found`) → `!route.credential` ⇒ 503 `provider_not_configured` → `estimatePromptTokens` → `reserve({... model: { id: route.modelId, contextLength, pricing }, ...})` (`InsufficientCreditsError` ⇒ 402) → `dispatch(route)` via `callProvider` → single runtime failover via `resolveRuntimeFallback` (only on network error or status ≥ 500; not on timeout; not on client abort) → error branches (`'err' in attempt`, `!upstream.ok`) each call `settle({status:'error', ...})` and `logRequest` and return their own JSON envelopes → `recordSuccess(route.providerId)` → streaming (`streamSSE`) or non-streaming.
- Streaming today: inside one `try`, `reader.read()` loop; **writes the raw upstream chunk first** (`stream.write(chunkText)`), then splits lines to extract `usage` / delta text. One `catch` sets `failed = true` for *any* error (upstream or client). After the try: computes tokens (`usage?.completion_tokens` → last known → `estimatePromptTokens(completionText)`), `settle({status: failed ? 'error' : 'success'})`, `afterSettle`, `logRequest`.
- Non-streaming today: `upstream.text()` → best-effort JSON parse for `usage` → `settle` as success → returns `c.body(text, upstream.status, {'content-type':'application/json'})` (raw upstream text).
- Local helpers: `isTimeoutError`, `afterSettle`, `deltaText` (only reads `choices[].delta.content`).
- Error envelope for `!upstream.ok` currently includes `status: upstream.status` (leak).
- `recordFailure` is called in the retry block only if a fallback exists, and again after the loop for the last attempt (so failures are recorded once per attempt today; this must stay true).
- Client abort before headers: the fetch rejects with `AbortError`, falls into `normalizeUpstreamError('network')` (`countAsFailure: true`) ⇒ **bug**: counts against the provider.

### 3.2 `apps/api/src/domain/router.ts` (read in full)
- Exports: `ResolvedRoute`, `resolveModelWithFallback`, `resolveRuntimeFallback`, `resolveModel` (alias), `UpstreamRequest`, `IAiProviderAdapter`, `OpenAiCompatibleAdapter`, `ProviderAdapterFactory`, `callProvider`, `NormalizedError`, `normalizeUpstreamError`. Internals: `ModelRow`, `resolveModelRow` (one Neon query per call; two for deprecated redirects), `buildRoute`, `resolveFallback`.
- `ResolvedRoute` fields: `providerName, baseUrl, credential, providerModelId, modelId, contextLength, pricing, upstreamPricing, providerId, isUsingFallback, deprecationWarning`.
- Deprecation: if `modelStatus==='deprecated'` and `replacementModelAlias` resolves to an `active` model whose provider is active and circuit not open ⇒ route to the replacement (builds the route from the replacement's **primary** provider only, bypassing any pool) with a warning string. Otherwise serves the deprecated model itself.
- `resolveRuntimeFallback` returns null if `row.modelId !== failed.modelId` (always true for redirected aliases ⇒ runtime failover is silently dead for them today).
- `OpenAiCompatibleAdapter.dispatchRequest`: payload `{...body, model: route.providerModelId, stream}`; forces `stream_options.include_usage = true` when streaming; sends header `'connection': 'close'`; timeout = `AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)` combined with the client signal via `AbortSignal.any`. That timeout covers the **entire streamed body**. Default 55 000 ms (comment references Vercel's 60 s limit).
- `normalizeUpstreamError`: 'timeout' → 504 no-count; 429 → 429 count; 401/403 → 503 `provider_auth_failed` **no-count**; 'network' or ≥500 → 502 count; default → 502 no-count.
- `resolveProviderCredential` runs AES-256-GCM decrypt on every `buildRoute`.

### 3.3 `apps/api/src/domain/circuit-breaker.ts` (read in full)
- Exports: `CBState`, `CircuitBreakerState`, `getCircuitState`, `isCircuitOpen`, `recordFailure`, `recordSuccess`. Key `cb:provider:${providerId}`. Env: `CB_FAILURE_THRESHOLD` (5), `CB_FAILURE_WINDOW_MS` (60 000), `CB_OPEN_DURATION_MS` (120 000); `STATE_TTL_MS` 5 min. Redis hash, or an in-process `Map` when `redis` is null.
- `isCircuitOpen`: when `openUntil` passed, writes `half-open` and returns **false for every caller** (no single-trial guard).
- `recordSuccess` deletes the key ⇒ counter clears ⇒ breaker trips on **consecutive** failures only.
- `persistTransition` writes the state object to `providers.circuitBreakerState` on transitions (shape `{state, failures, openUntil, lastFailure}`).
- Redis errors in `getCircuitState` are caught and return the default closed state (already fail-open).

### 3.4 Reported by the repo agent's verification (spot-check, then trust)
- `connection: close` at `router.ts:~211`, from commit `6c31099e`, no comment. `include_usage` forcing at `router.ts:~208`.
- Only `v1.ts` imports router functions.
- `billing.ts:~203`: `settle({status:'error'})` ⇒ `actualCredits = 0`, full refund. `usage_records.status` is a `text` column without constraint (no DDL needed for a new value) **[PREFLIGHT P5 to confirm]**.
- `lib/redis.ts`: `enableOfflineQueue` default (true), no `commandTimeout`.
- `ratelimit.ts` + `redis-store.ts`: `RedisRateLimitStore` with an atomic Lua `ACQUIRE_SCRIPT` (sorted set, TTL 300 s). Multi-node safe as long as `REDIS_URL` is set.
- `index.ts:~34-79`: 5 background intervals: `sweepExpiredReservations`, `purgeInterval`, `checkProviderHealth`, `sweepStaleDuitkuPayments`, `reconcilePaypalPayments`.
- Dashboards read `providers.circuitBreakerState` (`admin/page.tsx:~264`, `models-view.tsx:~210`).

---

## 4. PREFLIGHT checklist (do once, paste results in the first PR)

| ID | Check | Why it matters |
|---|---|---|
| P1 | Test runner, `typecheck`/`lint` script names, where tests live | Use the existing runner; no new deps |
| P2 | Versions of `hono` and `@hono/node-server`; whether `c.req.raw.signal` aborts on client disconnect; whether `stream.onAbort` / `stream.aborted` exist; whether code after `stream.write` throws/continues after disconnect | Phase 0.5 abort detection |
| P3 | DB driver (`neon-http` vs pooled websocket/pg) and whether `db.execute(sql\`...\`)` works | Phase 2A lease SQL |
| P4 | Does `chatCompletionRequestSchema` preserve `stream_options` (and unknown keys)? | Phase 0 usage stripping. If stripped: **stop and ask** |
| P5 | `usage_records.status` type (text vs pgEnum) and **every consumer** of status values (dashboards, analytics, reconcilers, sweeper). Also the `status` union type in `logRequest` | Phase 0.5 |
| P6 | Where `logRequest` persists (table/columns or console only) | Phase 1F |
| P7 | Redis client library/version in `lib/redis.ts`; any other user of that client (queues, pub/sub); location of the `ACQUIRE_SCRIPT` TTL constant | Phase 1A |
| P8 | What `checkProviderHealth` does with the circuit breaker and what its interval is | Phase 1C |
| P9 | Grep every caller of `isCircuitOpen`, `recordFailure`, `recordSuccess`, `getCircuitState` repo-wide | Phase 1C signature change |
| P10 | Column type of `providers.circuit_breaker_state` and whether dashboards validate its shape strictly | Phase 1C additive fields |
| P11 | Which `providers` rows are **brand-only** (shown in catalog but not actually routable) | Phase 1B seed |
| P12 | Deployment targets still in use (home server only, or any Vercel); SIGTERM/graceful-shutdown handling in `index.ts` | Timeouts, Phase 2 |
| P13 | Idempotency of each of the 5 background jobs (what happens if two nodes run the same tick) | Phase 2A |
| P14 | API of `lib/alert.ts` (how Telegram alerts are sent) | Phase 1F |
| P15 | `settle()` internals beyond status handling (capping at the reserved estimate, ledger writes, existing tests) | Phase 0.5 |

---

## 5. Phase 0: Sanitizer & standalone hardening (no schema change)

**Goal:** stop provider identity leaks and the abort miscount without any routing change.

**Files you MAY modify/create:**
- NEW `apps/api/src/lib/sse-sanitize.ts`, NEW `apps/api/src/lib/sse-sanitize.test.ts`
- `apps/api/src/routes/v1.ts` (only the blocks named below)
- `apps/api/src/domain/router.ts` (only commit 0f: delete the single `'connection': 'close'` header entry)

**Commits (separate, in this order):**

**0a. Sanitizer module + tests** (new files only). Contract in Appendix A, including the usage-stripping option (`clientWantsUsage`) which the delivered file does not yet have: add it with the tests described in Appendix A.

**0b. Integrate into `v1.ts`** following `v1-integration.md` (streaming block and non-streaming block), plus:
- Pass `clientWantsUsage = (rawBody?.stream_options?.include_usage === true)` (Option A: reads the **client's** value from raw JSON in `v1.ts` so `packages/shared` is untouched; the adapter's forced value lives only in the outbound payload).
- Stream that finishes with **zero valid chunks** (everything dropped or empty) ⇒ treat as failed: `settle` status `error` (full refund), `errorType: 'invalid_upstream_response'`, and write one generic SSE error chunk (`GENERIC_ERROR_PAYLOAD`) followed by `data: [DONE]\n\n`.
- Non-stream: `sanitizeCompletionBody` failure ⇒ 502 envelope `{error:{message:'upstream provider error', type:'server_error', code:'provider_error'}}`, `recordFailure`, `settle` status `error`.

**0c. Abort miscount fix.** In the `'err' in attempt` branch: `recordFailure` only if `norm.countAsFailure && !c.req.raw.signal.aborted`. Decide by `c.req.raw.signal.aborted` **only**; do **not** match on the error's name (Phase 1 introduces other abort reasons).

**0d. Envelope cleanup.** Remove the `status: upstream.status` property from the `upstream provider error` response in the `!upstream.ok` branch. Keep `norm.httpStatus` as the response status.

**0e. (inside 0b/0a)** Usage stripping rules (see Appendix A): if the client did not ask for usage, always delete the `usage` key from forwarded chunks (including `"usage": null`), and drop chunks whose `choices` is empty/missing. Usage is still passed to the internal `onChunk` callback for billing before stripping.

**0f. Remove `'connection': 'close'`** from `OpenAiCompatibleAdapter.dispatchRequest` headers. One-line commit, own PR if possible.

**Tests required (in addition to Appendix A's):**
- v1-level: non-stream upstream returns `200 text/html` ⇒ client gets 502 envelope, ledger refunded, body contains no upstream text.
- v1-level: stream upstream sends `data: {"error":...}` mid-stream ⇒ client receives generic error chunk only.
- v1-level: client abort before headers ⇒ `recordFailure` **not** called.
- Stream with `include_usage` omitted ⇒ client receives no usage; internal billing still uses upstream usage (assert `settle` got the upstream token counts).
- Stream with `include_usage: true` ⇒ usage chunk forwarded (with `model` rewritten).

**Acceptance:** suite + typecheck green; manual curl (stream and non-stream) against a provider whose model string differs from the public id shows `model` equal to the public id in every chunk.
**Rollback:** revert the PR(s). 0f is independently revertible; after deploying 0f watch logs for `ECONNRESET`/`terminated` for a few days.

---

## 6. Phase 0.5: Partial-stream billing hotfix

**Problem (verified):** any exception in the streaming loop, including the client simply disconnecting, sets `failed = true` ⇒ `settle(status:'error')` ⇒ 100 % refund, although the user already received the content and the upstream is billing us. Free tokens for anyone who disconnects after the last content chunk.

**Files you MAY modify/create:**
- `packages/db/src/billing.ts` (only `settle` and its input type)
- `packages/db/src/schema.ts` (only a type annotation/comment for the new status value; **no migration** unless PREFLIGHT P5 shows an enum)
- `apps/api/src/routes/v1.ts` (the streaming block only)
- `apps/api/src/middleware/logger.ts` (only the `status` union type of `logRequest`)
- NEW test files and NEW test helper `apps/api/src/test-helpers/mock-upstream.ts`
- Type-only edits in other files that fail to compile because of the widened `status` union (list them in the PR)

**Policy (D8, normative):**

| Situation | `settle.status` | Charge |
|---|---|---|
| Upstream non-2xx / network error before headers | `error` | none (unchanged) |
| Client aborted before upstream headers | `error` | none (unchanged; known residual risk §11) |
| Stream completes normally | `success` | actual usage (unchanged) |
| Client disconnected **after** upstream returned 200 | `partial` | prompt tokens + completion tokens delivered so far (even if 0 completion tokens) |
| Upstream broke mid-stream, ≥ 1 content token delivered | `partial` (or `error` if `PARTIAL_BILLING_UPSTREAM_BREAK=refund`) | as above |
| Upstream broke mid-stream, 0 content tokens delivered | `error` | none |
| Stream produced zero valid chunks (Phase 0b) | `error` | none |

Token sources for `partial`: `promptT = usage?.prompt_tokens ?? promptTokens (estimate)`; `completionT = usage?.completion_tokens ?? lastKnownCompletionTokens ?? estimatePromptTokens(completionText)`. For estimation, `completionText` must include `choices[].delta.content` **and** `choices[].delta.reasoning_content` / `choices[].delta.reasoning` when they are strings (extend `deltaText`; reasoning models otherwise look like 0 tokens).

**Implementation requirements:**
1. `settle`: accept `status: 'success' | 'error' | 'partial'`. `partial` is chargeable exactly like `success` (same pricing, same capping at the reserved estimate, same upstream cost calc); the stored status string is `partial`. `error` behavior unchanged. Do not restructure the rest of `settle`.
2. Streaming block: **separate the two failure sources**. Wrap `reader.read()` in its own try/catch (⇒ `upstreamBroke`) and `stream.write(...)` in its own try/catch (⇒ `clientGone`). Also set `clientGone` when `c.req.raw.signal.aborted` is true, and via `stream.onAbort(...)` / `stream.aborted` if PREFLIGHT P2 says they exist. When `clientGone`, call `reader.cancel()` and stop reading; **still run settle/log afterwards** (verify via the real-socket test that code after the abort executes in the installed Hono version; if it does not, stop and report).
3. Decision after the loop: `clientGone` ⇒ `partial`; `upstreamBroke` ⇒ per table; otherwise `success`. `errorType` for partial/abort cases: `client_disconnected`; for upstream break: `stream_disconnected` (existing value).
4. `logRequest` status union gains `'partial'`; `afterSettle` runs for `partial` too.
5. Update every consumer found in PREFLIGHT P5 only as far as needed to compile and to treat `partial` as a **non-error** (error-rate metrics must not count it as error). Do not redesign dashboards.

**Tests (write them FIRST, confirm they fail on current code):**
- **Real socket test** (not a mocked signal): start the API app on an ephemeral port with `@hono/node-server` (or the repo's existing harness), a mock upstream HTTP server that streams N content chunks slowly, and a client that opens the request with `node:http` and `destroy()`s the socket after the first content chunk. Assert: usage record status `partial`, `creditsConsumed > 0`, remainder refunded.
- Client disconnects right after headers, 0 content tokens ⇒ `partial`, charged for prompt tokens only.
- Upstream closes the connection after 2 chunks ⇒ `partial` (default) / `error` with the env flag.
- Upstream closes before any content chunk ⇒ `error`, full refund.
- Client abort **before** headers ⇒ `error`, full refund, no `recordFailure`.
- Reasoning-only stream (`reasoning_content` deltas) aborted early ⇒ charged > 0.

**Acceptance:** all above green; manual `curl -N` + Ctrl-C shows a `partial` usage row with a non-zero charge.
**Rollback:** revert PR; `partial` rows already written remain valid data (status is free text).

---

## 7. Phase 1: Provider pool, circuit isolation, failover

Sub-phases are separate PRs in this order. 1B and 1C may be developed in parallel but merge 1B first.

### 7.1A Redis hardening

**Files MAY modify:** `apps/api/src/lib/redis.ts`, `apps/api/src/lib/redis-store.ts` (the rate-limit/concurrency store), the file that defines the Lua slot TTL if different (per P7), NEW tests.
**Do NOT touch:** `middleware/auth.ts` (guards call the store; they must keep working unchanged).

Requirements:
1. Client options: `enableOfflineQueue: false`, `maxRetriesPerRequest: 1`, `commandTimeout` from `REDIS_COMMAND_TIMEOUT_MS` (default 100), `connectTimeout` from `REDIS_CONNECT_TIMEOUT_MS` (default 1000). Adapt option names to the actual client library found in P7. If another subsystem shares the client and needs queueing (P7), **stop and ask**.
2. Every Redis call in `redis-store.ts` is wrapped: on error/timeout log a warning (rate-limited to avoid log floods) and **fail open**:
   - rate-limit increment ⇒ allow the request
   - concurrency acquire ⇒ allow, record no slot
   - concurrency release ⇒ retry **once** immediately; if still failing, give up silently (slot expires by TTL)
3. Concurrency slot TTL (currently 300 s) must be **> `UPSTREAM_TOTAL_TIMEOUT_MS`/1000 + 60**. Compute from the env instead of a literal.
4. Document in a code comment: during boot, commands issued before the connection is ready fail and therefore fail open (a brief unlimited window at startup).

Tests: simulate Redis down (stub client throwing) ⇒ requests pass, no 500; release failure retried once; slot TTL derived from env.

### 7.1B Schema + seed

**Files MAY modify/create:** `packages/db/src/schema.ts`, NEW migration (generated), NEW `packages/db/scripts/seed-model-provider-pool.sql` (or the repo's existing scripts convention; do not create a new convention if one exists), NEW tests.

Table `model_provider_pool`:

| Column | Type / rule |
|---|---|
| `id` | uuid pk |
| `model_id` | uuid fk → `models.id`, `ON DELETE RESTRICT` |
| `provider_id` | uuid fk → `providers.id`, `ON DELETE RESTRICT` |
| `provider_model_id` | text, not null |
| `priority` | int, not null (lower = first) |
| `weight` | int, not null, default 100 |
| `is_enabled` | boolean, not null, default true |
| `cost_input_per_1m`, `cost_output_per_1m` | nullable; override applies only if **both** non-null (same rule as today's `upstreamPricing`) |
| `ttfb_timeout_ms` | int nullable (per-entry override for slow-first-token models) |
| `data_policy` | text nullable (informational tag) |
| `created_at`, `updated_at` | timestamps |

Constraints: `UNIQUE(model_id, provider_id)`; index `(model_id, priority)`. Extend `modelsRelations` with `providerPool: many(...)`. Add a schema comment stating the D9 parity invariant. `models.fallback_provider_id` stays (comment: deprecated, used only when pool is empty).

Seed script (idempotent, `ON CONFLICT DO NOTHING`): for each model with status in (`active`,`deprecated`): priority 1 from `models.provider_id` + `models.provider_model_id`; priority 2 from `fallback_provider_id` if set and different (same `provider_model_id` string, matching today's behavior). **Skip brand-only providers** identified in PREFLIGHT P11. The script's header comment must list the assumptions and that a human runs it after reviewing the output of a `SELECT` preview included in the same file.

Tests: migration applies on a clean dev DB; unique constraint rejects duplicates; RESTRICT blocks deleting a referenced provider.

### 7.1C Circuit breaker

**Files MAY modify:** `apps/api/src/domain/circuit-breaker.ts`, callers found in P9 (signature updates only), NEW tests.

Requirements:
1. **New signatures, all parameters required** (so `tsc` flags every caller): `checkCircuit(providerId, providerModelId)`, `recordFailure(providerId, providerModelId)`, `recordSuccess(providerId, providerModelId)`, `getCircuitState(providerId, providerModelId)`, `releaseTrial(providerId, providerModelId)`. Remove the old `isCircuitOpen` export (rename, do not keep an alias; an alias would hide missed call sites). `checkCircuit` returns `{ open: boolean; isTrial: boolean; retryAfterMs: number | null }`.
2. Key: `cb:${providerId}:${providerModelId}`. Old `cb:provider:*` keys are orphaned and expire by TTL; no migration of state.
3. **Single trial.** In `checkCircuit`: if state is `open` and `openUntil` not passed ⇒ `{open:true}`. If state is `open` (expired) **or** `half-open`: atomically try `SET cb:trial:${providerId}:${providerModelId} 1 NX PX <CB_TRIAL_TTL_MS>`; success ⇒ ensure state `half-open`, return `{open:false,isTrial:true}`; failure ⇒ `{open:true}`. `CB_TRIAL_TTL_MS` default = `UPSTREAM_TOTAL_TIMEOUT_MS + 5000`. In-memory fallback (no Redis) implements the same NX semantics. `recordSuccess` and `recordFailure` delete the trial key. `releaseTrial` deletes it without recording anything (used on client abort or non-failover outcomes).
4. **Memo:** in-process cache of **open=true** results only, TTL `min(2000ms, retryAfterMs)`. Never memoize `open:false` or trial results.
5. `recordFailure` / counting logic unchanged (consecutive-failures semantic). Fix the misleading comment ("failures within window" ⇒ "consecutive failures; success clears the counter").
6. **Aggregate to the provider row** (dashboard compatibility): implement `computeProviderAggregate(providerId)` that reads the current state of **all** circuits for that provider (enumerate that provider's pool entries from the DB, plus legacy `models.provider_model_id` rows where the provider is `models.provider_id`/`fallback_provider_id`) and produces `{state, failures, openUntil, lastFailure, openModels, totalModels}`:
   - `state`: `open` only if **all** models are open; else `half-open` if **any** is half-open; else `closed`
   - `failures`: max across models; `openUntil`: latest among open ones; `lastFailure`: latest
   - `openModels`/`totalModels`: **additive** fields (P10 must confirm the dashboard tolerates extra keys; if it validates strictly, drop these two fields and **ask**)
   Call it (a) fire-and-forget after each circuit transition and (b) from `checkProviderHealth` each tick (self-healing). Write to `providers.circuitBreakerState` only when the computed value differs from what was last written by this process. Remove the old per-transition `persistTransition` direct write. Swallow and log errors (never break a request).
7. `checkProviderHealth` (P8): update only as needed to use the new signatures/aggregate; do not change its alerting behavior.

Tests: model isolation (429s on model A do not open model B); N parallel `checkCircuit` on an expired-open circuit ⇒ exactly one `isTrial:true`; trial key cleared by `recordSuccess`/`recordFailure`/`releaseTrial`; trial key expires via TTL if never released; memo never returns stale `false`; aggregate rules (all open ⇒ open; one half-open ⇒ half-open; partial open ⇒ closed with `openModels`>0); Redis down ⇒ `checkCircuit` returns `{open:false,isTrial:false}` (fail-open).

### 7.1D Router: snapshot cache + route plan

**Files MAY modify:** `apps/api/src/domain/router.ts`, NEW `apps/api/src/domain/router.test.ts`. `routes/v1.ts` is **not** touched in this PR except the minimal compile fixes agreed in 1E (prefer: keep `resolveModelWithFallback`/`resolveRuntimeFallback` exported and working until 1E merges).

**A. Snapshot cache**
- One module-level snapshot with all `models`, all `providers`, all `model_provider_pool` rows; built with **at most 3 queries in parallel** (no N+1). Includes `inactive` models (so 404 vs 503 can be told apart).
- Indexes: by `publicModelId`, by `normalizeModelId(publicModelId)`, by `modelId`.
- TTL `ROUTER_CACHE_TTL_MS` (default 30 000). **Single-flight** refresh (concurrent callers await the same promise). **Stale-if-error**: if refresh fails, keep serving the previous snapshot, log, retry after 5 s backoff. If there has never been a successful load, throw and let `v1.ts` answer 503 `routing_unavailable`.
- Unknown `publicModelId` is answered from the snapshot (no DB hit).
- Export `invalidateRouterCache()` (tests, future admin).
- Decrypted credentials are memoized **per provider for the snapshot's lifetime**, stored in a module-private `Map`, never attached to objects that get logged/serialized, and never included in any error message. A provider whose credential resolves to null is excluded from candidates.

**B. Route plan**
```
createRoutePlan(publicModelId, opts?: { rng?: () => number }):
  Promise<{ kind: 'not_found' } | { kind: 'ok'; plan: RoutePlan }>

RoutePlan {
  modelId; contextLength; pricing;            // model-level, identical for all candidates
  deprecationWarning: string | null;
  candidateCount: number;                     // after filtering, before circuit checks
  next(): Promise<ResolvedRoute | null>;      // next usable candidate (skips open circuits)
  retryAfterMs(): number | null;              // earliest reopen among circuits skipped so far
}
```
Rules:
1. Not in snapshot, or `inactive` ⇒ `not_found`.
2. **Deprecation:** if the model is `deprecated` and `replacementModelAlias` resolves (by `publicModelId` or normalized) to an `active` model that has ≥ 1 candidate **whose circuit is not open (use a read-only peek that never acquires a trial)** ⇒ use the replacement model (its pool/legacy candidates, its pricing, its `modelId`) and set `deprecationWarning` to the exact current text: ``model '${publicModelId}' is deprecated; redirected to '${replacementModelAlias}'``. Otherwise serve the deprecated model itself with warning ``model '${publicModelId}' is deprecated``. Non-deprecated ⇒ no warning.
3. **Candidate list** (built once per plan): if `POOL_ENABLED` and the model has ≥ 1 enabled pool entry: those entries whose provider `status==='active'` and credential non-null. Else (**legacy**): primary (`models.providerId`, `models.providerModelId`) then fallback (`fallbackProviderId`, same `providerModelId`, only if different and active), each only if active with a credential. Never mix the two sources (D2).
4. **Ordering:** ascending `priority`; within equal priority, weighted random without replacement (`weight` ≤ 0 entries go after positive-weight ones, in stable order). RNG is injectable for tests.
5. `next()`: iterate remaining candidates; for each call `checkCircuit(providerId, providerModelId)`; open ⇒ skip (record `retryAfterMs`); allowed ⇒ return a `ResolvedRoute`. Exhausted ⇒ `null`.
6. `ResolvedRoute` keeps all current fields and adds `attemptIndex: number` (0-based position among **returned** routes), `isTrial: boolean`, `ttfbTimeoutMs: number | null` (from the pool entry). `isUsingFallback = attemptIndex > 0`. `providerModelId` = the candidate's own. `upstreamPricing` = pool override when both cost fields set, else model-level (today's rule).
7. `CB_LAST_RESORT=true` (default **false**): if the very first `next()` would return null **only because of open circuits**, return the candidate with the earliest `openUntil` once (flagged `isTrial:false`).
8. Keep `resolveModelWithFallback`, `resolveModel`, `resolveRuntimeFallback` working (reimplemented on top of the snapshot or untouched) until 1G removes them. They must not break while 1E is in review.

Tests: priority/weight ordering with seeded RNG; disabled/inactive/no-credential filtered; legacy only when pool empty; `POOL_ENABLED=false` ignores pool rows; deprecation redirect uses the replacement's pool and pricing; redirect skipped when replacement's circuits are all open; `not_found` vs `candidateCount===0` vs all-open (`next()` null with `retryAfterMs` set); single-flight (50 concurrent callers ⇒ 1 refresh); stale-if-error; unknown id never queries the DB after the first load; credentials never appear in `JSON.stringify` of the plan or logs.

### 7.1E Failover loop in `v1.ts` + adapter timeouts

**Files MAY modify:** `apps/api/src/routes/v1.ts` (the section from `resolveModelWithFallback` through the end of the error branches; the sanitizer/stream/non-stream success code from Phases 0/0.5 stays as is), `apps/api/src/domain/router.ts` (adapter + `normalizeUpstreamError` only), NEW tests + the Phase 0.5 mock-upstream helper.

**Adapter (`OpenAiCompatibleAdapter.dispatchRequest`)**
- Add optional `ttfbTimeoutMs?: number` to `UpstreamRequest`; applied **only when `stream` is true**: per-attempt `AbortController`, `setTimeout(() => ctrl.abort(Object.assign(new Error('ttfb timeout'), {name:'TtfbTimeoutError'})), ms)`, cleared when `fetch` resolves (headers received) and on any rejection. Effective TTFB = `route.ttfbTimeoutMs ?? UPSTREAM_TTFB_TIMEOUT_MS (15000)`.
- Final signal = `AbortSignal.any([clientSignal?, totalTimeoutSignal, ttfbController?.signal])`. Total timeout = `UPSTREAM_TOTAL_TIMEOUT_MS` (fallback `UPSTREAM_TIMEOUT_MS`, default 55 000; D13).
- Non-streaming requests get **no** TTFB timeout (headers arrive after full generation); only the total timeout.

**`normalizeUpstreamError`** implements Appendix B exactly. Extend the input union to `number | 'timeout' | 'ttfb_timeout' | 'network' | 'invalid_body' | 'client_abort'` and extend `NormalizedError` with `failover: boolean` and `alert: boolean`. Update the existing tests that asserted `countAsFailure:false` for 401/403 (consciously; mention in the PR).

**Attempt classification in `v1.ts`** (order matters): `clientAborted = c.req.raw.signal.aborted` ⇒ `'client_abort'`; else `e.name==='TtfbTimeoutError'` ⇒ `'ttfb_timeout'`; else `isTimeoutError(e)` ⇒ `'timeout'`; else `'network'`. HTTP responses classify by status. For non-streaming, a 2xx whose body fails `sanitizeCompletionBody` ⇒ `'invalid_body'`.

**Loop contract**
1. `createRoutePlan(body.model)`: `not_found` ⇒ 404 (unchanged envelope/log). Snapshot never loaded ⇒ 503 `routing_unavailable`.
2. `route = await plan.next()`. If null: `plan.candidateCount === 0` ⇒ 503 `provider_not_configured` (unchanged message); else 503 `provider_unavailable` with header `Retry-After: ceil(retryAfterMs/1000)` clamped to [1,120]. **No reservation exists yet**, nothing to release. Log with `errorType` accordingly.
3. Set `c.header('X-Morphic-Warning', ...)` from `plan.deprecationWarning` (unchanged behavior).
4. `reserve(...)` **once**, using `plan.modelId`, `plan.contextLength`, `plan.pricing` (unchanged logic).
5. Attempt loop, up to `MAX_POOL_ATTEMPTS`:
   - `dispatch(route)`. For non-stream, also read and sanitize the body **inside** the attempt so `invalid_body` can fail over.
   - Classify (Appendix B). Success ⇒ break to the existing success path with `route` = this attempt's route.
   - Failure: if `norm.countAsFailure` ⇒ `recordFailure(route.providerId, route.providerModelId)` **exactly once for this attempt** (never skip it, never double it); if `norm.alert` ⇒ fire-and-forget rate-limited provider alert (1F); cancel the response body if present; if `route.isTrial` and the outcome is **not** a recorded failure (client abort / non-failover) ⇒ `releaseTrial(...)`.
   - If `norm.failover` and attempts remain and not client-aborted ⇒ `route = await plan.next()`; if null ⇒ stop and return the **last** failure's envelope; else continue.
   - Otherwise stop and return the last failure's envelope.
6. Terminal failure handling reuses today's branches (`settle` status `error` ⇒ full refund, `logRequest`, normalized envelope with **no upstream text and no upstream status**), using the **last attempted** `route` and `norm`.
7. On success: `recordSuccess(route.providerId, route.providerModelId)` (as today, at headers), then streaming/non-stream success paths. `settle` and `logRequest` use the served `route` (its `upstreamPricing` and provider).
8. Between attempts, if `c.req.raw.signal.aborted` ⇒ stop, `releaseTrial` if applicable, `settle` `error` (refund).
9. Collect `attempts: { providerId, providerModelId, outcome, latencyMs }[]` for 1F.
10. Never fail over after the first streamed byte (that case is Phase 0.5's `partial`/`error` logic).

Tests (mock upstream with modes: ok, 400, 401, 402, 404, 429, 500, hang-before-headers, hang-after-headers, cut-mid-stream, 200-non-JSON, 200-error-body): one test per Appendix B row verifying failover/no-failover, `recordFailure` call count and keys, final HTTP status/body; 3 failing candidates ⇒ exactly 3 dispatches and 3 `recordFailure`; client abort ⇒ 0 `recordFailure`, trial released; TTFB hang ⇒ failover within ~`UPSTREAM_TTFB_TIMEOUT_MS` (use a small env value in tests) and classified as `ttfb_timeout`; total timeout ⇒ no failover; reservation created once and released/settled once; served route's `upstreamPricing` used in `settle`; deprecated alias that redirects still fails over (regression for the dead-failover bug); 503 + `Retry-After` when all circuits open; `POOL_ENABLED=false` behaves like today for models without pool rows.

### 7.1F Observability & alerts

**Files MAY modify/create:** `apps/api/src/middleware/logger.ts` (fields only), the table definition that `logRequest` writes to (per P6) + NEW migration, `apps/api/src/lib/alert.ts` (**add one function only**), `v1.ts` (pass the new fields), NEW tests.

- Add to the log record (internal only; **never** in HTTP responses): `servedProviderId`, `servedProviderModelId`, `attempts` (int), `failoverReasons` (string[]/json), `attemptLatenciesMs` (json). If P6 shows `logRequest` is console-only, extend the logged object and skip the migration.
- New alert function (name `alertProviderProblem`) used for 401/402/403/404 from providers: message includes provider name and status code; **cooldown** per `(providerId, status)` via Redis `SET NX PX` (`ALERT_PROVIDER_COOLDOWN_MS`, default 600 000) with an in-memory fallback.
- `alertNegativeMargin` call site (`afterSettle`) additionally passes the served provider name if its signature can take it without breaking other callers; otherwise leave it.
- Metrics to log at minimum: failover rate per model, circuit opens, count of `client_disconnected` partials.

### 7.1G Cleanup (only after 1E has run in production with `POOL_ENABLED=true` and no incidents)
Remove `resolveRuntimeFallback`, `resolveFallback`, the legacy `resolveModelWithFallback`/`resolveModel` wrappers **only if** P9 shows no other callers. Keep `models.fallback_provider_id` column (drop is a separate future decision).

---

## 8. Phase 2: Multi-server

### 8.2A Job leases (replaces advisory locks)

**Why not advisory locks:** `pg_try_advisory_xact_lock` only holds for the transaction. A second node ticking milliseconds after the first finishes would run the job again, so every node still runs each job once per interval, and the transaction would sit idle while the job calls external APIs.

**Files MAY modify/create:** `apps/api/src/index.ts` (only the interval registration), NEW `apps/api/src/lib/job-lease.ts`, `packages/db/src/schema.ts` + NEW migration (table `job_leases`), NEW tests. **Do not edit the bodies of the 5 job functions** (if P13 finds a non-idempotent job, report it and block Phase 2 rollout for that job instead of rewriting it).

- Table `job_leases(job text primary key, last_run_at timestamptz not null)`; no seed needed.
- `runLeased(jobName, intervalMs, fn)` executes, using the **database clock**, one statement:
  `INSERT INTO job_leases(job, last_run_at) VALUES ($job, now()) ON CONFLICT (job) DO UPDATE SET last_run_at = now() WHERE job_leases.last_run_at <= now() - make_interval(secs => $minSecs) RETURNING job`
  where `minSecs = 0.8 × intervalMs / 1000`. A returned row ⇒ this node runs `fn`; no row ⇒ skip silently. Because the lease is consumed at tick start, a node that dies mid-job simply lets the next interval's winner run; jobs must therefore be idempotent (P13).
- Wrap all 5 intervals (same intervals, same job bodies). Keep any existing in-process "already running" guard; if none exists add one in `runLeased` to avoid overlapping runs on one node.
- Env `JOB_LEASE_ENABLED` (default true); when false, behave exactly as today (single-node escape hatch).
- Uses `db.execute(sql...)`; if P3 says the driver can't, **stop and ask**.

Tests (against a real dev DB or the repo's DB test harness): two simulated nodes ticking 50 ms apart ⇒ exactly one run per interval across many intervals; a skipped node does not throw; after the winner "dies" the other node wins the next interval; `JOB_LEASE_ENABLED=false` runs unconditionally.

### 8.2B Multi-node audit and guards

**Files MAY modify:** `apps/api/src/lib/redis.ts` (the boot check only), NEW audit notes in the PR.
- Add `REQUIRE_REDIS` (default false): when true and `REDIS_URL` is unset, log fatal and exit at startup (prevents silently falling back to per-process Maps on a multi-node setup).
- Audit and **report** (do not fix outside scope): any other in-process state that must be shared (caches, Maps, singletons), pm2/cluster usage, graceful shutdown (P12).

### 8.2C Infra docs and config (the only phase that may touch these files)

**Files MAY modify:** `DEPLOYMENT_VPS.md`, `docker-compose.yml` (redis service only; the `postgres` service is local-dev only and must not change), a NEW example Nginx config file.
- Redis: `--maxmemory 32mb --maxmemory-policy allkeys-lru --save ""`, `requirepass`, bind to the private-link interface only; monitor `evicted_keys` (must stay 0; eviction silently drops counters/circuit state). Set `REDIS_COMMAND_TIMEOUT_MS` to ~250 for tunnelled Redis.
- Private link between nodes: Tailscale (preferred) or WireGuard. Redis is never public. Neon needs no tunnel; `DATABASE_URL` identical on both nodes; `.env` secrets identical on both.
- Nginx: `upstream` with `least_conn`; Server 2 initially `backup`; `proxy_next_upstream error timeout;` (**never** `non_idempotent`: retrying POST completions could double-bill); `proxy_buffering off;`; `proxy_read_timeout` ≥ `UPSTREAM_TOTAL_TIMEOUT_MS` + 30 s; keep existing header rules (`X-Forwarded-For $remote_addr`, `CF-Connecting-IP ""`).
- Set `UPSTREAM_TOTAL_TIMEOUT_MS` explicitly in home-server env (e.g. 300000); concurrency slot TTL derives from it (1A).
- State plainly in the doc: Nginx and Redis on Server 1 remain a single point of failure; two servers on the same ISP/power add capacity, not availability. Managed Redis and/or Cloudflare Tunnel with a connector per server are the upgrade path.

---

## 9. Environment variable registry

| Variable | Default | Phase | Meaning |
|---|---|---|---|
| `POOL_ENABLED` | `false` | 1D/1E | Use pool rows; off = legacy candidates only |
| `MAX_POOL_ATTEMPTS` | `3` | 1E | Max sequential attempts per request |
| `ROUTER_CACHE_TTL_MS` | `30000` | 1D | Routing snapshot TTL |
| `UPSTREAM_TOTAL_TIMEOUT_MS` | falls back to `UPSTREAM_TIMEOUT_MS`, then `55000` | 1E | Whole-attempt timeout incl. streamed body |
| `UPSTREAM_TTFB_TIMEOUT_MS` | `15000` | 1E | Streaming only: time to response headers |
| `CB_FAILURE_THRESHOLD` / `CB_FAILURE_WINDOW_MS` / `CB_OPEN_DURATION_MS` | `5` / `60000` / `120000` | existing | Unchanged |
| `CB_TRIAL_TTL_MS` | `UPSTREAM_TOTAL_TIMEOUT_MS + 5000` | 1C | Safety TTL of the half-open trial claim |
| `CB_LAST_RESORT` | `false` | 1D | Probe earliest-reopening circuit when all are open |
| `REDIS_COMMAND_TIMEOUT_MS` | `100` | 1A | Redis command timeout |
| `REDIS_CONNECT_TIMEOUT_MS` | `1000` | 1A | Redis connect timeout |
| `PARTIAL_BILLING_UPSTREAM_BREAK` | `charge` | 0.5 | `charge` or `refund` for upstream mid-stream breaks with delivered tokens |
| `ALERT_PROVIDER_COOLDOWN_MS` | `600000` | 1F | Per (provider,status) alert cooldown |
| `JOB_LEASE_ENABLED` | `true` | 2A | Leases for background jobs |
| `REQUIRE_REDIS` | `false` | 2B | Refuse to boot without Redis |

---

## 10. Rollout, rollback, monitoring

| Step | Rollout | Rollback | Watch |
|---|---|---|---|
| 0a-0e | Deploy | Revert PR | 502 rate from `invalid_upstream_response`; client-visible `model` values |
| 0f | Deploy separately | Revert one line | `ECONNRESET`/`terminated` errors, latency change |
| 0.5 | Deploy | Revert PR (existing `partial` rows stay valid) | Count of `partial`; user complaints about charges; usage vs upstream invoice |
| 1A | Deploy | Revert | Redis warnings; no 5xx from Redis errors |
| 1B | Migrate dev → staging → prod by a human; run seed by a human | Table can stay unused | n/a |
| 1C | Deploy with `POOL_ENABLED=false` | Revert | Circuit opens per (provider,model); dashboard state still renders |
| 1D/1E | Deploy with `POOL_ENABLED=false`, then enable for one model, then all | Flip `POOL_ENABLED=false` (no redeploy) | Failover rate, attempts distribution, 503s, TTFB timeouts, alert volume |
| 2A | Deploy on single node first with `JOB_LEASE_ENABLED=true` | Set false | Each job runs once per interval |
| 2C | Server 2 as Nginx `backup`, then active-active | Remove from upstream | Per-node request split, rate-limit/concurrency consistency |

---

## 11. Known limitations (accepted, do not "fix" in this plan)

- Non-stream request aborted by the client **before** headers is refunded while the upstream may still bill us for the generation. Log `client_disconnected`/abort counts per user to detect abuse; revisit later.
- Consecutive-failure breaker never opens for a provider that fails ~50 % of the time. Revisit with observability data.
- `UNIQUE(model_id, provider_id)` forbids two accounts of one provider for one model.
- Redis fail-open can let limits be exceeded during a Redis outage and for a brief window at boot.
- Partial-stream charges for aborted streams use estimated tokens when the upstream's final usage chunk never arrives.
- `data_policy` is informational; no automatic enforcement in this plan.
- Server 1 remains a single point of failure in Phase 2 (see 8.2C).

---

## Appendix A: Sanitizer contract (`sse-sanitize.ts`)

Exports: `createSseSanitizer(opts)`, `sanitizeCompletionBody(text, publicModel)`, `GENERIC_ERROR_PAYLOAD` = `{error:{message:'upstream provider error', type:'server_error', code:'provider_error'}}`.

`createSseSanitizer({ publicModel, clientWantsUsage, onChunk?, onDrop? })` returns `{ push(text): string, flush(): string }`. Pure, no I/O. Input is **decoded text** (caller owns `TextDecoder` with `{stream:true}` and a final `decoder.decode()`).

Line handling (split on `\n`, strip one trailing `\r`):
- empty line ⇒ output `\n` (preserve event delimiters)
- starts with `:` ⇒ output `: keepalive\n` (original comment text is discarded)
- matches `/^data: ?(.*)$/` (both `data:` and `data: ` valid): payload trimmed; empty ⇒ drop; `[DONE]` ⇒ `data: [DONE]\n`; JSON parse failure or non-plain-object ⇒ drop + `onDrop('non_json', line)`; object with non-null `error` ⇒ replace with `data: ${JSON.stringify(GENERIC_ERROR_PAYLOAD)}\n` + `onDrop('error_payload', line)`; otherwise valid chunk
- any other line (`event:`, `id:`, `retry:`, unknown) ⇒ drop

Valid chunk processing, in order: (1) call `onChunk(chunk)` with the **parsed original** (so billing sees `usage`); (2) set `chunk.model = publicModel`; delete `provider` and `system_fingerprint`; (3) if `clientWantsUsage` is false: **delete `chunk.usage` regardless of value** (including `null`) and, if `chunk.choices` is missing or an empty array, **drop the whole chunk** (no output); (4) otherwise output `data: ${JSON.stringify(chunk)}\n`. `id` is not modified.
Buffer cap: if the pending partial line exceeds 1 000 000 chars, drop it, call `onDrop('overflow','')`.
`flush()` processes a final line that lacked a trailing newline.

`sanitizeCompletionBody(text, publicModel)` ⇒ `{ok:true, json, body}` (model rewritten, `provider`/`system_fingerprint` removed, `json` keeps `usage`) or `{ok:false, reason:'non_json'|'error_payload'}`. It never returns upstream text that failed to parse. (Usage stripping is **not** applied to non-stream bodies: the OpenAI non-stream response always includes `usage` and clients expect it.)

Tests (node:test style, adapt to the repo runner): the 10 existing cases plus: usage Case A (separate chunk, `choices: []`, client did not ask ⇒ dropped); Case B (usage inside a chunk with non-empty choices ⇒ chunk kept, `usage` key removed, `onChunk` still received the usage); `"usage": null` on every chunk ⇒ key removed; client asked for usage ⇒ usage chunk forwarded with model rewritten; `onChunk` is **not** called for error/non-JSON lines.

## Appendix B: Failure classification (normative; implement in `normalizeUpstreamError` + loop)

| Outcome | `failover` | `countAsFailure` | `alert` | Client HTTP / code (final response if this is the last attempt) |
|---|---|---|---|---|
| `client_abort` | no | no | no | (no meaningful response) |
| `timeout` (total) | no | no | no | 504 `provider_timeout` |
| `ttfb_timeout` (stream, before headers) | yes | yes | no | 504 `provider_timeout` |
| `network` | yes | yes | no | 502 `provider_error` |
| HTTP 5xx | yes | yes | no | 502 `provider_error` |
| HTTP 429 | yes | yes | no | 429 `provider_rate_limited` |
| HTTP 401 / 403 | yes | **yes** (was no) | yes | 503 `provider_auth_failed` |
| HTTP 402 | yes | yes | yes | 503 `provider_auth_failed` |
| HTTP 404 | yes | yes | yes | 502 `provider_error` |
| HTTP 408 | yes | yes | no | 504 `provider_timeout` |
| HTTP 400 / 422 | no | no | no | 502 `provider_error` (as today's default; log the upstream status internally only) |
| other 4xx | no | no | no | 502 `provider_error` |
| `invalid_body` (2xx, non-stream, unusable) | yes | yes | no | 502 `provider_error` |

All client-facing bodies use the existing envelope shape `{error:{message,type,code}}` with generic messages; never include upstream text, upstream status, provider names, or provider model strings.

## Appendix C: Obsolete names (do not use or reintroduce)

`resolveFromPool`, `getProviderPool`, `CachedModelRouteData`, per-model lazy route cache, `IS_PRIMARY_NODE`, `pg_try_advisory_xact_lock` for jobs, `isCircuitOpen` (replaced by `checkCircuit`), `cb:provider:{id}` key format, `isUsingFallback = priority > 1`, "legacy fallback after pool exhausted", "Phase 2 needs no code changes".
