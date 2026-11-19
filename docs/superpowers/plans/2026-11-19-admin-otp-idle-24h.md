# Admin OTP Idle 24h Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin OTP is asked only after 24 hours without admin-panel activity, or when the request country differs from the country at verification, and it appears as a pop-up inside the admin panel instead of a redirect to settings.

**Architecture:** Pure decision logic (row parsing, idle/country rules, geo header parsing, safe return path) lives in `packages/shared/src/admin-step-up.ts` with node:test coverage. `apps/web/src/lib/actions.ts` replaces the IP-change trigger with that logic, stores state in the existing `verifications` row `admin-verified-session:<sessionId>`, and bumps it (throttled) on admin activity. Admin pages that need step-up redirect to `/admin/verify?next=…`, which renders the OTP dialog over the admin shell; a client watcher sends a stale tab there on focus.

**Tech Stack:** Next.js 16 App Router (server components + server actions), Better Auth 1.7.18 sessions, Drizzle/Postgres, Tailwind, node:test via `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-19-admin-otp-idle-24h-design.md`

## Global Constraints

- Idle window: `24 * 60 * 60 * 1000` ms. Bump throttle: `5 * 60 * 1000` ms.
- Row identifier stays `admin-verified-session:<sessionId>`; value format `verified:<lastBumpEpochMs>:<CC or ->`.
- Country rule: OTP required when current country is known and differs from the stored country (stored `-` counts as different), including a return to `ID`. Unknown current country: skip the check and `console.warn`.
- Country source: `x-nf-geo` (base64 JSON, `country.code`), fallback `x-country`. Never `x-morphic-country`.
- No DB migration. No change to user login OTP, Better Auth config, or `mfaMissing`.
- Keep `ADMIN_ALLOWED_IPS` + `ADMIN_IP_ENFORCEMENT=strict` hard deny. Drop all other IP-based step-up.
- Loopback skip only when `process.env.NODE_ENV !== 'production'`.
- OTP code limits unchanged: 10 min TTL, 5 attempts, 60 s resend cooldown.
- Dashboard navigation (the sidebar `isCurrentUserAdmin` check) must not read or bump the step-up row.
- Copy: Indonesian + English via existing i18n (`apps/web/src/lib/i18n/locales/{id,en}.ts`). No em dashes. UI follows antislop (core + `antislop-ui` + `antislop-human`) during the work.
- Commits: never run `git add`/`git commit`; give the user the command, no Claude attribution.

## Review Focus

- `x-nf-geo` arrives as plain JSON or URI-encoded JSON instead of base64: parser must still read `country.code`, and garbage must yield `null`, never throw. (Task 1 test `parseGeoCountry handles base64, raw and encoded JSON`.)
- Legacy rows from the old flow have value `verified` (no timestamp): must count as valid while unexpired and get rewritten on first bump, not force an OTP. (Task 1 test `legacy value is valid and bumps`.)
- `next` return path from a header or query: only same-site `/admin…` paths; `//evil.com`, `/admin/../x`, absolute URLs fall back to `/admin`. (Task 1 test `safeAdminNextPath rejects off-site paths`.)
- Page data must not render while step-up is pending: every admin page calls `requireAdmin` first, which redirects before any query. Verify with the manual check in Task 3 (open `/admin/users` with an expired row: no user data in the HTML).
- Watcher must not keep the session alive: `getAdminStepUpStatus` is read-only and never bumps. (Task 2 Step 5 code review point + Task 3 manual check.)

---

### Task 1: Shared step-up logic

**Files:**
- Create: `packages/shared/src/admin-step-up.ts`
- Create: `packages/shared/src/admin-step-up.test.ts`
- Modify: `packages/shared/package.json` (exports: add `"./admin-step-up": "./src/admin-step-up.ts"`)

**Interfaces:**
- Produces:
  - `ADMIN_STEP_UP_IDLE_MS: number`, `ADMIN_STEP_UP_BUMP_MS: number`
  - `formatStepUpValue(lastBumpMs: number, country: string | null): string`
  - `parseStepUpValue(value: string): { lastBumpMs: number; country: string | null } | null`
  - `evaluateAdminStepUp(input: { row: { value: string; expiresAt: Date } | null; nowMs: number; country: string | null }): { required: boolean; reason: 'no_row' | 'expired' | 'country_changed' | 'ok'; bump: boolean; storedCountry: string | null }`
  - `parseGeoCountry(headers: Pick<Headers, 'get'>): string | null`
  - `safeAdminNextPath(raw: string | null | undefined): string`

- [ ] **Step 1: Write the failing tests** in `admin-step-up.test.ts` (style of `admin-rbac.test.ts`: `node:test` + `node:assert/strict`). Use `now = Date.UTC(2026, 10, 19)`:
  - `no row requires OTP`: `evaluateAdminStepUp({ row: null, nowMs: now, country: 'ID' })` deep-equals `{ required: true, reason: 'no_row', bump: false, storedCountry: null }`.
  - `expired row requires OTP`: row `expiresAt = new Date(now - 1)` gives `required: true, reason: 'expired'`.
  - `fresh row passes without bump`: value `formatStepUpValue(now - 60_000, 'ID')`, `expiresAt = now + 1h` gives `required: false, reason: 'ok', bump: false`.
  - `stale bump is due`: lastBump `now - ADMIN_STEP_UP_BUMP_MS - 1` gives `bump: true`.
  - `country rules`: stored `ID` + current `SG` gives `country_changed`; stored `SG` + `SG` ok; stored `SG` + `ID` gives `country_changed`; stored `ID` + `null` ok; stored `null` (`-`) + `SG` gives `country_changed`; stored `null` + `null` ok.
  - `legacy value is valid and bumps`: value `'verified'` unexpired gives `required: false, bump: true, storedCountry: null`.
  - `formatStepUpValue round-trips`: `parseStepUpValue(formatStepUpValue(123, 'SG'))` deep-equals `{ lastBumpMs: 123, country: 'SG' }`; `formatStepUpValue(123, null) === 'verified:123:-'`.
  - `parseGeoCountry handles base64, raw and encoded JSON`: header `x-nf-geo` = `btoa(JSON.stringify({ country: { code: 'sg' } }))` gives `'SG'`; raw JSON string gives `'SG'`; `encodeURIComponent(JSON)` gives `'SG'`; `'%%%'` gives `null`; missing `x-nf-geo` but `x-country: id` gives `'ID'`; codes `XX`, `T1`, `ABC` give `null`.
  - `safeAdminNextPath rejects off-site paths`: `'/admin/users?page=2'` kept; `null`, `'//evil.com'`, `'https://evil.com/admin'`, `'/dashboard'`, `'/admin/../dashboard'`, `'/adminx'` all give `'/admin'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @morphic/shared test`
Expected: FAIL, cannot find module `./admin-step-up.ts`.

- [ ] **Step 3: Implement `admin-step-up.ts`**

`evaluateAdminStepUp` order: no row, then expired (`expiresAt <= now`), then parse (unparseable non-legacy value counts as `no_row`), then country rule, else ok with `bump = nowMs - lastBumpMs >= ADMIN_STEP_UP_BUMP_MS` (legacy `lastBumpMs = 0`). `parseGeoCountry` tries `JSON.parse(atob(v))`, then `JSON.parse(v)`, then `JSON.parse(decodeURIComponent(v))`, each in try/catch; uppercase, accept only `/^[A-Z]{2}$/` excluding `XX`/`T1`. `safeAdminNextPath` accepts only `/admin` or `/admin/` or `/admin?`-prefixed strings with no `..` segment and no leading `//`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @morphic/shared test && pnpm --filter @morphic/shared typecheck`
Expected: all tests PASS (including existing suites), no type errors.

- [ ] **Step 5: Commit (give the user the command)**

```bash
git add packages/shared/src/admin-step-up.ts packages/shared/src/admin-step-up.test.ts packages/shared/package.json
git commit -m "feat(shared): admin step-up rules for 24h idle and country change"
```

---

### Task 2: Server wiring in `actions.ts`

**Files:**
- Modify: `apps/web/src/lib/actions.ts:80-252` (admin check, requireAdmin) and `:1150-1300` (code request/verify)
- Modify: `apps/web/src/middleware.ts:172-175` (set `x-morphic-path`)
- Modify: `apps/web/src/lib/admin-actions.ts:153-185` (error code mapping)

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces (exported from `@/lib/actions`):
  - `requireAdmin(permission?, options?)`: same signature. Redirect mode with step-up pending: `redirect('/admin/verify?next=' + encodeURIComponent(safeAdminNextPath(headers().get('x-morphic-path'))))`. Throw mode: `throw new Error('Forbidden: admin step-up OTP required.')`. On pass with `bump: true`, update the row value to `formatStepUpValue(now, storedCountry)` and `expiresAt = now + ADMIN_STEP_UP_IDLE_MS`.
  - `requireAdminForStepUp(): Promise<{ user; required: boolean; email: string | null }>`: same as `requireAdmin('overview')` but never redirects for step-up (used by `/admin/verify`).
  - `getAdminStepUpStatus(): Promise<{ isAdmin: boolean; required: boolean }>`: read-only, never bumps. Replaces `getAdminIpStepUpStatus`.
  - `requestAdminStepUpCode(): Promise<{ ok: true } | { ok: false; error: string }>`: replaces `requestAdminIpVerificationCode`.
  - `verifyAdminStepUpCode(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }>`: replaces `verifyAdminIpCode`.

- [ ] **Step 1: Split the admin check.** `adminCheck` keeps role, suspension, api_key, `mfaMissing`, and the strict allowlist deny (`ADMIN_IP_ENFORCEMENT === 'strict' && !isAdminIpAllowed(clientIp, process.env.ADMIN_ALLOWED_IPS)` returns null). Remove `trustedIps`, `adminTrustedIpId`, `evaluateAdminIpAccess`, `ipVerificationRequired`. Add a separate `cache()`d `adminStepUpState()` that reads the row (`select value, expiresAt where identifier = adminVerifiedSessionId(sessionId)`, no expiry filter), takes the country from `parseGeoCountry(await headers())`, applies the loopback dev skip, and returns `evaluateAdminStepUp(...)`. Log `console.warn('[adminStepUp] country unknown')` once per call when the country is null and not dev-loopback. Only `requireAdmin`, `requireAdminForStepUp`, and `getAdminStepUpStatus` call it; `isCurrentUserAdmin` does not.

- [ ] **Step 2: Rewrite code request/verify.** Keep the existing OTP storage, TTL, attempts, and cooldown. On success: delete the `admin-ip-otp` row, upsert `admin-verified-session:<sessionId>` with `formatStepUpValue(now, country)` and `expiresAt = now + ADMIN_STEP_UP_IDLE_MS`, write audit action `verify_admin_step_up` with `{ ip, country }`. Stop writing `admin-trusted-ip:*` rows and stop updating `sessions.ipAddress`. Email subject `Kode verifikasi Panel Admin Morphic: <code>`; body says the code opens the Admin Panel, valid 10 minutes, shows IP and country (or "tidak diketahui") as info.

- [ ] **Step 3: Middleware path header.** In `middleware.ts`, `requestHeaders.set('x-morphic-path', req.nextUrl.pathname + req.nextUrl.search)` next to the country header (always overwrite, so a client value is never trusted).

- [ ] **Step 4: Error mapping.** In `checkCatalogWriteAdmin`, replace the `new admin IP` branch with `msg.includes('step-up OTP')` → code `step_up_required`, messages `id: 'Sesi admin perlu verifikasi OTP ulang. Muat ulang halaman.'`, `en: 'Your admin session needs OTP verification again. Reload the page.'`.

- [ ] **Step 5: Verify**

Run: `pnpm --filter @morphic/web typecheck && pnpm --filter @morphic/web lint && pnpm --filter @morphic/web test`
Expected: no type or lint errors, existing tests PASS. Grep check: `grep -n "adminTrustedIpId\|ipVerificationRequired\|getAdminIpStepUpStatus" apps/web/src -r` returns only callers fixed in Task 3 (settings page), nothing in `actions.ts`. Read `getAdminStepUpStatus` once more and confirm it has no write.

- [ ] **Step 6: Commit (give the user the command)**

```bash
git add apps/web/src/lib/actions.ts apps/web/src/lib/admin-actions.ts apps/web/src/middleware.ts
git commit -m "feat(admin): ask OTP after 24h idle or new foreign country, not on IP change"
```

---

### Task 3: Pop-up UI and settings cleanup

**Files:**
- Create: `apps/web/src/app/admin/verify/page.tsx` (server)
- Create: `apps/web/src/app/admin/step-up-dialog.tsx` (client)
- Create: `apps/web/src/app/admin/step-up-watcher.tsx` (client)
- Modify: `apps/web/src/app/admin/layout.tsx` (use `requireAdminForStepUp`, mount watcher)
- Modify: `apps/web/src/app/dashboard/settings/page.tsx` (drop step-up card + status call)
- Delete: `apps/web/src/app/dashboard/settings/admin-ip-verify-card.tsx`
- Modify: `apps/web/src/lib/i18n/locales/id.ts`, `en.ts` (new `adminStepUp` keys)

**Interfaces:**
- Consumes: `requireAdminForStepUp`, `getAdminStepUpStatus`, `requestAdminStepUpCode`, `verifyAdminStepUpCode`, `safeAdminNextPath` (Tasks 1-2).
- Produces: `<StepUpDialog next: string />`, `<StepUpWatcher />`.

- [ ] **Step 1: Layout.** `layout.tsx` calls `requireAdminForStepUp()` instead of `requireAdmin('overview')` so `/admin/verify` does not loop, and renders `<StepUpWatcher />` inside `AdminShell`. Every other admin page keeps its own `requireAdmin(...)` as the first statement (already true; confirm none fetches before it).

- [ ] **Step 2: Verify page.** `/admin/verify/page.tsx`: `searchParams.next` through `safeAdminNextPath`; if `required` is false, `redirect(next)`; else render `<StepUpDialog next={next} />`.

- [ ] **Step 3: Dialog.** Modal over the admin shell (`role="dialog"`, `aria-modal`, labelled heading, focus moves to the primary button on open and to the code input after sending, Escape does nothing since the panel stays locked). Content: heading "Verifikasi akses Panel Admin", one line saying the code goes to the admin email and that it is asked again after 24 hours without opening the panel or from a new country; send button with 60 s countdown after send; 6-digit numeric input (`inputMode="numeric"`, `autoComplete="one-time-code"`); error/info line with `aria-live="polite"`; on success `router.replace(next)` then `router.refresh()`. Reuse the state machine of the deleted card. Apply antislop-ui/human: existing admin tokens and button styles, no amber banner look, visible focus ring, contrast checked with the antislop contrast tool.

- [ ] **Step 4: Watcher.** On `visibilitychange` to visible and on `focus`, at most once per 60 s, call `getAdminStepUpStatus()`; if `required`, `router.push('/admin/verify?next=' + encodeURIComponent(location.pathname + location.search))`. Skip when already on `/admin/verify`.

- [ ] **Step 5: Settings cleanup.** Remove `getAdminIpStepUpStatus` import/call, `admin_ip` search param, `adminIpVerifyNotice`, and the card render from `settings/page.tsx`. Keep the `mfa=required` notice. Delete `admin-ip-verify-card.tsx`.

- [ ] **Step 6: Verify**

Run: `pnpm --filter @morphic/web typecheck && pnpm --filter @morphic/web lint`
Expected: clean.

Manual (local, `pnpm dev`, a dummy admin; loopback skip off by temporarily running with a forwarded non-loopback IP or by deleting the row and testing through a non-localhost host):
1. Delete the `admin-verified-session:*` row for the session, open `/admin/users`: URL becomes `/admin/verify?next=%2Fadmin%2Fusers`, dialog shows, view-source has no user rows.
2. Send code, enter it: lands on `/admin/users` with data.
3. Go to `/dashboard`, back to `/admin`: no dialog.
4. Set the row `expires_at` to the past, focus the admin tab: watcher moves to the dialog.
5. Request with header `x-nf-geo` = base64 `{"country":{"code":"SG"}}` while stored is `ID`: dialog shows. Verify, then send `ID`: dialog shows again.

- [ ] **Step 7: Commit (give the user the command)**

```bash
git add apps/web/src/app/admin apps/web/src/app/dashboard/settings apps/web/src/lib/i18n
git commit -m "feat(admin): OTP pop-up inside the admin panel, drop settings IP card"
```
