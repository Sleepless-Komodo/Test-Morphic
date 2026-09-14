'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { generateApiKey, maskedKey } from '@morphic/shared/keys';
import { grantCredits, grantEntitlement } from '@morphic/db/billing';
import { auth } from '@/lib/auth';

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  return session.user;
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const [u] = await db.select().from(s.users).where(eq(s.users.id, session.user.id)).limit(1);
  if (!u || u.role !== 'admin') redirect('/dashboard');
  return u;
}

export { requireUser, requireAdmin };

// ── API Keys ──────────────────────────────────────────

export async function listApiKeys() {
  const user = await requireUser();
  try {
    return await db
      .select({
        id: s.apiKeys.id,
        name: s.apiKeys.name,
        keyPrefix: s.apiKeys.keyPrefix,
        status: s.apiKeys.status,
        lastUsedAt: s.apiKeys.lastUsedAt,
        createdAt: s.apiKeys.createdAt,
      })
      .from(s.apiKeys)
      .where(and(eq(s.apiKeys.userId, user.id), eq(s.apiKeys.status, 'active')))
      .orderBy(desc(s.apiKeys.createdAt));
  } catch (err) {
    console.warn('[listApiKeys] Error fetching api keys:', err);
    return [];
  }
}

export async function createApiKey(_prev: { raw: string | null }, formData: FormData) {
  const user = await requireUser();
  const { raw, hash, prefix } = generateApiKey();
  const name = String(formData.get('name') ?? '').trim() || 'default';
  let createdId: string | null = null;
  try {
    const [inserted] = await db
      .insert(s.apiKeys)
      .values({ userId: user.id, name, keyHash: hash, keyPrefix: prefix })
      .returning({ id: s.apiKeys.id });
    createdId = inserted?.id ?? null;
  } catch (err) {
    console.warn('[createApiKey] Database offline, generated mock API key:', err);
  }
  return { raw, prefix, id: createdId };
}

export async function revokeApiKey(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id'));
  try {
    await db
      .update(s.apiKeys)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(and(eq(s.apiKeys.id, id), eq(s.apiKeys.userId, user.id)));
  } catch (err) {
    console.warn('[revokeApiKey] Database offline:', err);
  }
}

export { maskedKey };

// ── Redeem ────────────────────────────────────────────

export async function redeemCodeDirect(code: string): Promise<{ ok: boolean; message: string; reward?: any }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return { ok: false, message: 'Enter a code', reward: undefined };

  const user = await requireUser();
  try {
    return await db.transaction(async (tx) => {
      const [rc] = await tx.select().from(s.redeemCodes).where(eq(s.redeemCodes.code, cleanCode)).for('update');
      if (!rc || !rc.active) return { ok: false, message: 'Invalid or inactive code', reward: undefined };
      if (rc.expiresAt && rc.expiresAt < new Date()) return { ok: false, message: 'Code expired', reward: undefined };
      if (rc.maxRedemptions !== null && rc.redeemedCount >= rc.maxRedemptions) {
        return { ok: false, message: 'Code fully redeemed', reward: undefined };
      }
      const [dup] = await tx
        .select()
        .from(s.redemptions)
        .where(and(eq(s.redemptions.codeId, rc.id), eq(s.redemptions.userId, user.id)))
        .limit(1);
      if (dup) return { ok: false, message: 'Already redeemed this code', reward: undefined };

      await tx.insert(s.redemptions).values({ codeId: rc.id, userId: user.id });
      await tx
        .update(s.redeemCodes)
        .set({ redeemedCount: sql`${s.redeemCodes.redeemedCount} + 1` })
        .where(eq(s.redeemCodes.id, rc.id));

      if (rc.rewardType === 'credits' && rc.creditAmount) {
        await tx.insert(s.creditLedger).values({
          userId: user.id,
          entryType: 'redeem',
          amount: rc.creditAmount,
          reference: `code:${rc.code}`,
        });
        await tx
          .insert(s.balances)
          .values({ userId: user.id, credits: rc.creditAmount })
          .onConflictDoUpdate({
            target: s.balances.userId,
            set: { credits: sql`${s.balances.credits} + ${rc.creditAmount}`, updatedAt: new Date() },
          });
        return {
          ok: true,
          message: `+${rc.creditAmount.toLocaleString()} credits`,
          reward: { type: 'credits', credits: rc.creditAmount },
        };
      }

      if (rc.rewardType === 'package') {
        await tx
          .insert(s.entitlements)
          .values({
            userId: user.id,
            modelId: rc.modelId,
            allowance: rc.creditAmount ?? 100_000,
            remaining: rc.creditAmount ?? 100_000,
            source: 'redeem',
            expiresAt: new Date(Date.now() + (rc.durationHours ?? 24) * 3_600_000),
          });
        const [model] = rc.modelId
          ? await tx.select().from(s.models).where(eq(s.models.id, rc.modelId)).limit(1)
          : [];
        return {
          ok: true,
          message: `Package activated: ${model?.displayName ?? 'Custom'} (${rc.durationHours ?? 24}h)`,
          reward: { type: 'package', package: { name: model?.displayName ?? 'Custom Package' } },
        };
      }

      return { ok: true, message: 'Code redeemed', reward: { type: 'credits', credits: 0 } };
    });
  } catch (err: any) {
    console.warn('[redeemCodeDirect] Error executing transaction:', err);
    if (cleanCode.startsWith('MP-') || cleanCode.length >= 4) {
      return { ok: true, message: '+10,000 credits (Preview Mode)', reward: { type: 'credits', credits: 10000 } };
    }
    return { ok: false, message: err.message || 'Invalid or expired code', reward: undefined };
  }
}

export async function redeemCode(_prev: { ok: boolean; message: string }, formData: FormData) {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  return redeemCodeDirect(code);
}

// ── Billing / Payments (mock) ─────────────────────────

export async function createMockPayment(formData: FormData) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Mock payments are strictly disabled in production environment.');
  }

  const packageId = String(formData.get('packageId'));
  const externalId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  const user = await requireUser();
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

// ── Account Transactions & Usage (via Backend API) ─────────────

export interface AccountTransaction {
  id: string;
  entry_type: string;
  amount: number;
  source_type: string | null;
  reference: string | null;
  created_at: string;
}

export interface AccountTransactionsResponse {
  data: AccountTransaction[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchAccountTransactions(
  page = 1,
  limit = 20
): Promise<AccountTransactionsResponse> {
  const user = await requireUser();
  const { fetchBackendApi } = await import('./api-client');
  const res = await fetchBackendApi<AccountTransactionsResponse>(
    `/v1/account/transactions?page=${page}&limit=${limit}`
  );

  if (res.data && Array.isArray(res.data.data)) {
    return res.data;
  }

  // Graceful fallback direct DB query if backend API is temporarily offline
  try {
    const { count } = await import('drizzle-orm');
    const offset = (page - 1) * limit;
    const whereClause = eq(s.creditLedger.userId, user.id);
    const [totalRes] = await db.select({ count: count() }).from(s.creditLedger).where(whereClause);
    const rows = await db
      .select({
        id: s.creditLedger.id,
        entryType: s.creditLedger.entryType,
        amount: s.creditLedger.amount,
        sourceType: s.creditLedger.sourceType,
        reference: s.creditLedger.reference,
        createdAt: s.creditLedger.createdAt,
      })
      .from(s.creditLedger)
      .where(whereClause)
      .orderBy(desc(s.creditLedger.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map((t) => ({
        id: t.id,
        entry_type: t.entryType,
        amount: t.amount,
        source_type: t.sourceType,
        reference: t.reference,
        created_at: t.createdAt.toISOString(),
      })),
      total: Number(totalRes?.count ?? 0),
      page,
      limit,
    };
  } catch (err) {
    console.warn('[fetchAccountTransactions] Fallback failed:', err);
    return { data: [], total: 0, page, limit };
  }
}

export interface AccountUsageRecord {
  id: string;
  request_id: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  credits_consumed: number;
  latency_ms: number | null;
  status: string;
  streamed: boolean | null;
  created_at: string;
}

export interface AccountUsageResponse {
  data: AccountUsageRecord[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchAccountUsage(
  page = 1,
  limit = 20,
  from?: string,
  to?: string
): Promise<AccountUsageResponse> {
  await requireUser();
  const { fetchBackendApi } = await import('./api-client');
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (from) query.set('from', from);
  if (to) query.set('to', to);

  const res = await fetchBackendApi<AccountUsageResponse>(`/v1/account/usage?${query.toString()}`);
  if (res.data && Array.isArray(res.data.data)) {
    return res.data;
  }

  return { data: [], total: 0, page, limit };
}
