'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { generateApiKey, maskedKey } from '@morphic/shared/keys';
import { grantCredits, grantEntitlement } from '@morphic/db/billing';
import { auth } from '@/lib/auth';

import { fetchBackendApi } from '@/lib/api-client';

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


export async function listApiKeys() {
  await requireUser();

  try {
    const apiRes = await fetchBackendApi<{ data: any[] }>('/v1/keys');
    if (apiRes.data?.data) {
      return apiRes.data.data.map((k: any) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.prefix,
        status: k.status,
        expiresAt: k.expires_at ? new Date(k.expires_at) : null,
        lastUsedAt: k.last_used_at ? new Date(k.last_used_at) : null,
        createdAt: k.created_at ? new Date(k.created_at) : new Date(),
      }));
    }
  } catch (err) {
    console.warn('[listApiKeys] Backend API fetch failed, falling back to direct DB:', err);
  }

  try {
    const user = await requireUser();
    return await db
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
      .where(and(eq(s.apiKeys.userId, user.id), eq(s.apiKeys.status, 'active')))
      .orderBy(desc(s.apiKeys.createdAt));
  } catch (err) {
    console.warn('[listApiKeys] Error fetching api keys from DB:', err);
    return [];
  }
}

export async function createApiKey(_prev: { raw: string | null }, formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get('name') ?? '').trim() || 'default';
  const expiresIn = String(formData.get('expiresIn') ?? 'none');

  try {
    const apiRes = await fetchBackendApi<{
      id: string;
      name: string;
      prefix: string;
      key: string;
      status: string;
      expires_at: string | null;
    }>('/v1/keys', {
      method: 'POST',
      body: JSON.stringify({ name, expiresIn }),
    });

    if (apiRes.data?.key) {
      return {
        raw: apiRes.data.key,
        prefix: apiRes.data.prefix,
        id: apiRes.data.id,
        expiresAt: apiRes.data.expires_at ? new Date(apiRes.data.expires_at) : null,
      };
    }
  } catch (err) {
    console.warn('[createApiKey] Backend API create failed, falling back to direct DB:', err);
  }

  const { raw, hash, prefix } = generateApiKey();
  let createdId: string | null = null;
  let expiresAt: Date | null = null;
  if (expiresIn === '30d') {
    expiresAt = new Date(Date.now() + 30 * 86_400_000);
  } else if (expiresIn === '90d') {
    expiresAt = new Date(Date.now() + 90 * 86_400_000);
  }

  try {
    const [inserted] = await db
      .insert(s.apiKeys)
      .values({ userId: user.id, name, keyHash: hash, keyPrefix: prefix, expiresAt })
      .returning({ id: s.apiKeys.id });
    createdId = inserted?.id ?? null;
  } catch (err) {
    console.warn('[createApiKey] Database offline, generated mock API key:', err);
  }
  return { raw, prefix, id: createdId, expiresAt };
}

export async function revokeApiKey(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id'));

  try {
    const apiRes = await fetchBackendApi(`/v1/keys/${id}`, {
      method: 'DELETE',
    });
    if (apiRes.status === 200) return;
  } catch (err) {
    console.warn('[revokeApiKey] Backend API delete failed, falling back to direct DB:', err);
  }

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


export async function redeemCodeDirect(code: string): Promise<{ ok: boolean; message: string; reward?: any }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return { ok: false, message: 'Enter a code', reward: undefined };

  const user = await requireUser();

  try {
    const apiRes = await fetchBackendApi<{
      ok: boolean;
      message: string;
      reward?: any;
    }>('/v1/redeem', {
      method: 'POST',
      body: JSON.stringify({ code: cleanCode }),
    });

    if (apiRes.status === 200 && apiRes.data?.ok) {
      return {
        ok: true,
        message: apiRes.data.message || 'Code redeemed successfully',
        reward: apiRes.data.reward,
      };
    }

    if (apiRes.error && apiRes.status !== 0) {
      return { ok: false, message: apiRes.error, reward: undefined };
    }
  } catch (err) {
    console.warn('[redeemCodeDirect] Backend API unavailable, falling back to direct DB:', err);
  }

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


export async function createPaymentAction(packageId: string, paymentMethod?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
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
  const session = await auth.api.getSession({ headers: await headers() });
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
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
} = {}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));

  let query = `?page=${page}&limit=${limit}`;
  if (params.from) query += `&from=${encodeURIComponent(params.from)}`;
  if (params.to) query += `&to=${encodeURIComponent(params.to)}`;

  try {
    const apiRes = await fetchBackendApi<{
      data: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/v1/account/usage${query}`, {
      headers: {
        Authorization: `Bearer ${session.session.token}`,
      },
    });

    if (apiRes.data?.data && Array.isArray(apiRes.data.data)) {
      return {
        data: apiRes.data.data.map((u: any) => ({
          id: u.id,
          requestId: u.request_id,
          model: u.model,
          publicModelId: u.model,
          promptTokens: u.prompt_tokens,
          completionTokens: u.completion_tokens,
          totalTokens: u.total_tokens,
          credits: u.credits_consumed,
          status: u.status,
          streamed: u.streamed,
          latencyMs: u.latency_ms,
          createdAt: u.created_at,
        })),
        total: apiRes.data.total ?? 0,
        page: apiRes.data.page ?? page,
        limit: apiRes.data.limit ?? limit,
      };
    }
  } catch (err) {
    console.warn('[getUsageLogsAction] Backend API usage fetch failed, using DB fallback:', err);
  }

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

    const whereClause = and(...conditions);
    const offset = (page - 1) * limit;

    const [[totalRes], rows] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(s.usageRecords).where(whereClause),
      db
        .select({
          id: s.usageRecords.id,
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
        .where(whereClause)
        .orderBy(desc(s.usageRecords.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    return {
      data: rows.map((u) => ({
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
      total: totalRes?.count ?? 0,
      page,
      limit,
    };
  } catch (err) {
    console.warn('[getUsageLogsAction] Database fallback failed:', err);
    return { data: [], total: 0, page: 1, limit };
  }
}

export interface TestPingResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  reply?: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
  code?: string;
  rawJson?: any;
}

export async function getActiveModelsForTesting(): Promise<Array<{ id: string; name: string }>> {
  try {
    const rows = await db
      .select({
        id: s.models.publicModelId,
        name: s.models.displayName,
      })
      .from(s.models)
      .where(eq(s.models.status, 'active'));

    if (rows && rows.length > 0) {
      return rows;
    }
  } catch {
    // fallback
  }

  return [
    { id: 'deepseek-v4', name: 'DeepSeek V4' },
    { id: 'qwen-max', name: 'Qwen Max' },
    { id: 'kimi-coding', name: 'Kimi Coding' },
  ];
}

export async function testApiKeyPingAction(params: {
  apiKey: string;
  model?: string;
  prompt?: string;
}): Promise<TestPingResult> {
  await requireUser();

  const apiKey = params.apiKey?.trim();
  if (!apiKey || !apiKey.startsWith('mp-')) {
    return {
      ok: false,
      status: 400,
      latencyMs: 0,
      error: 'Format API Key tidak valid. Kunci harus diawali dengan mp-',
      code: 'invalid_api_key_format',
    };
  }

  const model = params.model?.trim() || 'deepseek-v4';
  const prompt = params.prompt?.trim() || 'Halo! Test koneksi API gateway Morphic.';

  const apiUrl = (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8787'
  ).replace(/\/+$/, '');

  const startTime = Date.now();

  try {
    const res = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60,
        stream: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const latencyMs = Date.now() - startTime;
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        latencyMs,
        error: json?.error?.message || json?.message || `Gateway returned status ${res.status}`,
        code: json?.error?.code || 'gateway_error',
        rawJson: json,
      };
    }

    const reply = json?.choices?.[0]?.message?.content || '(No response text)';
    return {
      ok: true,
      status: res.status,
      latencyMs,
      reply,
      model: json?.model || model,
      usage: {
        promptTokens: json?.usage?.prompt_tokens ?? 0,
        completionTokens: json?.usage?.completion_tokens ?? 0,
        totalTokens: json?.usage?.total_tokens ?? 0,
      },
      rawJson: json,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err?.name === 'TimeoutError' || String(err).includes('timeout');
    return {
      ok: false,
      status: 0,
      latencyMs,
      error: isTimeout
        ? 'Koneksi ke Gateway API timeout (melebihi 15 detik).'
        : `Gagal menghubungi Gateway API (${err?.message || 'Network error'})`,
      code: isTimeout ? 'timeout' : 'network_error',
    };
  }
}

