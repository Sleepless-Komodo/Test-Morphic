'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { grantCredits, getBalance, reconcileBalance, sweepExpiredReservations } from '@morphic/db/billing';
import { requireAdmin } from '@/lib/actions';
import { softDeleteUser } from '@/lib/account-deletion';
import { randomInt } from 'node:crypto';
import { normalizeCatalog, type CatalogResult } from '@/lib/provider-catalog';
import { loadAlerts } from '@/lib/admin-insights';
import { invalidate, memo } from '@/lib/memo';
import { parsePackageForm } from '@/lib/package-form';
import { isUuid, parseModelForm } from '@/lib/model-form';
import { getServerTranslation } from '@/lib/i18n/server';
import { multiplier, UNLIMITED_MAX_OUTPUT_MULTIPLIER } from '@morphic/shared/credits';
import { isUserRole, type AdminPermission } from '@morphic/shared/admin-rbac';
import { sendEmail } from '@morphic/shared/email';

const requireAdminPerm = (permission: AdminPermission) =>
  requireAdmin(permission, { mode: 'throw' });

async function audit(adminId: string, action: string, entity: string, entityId: string | null, detail?: unknown) {
  await db.insert(s.adminAuditLog).values({
    adminId,
    action,
    entity,
    entityId,
    detail: detail ?? null,
  });
}

// Unambiguous alphabet (no 0/O/1/I) for redeem-code suffixes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Cryptographically-random redeem-code suffix (audit H2 — replaces Math.random). */
function randomCodeSuffix(len = 12): string {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export async function toggleUserSuspension(formData: FormData) {
  const admin = await requireAdminPerm('users:write');
  const id = String(formData.get('id'));
  if (id === admin.id) return;
  const [u] = await db
    .select({ suspended: s.users.suspended, email: s.users.email, deletedAt: s.users.deletedAt })
    .from(s.users)
    .where(eq(s.users.id, id))
    .limit(1);
  if (!u) return;
  const nextSuspended = !u.suspended;
  await db.update(s.users).set({ suspended: nextSuspended }).where(eq(s.users.id, id));
  await audit(admin.id, u.suspended ? 'unsuspend' : 'suspend', 'user', id);
  if (nextSuspended && !u.deletedAt && u.email) {
    void sendEmail({
      to: u.email,
      subject: 'Akun Morphic Anda ditangguhkan (suspended)',
      text: 'Akun Morphic Anda telah ditangguhkan sementara oleh administrator sehingga akses API key dan dashboard dihentikan.\n\nJika Anda merasa ini adalah kekeliruan atau ingin mengajukan klarifikasi, hubungi tim dukungan kami di support@morphic.id.',
      html: '<p>Akun Morphic Anda telah <b>ditangguhkan sementara</b> oleh administrator sehingga akses API key dan dashboard dihentikan.</p><p>Jika Anda merasa ini adalah kekeliruan atau ingin mengajukan klarifikasi, hubungi tim dukungan kami di <a href="mailto:support@morphic.id">support@morphic.id</a>.</p>',
    }).catch((err) => console.error('[toggleUserSuspension] suspension email failed:', err));
  }
  revalidatePath('/admin/users');
}

export async function updateUserRole(formData: FormData) {
  const admin = await requireAdminPerm('users:role');
  const id = String(formData.get('id') ?? '').trim();
  const nextRole = String(formData.get('role') ?? '').trim();
  if (!id || !isUserRole(nextRole)) return;
  if (id === admin.id) {
    throw new Error('Anda tidak dapat mengubah role akun Anda sendiri.');
  }
  const [target] = await db
    .select({ id: s.users.id, email: s.users.email, role: s.users.role })
    .from(s.users)
    .where(eq(s.users.id, id))
    .limit(1);
  if (!target || target.role === nextRole) return;
  await db
    .update(s.users)
    .set({ role: nextRole, updatedAt: new Date() })
    .where(eq(s.users.id, id));
  await audit(admin.id, 'update_role', 'user', id, {
    email: target.email,
    previousRole: target.role,
    newRole: nextRole,
  });
  revalidatePath('/admin/users');
}

export async function adjustUserCredits(formData: FormData) {
  const admin = await requireAdminPerm('finance:write');
  const id = String(formData.get('id'));
  const amount = Number(formData.get('amount'));
  if (!id || !Number.isFinite(amount) || amount === 0) return;
  await grantCredits({
    userId: id,
    amount,
    entryType: 'admin_adjustment',
    reference: `admin:${admin.id}`,
  });
  await audit(admin.id, 'adjust_credits', 'user', id, { amount });
  revalidatePath('/admin/users');
}

export async function deleteUserByAdmin(formData: FormData) {
  const admin = await requireAdminPerm('users:delete');
  const id = String(formData.get('id') || '');
  if (!id) return;

  if (id === admin.id) {
    throw new Error('Anda tidak dapat menghapus akun admin Anda sendiri.');
  }

  const [target] = await db
    .select({ id: s.users.id, email: s.users.email, role: s.users.role })
    .from(s.users)
    .where(eq(s.users.id, id))
    .limit(1);

  if (!target) return;

  // Soft-delete: a hard delete would be refused by the ledger/payments FKs (financial retention).
  await softDeleteUser(id);
  await audit(admin.id, 'delete', 'user', id, { email: target.email, role: target.role });

  revalidatePath('/admin/users');
}

function optionalInt(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? '').trim() || NaN);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export type ModelActionResult = { ok: boolean; message: string };

function extractPgCode(err: unknown): string | undefined {
  const rec = err as { cause?: { code?: unknown }; code?: unknown } | null | undefined;
  if (typeof rec?.cause?.code === 'string') return rec.cause.code;
  if (typeof rec?.code === 'string') return rec.code;
  return undefined;
}

async function checkCatalogWriteAdmin(en: boolean) {
  try {
    const admin = await requireAdminPerm('catalog:write');
    return { ok: true as const, admin };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    const code = msg.startsWith('Unauthorized')
      ? 'unauthorized'
      : msg.includes('login OTP') || msg.includes('MFA')
        ? 'mfa_required'
        : msg.includes('new admin IP')
          ? 'ip_verification_required'
          : 'forbidden';
    console.warn('[admin-actions] catalog:write denied:', { code, msg });

    const messages: Record<typeof code, { en: string; id: string }> = {
      unauthorized: {
        en: 'Your session expired. Please sign in again.',
        id: 'Sesi Anda berakhir. Silakan masuk kembali.',
      },
      mfa_required: {
        en: 'Enable Login OTP (MFA) in dashboard settings before editing models.',
        id: 'Aktifkan Login OTP (MFA) di pengaturan sebelum mengubah model.',
      },
      ip_verification_required: {
        en: 'Verify your current admin IP via email OTP in dashboard settings first.',
        id: 'Verifikasi IP admin Anda lewat OTP email di pengaturan terlebih dahulu.',
      },
      forbidden: {
        en: 'Your account does not have permission to edit the model catalog.',
        id: 'Akun Anda tidak memiliki izin untuk mengubah katalog model.',
      },
    };
    const localized = en ? messages[code].en : messages[code].id;
    return { ok: false as const, message: `${localized} (kode: ${code})` };
  }
}

function formatCatalogDbError(
  pgCode: string | undefined,
  en: boolean,
  options?: { publicModelId?: string; duplicateFallbackEn?: string; duplicateFallbackId?: string },
): string {
  const codeTag = pgCode || 'unexpected';
  if (pgCode === '23505') {
    if (options?.publicModelId) {
      return en
        ? `A model with Public ID "${options.publicModelId}" already exists. (kode: 23505)`
        : `Model dengan Public ID "${options.publicModelId}" sudah ada. (kode: 23505)`;
    }
    const dupMsg = en
      ? (options?.duplicateFallbackEn ?? 'Duplicate record already exists.')
      : (options?.duplicateFallbackId ?? 'Data duplikat sudah ada.');
    return `${dupMsg} (kode: 23505)`;
  }
  if (pgCode === '23503') {
    return en
      ? 'Referenced provider or model was not found in the database. (kode: 23503)'
      : 'Provider atau model rujukan tidak ditemukan di database. (kode: 23503)';
  }
  if (pgCode === '22P02' || pgCode === '22003') {
    return en
      ? `Input format or number range is invalid. (kode: ${pgCode})`
      : `Format input atau rentang angka tidak valid. (kode: ${pgCode})`;
  }
  return en
    ? `Failed to save changes. Check server logs for details. (kode: ${codeTag})`
    : `Gagal menyimpan perubahan. Periksa log server untuk detail. (kode: ${codeTag})`;
}

export async function saveModel(formData: FormData): Promise<ModelActionResult> {
  const en = (await getServerTranslation()).locale === 'en';
  const authCheck = await checkCatalogWriteAdmin(en);
  if (!authCheck.ok) return { ok: false, message: authCheck.message };

  const id = String(formData.get('id') || '').trim();
  if (id && !isUuid(id)) {
    return {
      ok: false,
      message: en ? 'Invalid model ID. (kode: invalid_id)' : 'ID model tidak valid. (kode: invalid_id)',
    };
  }

  const parsed = parseModelForm(formData, en);
  if ('error' in parsed) return { ok: false, message: parsed.error };
  const { values } = parsed;

  try {
    const [provider] = await db
      .select({ id: s.providers.id })
      .from(s.providers)
      .where(eq(s.providers.id, values.providerId))
      .limit(1);
    if (!provider) {
      return {
        ok: false,
        message: en
          ? 'Selected provider was not found. (kode: provider_not_found)'
          : 'Provider yang dipilih tidak ditemukan. (kode: provider_not_found)',
      };
    }

    if (id) {
      const [updated] = await db
        .update(s.models)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(s.models.id, id))
        .returning({ id: s.models.id });
      if (!updated) {
        return {
          ok: false,
          message: en ? 'Model not found. (kode: model_not_found)' : 'Model tidak ditemukan. (kode: model_not_found)',
        };
      }
      await audit(authCheck.admin.id, 'update', 'model', id, values);
    } else {
      const [created] = await db.insert(s.models).values(values).returning({ id: s.models.id });
      await audit(authCheck.admin.id, 'create', 'model', created!.id, values);
    }
  } catch (err) {
    const pgCode = extractPgCode(err);
    console.error('[saveModel] failed:', { pgCode, id: id || null, publicModelId: values.publicModelId, err });
    return {
      ok: false,
      message: formatCatalogDbError(pgCode, en, { publicModelId: values.publicModelId }),
    };
  }

  revalidatePath('/admin/models');
  revalidatePath('/dashboard/models');
  return {
    ok: true,
    message: id
      ? en
        ? `Model "${values.publicModelId}" updated.`
        : `Model "${values.publicModelId}" berhasil diperbarui.`
      : en
        ? `Model "${values.publicModelId}" created.`
        : `Model "${values.publicModelId}" berhasil dibuat.`,
  };
}

export async function deleteModel(formData: FormData): Promise<{ deleted: boolean; message: string }> {
  const admin = await requireAdminPerm('catalog:write');
  const id = String(formData.get('id') || '');
  if (!id) return { deleted: false, message: 'ID model tidak ditemukan.' };

  const [target] = await db
    .select({
      id: s.models.id,
      publicModelId: s.models.publicModelId,
      displayName: s.models.displayName,
    })
    .from(s.models)
    .where(eq(s.models.id, id))
    .limit(1);

  if (!target) return { deleted: false, message: 'Model tidak ditemukan.' };

  try {
    await db.delete(s.models).where(eq(s.models.id, id));
  } catch (e) {
    const code = (e as { cause?: { code?: string } }).cause?.code;
    if (code === '23001' || code === '23503') {
      return {
        deleted: false,
        message: 'Database memblokir penghapusan model karena masih memiliki relasi data aktif.',
      };
    }
    throw e;
  }

  await audit(admin.id, 'delete', 'model', id, {
    publicModelId: target.publicModelId,
    displayName: target.displayName,
  });

  revalidatePath('/admin/models');
  revalidatePath('/dashboard/models');
  return {
    deleted: true,
    message: `Model "${target.displayName || target.publicModelId}" berhasil dihapus.`,
  };
}

function positiveIntOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? '').trim() || NaN);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Create or update a `model_provider_pool` entry (FIX-P1-03).
 * Enforces D9 (`contextLength >= model.contextLength`) and writes an audit trail row.
 */
export async function saveModelPoolEntry(formData: FormData): Promise<ModelActionResult> {
  const en = (await getServerTranslation()).locale === 'en';
  const authCheck = await checkCatalogWriteAdmin(en);
  if (!authCheck.ok) return { ok: false, message: authCheck.message };

  const id = String(formData.get('id') || '').trim();
  const modelId = String(formData.get('modelId') || '').trim();
  const providerId = String(formData.get('providerId') || '').trim();
  const providerModelId = String(formData.get('providerModelId') || '').trim();
  if ((id && !isUuid(id)) || !isUuid(modelId) || !isUuid(providerId) || !providerModelId) {
    return {
      ok: false,
      message: en
        ? 'Model, Provider, and Provider Model ID are required. (kode: invalid_input)'
        : 'Model, Provider, dan Provider Model ID wajib diisi. (kode: invalid_input)',
    };
  }

  try {
    const [model] = await db
      .select({ id: s.models.id, contextLength: s.models.contextLength, publicModelId: s.models.publicModelId })
      .from(s.models)
      .where(eq(s.models.id, modelId))
      .limit(1);
    if (!model) {
      return {
        ok: false,
        message: en ? 'Model not found. (kode: model_not_found)' : 'Model tidak ditemukan. (kode: model_not_found)',
      };
    }

    const priority = Math.max(1, Number(formData.get('priority') || 1) || 1);
    const weight = Math.max(1, Number(formData.get('weight') || 100) || 100);
    const rawContextStr = String(formData.get('contextLength') || '').trim();
    const rawContext = rawContextStr === '' ? model.contextLength : Number(rawContextStr);
    if (!Number.isSafeInteger(rawContext) || rawContext <= 0) {
      return {
        ok: false,
        message: en
          ? 'Context length must be a positive whole number. (kode: invalid_input)'
          : 'Context length harus bilangan bulat positif. (kode: invalid_input)',
      };
    }
    const contextLength = rawContext;
    if (contextLength < model.contextLength) {
      return {
        ok: false,
        message: en
          ? `Pool entry context length (${contextLength}) cannot be lower than model context length (${model.contextLength}). (kode: context_too_low)`
          : `Context length pool entry (${contextLength}) tidak boleh di bawah context length model (${model.contextLength}). (kode: context_too_low)`,
      };
    }

    const values = {
      modelId,
      providerId,
      providerModelId,
      priority: Number.isSafeInteger(priority) ? priority : 1,
      weight: Number.isSafeInteger(weight) ? weight : 100,
      contextLength,
      maxOutputTokens: positiveIntOrNull(formData.get('maxOutputTokens')),
      costInputPer1m: optionalInt(formData.get('costInputPer1m')),
      costOutputPer1m: optionalInt(formData.get('costOutputPer1m')),
      ttfbTimeoutMs: positiveIntOrNull(formData.get('ttfbTimeoutMs')),
      supportsTools: formData.get('supportsTools') === 'on' || formData.get('supportsTools') === 'true',
      supportsParallelTools:
        formData.get('supportsParallelTools') === 'on' || formData.get('supportsParallelTools') === 'true',
      supportsReasoning: formData.get('supportsReasoning') === 'on' || formData.get('supportsReasoning') === 'true',
      reasoningEchoRequired:
        formData.get('reasoningEchoRequired') === 'on' || formData.get('reasoningEchoRequired') === 'true',
      supportsVision: formData.get('supportsVision') === 'on' || formData.get('supportsVision') === 'true',
      usageInStream: formData.get('usageInStream') === 'on' || formData.get('usageInStream') === 'true',
      isEnabled: formData.has('isEnabled')
        ? formData.get('isEnabled') === 'on' || formData.get('isEnabled') === 'true'
        : true,
      updatedAt: new Date(),
    };

    if (id) {
      await db.update(s.modelProviderPool).set(values).where(eq(s.modelProviderPool.id, id));
      await audit(authCheck.admin.id, 'update', 'model_provider_pool', id, values);
    } else {
      const [existing] = await db
        .select({ id: s.modelProviderPool.id })
        .from(s.modelProviderPool)
        .where(and(eq(s.modelProviderPool.modelId, modelId), eq(s.modelProviderPool.providerId, providerId)))
        .limit(1);
      if (existing) {
        await db.update(s.modelProviderPool).set(values).where(eq(s.modelProviderPool.id, existing.id));
        await audit(authCheck.admin.id, 'update', 'model_provider_pool', existing.id, values);
      } else {
        const [created] = await db.insert(s.modelProviderPool).values(values).returning({ id: s.modelProviderPool.id });
        await audit(authCheck.admin.id, 'create', 'model_provider_pool', created!.id, values);
      }
    }
  } catch (err) {
    const pgCode = extractPgCode(err);
    console.error('[saveModelPoolEntry] failed:', { pgCode, id: id || null, modelId, providerId, err });
    return {
      ok: false,
      message: formatCatalogDbError(pgCode, en, {
        duplicateFallbackEn: 'This provider is already registered in the pool for this model.',
        duplicateFallbackId: 'Provider ini sudah terdaftar di pool untuk model tersebut.',
      }),
    };
  }

  revalidatePath('/admin/models');
  return {
    ok: true,
    message: en ? 'Pool entry saved.' : 'Pool entry berhasil disimpan.',
  };
}

export async function toggleModelPoolEntry(formData: FormData) {
  const admin = await requireAdminPerm('catalog:write');
  const id = String(formData.get('id') || '').trim();
  if (!id) return;
  const [entry] = await db
    .select({ id: s.modelProviderPool.id, isEnabled: s.modelProviderPool.isEnabled })
    .from(s.modelProviderPool)
    .where(eq(s.modelProviderPool.id, id))
    .limit(1);
  if (!entry) return;
  const nextEnabled = !entry.isEnabled;
  await db
    .update(s.modelProviderPool)
    .set({ isEnabled: nextEnabled, updatedAt: new Date() })
    .where(eq(s.modelProviderPool.id, id));
  await audit(admin.id, nextEnabled ? 'enable_pool_entry' : 'disable_pool_entry', 'model_provider_pool', id);
  revalidatePath('/admin/models');
}

export async function deleteModelPoolEntry(formData: FormData) {
  const admin = await requireAdminPerm('catalog:write');
  const id = String(formData.get('id') || '').trim();
  if (!id) return;
  const [entry] = await db
    .select({
      id: s.modelProviderPool.id,
      modelId: s.modelProviderPool.modelId,
      providerId: s.modelProviderPool.providerId,
      providerModelId: s.modelProviderPool.providerModelId,
    })
    .from(s.modelProviderPool)
    .where(eq(s.modelProviderPool.id, id))
    .limit(1);
  if (!entry) return;
  await db.delete(s.modelProviderPool).where(eq(s.modelProviderPool.id, id));
  await audit(admin.id, 'delete', 'model_provider_pool', id, entry);
  revalidatePath('/admin/models');
}

export async function saveProvider(formData: FormData) {
  const admin = await requireAdminPerm('catalog:write');
  const id = String(formData.get('id') || '');
  const credential = String(formData.get('credential') || '').trim();
  const values = {
    name: String(formData.get('name')).trim().toLowerCase(),
    baseUrl: String(formData.get('baseUrl')).trim(),
    status: String(formData.get('status') || 'active') as 'active' | 'disabled',
  };

  if (!values.name || !values.baseUrl) {
    throw new Error('Name and Base URL are required');
  }

  if (id) {
    const update: Record<string, unknown> = { ...values };
    if (credential) {
      const { encrypt } = await import('@morphic/shared/provider-crypto');
      update.encryptedCredentials = encrypt(credential);
      update.credentialReference = null;
    }
    await db.update(s.providers).set(update).where(eq(s.providers.id, id));
    await audit(admin.id, 'update', 'provider', id, { ...values, credentialSet: Boolean(credential) });
  } else {
    // If id is not specified, check if provider name already exists to prevent duplicate key error
    const [existing] = await db
      .select({ id: s.providers.id })
      .from(s.providers)
      .where(eq(s.providers.name, values.name))
      .limit(1);

    if (existing) {
      const update: Record<string, unknown> = { ...values };
      if (credential) {
        const { encrypt } = await import('@morphic/shared/provider-crypto');
        update.encryptedCredentials = encrypt(credential);
        update.credentialReference = null;
      }
      await db.update(s.providers).set(update).where(eq(s.providers.id, existing.id));
      await audit(admin.id, 'update', 'provider', existing.id, { ...values, credentialSet: Boolean(credential) });
    } else {
      let encryptedCredentials: string | null = null;
      if (credential) {
        const { encrypt } = await import('@morphic/shared/provider-crypto');
        encryptedCredentials = encrypt(credential);
      }
      const [p] = await db
        .insert(s.providers)
        .values({ ...values, encryptedCredentials })
        .returning();
      await audit(admin.id, 'create', 'provider', p!.id, { ...values, credentialSet: Boolean(credential) });
    }
  }
  revalidatePath('/admin/providers');
}

async function loadCatalog(baseUrl: string, credential: string | null): Promise<CatalogResult> {
  const fetchedAt = new Date().toISOString();
  const fail = (error: string): CatalogResult => ({ ok: false, error, models: [], fetchedAt });
  if (!/^https?:\/\//i.test(baseUrl)) return fail('Base URL harus diawali http:// atau https://');
  const url = `${baseUrl.replace(/\/$/, '')}/models`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: credential ? { Authorization: `Bearer ${credential}` } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause?.code;
    if (e instanceof Error && e.name === 'TimeoutError') return fail(`${url} tidak membalas dalam 10 detik.`);
    return fail(`Tidak bisa terhubung ke ${new URL(url).host}${cause ? ` (${cause})` : ''}. Cek Base URL.`);
  }
  if (res.status === 401 || res.status === 403) {
    return fail(credential ? `API key ditolak (HTTP ${res.status}). Ganti key lewat Edit.` : 'Belum ada API key. Isi lewat Edit.');
  }
  if (res.status === 404) return fail(`${url} tidak ditemukan (404). Base URL harus endpoint OpenAI-compatible, biasanya diakhiri /v1.`);
  if (!res.ok) return fail(`HTTP ${res.status} dari ${url}.`);
  if (!res.headers.get('content-type')?.includes('json')) {
    return fail(`${url} tidak membalas JSON. Base URL ini bukan endpoint OpenAI-compatible.`);
  }
  try {
    const models = normalizeCatalog(await res.json());
    return models.length ? { ok: true, models, fetchedAt } : fail('Provider tidak mengembalikan model.');
  } catch {
    return fail(`${url} membalas JSON yang tidak valid.`);
  }
}

// Per-server-instance cache so opening the page doesn't re-hit every provider.
// Keyed on URL + stored credential, so editing either invalidates the entry.
// Stale-while-revalidate: past the TTL the old result is served and refreshed in the background,
// so only the very first load ever waits on upstreams.
const CATALOG_TTL_MS = 5 * 60_000;
const catalogCache = new Map<string, { at: number; result: CatalogResult }>();
const inflight = new Map<string, Promise<CatalogResult>>();

function refreshCatalog(key: string, baseUrl: string, credential: string | null): Promise<CatalogResult> {
  let p = inflight.get(key);
  if (!p) {
    p = loadCatalog(baseUrl, credential)
      .then((result) => {
        catalogCache.set(key, { at: Date.now(), result });
        return result;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

/** Live model + price list for every saved provider, fetched in parallel. `fresh` skips the cache. */
export async function fetchAllProviderCatalogs(fresh = false): Promise<Record<string, CatalogResult>> {
  await requireAdminPerm('catalog:read');
  const { resolveProviderCredential } = await import('@morphic/shared/provider-crypto');
  const providers = await db
    .select({
      id: s.providers.id,
      name: s.providers.name,
      baseUrl: s.providers.baseUrl,
      encryptedCredentials: s.providers.encryptedCredentials,
      credentialReference: s.providers.credentialReference,
    })
    .from(s.providers);
  const entries = await Promise.all(
    providers.map(async (p) => {
      const key = `${p.id}|${p.baseUrl}|${p.encryptedCredentials ?? p.credentialReference ?? ''}`;
      let credential: string | null = null;
      try {
        credential = resolveProviderCredential(p.encryptedCredentials, p.credentialReference);
      } catch {
        return [p.name, { ok: false, error: 'Key tersimpan tidak bisa didekripsi. Isi ulang lewat Edit.', models: [], fetchedAt: new Date().toISOString() }] as const;
      }
      const hit = catalogCache.get(key);
      if (!fresh && hit) {
        if (Date.now() - hit.at >= CATALOG_TTL_MS) void refreshCatalog(key, p.baseUrl, credential);
        return [p.name, hit.result] as const;
      }
      return [p.name, await refreshCatalog(key, p.baseUrl, credential)] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Model list for the add/edit form, using the typed base URL/key. Never cached.
 * The saved key is only ever sent to the saved base URL.
 */
export async function fetchProviderCatalog(input: {
  providerId?: string;
  baseUrl?: string;
  credential?: string;
}): Promise<CatalogResult> {
  await requireAdminPerm('catalog:read');
  let baseUrl = input.baseUrl?.trim() ?? '';
  let credential = input.credential?.trim() || null;
  if (input.providerId) {
    const [p] = await db
      .select({
        baseUrl: s.providers.baseUrl,
        encryptedCredentials: s.providers.encryptedCredentials,
        credentialReference: s.providers.credentialReference,
      })
      .from(s.providers)
      .where(eq(s.providers.id, input.providerId))
      .limit(1);
    if (p) {
      baseUrl ||= p.baseUrl;
      if (!credential && baseUrl.replace(/\/$/, '') === p.baseUrl.replace(/\/$/, '')) {
        const { resolveProviderCredential } = await import('@morphic/shared/provider-crypto');
        credential = resolveProviderCredential(p.encryptedCredentials, p.credentialReference);
      }
    }
  }
  return loadCatalog(baseUrl, credential);
}

export async function deleteProvider(formData: FormData): Promise<{ deleted: boolean; message: string }> {
  const admin = await requireAdminPerm('catalog:write');
  const id = String(formData.get('id') || '');
  const [target] = id
    ? await db.select({ id: s.providers.id, name: s.providers.name }).from(s.providers).where(eq(s.providers.id, id)).limit(1)
    : [];
  if (!target) return { deleted: false, message: 'Provider tidak ditemukan.' };

  // Cascades to its models; billing rows (reservations, usage_records) keep their data with model_id set null.
  try {
    await db.delete(s.providers).where(eq(s.providers.id, id));
  } catch (e) {
    const code = (e as { cause?: { code?: string } }).cause?.code;
    if (code === '23001' || code === '23503') {
      return { deleted: false, message: 'Database masih memblokir hapus model yang punya riwayat billing. Jalankan migration terbaru (pnpm db:migrate).' };
    }
    throw e;
  }
  await audit(admin.id, 'delete', 'provider', id, { name: target.name });
  revalidatePath('/admin/providers');
  revalidatePath('/admin/models');
  return { deleted: true, message: `Provider "${target.name}" berhasil dihapus.` };
}

export async function toggleProviderStatus(formData: FormData) {
  const admin = await requireAdminPerm('catalog:write');
  const id = String(formData.get('id') || '');
  if (!id) return;

  const [target] = await db
    .select({ id: s.providers.id, status: s.providers.status })
    .from(s.providers)
    .where(eq(s.providers.id, id))
    .limit(1);

  if (!target) return;

  const newStatus = target.status === 'active' ? 'disabled' : 'active';
  await db.update(s.providers).set({ status: newStatus }).where(eq(s.providers.id, id));
  await audit(admin.id, 'update_status', 'provider', id, { previousStatus: target.status, newStatus });

  revalidatePath('/admin/providers');
  revalidatePath('/admin/models');
}
type PackageResult = { ok: boolean; message: string };


/** Create (no id) or edit (id) a package. Currency is left as stored; prices are in that currency's minor unit. */
export async function savePackage(formData: FormData): Promise<PackageResult> {
  const admin = await requireAdminPerm('finance:write');
  const en = (await getServerTranslation()).locale === 'en';
  const id = String(formData.get('id') || '');
  const parsed = parsePackageForm(formData, en);
  if ('error' in parsed) return { ok: false, message: parsed.error! };
  const values = parsed.values;
  if (values.kind === 'unlimited') {
    const [m] = await db
      .select({ name: s.models.displayName, out: s.models.outputCreditsPer1m })
      .from(s.models)
      .where(eq(s.models.id, values.modelId!))
      .limit(1);
    if (!m) return { ok: false, message: en ? 'Model not found.' : 'Model tidak ditemukan.' };
    if (multiplier(m.out) > UNLIMITED_MAX_OUTPUT_MULTIPLIER) {
      const x = `${multiplier(m.out).toFixed(0)}x`;
      return {
        ok: false,
        message: en
          ? `${m.name} costs ${x} on output; unlimited passes are limited to ${UNLIMITED_MAX_OUTPUT_MULTIPLIER}x models.`
          : `${m.name} output-nya ${x}; paket unlimited hanya untuk model maksimal ${UNLIMITED_MAX_OUTPUT_MULTIPLIER}x.`,
      };
    }
  }
  try {
    if (id) {
      const [p] = await db
        .update(s.packages)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(s.packages.id, id))
        .returning({ id: s.packages.id });
      if (!p) return { ok: false, message: en ? 'Package not found.' : 'Paket tidak ditemukan.' };
      await audit(admin.id, 'update', 'package', id, values);
    } else {
      const [p] = await db.insert(s.packages).values(values).returning();
      await audit(admin.id, 'create', 'package', p!.id, values);
    }
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code === '23505') {
      return { ok: false, message: en ? `A package named "${values.name}" already exists.` : `Nama paket "${values.name}" sudah dipakai.` };
    }
    throw e;
  }
  revalidatePath('/admin/packages');
  revalidatePath('/dashboard/billing');
  const verb = id ? (en ? 'updated' : 'diperbarui') : en ? 'created' : 'dibuat';
  return { ok: true, message: en ? `Package "${values.name}" ${verb}.` : `Paket "${values.name}" ${verb}.` };
}

/**
 * Hard delete. Refused while the package is still in flight: a pending payment would lose its
 * package (FK set null) and settle as plain credits instead of the pass that was bought, and an
 * active redeem code pointing at it would hand out the wrong reward. Entitlements already granted
 * keep working; they carry their own allowance, model and expiry.
 */
export async function deletePackage(formData: FormData): Promise<PackageResult> {
  const admin = await requireAdminPerm('finance:write');
  const en = (await getServerTranslation()).locale === 'en';
  const id = String(formData.get('id') || '');
  const [pkg] = id ? await db.select({ id: s.packages.id, name: s.packages.name }).from(s.packages).where(eq(s.packages.id, id)).limit(1) : [];
  if (!pkg) return { ok: false, message: en ? 'Package not found.' : 'Paket tidak ditemukan.' };

  const [[pending], [codes]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.payments)
      .where(and(eq(s.payments.packageId, id), sql`${s.payments.status} in ('pending', 'capturing', 'pending_paypal')`)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.redeemCodes)
      .where(
        and(
          eq(s.redeemCodes.packageId, id),
          eq(s.redeemCodes.active, true),
          sql`(${s.redeemCodes.expiresAt} is null or ${s.redeemCodes.expiresAt} > now())`,
        ),
      ),
  ]);
  const blockers = [
    pending!.n > 0 && (en ? `${pending!.n} payment(s) still pending` : `${pending!.n} pembayaran masih pending`),
    codes!.n > 0 &&
      (en
        ? `${codes!.n} active redeem code(s) still give this package (disable them under Redeem Codes)`
        : `${codes!.n} kode redeem aktif masih memberi paket ini (nonaktifkan di menu Redeem Codes)`),
  ].filter(Boolean);
  if (blockers.length) {
    return {
      ok: false,
      message: en
        ? `"${pkg.name}" can't be deleted yet: ${blockers.join('; ')}. To hide it from users now, edit it and set status Inactive.`
        : `"${pkg.name}" belum bisa dihapus: ${blockers.join('; ')}. Untuk menyembunyikannya dari user sekarang, edit dan set status Inactive.`,
    };
  }

  await db.delete(s.packages).where(eq(s.packages.id, id));
  await audit(admin.id, 'delete', 'package', id, { name: pkg.name });
  revalidatePath('/admin/packages');
  revalidatePath('/dashboard/billing');
  return { ok: true, message: en ? `Package "${pkg.name}" deleted.` : `Paket "${pkg.name}" dihapus.` };
}

export type GenerateCodesState = { ok: boolean; message: string; codes: string[] };

const intOrNull = (v: FormDataEntryValue | null) => {
  const str = String(v ?? '').trim();
  if (!str) return null;
  const n = Number(str);
  return Number.isSafeInteger(n) ? n : NaN;
};

/**
 * Admin-only redeem-code generator. Every field is validated server-side; the client form is
 * never trusted. Rewards are either a fixed credit amount or an existing active package.
 */
export async function createRedeemCodes(_prev: GenerateCodesState, formData: FormData): Promise<GenerateCodesState> {
  const admin = await requireAdminPerm('codes:write');
  const fail = (message: string): GenerateCodesState => ({ ok: false, message, codes: [] });

  // Code format: All redeem codes MUST be prefixed with "MP-".
  // If the admin typed a custom code (e.g. "LAUNCH50" or "MP-LAUNCH50"), normalize it so it always starts with "MP-".
  const rawPrefix = String(formData.get('prefix') ?? '').trim().toUpperCase();
  let customSuffix = '';
  if (rawPrefix) {
    customSuffix = rawPrefix.replace(/^MP-+/i, '').replace(/^MP/i, '').replace(/^-+/, '').trim();
    if (customSuffix && !/^[A-Z0-9][A-Z0-9-]{1,29}$/.test(customSuffix)) {
      return fail('Kode custom: minimal 2 karakter (huruf A-Z, angka, tanda -).');
    }
  }

  // Base prefix is always "MP"
  const prefix = customSuffix ? `MP-${customSuffix}` : 'MP';

  const count = intOrNull(formData.get('count')) ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 500) return fail('Jumlah kode harus 1-500.');

  const rewardType = String(formData.get('rewardType'));
  if (rewardType !== 'credits' && rewardType !== 'package') return fail('Tipe hadiah tidak valid.');

  let creditAmount: number | null = null;
  let packageId: string | null = null;
  if (rewardType === 'credits') {
    creditAmount = intOrNull(formData.get('creditAmount'));
    if (!creditAmount || !Number.isInteger(creditAmount) || creditAmount < 1 || creditAmount > 100_000_000) {
      return fail('Jumlah kredit harus 1 - 100.000.000.');
    }
  } else {
    packageId = String(formData.get('packageId') ?? '');
    const [pkg] = packageId
      ? await db
          .select({ id: s.packages.id })
          .from(s.packages)
          .where(and(eq(s.packages.id, packageId), eq(s.packages.status, 'active')))
          .limit(1)
      : [];
    if (!pkg) return fail('Pilih paket aktif.');
  }

  const maxRedemptions = intOrNull(formData.get('maxRedemptions'));
  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 1_000_000)) {
    return fail('Batas pemakaian harus kosong (tanpa batas) atau 1 - 1.000.000.');
  }

  const expiresInDays = intOrNull(formData.get('expiresInDays')) ?? 0;
  if (![0, 7, 30, 90].includes(expiresInDays)) return fail('Masa berlaku tidak valid.');
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null;

  // Single code with custom text = vanity code (e.g. "MP-LAUNCH50").
  // Batches get a cryptographically-random suffix so codes are not enumerable (audit H2).
  // Empty custom text = random codes starting with "MP-" (e.g. "MP-K7X9P2M4N6").
  const vanity = count === 1 && customSuffix !== '';
  const codes = Array.from({ length: count }, () => {
    if (vanity) return prefix;
    return `${prefix}-${randomCodeSuffix(customSuffix ? 8 : 10)}`;
  });

  const inserted = await db
    .insert(s.redeemCodes)
    .values(
      codes.map((code) => ({
        code,
        name: prefix,
        rewardType: rewardType as 'credits' | 'package',
        creditAmount,
        packageId,
        maxRedemptions,
        expiresAt,
      })),
    )
    .onConflictDoNothing()
    .returning({ code: s.redeemCodes.code });

  if (inserted.length === 0) return fail(`Kode ${prefix} sudah ada. Pakai prefix lain.`);

  await audit(admin.id, 'generate_codes', 'redeem_code', null, {
    prefix,
    count: inserted.length,
    rewardType,
    creditAmount,
    packageId,
    maxRedemptions,
  });
  revalidatePath('/admin/codes');
  revalidatePath('/dashboard/redeem');
  return { ok: true, message: `${inserted.length} kode dibuat.`, codes: inserted.map((r) => r.code) };
}

export async function toggleRedeemCode(formData: FormData) {
  const admin = await requireAdminPerm('codes:write');
  const id = String(formData.get('id'));
  const [rc] = await db.select({ active: s.redeemCodes.active }).from(s.redeemCodes).where(eq(s.redeemCodes.id, id)).limit(1);
  if (!rc) return;
  await db.update(s.redeemCodes).set({ active: !rc.active }).where(eq(s.redeemCodes.id, id));
  await audit(admin.id, rc.active ? 'disable_code' : 'enable_code', 'redeem_code', id);
  revalidatePath('/admin/codes');
  revalidatePath('/dashboard/redeem');
}

/** Rebuild one user's cached balance from the ledger (the source of truth). */
export async function reconcileUserBalance(formData: FormData) {
  const admin = await requireAdminPerm('finance:write');
  const userId = String(formData.get('userId') || '');
  if (!userId) return;
  const before = await getBalance(userId);
  const after = await reconcileBalance(userId);
  await audit(admin.id, 'reconcile', 'balance', userId, { before, after });
  invalidate('admin:alerts');
  revalidatePath('/admin/alerts');
}

/** Release every reservation past its expiry, returning the held credits. Same path as the API's sweep. */
export async function releaseStuckReservations() {
  const admin = await requireAdminPerm('finance:write');
  const released = await sweepExpiredReservations();
  await audit(admin.id, 'release_stuck', 'reservation', null, { released });
  invalidate('admin:alerts');
  revalidatePath('/admin/alerts');
}

/** Changelog entry for the dashboard notification drawer. Links must be site paths or http(s). */
export async function createAnnouncement(formData: FormData) {
  const admin = await requireAdminPerm('announcements:write');
  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  const body = String(formData.get('body') ?? '').trim().slice(0, 4000);
  const rawLink = String(formData.get('linkUrl') ?? '').trim();
  if (!title || !body) return;
  const linkUrl = /^\/(?!\/)/.test(rawLink) || /^https?:\/\//.test(rawLink) ? rawLink.slice(0, 500) : null;
  const [row] = await db.insert(s.announcements).values({ title, body, linkUrl, createdBy: admin.id }).returning({ id: s.announcements.id });
  await audit(admin.id, 'create_announcement', 'announcement', row!.id, { title });
  revalidatePath('/admin/announcements');
  revalidatePath('/dashboard', 'layout');
}

export async function deleteAnnouncement(formData: FormData) {
  const admin = await requireAdminPerm('announcements:write');
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await db.delete(s.announcements).where(eq(s.announcements.id, id));
  await audit(admin.id, 'delete_announcement', 'announcement', id);
  revalidatePath('/admin/announcements');
  revalidatePath('/dashboard', 'layout');
}

// ── Abuse Cases Queue (FIX-P2-06 / T-B5-03 / AI-09 Zero-Prompt Auditing) ──────

const VALID_ABUSE_SIGNAL_TYPES = new Set([
  'traffic_spike',
  'high_error_rate',
  'credit_burn_spike',
  'shared_ip_farming',
  'manual',
] as const);
const VALID_ABUSE_SEVERITIES = new Set(['low', 'medium', 'high', 'critical'] as const);
const VALID_ABUSE_STATUSES = new Set(['open', 'investigating', 'resolved', 'dismissed'] as const);

/**
 * Pulls active anomaly signals from `loadAlerts()` (metadata only — zero prompt content)
 * and creates `open` rows in `abuse_cases` for any signal fingerprint that doesn't already
 * have an active (`open` or `investigating`) case.
 */
export async function syncAbuseCasesFromSignals() {
  const admin = await requireAdminPerm('security:write');
  const a = await memo('admin:alerts', 20_000, () => loadAlerts());

  type Candidate = {
    userId: string | null;
    apiKeyId: string | null;
    signalType: 'traffic_spike' | 'high_error_rate' | 'credit_burn_spike' | 'shared_ip_farming';
    severity: 'low' | 'medium' | 'high' | 'critical';
    fingerprint: string;
    summary: string;
    metadata: Record<string, unknown>;
  };

  const candidates: Candidate[] = [];

  for (const k of a.spikes) {
    candidates.push({
      userId: k.userId,
      apiKeyId: k.keyId,
      signalType: 'traffic_spike',
      severity: k.lastHour >= 500 ? 'high' : 'medium',
      fingerprint: `spike:${k.keyId}`,
      summary: `Lonjakan trafik key "${k.keyName}" (${k.keyPrefix}…): ${k.lastHour} req/jam vs rata-rata ${Number(k.perHour).toFixed(1)}/jam`,
      metadata: {
        lastHour: k.lastHour,
        usualPerHour: Number(k.perHour),
        keyPrefix: k.keyPrefix,
        keyName: k.keyName,
      },
    });
  }

  for (const k of a.errorKeys) {
    candidates.push({
      userId: k.userId,
      apiKeyId: k.keyId,
      signalType: 'high_error_rate',
      severity: k.errors / Math.max(1, k.requests) >= 0.8 ? 'high' : 'medium',
      fingerprint: `error:${k.keyId}`,
      summary: `Error rate tinggi pada key "${k.keyName}" (${k.keyPrefix}…): ${k.errors}/${k.requests} gagal (${((k.errors / Math.max(1, k.requests)) * 100).toFixed(0)}%)`,
      metadata: {
        errors: k.errors,
        requests: k.requests,
        topError: k.topError ?? 'unknown',
        keyPrefix: k.keyPrefix,
      },
    });
  }

  for (const u of a.burners) {
    candidates.push({
      userId: u.userId,
      apiKeyId: null,
      signalType: 'credit_burn_spike',
      severity: 'high',
      fingerprint: `burn:${u.userId}`,
      summary: `Lonjakan konsumsi kredit 24 jam (${u.requests} request, ${Math.round(u.last24h).toLocaleString('id-ID')} kredit vs rata-rata ${Math.round(Number(u.perDay)).toLocaleString('id-ID')}/hari)`,
      metadata: {
        credits24h: u.last24h,
        usualPerDay: Number(u.perDay),
        requests24h: u.requests,
        balanceNow: u.balance,
      },
    });
  }

  for (const ip of a.sharedIps) {
    candidates.push({
      userId: null,
      apiKeyId: null,
      signalType: 'shared_ip_farming',
      severity: ip.users >= 5 ? 'critical' : 'high',
      fingerprint: `shared_ip:${ip.ip}`,
      summary: `Indikasi multi-akun dari IP ${ip.ip}: ${ip.users} akun berbeda login dalam 30 hari`,
      metadata: {
        ip: ip.ip,
        accountCount: ip.users,
        emails: ip.emails.filter(Boolean),
        agents: ip.agents.filter(Boolean).slice(0, 3),
      },
    });
  }

  if (candidates.length === 0) {
    revalidatePath('/admin/abuse');
    return;
  }

  const existing = await db
    .select({ fingerprint: s.abuseCases.fingerprint })
    .from(s.abuseCases)
    .where(
      and(
        inArray(
          s.abuseCases.fingerprint,
          candidates.map((c) => c.fingerprint),
        ),
        inArray(s.abuseCases.status, ['open', 'investigating']),
      ),
    );
  const activeFingerprints = new Set(existing.map((r) => r.fingerprint));
  const toInsert = candidates.filter((c) => !activeFingerprints.has(c.fingerprint));

  if (toInsert.length > 0) {
    await db.insert(s.abuseCases).values(
      toInsert.map((c) => ({
        userId: c.userId,
        apiKeyId: c.apiKeyId,
        signalType: c.signalType,
        severity: c.severity,
        status: 'open' as const,
        fingerprint: c.fingerprint,
        summary: c.summary,
        metadata: c.metadata,
      })),
    );
    await audit(admin.id, 'sync_abuse_cases', 'abuse_case', null, {
      inserted: toInsert.length,
      fingerprints: toInsert.map((c) => c.fingerprint),
    });
  }

  revalidatePath('/admin/abuse');
  revalidatePath('/admin/alerts');
}

export async function createAbuseCase(formData: FormData) {
  const admin = await requireAdminPerm('security:write');
  const rawSignal = String(formData.get('signalType') ?? 'manual').trim();
  const rawSeverity = String(formData.get('severity') ?? 'medium').trim();
  const summary = String(formData.get('summary') ?? '').trim().slice(0, 500);
  const userIdRaw = String(formData.get('userId') ?? '').trim();
  const apiKeyIdRaw = String(formData.get('apiKeyId') ?? '').trim();
  const fingerprintRaw = String(formData.get('fingerprint') ?? '').trim();

  if (!summary) return;

  const signalType = VALID_ABUSE_SIGNAL_TYPES.has(rawSignal as any)
    ? (rawSignal as 'traffic_spike' | 'high_error_rate' | 'credit_burn_spike' | 'shared_ip_farming' | 'manual')
    : 'manual';
  const severity = VALID_ABUSE_SEVERITIES.has(rawSeverity as any)
    ? (rawSeverity as 'low' | 'medium' | 'high' | 'critical')
    : 'medium';

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const userId = uuidRegex.test(userIdRaw) ? userIdRaw : null;
  const apiKeyId = uuidRegex.test(apiKeyIdRaw) ? apiKeyIdRaw : null;
  const fingerprint = fingerprintRaw || `manual:${Date.now()}:${randomCodeSuffix(6)}`;

  const [created] = await db
    .insert(s.abuseCases)
    .values({
      userId,
      apiKeyId,
      signalType,
      severity,
      status: 'open',
      fingerprint,
      summary,
      metadata: { createdByAdminId: admin.id },
    })
    .returning({ id: s.abuseCases.id });

  await audit(admin.id, 'create_abuse_case', 'abuse_case', created!.id, {
    signalType,
    severity,
    userId,
    apiKeyId,
    summary,
  });

  revalidatePath('/admin/abuse');
}

export async function updateAbuseCaseStatus(formData: FormData) {
  const admin = await requireAdminPerm('security:write');
  const id = String(formData.get('id') ?? '').trim();
  const rawStatus = String(formData.get('status') ?? '').trim();
  const resolutionNote = String(formData.get('resolutionNote') ?? '').trim().slice(0, 2000) || null;
  const quickAction = String(formData.get('quickAction') ?? 'none').trim();

  if (!id || !VALID_ABUSE_STATUSES.has(rawStatus as any)) return;
  const status = rawStatus as 'open' | 'investigating' | 'resolved' | 'dismissed';

  const [caseRow] = await db
    .select({
      id: s.abuseCases.id,
      status: s.abuseCases.status,
      userId: s.abuseCases.userId,
      apiKeyId: s.abuseCases.apiKeyId,
    })
    .from(s.abuseCases)
    .where(eq(s.abuseCases.id, id))
    .limit(1);
  if (!caseRow) return;

  const isTerminal = status === 'resolved' || status === 'dismissed';
  const now = new Date();

  await db
    .update(s.abuseCases)
    .set({
      status,
      resolutionNote,
      resolvedBy: isTerminal ? admin.id : null,
      resolvedAt: isTerminal ? now : null,
      updatedAt: now,
    })
    .where(eq(s.abuseCases.id, id));

  let executedQuickAction: string | null = null;

  if (quickAction === 'revoke_key' && caseRow.apiKeyId) {
    await db
      .update(s.apiKeys)
      .set({ status: 'revoked' })
      .where(eq(s.apiKeys.id, caseRow.apiKeyId));
    await audit(admin.id, 'revoke_key', 'api_key', caseRow.apiKeyId, {
      abuseCaseId: id,
    });
    executedQuickAction = 'revoke_key';
    revalidatePath('/admin/api-keys');
  } else if (quickAction === 'suspend_user' && caseRow.userId && caseRow.userId !== admin.id) {
    await db
      .update(s.users)
      .set({ suspended: true, updatedAt: now })
      .where(eq(s.users.id, caseRow.userId));
    await db.delete(s.sessions).where(eq(s.sessions.userId, caseRow.userId));
    await audit(admin.id, 'suspend_user', 'user', caseRow.userId, {
      abuseCaseId: id,
    });
    executedQuickAction = 'suspend_user';
    revalidatePath('/admin/users');
  }

  await audit(admin.id, 'update_abuse_case', 'abuse_case', id, {
    previousStatus: caseRow.status,
    status,
    resolutionNote,
    quickAction: executedQuickAction,
  });

  revalidatePath('/admin/abuse');
}
