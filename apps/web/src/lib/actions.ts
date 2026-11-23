// /home/riyan/Downloads/Projects/morphic/apps/web/src/lib/actions.ts
// typescript / actions.ts / next-server / @morphic/web

'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq, and, desc, sql, gt, gte, lte, ne, isNotNull, inArray } from 'drizzle-orm';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { db, schema as s } from '@morphic/db';
import { generateApiKey, maskedKey, hashApiKey } from '@morphic/shared/keys';
import {
  canonicalizeAdminIp,
  extractTrustedAdminIp,
  hasAdminPermission,
  isAdminIpAllowed,
  isAdminRole,
  isLoopbackAdminIp,
  type AdminPermission,
} from '@morphic/shared/admin-rbac';
import {
  ADMIN_OTP_RESEND_COOLDOWN_MS,
  ADMIN_STEP_UP_IDLE_MS,
  evaluateAdminStepUp,
  otpResendWaitSeconds,
  formatStepUpValue,
  parseGeoCountry,
  safeAdminNextPath,
  type AdminStepUpDecision,
} from '@morphic/shared/admin-step-up';
import { sendEmail } from '@morphic/shared/email';
import { auth } from '@/lib/auth';
import { fetchBackendApi } from './api-client';
import { softDeleteUser } from './account-deletion';
import { loadNotifications } from './notifications';
import { PAGE_SIZE, cursorAt, decodeCursor, olderThan, toPage } from './pagination';
import { COUNT_CAP, loadPage, readPage, type NumberedPage } from './page-numbers';
import { unionAll } from 'drizzle-orm/pg-core';
import { cappedCount } from './capped-count';
import type { GiftTransaction } from '@/app/dashboard/redeem/redeem-view';

import { cache } from 'react';

export const getSessionWithRetry = cache(async () => {
  const reqHeaders = await headers();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await auth.api.getSession({ headers: reqHeaders });
    } catch (err: any) {
      const msg = err?.message ?? '';
      const isTransient =
        msg.includes('fetch failed') ||
        msg.includes('connecting to database') ||
        msg.includes('Failed to get session') ||
        err?.name === 'TypeError';

      if (isTransient && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 150));
        continue;
      }
      if (attempt === 3) {
        console.warn('[getSessionWithRetry] DB connection transient drop, returning null session');
        return null;
      }
      throw err;
    }
  }
  return null;
});

/**
 * The signed-in user's balance row, read at most once per request: the dashboard layout and the
 * page under it both show it. Takes no user id, so as a server action it can only read your own.
 */
export const getOwnBalance = cache(async (): Promise<{ credits: number; updatedAt: string | null }> => {
  const session = await getSessionWithRetry();
  if (!session) return { credits: 0, updatedAt: null };
  const [bal] = await db
    .select({ credits: s.balances.credits, updatedAt: s.balances.updatedAt })
    .from(s.balances)
    .where(eq(s.balances.userId, session.user.id))
    .limit(1);
  return { credits: bal?.credits ?? 0, updatedAt: bal?.updatedAt ? bal.updatedAt.toISOString() : null };
});

/**
 * Tokens left on the signed-in user's active any-model token packs. Bought packs land in
 * entitlements, not the balances row, so the navbar adds this to the wallet figure.
 * Unlimited passes are per-model daily quotas and are left out.
 */
export const getOwnTokenPackRemaining = cache(async (): Promise<number> => {
  const session = await getSessionWithRetry();
  if (!session) return 0;
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${s.entitlements.remaining}), 0)::bigint` })
    .from(s.entitlements)
    .where(
      and(
        eq(s.entitlements.userId, session.user.id),
        eq(s.entitlements.status, 'active'),
        eq(s.entitlements.unlimited, false),
        gt(s.entitlements.expiresAt, new Date()),
      ),
    );
  return Number(row?.total ?? 0);
});

async function requireUser() {
  const session = await getSessionWithRetry();
  if (!session) redirect('/login');
  return session.user;
}

// The step-up code is per user, so a client IP that changes between "send code" and "verify"
// (IPv6 privacy addresses, IPv4/IPv6 switching) cannot make a fresh code read as expired.
const adminIpOtpId = (userId: string) => `admin-ip-otp:${userId}`;
// One marker per session: it expires 24 hours after the last admin-panel activity, and that
// activity pushes it forward (see `@morphic/shared/admin-step-up`).
const adminVerifiedSessionId = (sessionId: string) => `admin-verified-session:${sessionId}`;

// Only the user columns admin checks and admin pages read; this runs on every dashboard navigation.
const adminUserColumns = {
  id: s.users.id,
  email: s.users.email,
  name: s.users.name,
  role: s.users.role,
  suspended: s.users.suspended,
  twoFactorEnabled: s.users.twoFactorEnabled,
};

/**
 * The signed-in admin, or null for guests, non-admins, strictly-blocked IPs, suspended admins and API-key sessions.
 * Admins who sign in with a password must also have login OTP on (`mfaMissing` otherwise);
 * Google/GitHub-only admins are secured by their provider's MFA.
 * Does not look at the admin-panel step-up: the dashboard sidebar calls this on every navigation,
 * and that check (`adminStepUpState`) belongs to admin pages and actions only.
 * One joined query (user role + session auth method), memoised per request.
 */
const adminCheck = cache(
  async (): Promise<{
    user: Pick<typeof s.users.$inferSelect, keyof typeof adminUserColumns>;
    sessionId: string;
    mfaMissing: boolean;
    clientIp: string | null;
  } | null> => {
    const session = await getSessionWithRetry();
    if (!session) return null;

    // Role comes from the DB on every request (never from the session payload), and admin power is
    // refused to suspended accounts and to sessions minted from an mp-* API key, so a leaked key
    // can never reach admin actions.
    const [row] = await db
      .select({
        user: adminUserColumns,
        authMethod: s.sessions.authMethod,
        sessionId: s.sessions.id,
      })
      .from(s.users)
      .innerJoin(s.sessions, eq(s.sessions.userId, s.users.id))
      .where(and(eq(s.users.id, session.user.id), eq(s.sessions.id, session.session.id)))
      .limit(1);
    if (!row || !isAdminRole(row.user.role) || row.user.suspended || row.authMethod === 'api_key') {
      return null;
    }

    const clientIp = canonicalizeAdminIp(extractTrustedAdminIp(await headers()));
    // Opt-in hard allowlist: ADMIN_ALLOWED_IPS + ADMIN_IP_ENFORCEMENT=strict.
    if (process.env.ADMIN_IP_ENFORCEMENT === 'strict' && !isAdminIpAllowed(clientIp, process.env.ADMIN_ALLOWED_IPS)) {
      console.warn('[adminCheck] blocked admin access from strictly non-allowlisted IP', {
        userId: session.user.id,
        clientIp,
      });
      return null;
    }

    const mfaMissing = !row.user.twoFactorEnabled && (await hasPasswordLogin(row.user.id));
    return { user: row.user, sessionId: row.sessionId, mfaMissing, clientIp };
  },
);

/**
 * Whether this session must pass the admin-panel email OTP now, plus the request country.
 * Local development over loopback skips it so `pnpm dev` needs no email.
 */
const adminStepUpState = cache(
  async (sessionId: string): Promise<AdminStepUpDecision & { country: string | null }> => {
    const reqHeaders = await headers();
    const country = parseGeoCountry(reqHeaders);
    const clientIp = canonicalizeAdminIp(extractTrustedAdminIp(reqHeaders));
    if (process.env.NODE_ENV !== 'production' && (!clientIp || isLoopbackAdminIp(clientIp))) {
      return { required: false, reason: 'ok', bump: false, storedCountry: null, country };
    }
    if (!country) console.warn('[adminStepUp] request country unknown, country check skipped');
    const [row] = await db
      .select({ value: s.verifications.value, expiresAt: s.verifications.expiresAt })
      .from(s.verifications)
      .where(eq(s.verifications.identifier, adminVerifiedSessionId(sessionId)))
      .limit(1);
    return { ...evaluateAdminStepUp({ row: row ?? null, nowMs: Date.now(), country }), country };
  },
);

/** Pushes the session's step-up marker 24 hours ahead. A failed write only costs an earlier OTP. */
async function bumpAdminStepUp(sessionId: string, country: string | null) {
  const now = Date.now();
  try {
    await db
      .update(s.verifications)
      .set({
        value: formatStepUpValue(now, country),
        expiresAt: new Date(now + ADMIN_STEP_UP_IDLE_MS),
        updatedAt: new Date(now),
      })
      .where(eq(s.verifications.identifier, adminVerifiedSessionId(sessionId)));
  } catch (err) {
    console.warn('[adminStepUp] could not extend the step-up marker:', err);
  }
}

/**
 * Used by `DashboardLayout` to decide whether to render the "Panel admin" link in the sidebar.
 * Returns true for any active admin role even if Login OTP (`mfaMissing`) or the panel step-up
 * is pending: opening `/admin` then asks for it.
 */
async function isCurrentUserAdmin(): Promise<boolean> {
  return (await adminCheck()) !== null;
}

/** Session + admin role + login OTP checks shared by the admin guards. */
async function requireAdminBase(shouldThrow: boolean) {
  const session = await getSessionWithRetry();
  if (!session) {
    if (shouldThrow) throw new Error('Unauthorized: sign-in required.');
    redirect('/login');
  }
  const check = await adminCheck();
  if (!check) {
    if (shouldThrow) throw new Error('Forbidden: admin access denied.');
    redirect('/dashboard');
  }
  if (check.mfaMissing) {
    if (shouldThrow) throw new Error('Forbidden: login OTP (MFA) is required for admin accounts.');
    redirect('/dashboard/settings?mfa=required');
  }
  return check;
}

/**
 * Guard for admin pages (redirect mode) and admin actions (throw mode). A pending step-up sends
 * pages to `/admin/verify` before they read any data, and passing it counts as admin activity.
 */
async function requireAdmin(
  permission?: AdminPermission,
  options?: { mode?: 'redirect' | 'throw' },
) {
  const shouldThrow = options?.mode === 'throw';
  const check = await requireAdminBase(shouldThrow);
  const stepUp = await adminStepUpState(check.sessionId);
  if (stepUp.required) {
    if (shouldThrow) throw new Error('Forbidden: admin step-up OTP required.');
    const next = safeAdminNextPath((await headers()).get('x-morphic-path'));
    redirect(`/admin/verify?next=${encodeURIComponent(next)}`);
  }
  if (permission && !hasAdminPermission(check.user.role, permission)) {
    if (shouldThrow) {
      throw new Error(`Forbidden: role "${check.user.role}" lacks "${permission}" permission.`);
    }
    redirect('/admin?denied=1');
  }
  if (stepUp.bump) await bumpAdminStepUp(check.sessionId, stepUp.storedCountry ?? stepUp.country);
  return check.user;
}

/**
 * The admin layout's guard: same checks as `requireAdmin('overview')`, but a pending step-up is
 * returned instead of redirected, so `/admin/verify` can render inside the shell. Never extends
 * the marker.
 */
async function requireAdminForStepUp() {
  const check = await requireAdminBase(false);
  const stepUp = await adminStepUpState(check.sessionId);
  return { user: check.user, required: stepUp.required };
}

async function requireInteractiveUser() {
  return requireUser();
}

export { requireUser, requireAdmin, requireAdminForStepUp, requireInteractiveUser, isCurrentUserAdmin };


export async function listApiKeys() {
  const user = await requireUser();

  try {
    const rows = await db
      .select({
        id: s.apiKeys.id,
        name: s.apiKeys.name,
        keyPrefix: s.apiKeys.keyPrefix,
        status: s.apiKeys.status,
        expiresAt: s.apiKeys.expiresAt,
        lastUsedAt: s.apiKeys.lastUsedAt,
        createdAt: s.apiKeys.createdAt,
      })
      .from(s.apiKeys)
      .where(eq(s.apiKeys.userId, user.id))
      .orderBy(desc(s.apiKeys.createdAt));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      keyPrefix: r.keyPrefix,
      status: r.status,
      expiresAt: r.expiresAt,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    console.warn('[listApiKeys] Error fetching api keys from DB:', err);
    return [];
  }
}

// ── Rate Limiting / Cooldown Helpers for Server Actions ─────
const userActionCooldowns = new Map<string, number>();
const failedRedeemAttempts = new Map<string, { count: number; lockUntil: number }>();

function checkActionCooldown(userId: string, actionKey: string, cooldownMs: number): boolean {
  const key = `${userId}:${actionKey}`;
  const now = Date.now();
  const lastTime = userActionCooldowns.get(key) || 0;
  if (now - lastTime < cooldownMs) {
    return false;
  }
  userActionCooldowns.set(key, now);
  if (userActionCooldowns.size > 2000) {
    for (const [k, ts] of userActionCooldowns.entries()) {
      if (now - ts > 60_000) userActionCooldowns.delete(k);
    }
  }
  return true;
}

export interface ActiveSession {
  id: string;
  isCurrent: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Sessions the account can sign out from. The session token is the credential Better Auth
 * revokes by, so it stays on the server: the UI addresses a session by its row id instead.
 */
export async function listActiveSessions(): Promise<ActiveSession[]> {
  const session = await getSessionWithRetry();
  if (!session) redirect('/login');

  const rows = await db
    .select({
      id: s.sessions.id,
      ipAddress: s.sessions.ipAddress,
      userAgent: s.sessions.userAgent,
      createdAt: s.sessions.createdAt,
      expiresAt: s.sessions.expiresAt,
    })
    .from(s.sessions)
    .where(and(eq(s.sessions.userId, session.user.id), gt(s.sessions.expiresAt, new Date())))
    .orderBy(desc(s.sessions.createdAt))
    .limit(50);

  return rows.map((row) => ({ ...row, isCurrent: row.id === session.session.id }));
}

export async function revokeSessionById(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireInteractiveUser();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, error: 'Session id is required.' };

  const [row] = await db
    .select({ token: s.sessions.token })
    .from(s.sessions)
    .where(and(eq(s.sessions.id, id), eq(s.sessions.userId, user.id)))
    .limit(1);
  if (!row) return { ok: false, error: 'That session is already signed out.' };

  try {
    try {
      await auth.api.revokeSession({ body: { token: row.token }, headers: await headers() });
    } catch {
      // Direct DB deletion below guarantees session row is removed
    }
    await db.delete(s.sessions).where(and(eq(s.sessions.id, id), eq(s.sessions.userId, user.id)));
    revalidatePath('/dashboard/settings');
    return { ok: true };
  } catch (err) {
    console.error('[revokeSessionById] Failed to revoke session:', err);
    return { ok: false, error: 'Could not sign that device out. Please try again.' };
  }
}

export async function revokeOtherSessions(): Promise<{ ok: boolean; error?: string }> {
  const user = await requireInteractiveUser();
  const session = await getSessionWithRetry();
  const currentToken = session?.session?.token;

  try {
    try {
      await auth.api.revokeOtherSessions({ headers: await headers() });
    } catch {
      // Direct DB deletion below guarantees other session rows are removed
    }
    if (currentToken) {
      await db
        .delete(s.sessions)
        .where(and(eq(s.sessions.userId, user.id), ne(s.sessions.token, currentToken)));
    }
    revalidatePath('/dashboard/settings');
    return { ok: true };
  } catch (err) {
    console.error('[revokeOtherSessions] Failed to revoke other sessions:', err);
    return { ok: false, error: 'Could not sign the other devices out. Please try again.' };
  }
}

/** Permanently deletes one of the caller's API keys via the gateway API (with direct DB fallback if offline). */
export async function deleteApiKey(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireInteractiveUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Invalid key ID' };

  try {
    // 1. Call backend API first so delete + key.revoked audit log + revocation email execute atomically there.
    const apiRes = await fetchBackendApi(`/v1/keys/${id}`, { method: 'DELETE' });
    if (!apiRes.error) {
      revalidatePath('/dashboard/keys');
      revalidatePath('/dashboard');
      return { ok: true };
    }
    if (apiRes.status === 404) {
      return { ok: false, error: 'API key not found or already deleted' };
    }
    if (apiRes.status >= 400 && apiRes.status < 500) {
      return { ok: false, error: apiRes.error };
    }

    // 2. Fallback when backend API is unreachable in local dev (status === 0 or 5xx):
    //    delete directly in DB, record forensic audit row, and send revocation email.
    const [deleted] = await db
      .delete(s.apiKeys)
      .where(and(eq(s.apiKeys.id, id), eq(s.apiKeys.userId, user.id)))
      .returning({ id: s.apiKeys.id, name: s.apiKeys.name, keyPrefix: s.apiKeys.keyPrefix });

    if (!deleted) {
      return { ok: false, error: 'API key not found or already deleted' };
    }

    await db.insert(s.adminAuditLog).values({
      adminId: user.id,
      action: 'key.revoked',
      entity: 'api_key',
      entityId: deleted.id,
      detail: { actor: 'user', keyPrefix: deleted.keyPrefix, source: 'web_fallback' },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://morphic-api.web.id';
    void sendEmail({
      to: user.email,
      subject: `API key Morphic dicabut: ${deleted.name} (${deleted.keyPrefix}...)`,
      text: `API key "${deleted.name}" (${deleted.keyPrefix}...) baru saja dicabut/dihapus dari akun Morphic Anda.\n\nJika ini bukan Anda, segera periksa keamanan akun di: ${appUrl}/dashboard/keys`,
      html: `<p>API key <b>${deleted.name.replace(/[&<>"']/g, '')}</b> (<code>${deleted.keyPrefix}...</code>) baru saja dicabut/dihapus dari akun Morphic Anda.</p><p>Jika ini bukan Anda, segera periksa keamanan akun di <a href="${appUrl}/dashboard/keys">Dashboard API Keys</a>.</p>`,
    }).catch((e) => console.error('[deleteApiKey] revocation email failed:', e));

    revalidatePath('/dashboard/keys');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (err: any) {
    console.error('[deleteApiKey] Failed to delete API key:', err);
    return { ok: false, error: 'Failed to delete API key' };
  }
}

export { maskedKey };


export async function redeemCodeDirect(
  code: string,
): Promise<{ ok: boolean; message: string; code?: string; reward?: any }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode || cleanCode.length > 64) return { ok: false, message: 'Enter a valid code', code: 'missing_code' };

  const user = await requireInteractiveUser();

  const now = Date.now();
  const attempt = failedRedeemAttempts.get(user.id);
  if (attempt && attempt.lockUntil > now) {
    return { ok: false, message: 'Too many wrong codes', code: 'locked', reward: { retryInMinutes: Math.ceil((attempt.lockUntil - now) / 60_000) } };
  }

  // The API is the only writer: it holds the atomic cap/double-spend checks and the rate limit.
  // No direct-DB fallback; if the gateway is down the user is told so and nothing is granted.
  const apiRes = await fetchBackendApi<{ ok: boolean; message: string; reward?: any }>('/v1/redeem', {
    method: 'POST',
    body: JSON.stringify({ code: cleanCode }),
  });

  if (apiRes.status === 200 && apiRes.data?.ok) {
    failedRedeemAttempts.delete(user.id);
    return { ok: true, message: apiRes.data.message, reward: apiRes.data.reward };
  }

  if (apiRes.status === 0 || apiRes.status >= 500) {
    return { ok: false, message: apiRes.error ?? 'Service unavailable', code: 'service_unavailable' };
  }

  // Only guesses at unknown codes count toward the lockout.
  if (apiRes.errorCode === 'invalid_code') {
    const cur = failedRedeemAttempts.get(user.id) || { count: 0, lockUntil: 0 };
    cur.count += 1;
    if (cur.count >= 5) {
      cur.lockUntil = Date.now() + 10 * 60_000;
      cur.count = 0;
    }
    failedRedeemAttempts.set(user.id, cur);
  }
  return { ok: false, message: apiRes.error ?? 'Failed to redeem code', code: apiRes.errorCode ?? 'redeem_failed' };
}

export async function redeemCode(_prev: { ok: boolean; message: string }, formData: FormData) {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  return redeemCodeDirect(code);
}


export async function createMockPayment(formData: FormData) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Mock payments are strictly disabled in production environment.');
  }

  const packageId = String(formData.get('packageId'));
  const externalId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const user = await requireInteractiveUser();
  try {
    const [pkg] = await db.select().from(s.packages).where(eq(s.packages.id, packageId)).limit(1);
    if (pkg && pkg.status === 'active') {
      const [payment] = await db
        .insert(s.payments)
        .values({
          userId: user.id,
          provider: 'mock',
          externalId,
          packageId: pkg.id,
          amountCents: pkg.priceCents ?? 0,
          credits: pkg.creditAllowance,
        })
        .returning();

      return {
        paymentId: payment!.id,
        externalId,
        qrPayload: `MORPHIC:PAY:${externalId}:${pkg.priceCents}`,
        amountCents: pkg.priceCents ?? 0,
        packageName: pkg.name,
      };
    }
    throw new Error('Package not found or inactive');
  } catch (err) {
    console.error('[createMockPayment] Error creating payment record:', err);
    throw new Error('Gagal membuat tagihan pembayaran. Silakan hubungi support.');
  }
}

export async function simulatePaymentWebhook(formData: FormData) {
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, message: 'Simulated payment webhooks are strictly disabled in production.' };
  }

  await requireUser();
  const externalId = String(formData.get('externalId'));
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const payload = JSON.stringify({ event_id: eventId, payment_id: externalId, status: 'paid' });
  const { createHmac } = await import('node:crypto');
  const secret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, message: 'Webhook secret is not configured' };
  }
  const signature = createHmac('sha256', secret).update(payload).digest('hex');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';
  const res = await fetch(`${apiUrl}/webhooks/mock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-webhook-signature': signature },
    body: payload,
  });
  if (!res.ok) return { ok: false, message: `Webhook failed: ${res.status}` };
  return { ok: true, message: 'Payment confirmed' };
}


export async function createPaymentAction(packageId: string, paymentMethod?: string) {
  const session = await getSessionWithRetry();
  if (!session) redirect('/login');

  const res = await fetchBackendApi<{
    paymentId: string;
    merchantOrderId: string;
    paymentUrl: string;
    qrString?: string;
    reference: string;
    amountIDR: number;
    expiresAt: string;
    package: { id: string | null; name: string; creditAllowance: number };
  }>('/v1/payments/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.session.token}`,
    },
    body: JSON.stringify({ packageId, paymentMethod }),
  });

  if (res.error || !res.data) {
    throw new Error(res.error ?? 'Gagal membuat transaksi pembayaran');
  }

  return res.data;
}

export async function checkPaymentStatusAction(paymentId: string) {
  const session = await getSessionWithRetry();
  if (!session) redirect('/login');

  const res = await fetchBackendApi<{ status: string; credits?: number }>(
    `/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${session.session.token}`,
      },
    }
  );

  if (res.error || !res.data) {
    throw new Error(res.error ?? 'Gagal memeriksa status');
  }

  return res.data;
}


export async function getUsageLogsAction(params: {
  /** Opaque keyset cursor from a previous call's `nextCursor`; omitted for the newest page. */
  before?: string | null;
  limit?: number;
  from?: string;
  to?: string;
  status?: 'all' | 'success' | 'error';
} = {}) {
  const session = await getSessionWithRetry();
  if (!session) redirect('/login');

  // Up to 500 so the CSV export can walk the range in a few large batches.
  const limit = Math.min(500, Math.max(1, Math.trunc(Number(params.limit)) || PAGE_SIZE));

  // Read the usage table directly: the gateway endpoint this used to call issues the same
  // queries against the same rows, one region away.
  try {
    const conditions = [eq(s.usageRecords.userId, session.user.id)];
    if (params.from) {
      const fromDate = new Date(params.from);
      if (!isNaN(fromDate.getTime())) conditions.push(gte(s.usageRecords.createdAt, fromDate));
    }
    if (params.to) {
      const toDate = new Date(params.to);
      if (!isNaN(toDate.getTime())) conditions.push(lte(s.usageRecords.createdAt, toDate));
    }
    // "Errors" covers every non-success status (error and partial), as the table always showed it.
    if (params.status === 'success') conditions.push(eq(s.usageRecords.status, 'success'));
    else if (params.status === 'error') conditions.push(ne(s.usageRecords.status, 'success'));
    const older = olderThan(s.usageRecords.createdAt, s.usageRecords.id, decodeCursor(params.before));
    if (older) conditions.push(older);

    const rows = await db
      .select({
        id: s.usageRecords.id,
        cursorAt: cursorAt(s.usageRecords.createdAt),
        requestId: s.usageRecords.requestId,
        model: s.models.displayName,
        publicModelId: s.models.publicModelId,
        promptTokens: s.usageRecords.promptTokens,
        completionTokens: s.usageRecords.completionTokens,
        totalTokens: s.usageRecords.totalTokens,
        credits: s.usageRecords.creditsConsumed,
        status: s.usageRecords.status,
        streamed: s.usageRecords.streamed,
        latencyMs: s.usageRecords.latencyMs,
        createdAt: s.usageRecords.createdAt,
      })
      .from(s.usageRecords)
      .leftJoin(s.models, eq(s.usageRecords.modelId, s.models.id))
      .where(and(...conditions))
      .orderBy(desc(s.usageRecords.createdAt), desc(s.usageRecords.id))
      .limit(limit + 1);
    const { items, nextCursor } = toPage(rows, limit);

    return {
      data: items.map((u) => ({
        id: u.id,
        requestId: u.requestId,
        model: u.model,
        publicModelId: u.publicModelId,
        promptTokens: u.promptTokens,
        completionTokens: u.completionTokens,
        totalTokens: u.totalTokens,
        credits: u.credits,
        status: u.status,
        streamed: u.streamed,
        latencyMs: u.latencyMs,
        createdAt: u.createdAt.toISOString(),
      })),
      nextCursor,
    };
  } catch (err) {
    console.warn('[getUsageLogsAction] Database fallback failed:', err);
    return { data: [], nextCursor: null };
  }
}

/** One page of the signed-in user's payments for the billing list: the newest when `before` is empty. */
export async function getPaymentsPageAction(params: { before?: string | null } = {}) {
  const user = await requireUser();
  // Explicit columns: capture ids, reconcile timestamps and refund amounts stay on the server.
  const rows = await db
    .select({
      id: s.payments.id,
      cursorAt: cursorAt(s.payments.createdAt),
      provider: s.payments.provider,
      externalId: s.payments.externalId,
      packageId: s.payments.packageId,
      packageName: s.packages.name,
      amountCents: s.payments.amountCents,
      currency: s.payments.currency,
      credits: s.payments.credits,
      status: s.payments.status,
      createdAt: s.payments.createdAt,
    })
    .from(s.payments)
    .leftJoin(s.packages, eq(s.payments.packageId, s.packages.id))
    .where(and(eq(s.payments.userId, user.id), olderThan(s.payments.createdAt, s.payments.id, decodeCursor(params.before))))
    .orderBy(desc(s.payments.createdAt), desc(s.payments.id))
    .limit(PAGE_SIZE + 1);
  const { items, nextCursor } = toPage(rows);
  return {
    data: items.map(({ cursorAt: _c, ...p }) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    nextCursor,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids behind `code:<id>` / `payment:<id>` ledger references, so names resolve by primary key. */
function referencedIds(refs: (string | null)[], prefix: string): string[] {
  const ids = refs.flatMap((r) => (r?.startsWith(prefix) ? [r.slice(prefix.length)] : []));
  return [...new Set(ids.filter((id) => UUID_RE.test(id)))];
}

/** One page of the signed-in user's credit ledger, then the redeem code and package names it points to. */
export async function getLedgerPageAction(params: { before?: string | null } = {}) {
  const user = await requireUser();
  const rows = await db
    .select({
      id: s.creditLedger.id,
      cursorAt: cursorAt(s.creditLedger.createdAt),
      entryType: s.creditLedger.entryType,
      amount: s.creditLedger.amount,
      reference: s.creditLedger.reference,
      createdAt: s.creditLedger.createdAt,
    })
    .from(s.creditLedger)
    .where(and(eq(s.creditLedger.userId, user.id), olderThan(s.creditLedger.createdAt, s.creditLedger.id, decodeCursor(params.before))))
    .orderBy(desc(s.creditLedger.createdAt), desc(s.creditLedger.id))
    .limit(PAGE_SIZE + 1);
  const { items, nextCursor } = toPage(rows);
  const refs = items.map((r) => r.reference);
  const codeIds = referencedIds(refs, 'code:');
  const paymentIds = referencedIds(refs, 'payment:');
  const [codes, paid] = await Promise.all([
    codeIds.length
      ? db.select({ id: s.redeemCodes.id, code: s.redeemCodes.code }).from(s.redeemCodes).where(inArray(s.redeemCodes.id, codeIds))
      : [],
    paymentIds.length
      ? db
          .select({ id: s.payments.id, packageName: s.packages.name })
          .from(s.payments)
          .leftJoin(s.packages, eq(s.payments.packageId, s.packages.id))
          .where(inArray(s.payments.id, paymentIds))
      : [],
  ]);
  const codeById = new Map(codes.map((c) => [c.id, c.code]));
  const packageByPayment = new Map(paid.map((p) => [p.id, p.packageName]));
  return {
    data: items.map(({ cursorAt: _c, ...r }) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      redeemCode: r.reference?.startsWith('code:') ? (codeById.get(r.reference.slice(5)) ?? null) : null,
      packageName: r.reference?.startsWith('payment:') ? (packageByPayment.get(r.reference.slice(8)) ?? null) : null,
    })),
    nextCursor,
  };
}

/** One numbered page of the signed-in user's active, unexpired passes for the billing Plans tab. */
export async function getActivePassesPageAction(params: { page?: number } = {}) {
  const user = await requireUser();
  const active = and(
    eq(s.entitlements.userId, user.id),
    eq(s.entitlements.status, 'active'),
    gt(s.entitlements.expiresAt, new Date()),
  );
  return loadPage(
    readPage(String(params.page ?? 1)),
    (offset, limit) =>
      db
        .select({
          id: s.entitlements.id,
          allowance: s.entitlements.allowance,
          remaining: s.entitlements.remaining,
          unlimited: s.entitlements.unlimited,
          resetsAt: s.entitlements.resetsAt,
          expiresAt: s.entitlements.expiresAt,
          packageName: s.packages.name,
          displayName: s.models.displayName,
        })
        .from(s.entitlements)
        .leftJoin(s.packages, eq(s.entitlements.packageId, s.packages.id))
        .leftJoin(s.models, eq(s.entitlements.modelId, s.models.id))
        .where(active)
        .orderBy(desc(s.entitlements.createdAt), desc(s.entitlements.id))
        .limit(limit)
        .offset(offset),
    () => cappedCount(db.select({ id: s.entitlements.id }).from(s.entitlements).where(active).$dynamic()),
  );
}

const GIFT_OPEN = ['pending', 'pending_paypal', 'capturing'];
const GIFT_FAILED = ['failed', 'expired'];

type GiftRow = {
  kind: string;
  id: string;
  createdAt: Date;
  design: string;
  recipientEmail: string | null;
  amountCents: number | null;
  currency: string | null;
  credits: number;
  paymentStatus: string | null;
  code: string | null;
  redeemedCount: number | null;
  fromEmail: string | null;
};

/** A sent card or a received redemption, shaped for the gift history list. */
function toGiftTransaction(g: GiftRow): GiftTransaction {
  const date = g.createdAt instanceof Date ? g.createdAt.toISOString() : new Date(g.createdAt).toISOString();
  if (g.kind === 'received') {
    return {
      id: `r-${g.id}`,
      date,
      direction: 'received',
      design: g.design,
      credits: g.credits,
      amountCents: null,
      currency: null,
      from: g.fromEmail,
      to: null,
      code: null,
      status: 'redeemed',
    };
  }
  const paid = g.paymentStatus ?? '';
  return {
    id: g.id,
    date,
    direction: 'sent',
    design: g.design,
    credits: g.credits,
    amountCents: g.amountCents,
    currency: g.currency,
    from: null,
    to: g.recipientEmail,
    code: paid === 'paid' ? g.code : null,
    status: GIFT_OPEN.includes(paid)
      ? 'pending'
      : GIFT_FAILED.includes(paid)
        ? 'failed'
        : paid !== 'paid'
          ? 'on_hold'
          : (g.redeemedCount ?? 0) > 0
            ? 'redeemed'
            : 'ready',
  };
}

/**
 * One numbered page of gift cards the signed-in user bought or received, newest first. Both tables
 * go through one UNION ALL, so the database sorts and slices them and only one page comes back.
 */
export async function getGiftHistoryPageAction(params: { page?: number } = {}): Promise<NumberedPage<GiftTransaction>> {
  const user = await requireUser();
  const sentWhere = eq(s.giftCards.purchaserId, user.id);
  const receivedWhere = and(eq(s.redemptions.userId, user.id), ne(s.giftCards.purchaserId, user.id));
  const sent = () =>
    db
      .select({
        kind: sql<string>`'sent'`.as('kind'),
        id: s.giftCards.id,
        createdAt: s.giftCards.createdAt,
        design: s.giftCards.design,
        recipientEmail: s.giftCards.recipientEmail,
        amountCents: sql<number | null>`${s.payments.amountCents}`.as('amount_cents'),
        currency: sql<string | null>`${s.payments.currency}`.as('currency'),
        credits: s.payments.credits,
        paymentStatus: sql<string | null>`${s.payments.status}::text`.as('payment_status'),
        code: s.redeemCodes.code,
        redeemedCount: sql<number | null>`${s.redeemCodes.redeemedCount}`.as('redeemed_count'),
        fromEmail: sql<string | null>`null::text`.as('from_email'),
      })
      .from(s.giftCards)
      .innerJoin(s.payments, eq(s.payments.id, s.giftCards.paymentId))
      .leftJoin(s.redeemCodes, eq(s.redeemCodes.id, s.giftCards.redeemCodeId))
      .where(sentWhere);
  const received = () =>
    db
      .select({
        kind: sql<string>`'received'`.as('kind'),
        id: s.giftCards.id,
        createdAt: s.redemptions.createdAt,
        design: s.giftCards.design,
        recipientEmail: sql<string | null>`null::text`.as('recipient_email'),
        amountCents: sql<number | null>`null::integer`.as('amount_cents'),
        currency: sql<string | null>`null::text`.as('currency'),
        credits: s.payments.credits,
        paymentStatus: sql<string | null>`null::text`.as('payment_status'),
        code: sql<string | null>`null::text`.as('code'),
        redeemedCount: sql<number | null>`null::integer`.as('redeemed_count'),
        fromEmail: sql<string | null>`${s.users.email}`.as('from_email'),
      })
      .from(s.redemptions)
      .innerJoin(s.giftCards, eq(s.giftCards.redeemCodeId, s.redemptions.codeId))
      .innerJoin(s.payments, eq(s.payments.id, s.giftCards.paymentId))
      .innerJoin(s.users, eq(s.users.id, s.giftCards.purchaserId))
      .where(receivedWhere);

  const page = await loadPage(
    readPage(String(params.page ?? 1)),
    (offset, limit) =>
      unionAll(sent(), received())
        .orderBy(sql`created_at desc`, sql`id desc`)
        .limit(limit)
        .offset(offset) as Promise<GiftRow[]>,
    async () => {
      const [a, b] = await Promise.all([
        cappedCount(db.select({ id: s.giftCards.id }).from(s.giftCards).where(sentWhere).$dynamic()),
        cappedCount(
          db
            .select({ id: s.redemptions.id })
            .from(s.redemptions)
            .innerJoin(s.giftCards, eq(s.giftCards.redeemCodeId, s.redemptions.codeId))
            .where(receivedWhere)
            .$dynamic(),
        ),
      ]);
      const sum = a.total + b.total;
      return { total: Math.min(sum, COUNT_CAP), capped: a.capped || b.capped || sum > COUNT_CAP };
    },
  );
  return { ...page, items: page.items.map(toGiftTransaction) };
}

const COUPON_SOURCES = ['purchase', 'redeem', 'admin', 'promotion'] as const;

/**
 * One numbered page of every entitlement the signed-in user ever held, for the redeem page's coupon
 * list, filtered by source and by available vs used/expired in SQL.
 */
export async function getCouponsPageAction(params: { page?: number; type?: string; state?: string } = {}) {
  const user = await requireUser();
  const type = COUPON_SOURCES.find((t) => t === params.type);
  // Same rule as the view's isAvailable: active, something left, not expired.
  const available = sql`(${s.entitlements.status} = 'active' and ${s.entitlements.remaining} > 0 and ${s.entitlements.expiresAt} > now())`;
  const where = and(
    eq(s.entitlements.userId, user.id),
    type ? eq(s.entitlements.source, type) : undefined,
    params.state === 'available' ? available : params.state === 'inactive' ? sql`not coalesce(${available}, false)` : undefined,
  );
  const page = await loadPage(
    readPage(String(params.page ?? 1)),
    (offset, limit) =>
      db
        .select({
          id: s.entitlements.id,
          allowance: s.entitlements.allowance,
          remaining: s.entitlements.remaining,
          source: s.entitlements.source,
          status: s.entitlements.status,
          expiresAt: s.entitlements.expiresAt,
          packageName: s.packages.name,
          modelName: s.models.displayName,
        })
        .from(s.entitlements)
        .leftJoin(s.packages, eq(s.entitlements.packageId, s.packages.id))
        .leftJoin(s.models, eq(s.entitlements.modelId, s.models.id))
        .where(where)
        .orderBy(desc(s.entitlements.createdAt), desc(s.entitlements.id))
        .limit(limit)
        .offset(offset),
    () => cappedCount(db.select({ id: s.entitlements.id }).from(s.entitlements).where(where).$dynamic()),
  );
  return { ...page, items: page.items.map((c) => ({ ...c, expiresAt: c.expiresAt.toISOString() })) };
}

const exportBatch = (limit?: number) => Math.min(500, Math.max(1, Math.trunc(Number(limit)) || 500));

/** One keyset batch of the signed-in user's payments for the billing CSV export (same columns as the gateway's /v1/account/payments). */
export async function getPaymentsExportPageAction(params: { before?: string | null; limit?: number } = {}) {
  const user = await requireUser();
  const limit = exportBatch(params.limit);
  const rows = await db
    .select({
      id: s.payments.id,
      cursorAt: cursorAt(s.payments.createdAt),
      provider: s.payments.provider,
      amountCents: s.payments.amountCents,
      currency: s.payments.currency,
      credits: s.payments.credits,
      status: s.payments.status,
      paidAt: s.payments.paidAt,
      createdAt: s.payments.createdAt,
    })
    .from(s.payments)
    .where(and(eq(s.payments.userId, user.id), olderThan(s.payments.createdAt, s.payments.id, decodeCursor(params.before))))
    .orderBy(desc(s.payments.createdAt), desc(s.payments.id))
    .limit(limit + 1);
  const { items, nextCursor } = toPage(rows, limit);
  return {
    data: items.map((p) => ({
      id: p.id,
      provider: p.provider,
      amount_cents: p.amountCents,
      currency: p.currency,
      credits: p.credits,
      status: p.status,
      paid_at: p.paidAt?.toISOString() ?? null,
      created_at: p.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

/** One keyset batch of the signed-in user's credit ledger for the billing CSV export (same columns as the gateway's /v1/account/transactions). */
export async function getLedgerExportPageAction(params: { before?: string | null; limit?: number } = {}) {
  const user = await requireUser();
  const limit = exportBatch(params.limit);
  const rows = await db
    .select({
      id: s.creditLedger.id,
      cursorAt: cursorAt(s.creditLedger.createdAt),
      entryType: s.creditLedger.entryType,
      amount: s.creditLedger.amount,
      sourceType: s.creditLedger.sourceType,
      reference: s.creditLedger.reference,
      createdAt: s.creditLedger.createdAt,
    })
    .from(s.creditLedger)
    .where(and(eq(s.creditLedger.userId, user.id), olderThan(s.creditLedger.createdAt, s.creditLedger.id, decodeCursor(params.before))))
    .orderBy(desc(s.creditLedger.createdAt), desc(s.creditLedger.id))
    .limit(limit + 1);
  const { items, nextCursor } = toPage(rows, limit);
  return {
    data: items.map((t) => ({
      id: t.id,
      entry_type: t.entryType,
      amount: t.amount,
      source_type: t.sourceType,
      reference: t.reference,
      created_at: t.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

export async function provisionPostPaymentKey(params?: { packageName?: string }) {
  const user = await requireInteractiveUser();
  const name = params?.packageName ? `Pass: ${params.packageName}` : 'Quickstart Key';

  // Server actions are callable endpoints — the "post payment" framing is not a gate.
  // Require the caller to actually have a paid payment before minting a key (audit H6).
  const [paid] = await db
    .select({ id: s.payments.id })
    .from(s.payments)
    .where(and(eq(s.payments.userId, user.id), eq(s.payments.status, 'paid')))
    .limit(1);
  if (!paid) {
    return { ok: false, error: 'No completed payment found for this account.' };
  }

  // Enforce max 5 API keys limit
  const [keyCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.apiKeys)
    .where(eq(s.apiKeys.userId, user.id));

  if ((keyCount?.count ?? 0) >= 5) {
    return {
      ok: false,
      error: 'Batas maksimal 5 API key telah tercapai (5/5). Hapus key lama yang tidak terpakai untuk membuat key baru.',
    };
  }

  const { raw, hash, prefix } = generateApiKey();

  try {
    const [inserted] = await db
      .insert(s.apiKeys)
      .values({
        userId: user.id,
        name,
        keyHash: hash,
        keyPrefix: prefix,
        expiresAt: null,
      })
      .returning({ id: s.apiKeys.id, prefix: s.apiKeys.keyPrefix });

    return {
      ok: true,
      rawKey: raw,
      prefix: inserted?.prefix ?? prefix,
      name,
    };
  } catch (err: any) {
    console.error('[provisionPostPaymentKey] Failed to insert key:', err);
    return {
      ok: false,
      error: 'Failed to create API key',
    };
  }
}

async function hasPasswordLogin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: s.accounts.id })
    .from(s.accounts)
    .where(and(eq(s.accounts.userId, userId), eq(s.accounts.providerId, 'credential'), isNotNull(s.accounts.password)))
    .limit(1);
  return Boolean(row);
}

const DELETE_CODE_TTL_MS = 10 * 60 * 1000;
const DELETE_CODE_MAX_ATTEMPTS = 5;
const deleteCodeId = (userId: string) => `delete-account:${userId}`;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * Accounts without a password (Google/GitHub only) re-authenticate account deletion with a
 * 6-digit code sent to their email. Stored hashed with an attempt counter: `<hash>:<n>`.
 */
export async function requestAccountDeletionCode() {
  const user = await requireInteractiveUser();
  if (!user.email) return { ok: false as const, error: 'Akun tidak memiliki email.' };

  const [existing] = await db
    .select({ createdAt: s.verifications.createdAt })
    .from(s.verifications)
    .where(eq(s.verifications.identifier, deleteCodeId(user.id)))
    .limit(1);
  if (existing && Date.now() - existing.createdAt.getTime() < 60_000) {
    return { ok: false as const, error: 'Tunggu 1 menit sebelum meminta kode baru.' };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.delete(s.verifications).where(eq(s.verifications.identifier, deleteCodeId(user.id)));
  await db.insert(s.verifications).values({
    identifier: deleteCodeId(user.id),
    value: `${sha256(code)}:0`,
    expiresAt: new Date(Date.now() + DELETE_CODE_TTL_MS),
  });
  await sendEmail({
    to: user.email,
    subject: `Kode konfirmasi hapus akun Morphic: ${code}`,
    text: `Kode untuk mengonfirmasi penghapusan akun Morphic Anda: ${code}\n\nBerlaku 10 menit. Jika Anda tidak meminta ini, abaikan email ini dan akun Anda tetap aman.`,
    html: `<p>Kode untuk mengonfirmasi penghapusan akun Morphic Anda:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>Berlaku 10 menit. Jika Anda tidak meminta ini, abaikan email ini dan akun Anda tetap aman.</p>`,
  });
  return { ok: true as const };
}

async function checkDeletionCode(userId: string, code: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(s.verifications)
    .where(eq(s.verifications.identifier, deleteCodeId(userId)))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return 'Kode sudah kedaluwarsa. Minta kode baru.';
  const [hash, n] = row.value.split(':');
  const attempts = Number(n) || 0;
  if (attempts >= DELETE_CODE_MAX_ATTEMPTS) return 'Terlalu banyak percobaan salah. Minta kode baru.';
  const ok = /^\d{6}$/.test(code) && timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(hash));
  if (!ok) {
    await db
      .update(s.verifications)
      .set({ value: `${hash}:${attempts + 1}` })
      .where(eq(s.verifications.id, row.id));
    return 'Kode salah.';
  }
  await db.delete(s.verifications).where(eq(s.verifications.id, row.id));
  return null;
}

/**
 * Self-serve account deletion. Re-authenticates (password, or an emailed code for
 * password-less accounts), then soft-deletes: the user row is kept but anonymised and
 * suspended so credit_ledger / payments / usage stay intact for financial retention, while
 * every way back in (credentials, OAuth links, sessions, API keys) is removed.
 */
export async function deleteOwnAccount(formData: FormData) {
  const user = await requireInteractiveUser();
  const confirmation = String(formData.get('confirmation') || '').trim();
  const password = String(formData.get('password') || '');
  const code = String(formData.get('code') || '').trim();

  if (!user.email || confirmation.toLowerCase() !== user.email.toLowerCase()) {
    return {
      ok: false,
      error: 'Konfirmasi email tidak sesuai. Masukkan alamat email akun Anda persis seperti terdaftar.',
    };
  }

  if (await hasPasswordLogin(user.id)) {
    if (!password) return { ok: false, error: 'Masukkan kata sandi Anda.' };
    try {
      await auth.api.verifyPassword({ body: { password }, headers: await headers() });
    } catch (err: any) {
      return {
        ok: false,
        error:
          err?.body?.code === 'SESSION_NOT_FRESH'
            ? 'Demi keamanan, keluar lalu masuk lagi sebelum menghapus akun.'
            : 'Kata sandi salah.',
      };
    }
  } else {
    const codeError = await checkDeletionCode(user.id, code);
    if (codeError) return { ok: false, error: codeError };
  }

  try {
    await softDeleteUser(user.id);
    revalidatePath('/dashboard');
    revalidatePath('/login');
    return { ok: true };
  } catch (err: any) {
    console.error('[deleteOwnAccount] Failed to delete account:', err);
    return { ok: false, error: 'Gagal menghapus akun. Silakan coba lagi nanti.' };
  }
}

/** Fresh notification list for the drawer, so it is current without reloading the dashboard. */
export async function getNotificationsAction() {
  const user = await requireUser();
  return loadNotifications(user.id);
}

const ADMIN_IP_OTP_TTL_MS = 10 * 60 * 1000;
const ADMIN_IP_OTP_MAX_ATTEMPTS = 5;

/**
 * Read-only step-up status for the admin tab watcher. Never extends the marker, so a tab left
 * open does not keep the session trusted.
 */
export async function getAdminStepUpStatus(): Promise<{ isAdmin: boolean; required: boolean }> {
  const check = await adminCheck();
  if (!check) return { isAdmin: false, required: false };
  if (check.mfaMissing) return { isAdmin: true, required: false };
  const stepUp = await adminStepUpState(check.sessionId);
  return { isAdmin: true, required: stepUp.required };
}

/** Sends a 6-digit code to the signed-in admin's email to open the Admin Panel. */
export type AdminStepUpCodeResult =
  | { ok: true; retryAfterS: number }
  | { ok: false; reason: 'cooldown'; retryAfterS: number }
  | { ok: false; reason: 'send_failed'; error: string; retryAfterS: number }
  | { ok: false; reason: 'denied'; error: string };

export async function requestAdminStepUpCode(): Promise<AdminStepUpCodeResult> {
  const check = await adminCheck();
  if (!check) {
    return { ok: false, reason: 'denied', error: 'Akses ditolak: akun bukan admin aktif.' };
  }
  if (!check.user.email) {
    return { ok: false, reason: 'denied', error: 'Akun admin tidak memiliki alamat email terdaftar.' };
  }

  const otpId = adminIpOtpId(check.user.id);
  const [existing] = await db
    .select({ createdAt: s.verifications.createdAt })
    .from(s.verifications)
    .where(eq(s.verifications.identifier, otpId))
    .limit(1);
  // The previous code is still in the inbox and still valid: the dialog shows the input and a
  // countdown instead of a dead end.
  const waitS = existing ? otpResendWaitSeconds(existing.createdAt.getTime(), Date.now()) : 0;
  if (waitS > 0) return { ok: false, reason: 'cooldown', retryAfterS: waitS };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.delete(s.verifications).where(eq(s.verifications.identifier, otpId));
  await db.insert(s.verifications).values({
    identifier: otpId,
    value: `${sha256(code)}:0`,
    expiresAt: new Date(Date.now() + ADMIN_IP_OTP_TTL_MS),
  });

  const ip = check.clientIp ?? 'tidak diketahui';
  const country = parseGeoCountry(await headers()) ?? 'tidak diketahui';
  try {
    await sendEmail({
      to: check.user.email,
      subject: `Kode verifikasi Panel Admin Morphic: ${code}`,
      text: `Kode untuk membuka Panel Admin Morphic: ${code}\n\nBerlaku 10 menit. Permintaan dari IP ${ip} (negara: ${country}).\n\nJika Anda tidak sedang membuka Panel Admin, segera cabut sesi aktif Anda dan ganti kata sandi.`,
      html: `<p>Kode untuk membuka <strong>Panel Admin Morphic</strong>:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>Berlaku 10 menit. Permintaan dari IP <code>${ip}</code> (negara: ${country}).</p><p>Jika Anda tidak sedang membuka Panel Admin, segera cabut sesi aktif Anda dan ganti kata sandi.</p>`,
    });
  } catch (err) {
    // The stored code never reached anyone, but the row stays so the 60-second cooldown also
    // applies to failed sends: repeated clicks cannot hammer the email provider.
    console.error('[requestAdminStepUpCode] email send failed:', err);
    return {
      ok: false,
      reason: 'send_failed',
      error: 'Email kode gagal dikirim. Coba lagi setelah hitungan selesai.',
      retryAfterS: Math.ceil(ADMIN_OTP_RESEND_COOLDOWN_MS / 1000),
    };
  }

  return { ok: true, retryAfterS: Math.ceil(ADMIN_OTP_RESEND_COOLDOWN_MS / 1000) };
}

/**
 * Verifies the 6-digit Admin Panel code. On success the session's step-up marker is written with
 * the request country and a 24-hour expiry, and the check is logged to `admin_audit_log`.
 */
export async function verifyAdminStepUpCode(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const check = await adminCheck();
  if (!check) {
    return { ok: false, error: 'Akses ditolak: akun bukan admin aktif.' };
  }

  const code = String(formData.get('code') || '').trim();
  const otpId = adminIpOtpId(check.user.id);
  const [row] = await db
    .select()
    .from(s.verifications)
    .where(eq(s.verifications.identifier, otpId))
    .limit(1);

  if (!row || row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'Kode sudah kedaluwarsa. Minta kode baru.' };
  }
  const [hash, n] = row.value.split(':');
  const attempts = Number(n) || 0;
  if (attempts >= ADMIN_IP_OTP_MAX_ATTEMPTS) {
    return { ok: false, error: 'Terlalu banyak percobaan salah. Minta kode baru.' };
  }

  const ok =
    /^\d{6}$/.test(code) &&
    Boolean(hash) &&
    timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(hash));
  if (!ok) {
    await db
      .update(s.verifications)
      .set({ value: `${hash}:${attempts + 1}` })
      .where(eq(s.verifications.id, row.id));
    return { ok: false, error: 'Kode OTP salah.' };
  }

  const now = Date.now();
  const country = parseGeoCountry(await headers());
  const verifiedSessionId = adminVerifiedSessionId(check.sessionId);
  await db.delete(s.verifications).where(eq(s.verifications.id, row.id));
  await db.delete(s.verifications).where(eq(s.verifications.identifier, verifiedSessionId));
  await db.insert(s.verifications).values({
    identifier: verifiedSessionId,
    value: formatStepUpValue(now, country),
    expiresAt: new Date(now + ADMIN_STEP_UP_IDLE_MS),
  });

  await db.insert(s.adminAuditLog).values({
    adminId: check.user.id,
    action: 'verify_admin_step_up',
    entity: 'session',
    entityId: check.sessionId,
    detail: { ip: check.clientIp, country },
  });

  revalidatePath('/admin', 'layout');
  return { ok: true };
}
